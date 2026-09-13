import ActivityLogPanel from "@/components/ActivityLogPanel";
import DateField from "@/components/DateField";
import PublicBoardPanel from "@/components/PublicBoardPanel";
import SAQueuePanel from "@/components/SAQueuePanel";
import SessionsChart from "@/components/SessionsChart";
import { useQueue } from "@/context/QueueContext";
import { logActivity } from "@/lib/activityLog";
import { promptForInput, showAlert } from "@/lib/alert";
import { exportRowsToExcel } from "@/lib/exportExcel";
import { SUPABASE_URL, supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  role: string;
  password_plaintext?: string | null;
};

// SA/manager-created entries (addStaffQueueEntry) store the category itself
// as the plate number (INTERNAL/PRIORITY/DELIVERY/SERVICE) since they skip
// the customer join flow entirely — used to exclude them from customer
// history, which only tracks real plate-number check-ins.
const STAFF_PLATE_CATEGORIES = ["INTERNAL", "PRIORITY", "DELIVERY", "SERVICE"];

const CHECKBOX_COLUMN_WIDTH = 40;

const TABLE_COLUMNS = [
  { key: "plateNumber", label: "Plate Number", width: 110 },
  { key: "name", label: "Name", width: 140 },
  { key: "phoneNumber", label: "Phone Number", width: 130 },
  { key: "agreedToTerms", label: "Agree T&C", width: 90 },
  { key: "joinedAt", label: "Queue Join", width: 150 },
  { key: "chargingStart", label: "Charging Start", width: 150 },
  { key: "chargingStop", label: "Charging Stop", width: 150 },
  { key: "actualChargingMinutes", label: "Actual Charging Time (mins)", width: 170 },
  { key: "overtimeMinutes", label: "Over Time (mins)", width: 130 },
  { key: "waitingMinutes", label: "Waiting Time (mins)", width: 150 },
  { key: "bayId", label: "Bay ID", width: 90 },
] as const;

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminDashboard() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const { chargingSessions, bays, queueEntries, deleteQueueEntries } =
    useQueue();

  const [saAccounts, setSaAccounts] = useState<SAAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isManagerSession, setIsManagerSession] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [managerName, setManagerName] = useState("Manager");
  const [tab, setTab] = useState<
    "stats" | "home" | "queue" | "board" | "settings"
  >(
    tabParam === "settings" ||
      tabParam === "stats" ||
      tabParam === "queue" ||
      tabParam === "board"
      ? tabParam
      : "home",
  );
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalAccount, setModalAccount] = useState<SAAccount | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [showSaListModal, setShowSaListModal] = useState(false);
  const [showManagerListModal, setShowManagerListModal] = useState(false);

  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [chartFromDate, setChartFromDate] = useState("");
  const [chartToDate, setChartToDate] = useState("");
  const [downloadingHistory, setDownloadingHistory] = useState(false);
  const [resettingHistory, setResettingHistory] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [deletingSelectedHistory, setDeletingSelectedHistory] =
    useState(false);
  const historyTopScrollRef = useRef<ScrollView>(null);
  const historyBottomScrollRef = useRef<ScrollView>(null);
  const historySyncingRef = useRef<"top" | "bottom" | null>(null);
  const [historyTableWidth, setHistoryTableWidth] = useState(0);

  const [showroomName, setShowroomName] = useState("Main Showroom");
  const [showroomLat, setShowroomLat] = useState("");
  const [showroomLng, setShowroomLng] = useState("");
  const [gpsRadiusM, setGpsRadiusM] = useState("50");
  const [graceMinutes, setGraceMinutes] = useState("5");
  const [chargingMinutes, setChargingMinutes] = useState("60");
  const [gpsTestEnabled, setGpsTestEnabled] = useState(false);
  const [loadingShowroom, setLoadingShowroom] = useState(false);
  const [statsResetAt, setStatsResetAt] = useState<string | null>(null);
  const [resettingStats, setResettingStats] = useState(false);

  const [blockedPlateCount, setBlockedPlateCount] = useState(0);
  const [loadingBlockedPlateCount, setLoadingBlockedPlateCount] =
    useState(false);

  useEffect(() => {
    const verify = async () => {
      setCheckingAuth(true);
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        const role = user?.app_metadata?.role || user?.user_metadata?.role;
        setIsManagerSession(role === "manager" || role === "admin");
        setManagerName(
          user?.user_metadata?.name ||
            user?.email?.split("@")[0] ||
            "Manager",
        );
      } catch {
        setIsManagerSession(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    verify();
    loadAccounts();
    loadShowroom();
    loadBlockedPlateCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      tabParam === "settings" ||
      tabParam === "stats" ||
      tabParam === "queue" ||
      tabParam === "board" ||
      tabParam === "home"
    ) {
      setTab(tabParam);
    }
  }, [tabParam]);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    const { data, error } = await supabase
      .from("sa_users")
      .select("id, name, email, role, password_plaintext")
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
      setGraceMinutes(String(data.grace_minutes ?? 5));
      setChargingMinutes(String(data.charging_minutes ?? 60));
      setGpsTestEnabled(data.gps_test_enabled ?? true);
      setStatsResetAt(data.stats_reset_at ?? null);
    }
    setLoadingShowroom(false);
  };

  const loadBlockedPlateCount = async () => {
    setLoadingBlockedPlateCount(true);
    const { count, error } = await supabase
      .from("blocked_plates")
      .select("id", { count: "exact", head: true });
    if (error) setMessage(error.message);
    setBlockedPlateCount(count ?? 0);
    setLoadingBlockedPlateCount(false);
  };

  const onDeleteSAAccount = async (
    emailOrId: string,
    isManagerAccount = false,
  ) => {
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

    showAlert(
      isManagerAccount ? "Delete Manager" : "Delete SA",
      isManagerAccount
        ? "Confirm manager account deletion?"
        : "Delete selected SA account?",
      [
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

            showAlert(
              "Success",
              isManagerAccount
                ? "Manager account deletion success."
                : "SA account deletion success.",
            );
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

  // "Reset" zeroes the Sessions/Utilization counters by hiding sessions
  // created before the reset point — it never deletes charging_sessions
  // rows, since Customer History still needs the full audit trail. Active
  // (currently charging) is always live and deliberately excluded from the
  // reset filter, since it reflects present bay occupancy, not an
  // accumulating counter.
  const statsSessions = useMemo(() => {
    if (!statsResetAt) return chargingSessions;
    return chargingSessions.filter(
      (s) => +new Date(s.createdAt) > +new Date(statsResetAt),
    );
  }, [chargingSessions, statsResetAt]);

  const totalSessions = statsSessions.length;
  const completed = statsSessions.filter(
    (s) => s.status === "completed",
  ).length;
  const active = chargingSessions.filter((s) => s.status === "active").length;
  const utilization = bays.map((bay) => ({
    bayId: bay.id,
    name: bay.name,
    count: statsSessions.filter((s) => s.bayId === bay.id).length,
  }));

  const chartSessions = useMemo(() => {
    if (!chartFromDate && !chartToDate) return statsSessions;

    const fromTime = chartFromDate
      ? new Date(`${chartFromDate}T00:00:00`).getTime()
      : null;
    const toTime = chartToDate
      ? new Date(`${chartToDate}T23:59:59.999`).getTime()
      : null;

    return statsSessions.filter((s) => {
      const createdTime = +new Date(s.createdAt);
      if (fromTime !== null && createdTime < fromTime) return false;
      if (toTime !== null && createdTime > toTime) return false;
      return true;
    });
  }, [statsSessions, chartFromDate, chartToDate]);

  const handleResetStats = () => {
    if (checkingAuth || !isManagerSession) {
      setMessage("Not authorized to reset stats.");
      return;
    }

    showAlert(
      "Reset counters",
      "This will zero the Sessions and Charger Utilization counters. Charging history and records are not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setResettingStats(true);
            const timestamp = new Date().toISOString();
            const { error } = await supabase
              .from("showroom_settings")
              .update({ stats_reset_at: timestamp })
              .eq("id", "main");

            if (error) {
              setMessage(error.message);
            } else {
              setStatsResetAt(timestamp);
              void logActivity({
                action: "stats.reset",
                targetType: "showroom_settings",
                targetId: "main",
              });
            }
            setResettingStats(false);
          },
        },
      ],
    );
  };

  // Most recent session per queue entry, since a plate normally only ever
  // has one, but staff can in theory retry a session on the same entry.
  const latestSessionByEntryId = useMemo(() => {
    const map = new Map<string, (typeof chargingSessions)[number]>();
    for (const session of chargingSessions) {
      const existing = map.get(session.queueEntryId);
      if (!existing || +new Date(session.createdAt) > +new Date(existing.createdAt)) {
        map.set(session.queueEntryId, session);
      }
    }
    return map;
  }, [chargingSessions]);

  const historyRows = useMemo(() => {
    return queueEntries
      .filter(
        (entry) =>
          entry.status !== "cancelled" &&
          entry.status !== "skipped" &&
          !STAFF_PLATE_CATEGORIES.includes(entry.plateNumber),
      )
      .slice()
      .sort((a, b) => +new Date(b.joinedAt) - +new Date(a.joinedAt))
      .map((entry) => {
        const session = latestSessionByEntryId.get(entry.id);

        const waitingMinutes = session?.startedAt
          ? Math.max(
              0,
              Math.round(
                (+new Date(session.startedAt) - +new Date(entry.joinedAt)) /
                  60000,
              ),
            )
          : null;

        const overtimeMinutes =
          session?.startedAt && session?.endedAt
            ? Math.max(
                0,
                Math.round(
                  (+new Date(session.endedAt) -
                    (+new Date(session.startedAt) +
                      session.plannedDurationMinutes * 60000)) /
                    60000,
                ),
              )
            : null;

        return {
          id: entry.id,
          plateNumber: entry.plateNumber,
          bayId: session?.bayId ?? null,
          name: entry.name,
          phoneNumber: entry.phoneNumber,
          agreedToTerms: entry.agreedToTerms,
          joinedAt: entry.joinedAt,
          chargingStart: session?.startedAt ?? null,
          chargingStop: session?.endedAt ?? null,
          actualChargingMinutes: session?.actualDurationMinutes ?? null,
          overtimeMinutes,
          waitingMinutes,
        };
      });
  }, [queueEntries, latestSessionByEntryId]);

  const filteredHistoryRows = useMemo(() => {
    if (!historyFromDate && !historyToDate) return historyRows;

    const fromTime = historyFromDate
      ? new Date(`${historyFromDate}T00:00:00`).getTime()
      : null;
    const toTime = historyToDate
      ? new Date(`${historyToDate}T23:59:59.999`).getTime()
      : null;

    return historyRows.filter((row) => {
      const joinedTime = +new Date(row.joinedAt);
      if (fromTime !== null && joinedTime < fromTime) return false;
      if (toTime !== null && joinedTime > toTime) return false;
      return true;
    });
  }, [historyRows, historyFromDate, historyToDate]);

  // Drops selected ids that no longer exist (e.g. deleted elsewhere), but
  // keeps the rest even if the date filter changes so selection survives
  // narrowing/widening the range.
  useEffect(() => {
    setSelectedHistoryIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(historyRows.map((r) => r.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [historyRows]);

  const toggleHistorySelection = (id: string) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredHistorySelected =
    filteredHistoryRows.length > 0 &&
    filteredHistoryRows.every((r) => selectedHistoryIds.has(r.id));

  const toggleSelectAllHistory = () => {
    setSelectedHistoryIds(
      allFilteredHistorySelected
        ? new Set()
        : new Set(filteredHistoryRows.map((r) => r.id)),
    );
  };

  const handleDeleteSelectedHistory = () => {
    if (checkingAuth || !isManagerSession) {
      setMessage("Not authorized to delete customer history.");
      return;
    }

    const ids = Array.from(selectedHistoryIds);
    if (ids.length === 0) return;

    showAlert(
      "Delete selected records",
      `This will permanently delete ${ids.length} selected customer record${
        ids.length === 1 ? "" : "s"
      }, along with their charging session data. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingSelectedHistory(true);
            const { error } = await deleteQueueEntries(ids);
            if (error) {
              setMessage(error);
            } else {
              setSelectedHistoryIds(new Set());
            }
            setDeletingSelectedHistory(false);
          },
        },
      ],
    );
  };

  const handleDownloadHistory = async () => {
    setDownloadingHistory(true);
    try {
      const rows = filteredHistoryRows.map((r) => ({
        "Plate Number": r.plateNumber,
        Name: r.name,
        "Phone Number": r.phoneNumber || "-",
        "Agree to T&C": r.agreedToTerms ? "Yes" : "No",
        "Queue Join Timestamp": formatDateTime(r.joinedAt),
        "Charging Start Timestamp": formatDateTime(r.chargingStart),
        "Charging Stop Timestamp": formatDateTime(r.chargingStop),
        "Actual Charging Time (mins)": r.actualChargingMinutes ?? "-",
        "Over Time (mins)": r.overtimeMinutes ?? "-",
        "Waiting Time (mins)": r.waitingMinutes ?? "-",
        "Bay ID": r.bayId ?? "-",
      }));

      await exportRowsToExcel(
        rows,
        "Customer History",
        `customer-history-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } catch (err: any) {
      setMessage(err?.message || "Failed to export customer history.");
    } finally {
      setDownloadingHistory(false);
    }
  };

  const handleResetHistory = () => {
    if (checkingAuth || !isManagerSession) {
      setMessage("Not authorized to reset customer history.");
      return;
    }

    const count = filteredHistoryRows.length;
    if (count === 0) return;

    const rangeText =
      historyFromDate || historyToDate
        ? ` from ${historyFromDate || "the beginning"} to ${
            historyToDate || "now"
          }`
        : " (no date filter applied — this covers all customer history)";

    showAlert(
      "Delete customer history",
      `This will permanently delete ${count} customer record${
        count === 1 ? "" : "s"
      }${rangeText}, along with their charging session data. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setResettingHistory(true);
            const ids = filteredHistoryRows.map((r) => r.id);
            const { error } = await deleteQueueEntries(ids);
            if (error) setMessage(error);
            setResettingHistory(false);
          },
        },
      ],
    );
  };

  const saOnlyAccounts = saAccounts.filter((a) => a.role !== "manager" && a.role !== "admin");
  const managerAccounts = saAccounts.filter((a) => a.role === "manager" || a.role === "admin");

  const renderAccountRow = (
    account: SAAccount,
    isLast: boolean,
    idLabel: string,
    idValue: string,
    subtitle?: string,
  ) => {
    const isManagerAccount =
      account.role === "manager" || account.role === "admin";

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
        {subtitle ? (
          <Text style={styles.accountName}>{subtitle}</Text>
        ) : null}
        <Text style={styles.accountName}>
          {idLabel}: <Text style={styles.accountEmail}>{idValue}</Text>
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={() =>
            setOpenMenuFor(openMenuFor === account.id ? null : account.id)
          }
          style={{ padding: 8 }}
          accessibilityLabel="More actions"
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#F8FBFF" />
        </Pressable>

        {openMenuFor === account.id ? (
          <View style={styles.menu}>
            {isManagerAccount ? null : (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setOpenMenuFor(null);
                  setShowSaListModal(false);
                  setShowManagerListModal(false);
                  setModalAccount(account);
                  setShowPasswordModal(true);
                }}
              >
                <Text style={styles.menuText}>View Password</Text>
              </Pressable>
            )}

            {isManagerAccount ? null : (
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
                      setMessage("Manager session missing. Please Login again.");
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
                          res.error.message || "Function invoke failed",
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
                        throw new Error(`HTTP ${fallback.status}: ${txt}`);
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
                <Text style={styles.menuText}>Reset Password</Text>
              </Pressable>
            )}

            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setOpenMenuFor(null);
                onDeleteSAAccount(account.email, isManagerAccount);
              }}
            >
              <Text style={[styles.menuText, { color: "#FFB3A0" }]}>
                Delete Account
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
    );
  };

  const isSaCredsModal = Boolean(
    modalAccount &&
      modalAccount.role !== "manager" &&
      modalAccount.role !== "admin",
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Manager Dashboard</Text>
            <Text style={styles.greeting}>Hello, {managerName}</Text>
          </View>
          {tab === "home" ? (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push("/")}
                style={styles.logoutButton}
                accessibilityLabel="Home"
              >
                <Ionicons name="home" size={20} color="#F6FAFF" />
              </Pressable>
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
            </View>
          ) : null}
        </View>
      </View>

      {checkingAuth ? <ActivityIndicator color="#D1DCF3" /> : null}

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "stats" && (
          <>
            <View style={[styles.card, styles.statsCard]}>
              <Text style={styles.cardTitle}>Customer History</Text>

              <View style={styles.historyFilterRow}>
                <View style={styles.historyFilterField}>
                  <Text style={styles.historyFilterLabel}>From</Text>
                  <DateField
                    value={historyFromDate}
                    onChange={setHistoryFromDate}
                    placeholder="Any"
                  />
                </View>
                <View style={styles.historyFilterField}>
                  <Text style={styles.historyFilterLabel}>To</Text>
                  <DateField
                    value={historyToDate}
                    onChange={setHistoryToDate}
                    placeholder="Any"
                  />
                </View>
                {historyFromDate || historyToDate ? (
                  <View style={styles.historyFilterField}>
                    <Text style={[styles.historyFilterLabel, styles.historyFilterLabelHidden]}>
                      Clear Filter
                    </Text>
                    <Pressable
                      style={styles.historyClearButton}
                      onPress={() => {
                        setHistoryFromDate("");
                        setHistoryToDate("");
                      }}
                    >
                      <Text style={styles.historyClearButtonText}>
                        Clear Filter
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.historyFilterField}>
                  <Text style={[styles.historyFilterLabel, styles.historyFilterLabelHidden]}>
                    Download
                  </Text>
                  <Pressable
                    style={[
                      styles.settingsRowButton,
                      styles.historyDownloadButton,
                      (downloadingHistory || filteredHistoryRows.length === 0) &&
                        styles.disabledButton,
                    ]}
                    onPress={handleDownloadHistory}
                    disabled={
                      downloadingHistory || filteredHistoryRows.length === 0
                    }
                  >
                    {downloadingHistory ? (
                      <ActivityIndicator color="#F8FBFF" />
                    ) : (
                      <>
                        <Ionicons
                          name="download-outline"
                          size={16}
                          color="#F8FBFF"
                        />
                        <Text style={styles.settingsRowButtonText}>
                          Download Excel
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
                <View style={styles.historyFilterField}>
                  <Text style={[styles.historyFilterLabel, styles.historyFilterLabelHidden]}>
                    Reset
                  </Text>
                  <Pressable
                    style={[
                      styles.historyResetButton,
                      (resettingHistory ||
                        checkingAuth ||
                        !isManagerSession ||
                        filteredHistoryRows.length === 0) &&
                        styles.disabledButton,
                    ]}
                    onPress={handleResetHistory}
                    disabled={
                      resettingHistory ||
                      checkingAuth ||
                      !isManagerSession ||
                      filteredHistoryRows.length === 0
                    }
                  >
                    {resettingHistory ? (
                      <ActivityIndicator color="#FFB3A0" />
                    ) : (
                      <>
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#FFB3A0"
                        />
                        <Text style={styles.resetButtonText}>Reset</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>

              {selectedHistoryIds.size > 0 ? (
                <View style={styles.historySelectionBar}>
                  <Text style={styles.historySelectionText}>
                    {selectedHistoryIds.size} selected
                  </Text>
                  <Pressable
                    style={[
                      styles.historyResetButton,
                      deletingSelectedHistory && styles.disabledButton,
                    ]}
                    onPress={handleDeleteSelectedHistory}
                    disabled={deletingSelectedHistory}
                  >
                    {deletingSelectedHistory ? (
                      <ActivityIndicator color="#FFB3A0" />
                    ) : (
                      <>
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#FFB3A0"
                        />
                        <Text style={styles.resetButtonText}>Delete</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : null}

              {/* Thin top scrollbar mirrors the bottom content scroll so
                  the table is scrollable without hunting for the bottom
                  edge on a long list. */}
              <ScrollView
                horizontal
                ref={historyTopScrollRef}
                showsHorizontalScrollIndicator
                scrollEventThrottle={16}
                style={styles.historyTopScroll}
                contentContainerStyle={styles.historyScrollContent}
                onScroll={(e) => {
                  if (historySyncingRef.current === "bottom") {
                    historySyncingRef.current = null;
                    return;
                  }
                  historySyncingRef.current = "top";
                  historyBottomScrollRef.current?.scrollTo({
                    x: e.nativeEvent.contentOffset.x,
                    animated: false,
                  });
                }}
              >
                <View style={{ width: historyTableWidth, height: 1 }} />
              </ScrollView>

              <ScrollView
                horizontal
                ref={historyBottomScrollRef}
                showsHorizontalScrollIndicator
                scrollEventThrottle={16}
                contentContainerStyle={styles.historyScrollContent}
                onScroll={(e) => {
                  if (historySyncingRef.current === "top") {
                    historySyncingRef.current = null;
                    return;
                  }
                  historySyncingRef.current = "bottom";
                  historyTopScrollRef.current?.scrollTo({
                    x: e.nativeEvent.contentOffset.x,
                    animated: false,
                  });
                }}
              >
                <View
                  onLayout={(e) =>
                    setHistoryTableWidth(e.nativeEvent.layout.width)
                  }
                >
                  <View style={styles.tableHeaderRow}>
                    <Pressable
                      style={[styles.tableCheckboxCell, { width: CHECKBOX_COLUMN_WIDTH }]}
                      onPress={toggleSelectAllHistory}
                      accessibilityLabel="Select all"
                    >
                      <View
                        style={[
                          styles.checkbox,
                          allFilteredHistorySelected && styles.checkboxChecked,
                        ]}
                      >
                        {allFilteredHistorySelected ? (
                          <Ionicons name="checkmark" size={12} color="#F8FBFF" />
                        ) : null}
                      </View>
                    </Pressable>
                    {TABLE_COLUMNS.map((col) => (
                      <Text
                        key={col.key}
                        style={[styles.tableHeaderCell, { width: col.width }]}
                      >
                        {col.label}
                      </Text>
                    ))}
                  </View>
                  {filteredHistoryRows.length === 0 ? (
                    <Text style={[styles.row, { padding: 10 }]}>
                      No queue entries in this range.
                    </Text>
                  ) : (
                    filteredHistoryRows.map((r, idx) => (
                      <View
                        key={r.id}
                        style={[
                          styles.tableRow,
                          idx % 2 === 1 && styles.tableRowAlt,
                        ]}
                      >
                        <Pressable
                          style={[styles.tableCheckboxCell, { width: CHECKBOX_COLUMN_WIDTH }]}
                          onPress={() => toggleHistorySelection(r.id)}
                          accessibilityLabel={`Select ${r.plateNumber}`}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              selectedHistoryIds.has(r.id) &&
                                styles.checkboxChecked,
                            ]}
                          >
                            {selectedHistoryIds.has(r.id) ? (
                              <Ionicons
                                name="checkmark"
                                size={12}
                                color="#F8FBFF"
                              />
                            ) : null}
                          </View>
                        </Pressable>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[0].width }]}>
                          {r.plateNumber}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[1].width }]}>
                          {r.name}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[2].width }]}>
                          {r.phoneNumber || "-"}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[3].width }]}>
                          {r.agreedToTerms ? "Yes" : "No"}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[4].width }]}>
                          {formatDateTime(r.joinedAt)}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[5].width }]}>
                          {formatDateTime(r.chargingStart)}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[6].width }]}>
                          {formatDateTime(r.chargingStop)}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[7].width }]}>
                          {r.actualChargingMinutes ?? "-"}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[8].width }]}>
                          {r.overtimeMinutes ?? "-"}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[9].width }]}>
                          {r.waitingMinutes ?? "-"}
                        </Text>
                        <Text style={[styles.tableCell, { width: TABLE_COLUMNS[10].width }]}>
                          {r.bayId ?? "-"}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            </View>

            <View style={[styles.card, styles.statsCard]}>
              <Text style={styles.cardTitle}>Sessions Over Time</Text>

              <View style={styles.historyFilterRow}>
                <View style={styles.historyFilterField}>
                  <Text style={styles.historyFilterLabel}>From</Text>
                  <DateField
                    value={chartFromDate}
                    onChange={setChartFromDate}
                    placeholder="Any"
                  />
                </View>
                <View style={styles.historyFilterField}>
                  <Text style={styles.historyFilterLabel}>To</Text>
                  <DateField
                    value={chartToDate}
                    onChange={setChartToDate}
                    placeholder="Any"
                  />
                </View>
                {chartFromDate || chartToDate ? (
                  <View style={styles.historyFilterField}>
                    <Text style={[styles.historyFilterLabel, styles.historyFilterLabelHidden]}>
                      Clear Filter
                    </Text>
                    <Pressable
                      style={styles.historyClearButton}
                      onPress={() => {
                        setChartFromDate("");
                        setChartToDate("");
                      }}
                    >
                      <Text style={styles.historyClearButtonText}>
                        Clear Filter
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <SessionsChart bays={bays} sessions={chartSessions} />
            </View>

            <View style={[styles.card, styles.statsCard]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Sessions</Text>
                <Pressable
                  style={[
                    styles.resetButton,
                    (resettingStats || checkingAuth || !isManagerSession) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleResetStats}
                  disabled={resettingStats || checkingAuth || !isManagerSession}
                >
                  <Text style={styles.resetButtonText}>Reset</Text>
                </Pressable>
              </View>
              <Text style={styles.row}>Total: {totalSessions}</Text>
              <Text style={styles.row}>Active: {active}</Text>
              <Text style={styles.row}>Completed: {completed}</Text>
            </View>

            <View style={[styles.card, styles.statsCard]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Charger Utilization</Text>
                <Pressable
                  style={[
                    styles.resetButton,
                    (resettingStats || checkingAuth || !isManagerSession) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleResetStats}
                  disabled={resettingStats || checkingAuth || !isManagerSession}
                >
                  <Text style={styles.resetButtonText}>Reset</Text>
                </Pressable>
              </View>
              {utilization.map((u) => (
                <View key={u.bayId} style={styles.rowWrap}>
                  <Text style={styles.row}>{u.name}</Text>
                  <Text style={styles.row}>{u.count} sessions</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {tab === "home" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activity Log</Text>
              <ActivityLogPanel />
            </View>

            <Pressable
              style={{ alignItems: "center", marginTop: 8 }}
              onPress={() => router.push("/")}
            >
              <Text style={styles.linkText}>Back to main page</Text>
            </Pressable>
          </>
        )}

        {tab === "queue" && (
          <SAQueuePanel saName={managerName} role="manager" embedded />
        )}

        {tab === "board" && <PublicBoardPanel embedded />}

        {tab === "settings" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Settings</Text>

              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <Text style={styles.settingsRowTitle}>
                    SA Account Management
                  </Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {loadingAccounts
                      ? "Loading…"
                      : `${saOnlyAccounts.length} account${saOnlyAccounts.length === 1 ? "" : "s"}`}
                  </Text>
                </View>
                <Pressable
                  style={styles.settingsRowButton}
                  onPress={() => setShowSaListModal(true)}
                  disabled={checkingAuth || !isManagerSession}
                >
                  <Text style={styles.settingsRowButtonText}>Manage</Text>
                </Pressable>
              </View>

              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <Text style={styles.settingsRowTitle}>
                    Manager Account Management
                  </Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {loadingAccounts
                      ? "Loading…"
                      : `${managerAccounts.length} account${managerAccounts.length === 1 ? "" : "s"}`}
                  </Text>
                </View>
                <Pressable
                  style={styles.settingsRowButton}
                  onPress={() => setShowManagerListModal(true)}
                  disabled={checkingAuth || !isManagerSession}
                >
                  <Text style={styles.settingsRowButtonText}>Manage</Text>
                </Pressable>
              </View>

              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <Text style={styles.settingsRowTitle}>
                    Blocked Plate Numbers
                  </Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {loadingBlockedPlateCount
                      ? "Loading…"
                      : `${blockedPlateCount} plate${blockedPlateCount === 1 ? "" : "s"} blocked`}
                  </Text>
                </View>
                <Pressable
                  style={styles.settingsRowButton}
                  onPress={() => router.push("/admin/settings/blocked-plates")}
                  disabled={checkingAuth || !isManagerSession}
                >
                  <Text style={styles.settingsRowButtonText}>Manage</Text>
                </Pressable>
              </View>

              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <Text style={styles.settingsRowTitle}>Charging Bays</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {bays.length} bay{bays.length === 1 ? "" : "s"} •{" "}
                    {bays.filter((b) => b.enabled).length} enabled
                  </Text>
                </View>
                <Pressable
                  style={styles.settingsRowButton}
                  onPress={() => router.push("/admin/settings/bays")}
                  disabled={checkingAuth || !isManagerSession}
                >
                  <Text style={styles.settingsRowButtonText}>Manage</Text>
                </Pressable>
              </View>

              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <Text style={styles.settingsRowTitle}>Operating Hours</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    Hours, cutoff, and public holidays.
                  </Text>
                </View>
                <Pressable
                  style={styles.settingsRowButton}
                  onPress={() => router.push("/admin/settings/operating-hours")}
                  disabled={checkingAuth || !isManagerSession}
                >
                  <Text style={styles.settingsRowButtonText}>Manage</Text>
                </Pressable>
              </View>

              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <Text style={styles.settingsRowTitle}>
                    Terms & Conditions
                  </Text>
                  <Text style={styles.settingsRowSubtitle}>
                    Shown on the Join Queue screen.
                  </Text>
                </View>
                <Pressable
                  style={styles.settingsRowButton}
                  onPress={() => router.push("/admin/settings/terms")}
                  disabled={checkingAuth || !isManagerSession}
                >
                  <Text style={styles.settingsRowButtonText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.settingsRow}>
                <View style={styles.settingsRowLeft}>
                  <Text style={styles.settingsRowTitle}>
                    Showroom Settings
                  </Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {loadingShowroom
                      ? "Loading…"
                      : `${showroomName} • Radius ${gpsRadiusM}m`}
                  </Text>
                </View>
                <Pressable
                  style={styles.settingsRowButton}
                  onPress={() => router.push("/admin/settings/showroom")}
                  disabled={checkingAuth || !isManagerSession}
                >
                  <Text style={styles.settingsRowButtonText}>Edit</Text>
                </Pressable>
              </View>

              <View style={[styles.settingsRow, styles.settingsRowLast]}>
                <View style={styles.settingsRowLeft}>
                  <Text style={styles.settingsRowTitle}>
                    Customer GPS Test (Developer Mode)
                  </Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {gpsTestEnabled ? "Enabled" : "Disabled"}
                  </Text>
                </View>
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
                    } else {
                      void logActivity({
                        action: "showroom_settings.toggle_gps_test",
                        targetType: "showroom_settings",
                        targetId: "main",
                        details: { enabled: v },
                      });
                    }
                  }}
                  disabled={checkingAuth || !isManagerSession}
                />
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
          <View
            style={[
              styles.modalContainer,
              isSaCredsModal ? styles.modalContainerSaCreds : null,
            ]}
          >
            <Text
              style={[styles.modalTitle, isSaCredsModal && styles.modalTextDark]}
            >
              {modalAccount?.role === "manager" || modalAccount?.role === "admin"
                ? "Manager Credentials"
                : "SA Credentials"}
            </Text>
            <Text style={styles.modalLine} selectable>
              <Text
                style={[
                  styles.modalLabelInline,
                  isSaCredsModal && styles.modalTextDark,
                ]}
              >
                {modalAccount?.role === "manager" || modalAccount?.role === "admin"
                  ? "Manager Email: "
                  : "SA ID: "}
              </Text>
              <Text
                style={[
                  styles.modalValueInline,
                  isSaCredsModal && styles.modalTextDark,
                ]}
              >
                {modalAccount
                  ? modalAccount.role === "manager" || modalAccount.role === "admin"
                    ? modalAccount.email
                    : modalAccount.email.split("@")[0]
                  : "—"}
              </Text>
            </Text>

            <Text style={styles.modalLine} selectable>
              <Text
                style={[
                  styles.modalLabelInline,
                  isSaCredsModal && styles.modalTextDark,
                ]}
              >
                Password:{" "}
              </Text>
              <Text
                style={[
                  styles.modalValueInline,
                  isSaCredsModal && styles.modalTextDark,
                ]}
              >
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
                  const isManagerAccount =
                    modalAccount?.role === "manager" ||
                    modalAccount?.role === "admin";
                  const idLabel = isManagerAccount ? "Manager Email" : "SA ID";
                  const saId = isManagerAccount
                    ? modalAccount?.email ?? ""
                    : modalAccount?.email.split("@")[0] ?? "";
                  const pw = modalAccount?.password_plaintext ?? "";
                  const textToCopy =
                    saId || pw ? `${idLabel}: ${saId}\nPassword: ${pw}` : "";

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
                <Ionicons
                  name="copy"
                  size={18}
                  color={isSaCredsModal ? "#0B1F33" : "#F8FBFF"}
                />
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
                <Text
                  style={[
                    styles.buttonText,
                    { color: isSaCredsModal ? "#0B1F33" : "#C4D2FF" },
                  ]}
                >
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

      <Modal
        visible={showSaListModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.modalContainerSa]}>
            <Text style={styles.modalTitle}>SA Account Management</Text>

            <Text style={styles.listHeading}>Active SA Accounts</Text>
            <View style={styles.listWrapper}>
              {loadingAccounts ? (
                <ActivityIndicator color="#D1DCF3" />
              ) : saOnlyAccounts.length === 0 ? (
                <Text style={styles.row}>No SA accounts found.</Text>
              ) : (
                saOnlyAccounts.map((account, idx) =>
                  renderAccountRow(
                    account,
                    idx === saOnlyAccounts.length - 1,
                    "SA ID",
                    (account.email || account.name || account.id).split(
                      "@",
                    )[0],
                  ),
                )
              )}
            </View>

            <Pressable
              style={[styles.primaryButton, { marginTop: 12 }]}
              onPress={() => {
                setShowSaListModal(false);
                router.push("/admin/settings/create-sa");
              }}
              disabled={checkingAuth || !isManagerSession}
            >
              <Text style={styles.buttonText}>Create SA Account</Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, { marginTop: 8 }]}
              onPress={() => setShowSaListModal(false)}
            >
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showManagerListModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManagerListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Manager Account Management</Text>

            <Text style={styles.listHeading}>Active Manager Accounts</Text>
            <View style={styles.listWrapper}>
              {loadingAccounts ? (
                <ActivityIndicator color="#D1DCF3" />
              ) : managerAccounts.length === 0 ? (
                <Text style={styles.row}>No manager accounts found.</Text>
              ) : (
                managerAccounts.map((account, idx) =>
                  renderAccountRow(
                    account,
                    idx === managerAccounts.length - 1,
                    "Manager Email",
                    account.email,
                    account.name && account.name !== account.email
                      ? account.name
                      : undefined,
                  ),
                )
              )}
            </View>

            <Pressable
              style={[styles.primaryButton, { marginTop: 12 }]}
              onPress={() => {
                setShowManagerListModal(false);
                router.push("/admin/settings/create-manager");
              }}
              disabled={checkingAuth || !isManagerSession}
            >
              <Text style={styles.buttonText}>Create Manager Account</Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, { marginTop: 8 }]}
              onPress={() => setShowManagerListModal(false)}
            >
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
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
        <Pressable onPress={() => setTab("queue")} style={styles.tabButton}>
          <Ionicons
            name="flash"
            size={28}
            color={tab === "queue" ? "#F6FAFF" : "#9FB0CD"}
          />
        </Pressable>
        <Pressable onPress={() => setTab("board")} style={styles.tabButton}>
          <Ionicons
            name="grid"
            size={26}
            color={tab === "board" ? "#F6FAFF" : "#9FB0CD"}
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
  greeting: {
    color: "#C4D2FF",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  statsCard: {
    maxWidth: "100%",
    alignSelf: "stretch",
  },
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
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  resetButton: {
    backgroundColor: "rgba(255, 107, 107, 0.16)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resetButtonText: { color: "#FFB3A0", fontWeight: "700", fontSize: 12 },
  historyResetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 107, 107, 0.16)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  historySelectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 107, 107, 0.08)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  historySelectionText: { color: "#FFD0C4", fontWeight: "600", fontSize: 13 },
  tableCheckboxCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxChecked: {
    backgroundColor: "rgba(132, 158, 255, 0.5)",
    borderColor: "rgba(196,210,255,0.5)",
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
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryButtonText: { color: "#C4D2FF", fontWeight: "700" },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  settingsRowLast: {
    borderBottomWidth: 0,
  },
  settingsRowLeft: { flex: 1 },
  settingsRowTitle: { color: "#F4F8FF", fontWeight: "700" },
  settingsRowSubtitle: { color: "#9FB0CD", fontSize: 12, marginTop: 2 },
  settingsRowButton: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  settingsRowButtonText: { color: "#F8FBFF", fontWeight: "700", fontSize: 13 },
  disabledButton: { opacity: 0.5 },
  listHeading: { color: "#E0EBFF", fontWeight: "700", marginBottom: 8 },
  historyFilterRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  historyFilterField: { minWidth: 140 },
  historyFilterLabel: {
    color: "#9FB0CD",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  historyFilterLabelHidden: { opacity: 0 },
  historyClearButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  historyClearButtonText: { color: "#C4D2FF", fontWeight: "600", fontSize: 13 },
  historyDownloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  historyTopScroll: { height: 14, marginBottom: 2 },
  historyScrollContent: { flexGrow: 1, justifyContent: "center" },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.16)",
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableHeaderCell: {
    color: "#C4D3EE",
    fontWeight: "700",
    fontSize: 12,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  tableRowAlt: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tableCell: {
    color: "#EAF2FF",
    fontSize: 12,
    paddingHorizontal: 6,
  },
  message: { color: "#FFD0A8", marginTop: 8, textAlign: "center" },
  linkText: { color: "#C4D2FF", textAlign: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
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
    paddingHorizontal: 12,
  },
  tabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
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
  modalContainerSa: {
    backgroundColor: "rgba(20, 40, 34, 0.98)",
  },
  modalContainerSaCreds: {
    backgroundColor: "#9FD3FF",
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
  modalTextDark: { color: "#0B1F33" },
});
