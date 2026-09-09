import { useQueue } from "@/context/QueueContext";
import { promptForInput, showAlert } from "@/lib/alert";
import { SUPABASE_URL, supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

type SAAccount = {
  id: string;
  name: string;
  email: string;
  password_plaintext?: string | null;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const { chargingSessions, bays } = useQueue();

  const [saAccounts, setSaAccounts] = useState<SAAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isManagerSession, setIsManagerSession] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"stats" | "home" | "settings">(
    tabParam === "settings" || tabParam === "stats" ? tabParam : "home",
  );
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalAccount, setModalAccount] = useState<SAAccount | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);

  const [showroomName, setShowroomName] = useState("Main Showroom");
  const [showroomLat, setShowroomLat] = useState("");
  const [showroomLng, setShowroomLng] = useState("");
  const [gpsRadiusM, setGpsRadiusM] = useState("50");
  const [gpsTestEnabled, setGpsTestEnabled] = useState(false);
  const [loadingShowroom, setLoadingShowroom] = useState(false);

  useEffect(() => {
    const verify = async () => {
      setCheckingAuth(true);
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        const role = user?.app_metadata?.role || user?.user_metadata?.role;
        setIsManagerSession(role === "manager" || role === "admin");
      } catch {
        setIsManagerSession(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    verify();
    loadAccounts();
    loadShowroom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tabParam === "settings" || tabParam === "stats" || tabParam === "home") {
      setTab(tabParam);
    }
  }, [tabParam]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    const { data, error } = await supabase
      .from("sa_users")
      .select("id, name, email, password_plaintext")
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    setSaAccounts((data as SAAccount[]) || []);
    setLoadingAccounts(false);
  };

  const loadShowroom = async () => {
    setLoadingShowroom(true);
    const { data, error } = await supabase
      .from("showroom_settings")
      .select("*")
      .eq("id", "main")
      .maybeSingle();

    if (error) setMessage(error.message);

    if (data) {
      setShowroomName(data.showroom_name || "Main Showroom");
      setShowroomLat(String(data.latitude ?? ""));
      setShowroomLng(String(data.longitude ?? ""));
      setGpsRadiusM(String(data.gps_radius_m ?? 50));
      setGpsTestEnabled(data.gps_test_enabled ?? true);
    }
    setLoadingShowroom(false);
  };

  const onDeleteSAAccount = async (emailOrId: string) => {
    if (checkingAuth) {
      showAlert("Please wait", "Checking authorization. Try again shortly.");
      return;
    }
    if (!isManagerSession) {
      showAlert(
        "Not authorized",
        "You must be signed in as a manager to delete SA accounts.",
        [
          { text: "OK", style: "cancel" },
          { text: "Sign in", onPress: () => router.push("/admin/login") },
        ],
      );
      return;
    }

    showAlert("Delete SA", "Delete selected SA account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const email = emailOrId.includes("@")
              ? emailOrId
              : `${emailOrId}@sa.internal`;

            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
              setMessage("Manager session missing. Please Login again.");
              return;
            }

            const payload = { email };

            const res = await supabase.functions.invoke(
              "delete-sa-account",
              {
                body: payload,
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              },
            );

            if (res.error) {
              const host = new URL(SUPABASE_URL).host;
              const projectRef = host.split(".")[0];
              const fnUrl = projectRef
                ? `https://${projectRef}.functions.supabase.co/delete-sa-account`
                : null;
              if (!fnUrl)
                throw new Error(res.error.message || "Function invoke failed");

              const fallback = await fetch(fnUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(payload),
              });

              if (!fallback.ok) {
                const txt = await fallback.text();
                throw new Error(`HTTP ${fallback.status}: ${txt}`);
              }
            }

            showAlert("Success", "SA account deletion success.");
            await loadAccounts();
          } catch (err: any) {
            setMessage(
              err?.message ||
                "Failed to delete SA account. Ensure delete function is deployed.",
            );
          }
        },
      },
    ]);
  };

  const totalSessions = chargingSessions.length;
  const completed = chargingSessions.filter(
    (s) => s.status === "completed",
  ).length;
  const active = chargingSessions.filter((s) => s.status === "active").length;
  const utilization = bays.map((bay) => ({
    bayId: bay.id,
    name: bay.name,
    count: chargingSessions.filter((s) => s.bayId === bay.id).length,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Manager Dashboard</Text>
          {tab === "home" ? (
            <Pressable
              onPress={async () => {
                try {
                  await supabase.auth.signOut();
                } catch {
                  // ignore
                }
                router.replace("/admin/login");
              }}
              style={styles.logoutButton}
              accessibilityLabel="Logout"
            >
              <Ionicons name="log-out" size={20} color="#F6FAFF" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {checkingAuth ? <ActivityIndicator color="#D1DCF3" /> : null}

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "stats" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>History (latest 12)</Text>
            {chargingSessions
              .slice()
              .reverse()
              .slice(0, 12)
              .map((s) => (
                <View key={s.id} style={styles.rowWrap}>
                  <Text style={styles.row}>
                    {s.saName} - {s.bayId}
                  </Text>
                  <Text style={styles.row}>{s.status}</Text>
                </View>
              ))}
          </View>
        )}

        {tab === "home" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sessions</Text>
              <Text style={styles.row}>Total: {totalSessions}</Text>
              <Text style={styles.row}>Active: {active}</Text>
              <Text style={styles.row}>Completed: {completed}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Charger Utilization</Text>
              {utilization.map((u) => (
                <View key={u.bayId} style={styles.rowWrap}>
                  <Text style={styles.row}>{u.name}</Text>
                  <Text style={styles.row}>{u.count} sessions</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={{ alignItems: "center", marginTop: 8 }}
              onPress={() => router.push("/")}
            >
              <Text style={styles.linkText}>Back to main page</Text>
            </Pressable>
          </>
        )}

        {tab === "settings" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>SA Account Management</Text>

              <Text style={styles.listHeading}>Active SA Accounts</Text>
              <View style={styles.listWrapper}>
                {loadingAccounts ? (
                  <ActivityIndicator color="#D1DCF3" />
                ) : saAccounts.length === 0 ? (
                  <Text style={styles.row}>No SA accounts found.</Text>
                ) : (
                  saAccounts.map((account, idx) => {
                    const isLast = idx === saAccounts.length - 1;
                    const saId = (
                      account.email ||
                      account.name ||
                      account.id
                    ).split("@")[0];
                    return (
                      <View
                        key={account.id}
                        style={[
                          styles.accountRow,
                          styles.rowWrap,
                          !isLast && styles.accountDivider,
                        ]}
                      >
                        <View>
                          <Text style={styles.accountName}>
                            SA ID:{" "}
                            <Text style={styles.accountEmail}>{saId}</Text>
                          </Text>
                        </View>
                        <View
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          <Pressable
                            onPress={() =>
                              setOpenMenuFor(
                                openMenuFor === account.id ? null : account.id,
                              )
                            }
                            style={{ padding: 8 }}
                            accessibilityLabel="More actions"
                          >
                            <Ionicons
                              name="ellipsis-vertical"
                              size={20}
                              color="#F8FBFF"
                            />
                          </Pressable>

                          {openMenuFor === account.id ? (
                            <View style={styles.menu}>
                              <Pressable
                                style={styles.menuItem}
                                onPress={() => {
                                  setOpenMenuFor(null);
                                  setModalAccount(account);
                                  setShowPasswordModal(true);
                                }}
                              >
                                <Text style={styles.menuText}>
                                  View Password
                                </Text>
                              </Pressable>

                              <Pressable
                                style={styles.menuItem}
                                onPress={async () => {
                                  setOpenMenuFor(null);
                                  const newPass = await promptForInput(
                                    `Reset password for ${account.email}`,
                                    "Enter new password",
                                  );
                                  if (!newPass) return;

                                  try {
                                    const {
                                      data: { session },
                                    } = await supabase.auth.getSession();

                                    if (!session?.access_token) {
                                      setMessage(
                                        "Manager session missing. Please Login again.",
                                      );
                                      return;
                                    }

                                    const payload = {
                                      email: account.email,
                                      password: newPass,
                                    };

                                    const res = await supabase.functions.invoke(
                                      "reset-sa-password",
                                      {
                                        body: payload,
                                        headers: {
                                          Authorization: `Bearer ${session.access_token}`,
                                        },
                                      },
                                    );

                                    if (res.error) {
                                      const host = new URL(SUPABASE_URL).host;
                                      const projectRef = host.split(".")[0];
                                      const fnUrl = projectRef
                                        ? `https://${projectRef}.functions.supabase.co/reset-sa-password`
                                        : null;
                                      if (!fnUrl)
                                        throw new Error(
                                          res.error.message ||
                                            "Function invoke failed",
                                        );

                                      const fallback = await fetch(fnUrl, {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                          Authorization: `Bearer ${session.access_token}`,
                                        },
                                        body: JSON.stringify(payload),
                                      });

                                      if (!fallback.ok) {
                                        const txt = await fallback.text();
                                        throw new Error(
                                          `HTTP ${fallback.status}: ${txt}`,
                                        );
                                      }
                                    }

                                    setMessage("Password reset.");
                                    await loadAccounts();
                                  } catch (err: any) {
                                    setMessage(
                                      err?.message ||
                                        "Failed to reset password. Ensure reset function is deployed.",
                                    );
                                  }
                                }}
                              >
                                <Text style={styles.menuText}>
                                  Reset Password
                                </Text>
                              </Pressable>

                              <Pressable
                                style={styles.menuItem}
                                onPress={() => {
                                  setOpenMenuFor(null);
                                  onDeleteSAAccount(account.email);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.menuText,
                                    { color: "#FFB3A0" },
                                  ]}
                                >
                                  Delete Account
                                </Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              <Pressable
                style={[styles.primaryButton, { marginTop: 12 }]}
                onPress={() => router.push("/admin/settings/create-sa")}
                disabled={checkingAuth || !isManagerSession}
              >
                <Text style={styles.buttonText}>Create SA Account</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Showroom Settings</Text>
              {loadingShowroom ? (
                <ActivityIndicator color="#D1DCF3" />
              ) : (
                <>
                  <Text style={styles.row}>Name: {showroomName}</Text>
                  <Text style={styles.rowMuted}>
                    Lat: {showroomLat || "—"} • Lng: {showroomLng || "—"}
                  </Text>
                  <Text style={styles.rowMuted}>Radius: {gpsRadiusM} m</Text>
                </>
              )}

              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push("/admin/settings/showroom")}
                disabled={checkingAuth || !isManagerSession}
              >
                <Text style={styles.buttonText}>Edit Showroom Settings</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Customer GPS Test (Developer Mode)
              </Text>
              <Text style={styles.rowMuted}>
                Toggle whether customers can use the GPS test UI in the Join
                Queue page.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <Switch
                  value={gpsTestEnabled}
                  onValueChange={async (v) => {
                    if (checkingAuth || !isManagerSession) {
                      setMessage("Not authorized to change this setting.");
                      return;
                    }
                    const previous = gpsTestEnabled;
                    setGpsTestEnabled(v);
                    const { error } = await supabase
                      .from("showroom_settings")
                      .update({ gps_test_enabled: v })
                      .eq("id", "main");
                    if (error) {
                      setGpsTestEnabled(previous);
                      setMessage(error.message);
                    }
                  }}
                  disabled={checkingAuth || !isManagerSession}
                />
                <Text style={{ color: "#D1DCF3", marginLeft: 8 }}>
                  {gpsTestEnabled ? "Enabled" : "Disabled"}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>SA Credentials</Text>
            <Text style={styles.modalLine} selectable>
              <Text style={styles.modalLabelInline}>SA ID: </Text>
              <Text style={styles.modalValueInline}>
                {modalAccount ? modalAccount.email.split("@")[0] : "—"}
              </Text>
            </Text>

            <Text style={styles.modalLine} selectable>
              <Text style={styles.modalLabelInline}>Password: </Text>
              <Text style={styles.modalValueInline}>
                {modalAccount?.password_plaintext ||
                  "Not available — use Reset Password."}
              </Text>
            </Text>

            <View style={{ flexDirection: "row", marginTop: 18 }}>
              <Pressable
                style={[
                  styles.primaryButton,
                  {
                    flex: 1,
                    marginRight: 8,
                    paddingVertical: 8,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
                accessibilityLabel="Copy credentials"
                onPress={async () => {
                  const saId = modalAccount?.email.split("@")[0] ?? "";
                  const pw = modalAccount?.password_plaintext ?? "";
                  const textToCopy =
                    saId || pw ? `SA ID: ${saId}\nPassword: ${pw}` : "";

                  try {
                    if (
                      typeof navigator !== "undefined" &&
                      (navigator as any).clipboard?.writeText
                    ) {
                      await (navigator as any).clipboard.writeText(textToCopy);
                      setModalMessage("Credentials copied to clipboard.");
                    } else if (Platform.OS !== "web") {
                      // On native, try using the legacy clipboard API if available
                      // This may be a no-op if no clipboard module is installed.
                      try {
                        // @ts-ignore
                        const { Clipboard } = require("react-native");
                        // @ts-ignore
                        Clipboard.setString && Clipboard.setString(textToCopy);
                        setModalMessage("Credentials copied to clipboard.");
                      } catch {
                        setModalMessage("Copy not available on this platform.");
                      }
                    } else {
                      // Fallback for older browsers
                      const el = document.createElement("textarea");
                      el.value = textToCopy;
                      document.body.appendChild(el);
                      el.select();
                      document.execCommand("copy");
                      document.body.removeChild(el);
                      setModalMessage("Credentials copied to clipboard.");
                    }
                  } catch (err) {
                    setModalMessage("Failed to copy credentials.");
                  }
                }}
              >
                <Ionicons name="copy" size={18} color="#F8FBFF" />
              </Pressable>

              <Pressable
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: "transparent",
                    borderWidth: 0,
                    borderColor: "transparent",
                    flex: 1,
                  },
                ]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setModalAccount(null);
                  setModalMessage(null);
                }}
              >
                <Text style={[styles.buttonText, { color: "#C4D2FF" }]}>
                  Close
                </Text>
              </Pressable>
            </View>
            {modalMessage ? (
              <Text style={[styles.message, { marginTop: 12 }]}>
                {modalMessage}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <View style={styles.tabBar}>
        <Pressable onPress={() => setTab("stats")} style={styles.tabButton}>
          <Ionicons
            name="bar-chart"
            size={28}
            color={tab === "stats" ? "#F6FAFF" : "#9FB0CD"}
          />
        </Pressable>
        <Pressable onPress={() => setTab("home")} style={styles.tabButton}>
          <Ionicons
            name="home"
            size={30}
            color={tab === "home" ? "#F6FAFF" : "#9FB0CD"}
          />
        </Pressable>
        <Pressable onPress={() => setTab("settings")} style={styles.tabButton}>
          <Ionicons
            name="settings"
            size={28}
            color={tab === "settings" ? "#F6FAFF" : "#9FB0CD"}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070D1A" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: { padding: 16, paddingBottom: 96 },
  heading: { fontSize: 20, color: "#F6FAFF", fontWeight: "700" },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    marginBottom: 12,
  },
  cardTitle: {
    color: "#F6FAFF",
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  row: { color: "#D1DCF3" },
  rowMuted: { color: "#9FB0CD" },
  rowWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  primaryButton: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  buttonText: { color: "#F8FBFF", fontWeight: "700" },
  listHeading: { color: "#E0EBFF", fontWeight: "700", marginBottom: 8 },
  message: { color: "#FFD0A8", marginTop: 8, textAlign: "center" },
  linkText: { color: "#C4D2FF", textAlign: "center" },
  logoutButton: { padding: 8 },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    height: 64,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  tabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  menu: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginLeft: 8,
    minWidth: 140,
  },
  menuItem: { paddingVertical: 8 },
  menuText: { color: "#F6FAFF" },
  accountRow: {
    paddingVertical: 10,
  },
  accountDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  accountName: { color: "#F4F8FF", fontWeight: "600" },
  accountEmail: { color: "#B9CBE6" },
  listWrapper: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "86%",
    maxWidth: 480,
    backgroundColor: "rgba(12,16,26,0.98)",
    borderRadius: 12,
    padding: 18,
    borderWidth: 0,
    borderColor: "transparent",
  },
  modalTitle: {
    color: "#F6FAFF",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  modalLabel: { color: "#CFE0FF", fontWeight: "600", marginTop: 8 },
  modalValue: { color: "#EAF2FF", fontSize: 15, marginTop: 4 },
  modalLine: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  modalLabelInline: { color: "#CFE0FF", fontWeight: "700" },
  modalValueInline: { color: "#EAF2FF", fontSize: 15 },
});
