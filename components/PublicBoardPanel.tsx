import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import ChargerCarVisual from "@/components/ChargerCarVisual";
import PlateBadge from "@/components/PlateBadge";
import { useQueue } from "@/context/QueueContext";
import {
    formatClockTime,
    formatCountdown,
    getSessionEndTime,
    getSessionProgress,
    getWaitProgress,
} from "@/lib/eta";
import {
    evaluateSchedule,
    fetchOperatingHours,
    fetchUpcomingHolidays,
    OperatingHoursRow,
    PublicHoliday,
} from "@/lib/operatingHours";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  /**
   * When true the panel renders without its own SafeAreaView / background
   * glows / ScrollView / back link, so it can be embedded inside another
   * screen's tab content (e.g. the SA or manager dashboard).
   */
  embedded?: boolean;
  /**
   * Shows "Join Queue" / "Track Queue" links, for when customers reach the
   * board from the customer landing page rather than staff viewing it from
   * a dashboard tab.
   */
  showCustomerActions?: boolean;
};

export default function PublicBoardPanel({
  embedded = false,
  showCustomerActions = false,
}: Props) {
  const {
    bays,
    queueEntries,
    activeSessions,
    waitingEntries,
    getEtaForEntry,
    getEtaForPosition,
    rainMode,
  } = useQueue();

  // Forces a re-render every second so live countdowns stay accurate.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const [hoursRows, setHoursRows] = useState<OperatingHoursRow[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const [rows, holidayRows] = await Promise.all([
          fetchOperatingHours(),
          fetchUpcomingHolidays(),
        ]);
        setHoursRows(rows);
        setHolidays(holidayRows);
      } catch {
        // Best-effort: if operating hours aren't configured yet, show the
        // board as always-open rather than blocking it.
      }
    };

    void loadSchedule();

    // Supabase caches channels by name; a fixed name can collide with a
    // stale, already-subscribed channel left over from a fast refresh /
    // double-mount, and calling .on() on that would throw. A unique name
    // per mount avoids the collision entirely.
    const channel = supabase
      .channel(`public:operating_hours_board:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operating_hours" },
        () => void loadSchedule(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "public_holidays" },
        () => void loadSchedule(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const scheduleEval = useMemo(() => {
    if (hoursRows.length === 0) return null;
    return evaluateSchedule(hoursRows, holidays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoursRows, holidays, tick]);

  const isShowroomOpen = scheduleEval ? scheduleEval.isWithinOperatingHours : true;
  const canRegister = scheduleEval ? scheduleEval.canRegister : true;

  const activeSessionByBay = new Map(
    activeSessions.map((session) => [session.bayId, session]),
  );

  const estimatedWaitSeconds = (() => {
    try {
      const position = waitingEntries.length + 1;
      return getEtaForPosition(position);
    } catch {
      return null;
    }
  })();

  const estimatedWait = rainMode
    ? "∞"
    : estimatedWaitSeconds === null
      ? "--"
      : formatCountdown(estimatedWaitSeconds);
  const estimatedStart =
    rainMode || estimatedWaitSeconds === null
      ? "--"
      : formatClockTime(new Date(Date.now() + estimatedWaitSeconds * 1000));

  const body = (
    <>
      {embedded ? null : <Text style={styles.heading}>Live Queue Board</Text>}

      <Text style={[styles.subheading, styles.etaBadge]}>
        Estimated wait: {estimatedWait}
        {estimatedStart !== "--"
          ? ` (Start charging at ${estimatedStart})`
          : ""}
      </Text>

      {rainMode ? (
        <View style={styles.statusBannerRain}>
          <Ionicons name="thunderstorm-outline" size={16} color="#9FD3FF" />
          <Text style={styles.statusBannerTextRain}>
            Heavy rain — for safety reasons, all queuing charging
            are unable to start at the moment.
          </Text>
        </View>
      ) : null}

      {!isShowroomOpen ? (
        <View style={styles.statusBannerClosed}>
          <Ionicons name="lock-closed-outline" size={16} color="#FF9B8A" />
          <Text style={styles.statusBannerTextClosed}>
            Showroom is closed. No new queue is allowed.
          </Text>
        </View>
      ) : !canRegister ? (
        <View style={styles.statusBannerWarning}>
          <Ionicons name="time-outline" size={16} color="#FFD0A8" />
          <Text style={styles.statusBannerTextWarning}>
            Showroom is closing soon. No new queue is allowed.
          </Text>
        </View>
      ) : null}

      <View style={[styles.sectionCard, styles.sectionCardBays]}>
        <Text style={styles.sectionTitle}>Charging Bays</Text>
        {bays.map((bay) => {
          const activeSession = activeSessionByBay.get(bay.id);
          const chargingEntry = activeSession
            ? queueEntries.find(
                (item) => item.id === activeSession.queueEntryId,
              )
            : undefined;

          const isActive = Boolean(activeSession?.startedAt);
          const phaseInfo = activeSession?.startedAt
            ? getSessionProgress(
                activeSession.startedAt,
                activeSession.graceMinutes,
                activeSession.chargingMinutes,
              )
            : null;

          // A bay that's idle after closing time isn't accepting new
          // vehicles, even though it's technically enabled and free —
          // show it as unavailable rather than available.
          const isUnavailableAfterHours =
            bay.enabled && bay.status === "available" && !isShowroomOpen && !isActive;

          return (
            <View key={bay.id} style={styles.rowCard}>
              <View style={styles.bayHeaderRow}>
                <Text style={styles.rowTitle}>{bay.name}</Text>
                <Text
                  style={
                    !bay.enabled
                      ? styles.bayDisabled
                      : isUnavailableAfterHours
                        ? styles.bayUnavailable
                        : bay.status === "available"
                          ? styles.available
                          : styles.occupied
                  }
                >
                  {!bay.enabled
                    ? "DISABLED"
                    : isUnavailableAfterHours
                      ? "UNAVAILABLE"
                      : bay.status.toUpperCase()}
                </Text>
              </View>

              <ChargerCarVisual
                active={isActive}
                colorAccent={
                  phaseInfo?.phase === "charging" ? "#3CE685" : "#FFD0A8"
                }
                disabled={!bay.enabled}
                raining={rainMode}
              />

              {activeSession?.startedAt && phaseInfo ? (
                (() => {
                  const { phase, remainingSeconds, progress } = phaseInfo;
                  const endTime = getSessionEndTime(
                    activeSession.startedAt!,
                    activeSession.plannedDurationMinutes,
                  );
                  return (
                    <>
                      <PlateBadge
                        plateNumber={chargingEntry?.plateNumber ?? "Unknown"}
                      />
                      <View style={[styles.timerRow, styles.statusLineActive]}>
                        {phase === "charging" ? (
                          <Ionicons
                            name="hourglass-outline"
                            size={14}
                            color="#D1DCF3"
                          />
                        ) : null}
                        <Text style={styles.rowSub}>
                          {phase === "charging"
                            ? "Charging"
                            : "Initializing"}
                          : {formatCountdown(remainingSeconds)} | Ends at:{" "}
                          {formatClockTime(endTime)}
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            phase === "charging"
                              ? styles.progressFillCharging
                              : styles.progressFillGrace,
                            {
                              width: `${Math.min(Math.max(progress * 100, 0), 100)}%`,
                            },
                          ]}
                        />
                      </View>
                    </>
                  );
                })()
              ) : (
                <Text
                  style={[
                    styles.rowSub,
                    styles.rowSubCentered,
                    !bay.enabled
                      ? styles.statusLineDisabled
                      : rainMode
                        ? styles.statusLineClosed
                        : isUnavailableAfterHours
                          ? styles.statusLineClosed
                          : styles.statusLineReady,
                  ]}
                >
                  {!bay.enabled
                    ? bay.disabledReason || "Unspecified"
                    : rainMode
                      ? "Unable to start charging at the moment."
                      : isUnavailableAfterHours
                        ? "Operation Off"
                        : "Ready for next vehicle"}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={[styles.sectionCard, styles.sectionCardQueue]}>
        <Text style={styles.sectionTitle}>Waiting Queue</Text>
        {waitingEntries.length === 0 ? (
          <Text style={styles.rowSub}>No one is waiting right now.</Text>
        ) : null}
        {waitingEntries.map((item, index) => {
          const etaSeconds = getEtaForEntry(item.id);
          const progress = getWaitProgress(item.joinedAt, etaSeconds);
          return (
            <View key={item.id} style={styles.queueRow}>
              <View style={styles.queueRowLeft}>
                <Text style={styles.queueText}>#{index + 1}</Text>
                <PlateBadge plateNumber={item.plateNumber} />
              </View>
              <View style={styles.queueRowRight}>
                <Text style={styles.queueEta}>
                  {rainMode ? "∞" : formatCountdown(etaSeconds)}
                </Text>
                {rainMode ? null : (
                  <View style={styles.miniProgressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        styles.progressFillEta,
                        {
                          width: `${Math.min(Math.max(progress * 100, 0), 100)}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {showCustomerActions ? (
        <View style={styles.customerActionsRow}>
          <Link href="/customer/join" asChild>
            <Pressable style={styles.customerActionButton}>
              <Text style={styles.customerActionButtonText}>Join Queue</Text>
            </Pressable>
          </Link>
          <Link href="/customer/track" asChild>
            <Pressable style={styles.customerActionButton}>
              <Ionicons
                name="search"
                size={14}
                color="#EAF2FF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.customerActionButtonText}>Track Queue</Text>
            </Pressable>
          </Link>
          <Link href="/customer" asChild>
            <Pressable style={styles.customerActionButton}>
              <Text style={styles.customerActionButtonText}>
                Back to main page
              </Text>
            </Pressable>
          </Link>
        </View>
      ) : null}
    </>
  );

  if (embedded) {
    return <View style={styles.embedded}>{body}</View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
  },
  content: {
    padding: 18,
    gap: 14,
    paddingBottom: 28,
  },
  embedded: {
    gap: 14,
  },
  heading: {
    fontSize: 27,
    fontWeight: "800",
    color: "#F4F8FF",
    textAlign: "center",
  },
  subheading: {
    color: "#C4D3EE",
    marginBottom: 4,
    textAlign: "center",
  },
  etaBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  customerActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  customerActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  customerActionButtonText: {
    color: "#EAF2FF",
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  sectionCardBays: {
    backgroundColor: "rgba(124, 255, 186, 0.10)",
  },
  sectionCardQueue: {
    backgroundColor: "rgba(255, 208, 168, 0.12)",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#F6FAFF",
    textAlign: "center",
  },
  rowCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  bayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowTitle: {
    color: "#EEF5FF",
    fontWeight: "700",
  },
  rowSub: {
    color: "#D1DCF3",
    lineHeight: 19,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  available: {
    color: "#7CFFBA",
    fontWeight: "700",
  },
  occupied: {
    color: "#FFD0A8",
    fontWeight: "700",
  },
  bayDisabled: {
    color: "#FF9B8A",
    fontWeight: "700",
  },
  rowSubCentered: {
    textAlign: "center",
    width: "100%",
  },
  statusLineActive: {
    backgroundColor: "rgba(255, 208, 90, 0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusLineDisabled: {
    backgroundColor: "rgba(255, 90, 90, 0.16)",
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusLineReady: {
    backgroundColor: "rgba(124, 255, 186, 0.16)",
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusLineClosed: {
    backgroundColor: "rgba(255, 90, 90, 0.16)",
    paddingVertical: 6,
    borderRadius: 8,
  },
  bayUnavailable: {
    color: "#9FB0CD",
    fontWeight: "700",
  },
  statusBannerClosed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "rgba(255, 155, 138, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statusBannerTextClosed: {
    color: "#FF9B8A",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  statusBannerRain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "rgba(159, 211, 255, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statusBannerTextRain: {
    color: "#9FD3FF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  statusBannerWarning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "rgba(255, 208, 168, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statusBannerTextWarning: {
    color: "#FFD0A8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    marginTop: 6,
  },
  miniProgressTrack: {
    height: 6,
    width: 90,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressFillCharging: {
    backgroundColor: "#3CE685",
  },
  progressFillGrace: {
    backgroundColor: "#FFD0A8",
  },
  progressFillEta: {
    backgroundColor: "#F2C94C",
  },
  queueRow: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  queueRowRight: {
    alignItems: "flex-end",
  },
  queueText: {
    color: "#EEF5FF",
    fontWeight: "600",
  },
  queueEta: {
    color: "#CAE0FF",
    fontWeight: "700",
  },
  bgGlowOne: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#39A0ED",
    opacity: 0.16,
    top: -80,
    right: -70,
  },
  bgGlowTwo: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: "#F26419",
    opacity: 0.14,
    bottom: -120,
    left: -90,
  },
});
