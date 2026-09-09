import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";

export default function PublicBoardScreen() {
  const router = useRouter();
  const { bays, queueEntries, activeSessions, waitingEntries, getEtaForEntry } =
    useQueue();

  // Forces a re-render every second so live countdowns stay accurate.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeSessionByBay = new Map(
    activeSessions.map((session) => [session.bayId, session]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Live Queue Board</Text>
        <Text style={styles.subheading}>
          Charging bay status and current waiting queue.
        </Text>

        <View style={styles.sectionCard}>
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

            return (
              <View key={bay.id} style={styles.rowCard}>
                <View style={styles.bayHeaderRow}>
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
                </View>

                <ChargerCarVisual
                  active={isActive}
                  colorAccent={
                    phaseInfo?.phase === "charging" ? "#3CE685" : "#FFD0A8"
                  }
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
                    {formatCountdown(etaSeconds)}
                  </Text>
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
                </View>
              </View>
            );
          })}
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
  heading: {
    fontSize: 27,
    fontWeight: "800",
    color: "#F4F8FF",
  },
  subheading: {
    color: "#C4D3EE",
    marginBottom: 4,
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
