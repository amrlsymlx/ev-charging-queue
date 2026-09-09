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

import BatteryIndicator from "@/components/BatteryIndicator";
import ContactBadge from "@/components/ContactBadge";
import PlateBadge from "@/components/PlateBadge";
import { useQueue } from "@/context/QueueContext";
import {
    formatClockTime,
    formatCountdown,
    getSessionEndTime,
    getSessionProgress,
    getWaitProgress,
} from "@/lib/eta";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";

export default function SADashboardScreen() {
  const router = useRouter();
  const { saName = "SA" } = useLocalSearchParams<{
    saName?: string;
    role?: string;
  }>();
  const {
    bays,
    queueEntries,
    waitingEntries,
    activeSessions,
    pendingOverrideEntries,
    getEtaForEntry,
    startCharging,
    endCharging,
    skipQueueEntry,
    removeQueueEntry,
    approveOverride,
    rejectOverride,
  } = useQueue();

  // Forces a re-render every second so bay countdowns show live seconds.
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
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Dashboard</Text>
          <Pressable
            onPress={async () => {
              try {
                await supabase.auth.signOut();
              } catch {
                // ignore
              }
              router.replace("/sa/login");
            }}
            style={styles.logoutButton}
            accessibilityLabel="Logout"
          >
            <Ionicons name="log-out" size={20} color="#F4F8FF" />
          </Pressable>
        </View>
        <Text style={styles.subheading}>
          Welcome, {saName}. Live queue and bay control.
        </Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Charging Bays</Text>
          {bays.map((bay) => {
            const activeSession = activeSessionByBay.get(bay.id);
            const activeEntry = activeSession
              ? queueEntries.find(
                  (entry) => entry.id === activeSession.queueEntryId,
                )
              : undefined;

            return (
              <View key={bay.id} style={styles.bayCard}>
                <Text style={styles.bayTitle}>{bay.name}</Text>
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
                  <>
                    <PlateBadge plateNumber={activeEntry?.plateNumber ?? "N/A"} />
                    <View style={styles.contactBatteryRow}>
                      <ContactBadge
                        phoneNumber={activeEntry?.phoneNumber ?? ""}
                        name={activeEntry?.name ?? "N/A"}
                      />
                      <BatteryIndicator
                        percentage={activeEntry?.batteryPercentage ?? 0}
                      />
                    </View>
                    {(() => {
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
                          <View style={styles.timerRow}>
                            {phase === "charging" ? (
                              <Ionicons
                                name="hourglass-outline"
                                size={14}
                                color="#D1DCF3"
                              />
                            ) : null}
                            <Text style={styles.bayMeta}>
                              {phase === "charging"
                                ? "Charging"
                                : phase === "grace"
                                  ? "Initializing"
                                  : "Session complete"}
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
                                { width: `${Math.min(Math.max(progress * 100, 0), 100)}%` },
                              ]}
                            />
                          </View>
                        </>
                      );
                    })()}
                    <Pressable
                      style={styles.endButton}
                      onPress={() => {
                        void endCharging(activeSession.id);
                      }}
                    >
                      <Text style={styles.endButtonText}>End Charging</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.bayMeta}>Ready for next customer</Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Waiting Queue</Text>
          {waitingEntries.length === 0 ? (
            <Text style={styles.bayMeta}>No active waiting queue.</Text>
          ) : null}

          {waitingEntries.map((entry, index) => {
            const bayOne = bays.find((bay) => bay.id === "bay-1");
            const bayTwo = bays.find((bay) => bay.id === "bay-2");

            return (
              <View key={entry.id} style={styles.queueCard}>
                <Text style={styles.queueIndexBadge}>#{index + 1}</Text>
                <PlateBadge plateNumber={entry.plateNumber} />
                <View style={styles.contactBatteryRow}>
                  <ContactBadge
                    phoneNumber={entry.phoneNumber}
                    name={entry.name}
                  />
                  <BatteryIndicator percentage={entry.batteryPercentage} />
                </View>
                {(() => {
                  const etaSeconds = getEtaForEntry(entry.id);
                  const startTime = new Date(Date.now() + etaSeconds * 1000);
                  const progress = getWaitProgress(entry.joinedAt, etaSeconds);
                  return (
                    <>
                      <Text style={[styles.bayMeta, styles.centeredText]}>
                        ETA Start Charging: {formatCountdown(etaSeconds)} |
                        ETA Start Time: {formatClockTime(startTime)}
                      </Text>
                      <View style={styles.progressTrack}>
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
                    </>
                  );
                })()}

                <View style={styles.actionRow}>
                  <Pressable
                    style={
                      bayOne?.status !== "available"
                        ? styles.startButtonDisabled
                        : styles.startButtonAction
                    }
                    disabled={bayOne?.status !== "available"}
                    onPress={() => {
                      void startCharging(entry.id, "bay-1", String(saName));
                    }}
                  >
                    <Text style={styles.actionButtonText}>Start Bay 1</Text>
                  </Pressable>
                  <Pressable
                    style={
                      bayTwo?.status !== "available"
                        ? styles.startButtonDisabled
                        : styles.startButtonAction
                    }
                    disabled={bayTwo?.status !== "available"}
                    onPress={() => {
                      void startCharging(entry.id, "bay-2", String(saName));
                    }}
                  >
                    <Text style={styles.actionButtonText}>Start Bay 2</Text>
                  </Pressable>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.skipButtonAction}
                    onPress={() => {
                      void skipQueueEntry(entry.id);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Skip Queue</Text>
                  </Pressable>
                  <Pressable
                    style={styles.removeButtonAction}
                    onPress={() => {
                      void removeQueueEntry(entry.id);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {waitingEntries.length > 0 ? (
            <Text style={styles.hint}>
              Tip: Start charging from top of queue for FCFS policy.
            </Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>GPS Override Approval</Text>
          {pendingOverrideEntries.length === 0 ? (
            <Text style={styles.bayMeta}>No pending override requests.</Text>
          ) : null}

          {pendingOverrideEntries.map((entry) => (
            <View key={entry.id} style={styles.queueCard}>
              <PlateBadge plateNumber={entry.plateNumber} />
              <Text style={styles.bayMeta}>
                {entry.name} requested GPS override
              </Text>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.approveButtonAction}
                  onPress={() => {
                    void approveOverride(entry.id);
                  }}
                >
                  <Text style={styles.actionButtonText}>Approve</Text>
                </Pressable>
                <Pressable
                  style={styles.rejectButtonAction}
                  onPress={() => {
                    void rejectOverride(entry.id);
                  }}
                >
                  <Text style={styles.actionButtonText}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
        <Pressable
          style={{ alignItems: "center", marginTop: 12 }}
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
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  heading: {
    color: "#F4F8FF",
    fontSize: 27,
    fontWeight: "800",
  },
  subheading: {
    color: "#C4D3EE",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoutButton: { padding: 8 },
  linkText: { color: "#C4D2FF", textAlign: "center", marginTop: 6 },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: "#F6FAFF",
    fontSize: 17,
    fontWeight: "700",
  },
  bayCard: {
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    padding: 10,
    gap: 4,
  },
  bayTitle: {
    color: "#EEF5FF",
    fontWeight: "700",
  },
  bayMeta: {
    color: "#D1DCF3",
    lineHeight: 19,
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
  available: {
    color: "#7CFFBA",
    fontWeight: "700",
  },
  occupied: {
    color: "#FFD0A8",
    fontWeight: "700",
  },
  endButton: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
    paddingVertical: 9,
  },
  endButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
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
  queueCard: {
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 12,
    padding: 10,
    paddingTop: 22,
    gap: 6,
  },
  queueIndexBadge: {
    position: "absolute",
    top: 8,
    left: 10,
    color: "#EEF5FF",
    fontWeight: "700",
    fontSize: 13,
  },
  contactBatteryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  startButtonAction: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
  },
  startButtonDisabled: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
    opacity: 0.45,
  },
  startButton: {
    backgroundColor: "#0A5A8A",
  },
  skipButtonAction: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "rgba(242, 176, 74, 0.28)",
    borderWidth: 0,
    borderColor: "transparent",
  },
  skipButton: {
    backgroundColor: "#8E5A11",
  },
  removeButtonAction: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "rgba(215, 95, 85, 0.3)",
    borderWidth: 0,
    borderColor: "transparent",
  },
  removeButton: {
    backgroundColor: "#952E22",
  },
  approveButtonAction: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "rgba(78, 201, 140, 0.28)",
    borderWidth: 0,
    borderColor: "transparent",
  },
  approveButton: {
    backgroundColor: "#0D8244",
  },
  rejectButtonAction: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "rgba(215, 95, 85, 0.3)",
    borderWidth: 0,
    borderColor: "transparent",
  },
  rejectButton: {
    backgroundColor: "#9A2F22",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  disabled: {
    opacity: 0.45,
  },
  hint: {
    color: "#D1DCF3",
    fontStyle: "italic",
    marginTop: 2,
  },
  bgGlowOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#39A0ED",
    opacity: 0.16,
    top: -90,
    right: -80,
  },
  bgGlowTwo: {
    position: "absolute",
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "#F26419",
    opacity: 0.14,
    bottom: -140,
    left: -120,
  },
});
