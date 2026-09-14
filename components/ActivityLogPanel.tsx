import DateField from "@/components/DateField";
import { showAlert } from "@/lib/alert";
import { exportRowsToPdf } from "@/lib/exportPdf";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
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

type Props = {
  /** Shows the role filter chips and "Load More" pagination. */
  showFilters?: boolean;
  /** Shows the date filter, PDF export, and clear-log controls (manager only). */
  canManage?: boolean;
};

// Applies the role chip + date range filters shared by the live list, the
// PDF export, and the clear-log delete — keeping all three in sync so
// "export"/"clear" always act on exactly what's on screen.
function applyFilters(
  query: any,
  roleFilter: RoleFilter,
  fromDate: string,
  toDate: string,
) {
  // Always true for real rows (id is a not-null primary key) — PostgREST
  // rejects a DELETE with zero filters as a safety guard, so a "clear
  // everything" request (no role/date filter set) still needs one.
  let q = query.not("id", "is", null);
  if (roleFilter !== "all") q = q.eq("actor_role", roleFilter);
  if (fromDate) q = q.gte("created_at", `${fromDate}T00:00:00.000Z`);
  if (toDate) q = q.lte("created_at", `${toDate}T23:59:59.999Z`);
  return q;
}

export default function ActivityLogPanel({
  showFilters = true,
  canManage = false,
}: Props) {
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = async (filter: RoleFilter, from: string, to: string) => {
    setLoading(true);
    setMessage(null);

    const query = applyFilters(
      supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE),
      filter,
      from,
      to,
    );

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

    const query = applyFilters(
      supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .lt("created_at", oldest)
        .limit(PAGE_SIZE),
      roleFilter,
      fromDate,
      toDate,
    );

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
    void load(roleFilter, fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, fromDate, toDate]);

  // Fetches every row matching the current filters (not just the loaded
  // page) so export/clear act on the full filtered set, not what happens to
  // be on screen.
  const fetchAllFiltered = async (): Promise<ActivityLogRow[] | null> => {
    const query = applyFilters(
      supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false }),
      roleFilter,
      fromDate,
      toDate,
    );
    const { data, error } = await query;
    if (error) {
      setMessage(error.message);
      return null;
    }
    return (data as ActivityLogRow[]) || [];
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setMessage(null);
    try {
      const rows = await fetchAllFiltered();
      if (!rows) return;
      if (rows.length === 0) {
        setMessage("No activity to export for this filter.");
        return;
      }

      await exportRowsToPdf(
        "Activity Log",
        ["Timestamp", "Role", "Actor", "Action", "Target", "Details"],
        rows.map((log) => [
          formatTimestamp(log.created_at),
          ROLE_LABEL[log.actor_role],
          log.actor_name || "-",
          formatAction(log.action),
          [log.target_type, log.target_id].filter(Boolean).join(" · ") || "-",
          formatDetails(log.details) || "-",
        ]),
        `activity-log-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err: any) {
      setMessage(err?.message || "Failed to export activity log.");
    } finally {
      setDownloading(false);
    }
  };

  const handleClearLog = () => {
    const rangeText =
      fromDate || toDate
        ? ` from ${fromDate || "the beginning"} to ${toDate || "now"}`
        : " (no date filter applied — this clears the entire log)";
    const roleText = roleFilter !== "all" ? ` for ${ROLE_LABEL[roleFilter]}` : "";

    showAlert(
      "Clear activity log",
      `This will permanently delete all logged activity${roleText}${rangeText}. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            setMessage(null);
            try {
              const query = applyFilters(
                supabase.from("activity_logs").delete(),
                roleFilter,
                fromDate,
                toDate,
              );
              const { error } = await query;
              if (error) {
                setMessage(error.message);
              } else {
                await load(roleFilter, fromDate, toDate);
              }
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  };

  // Live-append new log rows as they're written, instead of requiring a
  // manual refresh. Supabase caches channels by name; a unique suffix per
  // mount avoids colliding with a stale channel left over from a fast
  // refresh / double-mount.
  useEffect(() => {
    const channel = supabase
      .channel(`public:activity_logs:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        (payload) => {
          const row = payload.new as ActivityLogRow;
          if (roleFilter !== "all" && row.actor_role !== roleFilter) return;
          if (toDate && row.created_at > `${toDate}T23:59:59.999Z`) return;
          setLogs((prev) =>
            prev.some((log) => log.id === row.id) ? prev : [row, ...prev],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roleFilter, toDate]);

  return (
    <>
      {showFilters ? (
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
      ) : null}

      {canManage ? (
        <View style={styles.manageBlock}>
          <View style={styles.dateFilterRow}>
            <View style={styles.dateFilterField}>
              <Text style={styles.historyFilterLabel}>From</Text>
              <DateField value={fromDate} onChange={setFromDate} placeholder="Any" />
            </View>
            <View style={styles.dateFilterField}>
              <Text style={styles.historyFilterLabel}>To</Text>
              <DateField value={toDate} onChange={setToDate} placeholder="Any" />
            </View>
            {fromDate || toDate ? (
              <View style={styles.dateFilterField}>
                <Text style={[styles.historyFilterLabel, styles.historyFilterLabelHidden]}>
                  Clear Filter
                </Text>
                <Pressable
                  style={styles.filterClearButton}
                  onPress={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                >
                  <Text style={styles.filterClearButtonText}>Clear Filter</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.manageButtonRow}>
            <Pressable
              style={[
                styles.manageButton,
                (downloading || logs.length === 0) && styles.manageButtonDisabled,
              ]}
              onPress={handleDownloadPdf}
              disabled={downloading || logs.length === 0}
            >
              {downloading ? (
                <ActivityIndicator color="#F8FBFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={16} color="#F8FBFF" />
                  <Text style={styles.manageButtonText}>Download PDF</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.clearButton,
                (clearing || logs.length === 0) && styles.manageButtonDisabled,
              ]}
              onPress={handleClearLog}
              disabled={clearing || logs.length === 0}
            >
              {clearing ? (
                <ActivityIndicator color="#FFB3A0" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color="#FFB3A0" />
                  <Text style={styles.clearButtonText}>Clear Log</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

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

      {showFilters && !loading && hasMore ? (
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
    </>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
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
  manageBlock: { marginBottom: 8 },
  dateFilterRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  dateFilterField: { minWidth: 130 },
  historyFilterLabel: {
    color: "#9FB0CD",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  historyFilterLabelHidden: { opacity: 0 },
  filterClearButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  filterClearButtonText: { color: "#C4D2FF", fontWeight: "600", fontSize: 13 },
  manageButtonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  manageButtonText: { color: "#F8FBFF", fontWeight: "700", fontSize: 13 },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 107, 107, 0.16)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  clearButtonText: { color: "#FFB3A0", fontWeight: "700", fontSize: 13 },
  manageButtonDisabled: { opacity: 0.5 },
  message: { color: "#FFD0A8", marginTop: 8 },
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
