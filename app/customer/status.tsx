import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import PlateBadge from "@/components/PlateBadge";
import { useQueue } from "@/context/QueueContext";
import { Ionicons } from "@expo/vector-icons";
import {
    formatClockTime,
    formatCountdown,
    getSessionEndTime,
    getSessionProgress,
    getWaitProgress,
} from "@/lib/eta";

export default function CustomerStatusScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const {
    bays,
    activeSessions,
    waitingEntries,
    queueEntries,
    getQueueEntryById,
    getQueuePosition,
    getEtaForEntry,
  } = useQueue();

  // Forces a re-render every second so countdowns show live seconds.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const entry = id ? getQueueEntryById(id) : undefined;

  if (!entry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Queue entry not found</Text>
          <Text style={styles.emptyText}>
            Please return to registration and search again by plate number.
          </Text>
          <Text
            style={styles.backLink}
            onPress={() => router.replace("/customer")}
          >
            Back to Join Queue
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeSessionByBay = new Map(
    activeSessions.map((session) => [session.bayId, session]),
  );
  const mySession = activeSessions.find(
    (session) => session.queueEntryId === entry.id,
  );
  const myPhase =
    mySession?.startedAt &&
    getSessionProgress(
      mySession.startedAt,
      mySession.graceMinutes,
      mySession.chargingMinutes,
    );
  const queuePosition = getQueuePosition(entry.id);
  const etaSeconds = getEtaForEntry(entry.id);
  const historicalCount = queueEntries.filter(
    (item) => item.status === "completed",
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Hello, {entry.name}</Text>
          <PlateBadge plateNumber={entry.plateNumber} />
          <Text style={styles.heroStatus}>
            Status: {entry.status.toUpperCase()}
          </Text>

          {entry.status === "waiting" && queuePosition ? (
            <>
              <Text style={styles.metricLabel}>Current Position</Text>
              <Text style={styles.metricValue}>#{queuePosition}</Text>
              <Text style={[styles.metricLabel, styles.centeredText]}>
                ETA Start Charging | ETA Start Time:{" "}
                {formatClockTime(new Date(Date.now() + etaSeconds * 1000))}
              </Text>
              <Text style={styles.metricValue}>
                {formatCountdown(etaSeconds)}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    styles.progressFillEta,
                    {
                      width: `${Math.min(
                        Math.max(
                          getWaitProgress(entry.joinedAt, etaSeconds) * 100,
                          0,
                        ),
                        100,
                      )}%`,
                    },
                  ]}
                />
              </View>
            </>
          ) : null}

          {entry.status === "charging" && myPhase ? (
            <>
              <View style={styles.timerRow}>
                {myPhase.phase === "charging" ? (
                  <Ionicons
                    name="hourglass-outline"
                    size={16}
                    color="#C8D7F0"
                  />
                ) : null}
                <Text style={styles.metricLabel}>
                  {myPhase.phase === "grace" ? "Initializing" : "Charging"}
                  {mySession?.startedAt
                    ? ` | Ends at: ${formatClockTime(
                        getSessionEndTime(
                          mySession.startedAt,
                          mySession.plannedDurationMinutes,
                        ),
                      )}`
                    : ""}
                </Text>
              </View>
              <Text style={styles.metricValue}>
                {formatCountdown(myPhase.remainingSeconds)}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    myPhase.phase === "charging"
                      ? styles.progressFillCharging
                      : styles.progressFillGrace,
                    {
                      width: `${Math.min(Math.max(myPhase.progress * 100, 0), 100)}%`,
                    },
                  ]}
                />
              </View>
            </>
          ) : null}

          {entry.gpsOverrideRequested && !entry.gpsOverrideApproved ? (
            <Text style={styles.pendingText}>
              GPS override request is pending SA approval.
            </Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Charging Bays</Text>
          {bays.map((bay) => {
            const activeSession = activeSessionByBay.get(bay.id);
            const chargingEntry = activeSession
              ? queueEntries.find(
                  (item) => item.id === activeSession.queueEntryId,
                )
              : undefined;

            return (
              <View key={bay.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{bay.name}</Text>
                <Text
                  style={
                    bay.status === "available"
                      ? styles.available
                      : styles.occupied
                  }
                >
                  {bay.status.toUpperCase()}
                </Text>
                {activeSession?.startedAt ? (
                  (() => {
                    const { phase, remainingSeconds, progress } =
                      getSessionProgress(
                        activeSession.startedAt,
                        activeSession.graceMinutes,
                        activeSession.chargingMinutes,
                      );
                    const endTime = getSessionEndTime(
                      activeSession.startedAt,
                      activeSession.plannedDurationMinutes,
                    );
                    return (
                      <>
                        <PlateBadge
                          plateNumber={chargingEntry?.plateNumber ?? "Unknown"}
                        />
                        <View style={styles.timerRow}>
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
                  <Text style={styles.rowSub}>Ready for next vehicle</Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Waiting Queue</Text>
          {waitingEntries.length === 0 ? (
            <Text style={styles.rowSub}>No one is waiting right now.</Text>
          ) : null}
          {waitingEntries.map((item, index) => (
            <View key={item.id} style={styles.queueRow}>
              <View style={styles.queueRowLeft}>
                <Text style={styles.queueText}>#{index + 1}</Text>
                <PlateBadge plateNumber={item.plateNumber} />
              </View>
              <Text style={styles.queueEta}>
                {formatCountdown(getEtaForEntry(item.id))}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>System Snapshot</Text>
          <Text style={styles.rowSub}>
            Completed sessions today: {historicalCount}
          </Text>
          <Text style={styles.rowSub}>
            Realtime updates refresh whenever SA actions happen.
          </Text>
        </View>

        <Pressable
          style={{ alignItems: "center", marginTop: 8 }}
          onPress={() => router.push("/")}
        >
          <Text style={styles.linkText}>Back to main page</Text>
        </Pressable>
      </ScrollView>
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
  heroCard: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#F6FAFF",
  },
  heroStatus: {
    color: "#CAE0FF",
    marginBottom: 8,
    fontWeight: "700",
  },
  metricLabel: {
    color: "#C8D7F0",
  },
  centeredText: {
    textAlign: "center",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  metricValue: {
    fontSize: 28,
    color: "#FFF3EB",
    fontWeight: "800",
    marginBottom: 3,
  },
  pendingText: {
    marginTop: 8,
    color: "#FFDCC2",
    fontWeight: "600",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    marginTop: 6,
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
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#F6FAFF",
  },
  rowCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  rowTitle: {
    color: "#EEF5FF",
    fontWeight: "700",
  },
  rowSub: {
    color: "#D1DCF3",
    lineHeight: 19,
  },
  available: {
    color: "#7CFFBA",
    fontWeight: "700",
  },
  occupied: {
    color: "#FFD0A8",
    fontWeight: "700",
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
  queueText: {
    color: "#EEF5FF",
    fontWeight: "600",
  },
  queueEta: {
    color: "#CAE0FF",
    fontWeight: "700",
  },
  emptyCard: {
    margin: 20,
    marginTop: 40,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F6FAFF",
  },
  emptyText: {
    color: "#D1DCF3",
    lineHeight: 20,
  },
  backLink: {
    color: "#CAE0FF",
    fontWeight: "700",
    marginTop: 8,
  },
  linkText: { color: "#C4D2FF", textAlign: "center" },
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
