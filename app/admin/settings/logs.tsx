import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

type ActivityLogRow = {
  id: string;
  actor_role: "customer" | "sa" | "manager" | "system";
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const ROLE_FILTERS = ["all", "customer", "sa", "manager"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

const ROLE_LABEL: Record<ActivityLogRow["actor_role"], string> = {
  customer: "Customer",
  sa: "SA",
  manager: "Manager",
  system: "System",
};

const ROLE_COLOR: Record<ActivityLogRow["actor_role"], string> = {
  customer: "#7CFFBA",
  sa: "#F2C94C",
  manager: "#849EFF",
  system: "#9FB0CD",
};

function formatAction(action: string): string {
  return action
    .split(".")
    .join(" · ")
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDetails(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  const parts = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const PAGE_SIZE = 50;

export default function ActivityLogScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const load = async (filter: RoleFilter) => {
    setLoading(true);
    setMessage(null);

    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (filter !== "all") {
      query = query.eq("actor_role", filter);
    }

    const { data, error } = await query;

    if (error) setMessage(error.message);
    setLogs((data as ActivityLogRow[]) || []);
    setHasMore((data?.length ?? 0) === PAGE_SIZE);
    setLoading(false);
  };

  const loadMore = async () => {
    if (logs.length === 0) return;

    setLoadingMore(true);
    const oldest = logs[logs.length - 1].created_at;

    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .lt("created_at", oldest)
      .limit(PAGE_SIZE);

    if (roleFilter !== "all") {
      query = query.eq("actor_role", roleFilter);
    }

    const { data, error } = await query;

    if (error) {
      setMessage(error.message);
    } else {
      setLogs((prev) => [...prev, ...((data as ActivityLogRow[]) || [])]);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    void load(roleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Activity Log</Text>
          <Text style={styles.subtitle}>
            Every customer, SA, and manager action, most recent first.
          </Text>

          <View style={styles.filterRow}>
            {ROLE_FILTERS.map((filter) => (
              <Pressable
                key={filter}
                style={[
                  styles.filterChip,
                  roleFilter === filter && styles.filterChipSelected,
                ]}
                onPress={() => setRoleFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    roleFilter === filter && styles.filterChipTextSelected,
                  ]}
                >
                  {filter === "all" ? "All" : ROLE_LABEL[filter]}
                </Text>
              </Pressable>
            ))}
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color="#D1DCF3" />
          ) : logs.length === 0 ? (
            <Text style={styles.row}>No activity recorded yet.</Text>
          ) : (
            <View style={styles.listWrapper}>
              {logs.map((log, idx) => {
                const detailsText = formatDetails(log.details);
                return (
                  <View
                    key={log.id}
                    style={[
                      styles.logRow,
                      idx !== logs.length - 1 && styles.logDivider,
                    ]}
                  >
                    <View style={styles.logHeaderRow}>
                      <View
                        style={[
                          styles.roleBadge,
                          { backgroundColor: `${ROLE_COLOR[log.actor_role]}22` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleBadgeText,
                            { color: ROLE_COLOR[log.actor_role] },
                          ]}
                        >
                          {ROLE_LABEL[log.actor_role]}
                        </Text>
                      </View>
                      <Text style={styles.logTimestamp}>
                        {formatTimestamp(log.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.logAction}>
                      {formatAction(log.action)}
                      {log.actor_name ? (
                        <Text style={styles.logActor}> — {log.actor_name}</Text>
                      ) : null}
                    </Text>
                    {detailsText ? (
                      <Text style={styles.logDetails} numberOfLines={3}>
                        {detailsText}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          {!loading && hasMore ? (
            <Pressable
              style={styles.loadMoreButton}
              onPress={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator color="#D1DCF3" />
              ) : (
                <Text style={styles.loadMoreButtonText}>Load More</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        style={{ alignItems: "center", marginTop: 12, marginBottom: 12 }}
        onPress={() => router.back()}
      >
        <Text style={styles.linkText}>Back to Settings</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070D1A" },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    borderRadius: 12,
  },
  title: { fontSize: 20, color: "#F6FAFF", fontWeight: "700" },
  subtitle: { color: "#9FB0CD", marginBottom: 12, lineHeight: 18 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  filterChipSelected: {
    backgroundColor: "rgba(132, 158, 255, 0.35)",
  },
  filterChipText: {
    color: "#C4D3EE",
    fontWeight: "600",
    fontSize: 12,
  },
  filterChipTextSelected: { color: "#F8FBFF" },
  message: { color: "#FFD0A8", marginTop: 8 },
  linkText: { color: "#C4D2FF", textAlign: "center" },
  row: { color: "#D1DCF3", paddingVertical: 10 },
  listWrapper: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  logRow: { paddingVertical: 10 },
  logDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  logHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  roleBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  roleBadgeText: { fontWeight: "700", fontSize: 11 },
  logTimestamp: { color: "#7E8EA8", fontSize: 11 },
  logAction: { color: "#F4F8FF", fontWeight: "600", fontSize: 13 },
  logActor: { color: "#B9CBE6", fontWeight: "400" },
  logDetails: { color: "#9FB0CD", fontSize: 12, marginTop: 2 },
  loadMoreButton: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(132, 158, 255, 0.2)",
  },
  loadMoreButtonText: { color: "#F8FBFF", fontWeight: "700" },
});
