import { useLocalSearchParams } from "expo-router";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { useQueue } from "@/context/QueueContext";
import { formatMinutes, getRemainingMinutes } from "@/lib/eta";

export default function SADashboardScreen() {
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

  const activeSessionByBay = new Map(
    activeSessions.map((session) => [session.bayId, session]),
  );
  const eligibleWaiting = waitingEntries.filter(
    (entry) => entry.gpsValidated || entry.gpsOverrideApproved,
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Dashboard</Text>
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
                    <Text style={styles.bayMeta}>
                      Plate: {activeEntry?.plateNumber ?? "N/A"}
                    </Text>
                    <Text style={styles.bayMeta}>
                      Remaining:{" "}
                      {formatMinutes(
                        getRemainingMinutes(
                          activeSession.startedAt,
                          activeSession.plannedDurationMinutes,
                        ),
                      )}
                    </Text>
                    <Pressable
                      style={styles.endButton}
                      onPress={() => endCharging(activeSession.id)}
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
            const canStart = entry.gpsValidated || entry.gpsOverrideApproved;

            return (
              <View key={entry.id} style={styles.queueCard}>
                <Text style={styles.queueTitle}>
                  #{index + 1} {entry.plateNumber}
                </Text>
                <Text style={styles.bayMeta}>
                  {entry.name} | Battery {entry.batteryPercentage}%
                </Text>
                <Text style={styles.bayMeta}>
                  ETA:{" "}
                  {canStart
                    ? formatMinutes(getEtaForEntry(entry.id))
                    : "Pending GPS override"}
                </Text>

                <View style={styles.actionRow}>
                  <Pressable
                    style={
                      !canStart || bayOne?.status !== "available"
                        ? styles.startButtonDisabled
                        : styles.startButtonAction
                    }
                    disabled={!canStart || bayOne?.status !== "available"}
                    onPress={() =>
                      startCharging(entry.id, "bay-1", String(saName))
                    }
                  >
                    <Text style={styles.actionButtonText}>Start Bay 1</Text>
                  </Pressable>
                  <Pressable
                    style={
                      !canStart || bayTwo?.status !== "available"
                        ? styles.startButtonDisabled
                        : styles.startButtonAction
                    }
                    disabled={!canStart || bayTwo?.status !== "available"}
                    onPress={() =>
                      startCharging(entry.id, "bay-2", String(saName))
                    }
                  >
                    <Text style={styles.actionButtonText}>Start Bay 2</Text>
                  </Pressable>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.skipButtonAction}
                    onPress={() => skipQueueEntry(entry.id)}
                  >
                    <Text style={styles.actionButtonText}>Skip Queue</Text>
                  </Pressable>
                  <Pressable
                    style={styles.removeButtonAction}
                    onPress={() => removeQueueEntry(entry.id)}
                  >
                    <Text style={styles.actionButtonText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {eligibleWaiting.length > 0 ? (
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
              <Text style={styles.queueTitle}>{entry.plateNumber}</Text>
              <Text style={styles.bayMeta}>
                {entry.name} requested GPS override
              </Text>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.approveButtonAction}
                  onPress={() => approveOverride(entry.id)}
                >
                  <Text style={styles.actionButtonText}>Approve</Text>
                </Pressable>
                <Pressable
                  style={styles.rejectButtonAction}
                  onPress={() => rejectOverride(entry.id)}
                >
                  <Text style={styles.actionButtonText}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
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
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
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
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
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
    borderWidth: 1,
    borderColor: "rgba(196, 210, 255, 0.32)",
    alignItems: "center",
    paddingVertical: 9,
  },
  endButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  queueCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  queueTitle: {
    color: "#EEF5FF",
    fontWeight: "700",
    fontSize: 15,
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
    borderWidth: 1,
    borderColor: "rgba(196, 210, 255, 0.32)",
  },
  startButtonDisabled: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(196, 210, 255, 0.32)",
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
    borderWidth: 1,
    borderColor: "rgba(255, 223, 169, 0.35)",
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
    borderWidth: 1,
    borderColor: "rgba(255, 190, 184, 0.35)",
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
    borderWidth: 1,
    borderColor: "rgba(173, 248, 213, 0.35)",
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
    borderWidth: 1,
    borderColor: "rgba(255, 190, 184, 0.35)",
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
