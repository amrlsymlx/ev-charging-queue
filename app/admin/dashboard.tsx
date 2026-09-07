import { useQueue } from "@/context/QueueContext";
import { formatMinutes } from "@/lib/eta";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

type SAAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
};

export default function AdminDashboard() {
  const { adminEmail = "Manager" } = useLocalSearchParams<{
    adminEmail?: string;
  }>();
  const { chargingSessions, bays } = useQueue();

  const [saAccounts, setSaAccounts] = useState<SAAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const router = useRouter();

  const [showroomName, setShowroomName] = useState("Main Showroom");
  const [showroomLat, setShowroomLat] = useState("");
  const [showroomLng, setShowroomLng] = useState("");
  const [gpsRadiusM, setGpsRadiusM] = useState("50");
  const [savingShowroom, setSavingShowroom] = useState(false);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isManagerSession, setIsManagerSession] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"stats" | "home" | "settings">("home");

  const totalSessions = chargingSessions.length;
  const completed = chargingSessions.filter(
    (s) => s.status === "completed",
  ).length;
  const active = chargingSessions.filter((s) => s.status === "active").length;

  const utilization = bays.map((bay) => {
    const count = chargingSessions.filter((s) => s.bayId === bay.id).length;
    return { bayId: bay.id, name: bay.name, count };
  });

  const isManagerUser = (user: any) => {
    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    return role === "manager" || role === "admin";
  };

  const verifyManagerSession = async () => {
    setCheckingAuth(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setIsManagerSession(false);
      } else {
        setIsManagerSession(isManagerUser(data.user));
      }
    } catch (err) {
      setIsManagerSession(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    const { data, error } = await supabase
      .from("sa_users")
      .select("id, name, email, role, created_at")
      .in("role", ["sa", "admin"])
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoadingAccounts(false);
      return;
    }

    setSaAccounts((data as SAAccount[]) || []);
    setLoadingAccounts(false);
  };

  const loadShowroom = async () => {
    const { data, error } = await supabase
      .from("showroom_settings")
      .select("showroom_name, latitude, longitude, gps_radius_m")
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data) {
      setShowroomName(data.showroom_name || "Main Showroom");
      setShowroomLat(String(data.latitude ?? ""));
      setShowroomLng(String(data.longitude ?? ""));
      setGpsRadiusM(String(data.gps_radius_m ?? 50));
    }
  };

  useEffect(() => {
    verifyManagerSession();
    loadAccounts();
    loadShowroom();
  }, []);

  // creation moved to dedicated settings pages

  const onDeleteSAAccount = async (emailOrId: string) => {
    Alert.alert("Delete SA", "Delete selected SA account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSavingAccount(true);
          try {
            // try RPC first (if configured)
            const email = emailOrId.includes("@")
              ? emailOrId
              : `${emailOrId}@sa.internal`;
            const { error: rpcErr } = await supabase.rpc("delete_sa_account", {
              sa_email: email,
            });
            if (rpcErr) {
              // fallback: remove from sa_users table
              const { error } = await supabase
                .from("sa_users")
                .delete()
                .eq("email", email);
              if (error) throw error;
            }

            setMessage("SA account deleted.");
            await loadAccounts();
          } catch (err: any) {
            setMessage(err?.message || "Failed to delete SA account.");
          } finally {
            setSavingAccount(false);
          }
        },
      },
    ]);
  };

  // showroom editing moved to dedicated settings page

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Manager Dashboard</Text>
        <Text style={styles.subheading}>Welcome, {adminEmail}.</Text>
      </View>

      {checkingAuth ? <ActivityIndicator color="#D1DCF3" /> : null}

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "stats" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>History (latest 12)</Text>
              {chargingSessions
                .slice()
                .reverse()
                .slice(0, 12)
                .map((s) => (
                  <View key={s.id} style={styles.rowWrap}>
                    <Text style={styles.row}>
                      {s.saName} — {s.bayId}
                    </Text>
                    <Text style={styles.row}>
                      {s.status}{" "}
                      {s.startedAt
                        ? `• ${formatMinutes(s.plannedDurationMinutes)}`
                        : ""}
                    </Text>
                  </View>
                ))}
            </View>
          </>
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
          </>
        )}

        {tab === "settings" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>SA Account Management</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push("/admin/settings/create-sa")}
                disabled={checkingAuth || !isManagerSession}
              >
                <Text style={styles.buttonText}>Create SA Account</Text>
              </Pressable>

              <Text style={styles.listHeading}>Active SA Accounts</Text>
              {loadingAccounts ? (
                <ActivityIndicator color="#D1DCF3" />
              ) : saAccounts.length === 0 ? (
                <Text style={styles.row}>No SA accounts found.</Text>
              ) : (
                saAccounts.map((account) => (
                  <View key={account.id} style={styles.rowWrap}>
                    <View>
                      <Text style={styles.row}>{account.name}</Text>
                      <Text style={styles.rowMuted}>{account.email}</Text>
                    </View>
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => onDeleteSAAccount(account.email)}
                      disabled={
                        savingAccount || checkingAuth || !isManagerSession
                      }
                    >
                      <Text style={styles.buttonText}>Delete</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Showroom Settings</Text>
              <Text style={styles.row}>Name: {showroomName}</Text>
              <Text style={styles.rowMuted}>
                Lat: {showroomLat || "—"} • Lng: {showroomLng || "—"}
              </Text>
              <Text style={styles.rowMuted}>Radius: {gpsRadiusM} m</Text>

              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push("/admin/settings/showroom")}
                disabled={checkingAuth || !isManagerSession}
              >
                <Text style={styles.buttonText}>Edit Showroom Settings</Text>
              </Pressable>
            </View>
          </>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>

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
  content: { padding: 16, paddingBottom: 96 },
  heading: { fontSize: 20, color: "#F6FAFF", fontWeight: "700" },
  subheading: { color: "#9FB0CD", marginTop: 4 },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: { color: "#F6FAFF", fontWeight: "700", marginBottom: 6 },
  row: { color: "#D1DCF3" },
  rowMuted: { color: "#9FB0CD" },
  rowWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#F4F8FF",
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(196, 210, 255, 0.32)",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: "rgba(242,100,25,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,208,168,0.34)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  buttonText: { color: "#F8FBFF", fontWeight: "700" },
  listHeading: { color: "#E0EBFF", fontWeight: "700", marginBottom: 8 },
  message: { color: "#FFD0A8", marginTop: 8, textAlign: "center" },
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
});
