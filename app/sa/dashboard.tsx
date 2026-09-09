import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

// @ts-ignore: optional native dependency may not be installed in web/dev environment
import Slider from "@react-native-community/slider";
import BatteryIndicator from "@/components/BatteryIndicator";
import ContactBadge from "@/components/ContactBadge";
import PlateBadge from "@/components/PlateBadge";
import { useQueue } from "@/context/QueueContext";
import { showAlert } from "@/lib/alert";
import {
    formatClockTime,
    formatCountdown,
    getSessionEndTime,
    getSessionProgress,
    getWaitProgress,
} from "@/lib/eta";
import { supabase } from "@/lib/supabase";
import { StaffPlateCategory } from "@/types/domain";
import { Ionicons } from "@expo/vector-icons";

function toSafeBatteryValue(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const STAFF_PLATE_CATEGORIES: StaffPlateCategory[] = [
  "INTERNAL",
  "PRIORITY",
  "DELIVERY",
  "SERVICE",
];

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
    defaultChargingMinutes,
    getEtaForEntry,
    getEtaForPosition,
    startCharging,
    endCharging,
    removeQueueEntry,
    approveOverride,
    rejectOverride,
    addStaffQueueEntry,
  } = useQueue();

  // Forces a re-render every second so bay countdowns show live seconds.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const [showStaffEntryModal, setShowStaffEntryModal] = useState(false);
  const [staffCategory, setStaffCategory] = useState<StaffPlateCategory>(
    STAFF_PLATE_CATEGORIES[0],
  );
  const [staffNote, setStaffNote] = useState("");
  const [staffBattery, setStaffBattery] = useState(50);
  const [staffChargingMinutes, setStaffChargingMinutes] = useState(
    String(defaultChargingMinutes),
  );
  const [addingStaffEntry, setAddingStaffEntry] = useState(false);

  const openStaffEntryModal = () => {
    setStaffCategory(STAFF_PLATE_CATEGORIES[0]);
    setStaffNote("");
    setStaffBattery(50);
    setStaffChargingMinutes(String(defaultChargingMinutes));
    setShowStaffEntryModal(true);
  };

  const onAddStaffEntry = async () => {
    const battery = toSafeBatteryValue(staffBattery);
    const chargingOverride = Number(staffChargingMinutes);

    if (!Number.isFinite(chargingOverride) || chargingOverride < 1) {
      showAlert("Invalid charging time", "Charging time must be at least 1 minute.");
      return;
    }

    setAddingStaffEntry(true);
    try {
      await addStaffQueueEntry({
        category: staffCategory,
        note: staffNote,
        batteryPercentage: battery,
        overrideChargingMinutes: chargingOverride,
      });
      setShowStaffEntryModal(false);
    } catch (err: any) {
      showAlert("Failed to add queue entry", err?.message || "Unknown error");
    } finally {
      setAddingStaffEntry(false);
    }
  };

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

  const estimatedWait =
    estimatedWaitSeconds === null ? "--" : formatCountdown(estimatedWaitSeconds);
  const estimatedStart =
    estimatedWaitSeconds === null
      ? "--"
      : formatClockTime(new Date(Date.now() + estimatedWaitSeconds * 1000));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>SA Dashboard</Text>
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
        <Text style={[styles.subheading, styles.etaBadge]}>
          Estimated wait: {estimatedWait}
          {estimatedStart !== "--"
            ? ` (Start charging at ${estimatedStart})`
            : ""}
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
                    !bay.enabled
                      ? styles.bayDisabled
                      : bay.status === "available"
                        ? styles.available
                        : styles.occupied
                  }
                >
                  {!bay.enabled
                    ? `DISABLED — ${bay.disabledReason || "Unspecified"}`
                    : bay.status.toUpperCase()}
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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Waiting Queue</Text>
            <Pressable
              style={styles.addStaffEntryButton}
              onPress={openStaffEntryModal}
            >
              <Ionicons name="add" size={16} color="#F4F8FF" />
              <Text style={styles.addStaffEntryButtonText}>Add Vehicle</Text>
            </Pressable>
          </View>
          {waitingEntries.length === 0 ? (
            <Text style={styles.bayMeta}>No active waiting queue.</Text>
          ) : null}

          {waitingEntries.map((entry, index) => {
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

                <View style={[styles.actionRow, styles.actionRowWrap]}>
                  {bays.map((bay) => {
                    const canStart = bay.enabled && bay.status === "available";
                    return (
                      <Pressable
                        key={bay.id}
                        style={[
                          styles.startButtonAction,
                          !canStart && styles.startButtonDisabled,
                          styles.startButtonFlexBasis,
                        ]}
                        disabled={!canStart}
                        onPress={() => {
                          void startCharging(entry.id, bay.id, String(saName));
                        }}
                      >
                        <Text style={styles.actionButtonText}>
                          {!bay.enabled
                            ? `${bay.name} (Disabled)`
                            : `Start ${bay.name}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    style={[styles.removeButtonAction, styles.startButtonFlexBasis]}
                    onPress={() => {
                      void removeQueueEntry(entry.id);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Cancel</Text>
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

      <Modal
        visible={showStaffEntryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStaffEntryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add Vehicle to Queue</Text>
            <Text style={styles.modalSubtitle}>
              For internal, priority, delivery, or service vehicles.
            </Text>

            <Text style={styles.modalLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {STAFF_PLATE_CATEGORIES.map((category) => (
                <Pressable
                  key={category}
                  style={[
                    styles.categoryChip,
                    staffCategory === category && styles.categoryChipSelected,
                  ]}
                  onPress={() => setStaffCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      staffCategory === category &&
                        styles.categoryChipTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Note (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={staffNote}
              onChangeText={setStaffNote}
              placeholder="e.g. Workshop test drive"
              placeholderTextColor="#7E8EA8"
            />

            <Text style={styles.modalLabel}>Battery Percentage</Text>
            <View style={{ alignItems: "center" }}>
              <BatteryIndicator percentage={toSafeBatteryValue(staffBattery)} />
            </View>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={toSafeBatteryValue(staffBattery)}
              minimumTrackTintColor="#7CFFBA"
              maximumTrackTintColor="#7A8495"
              thumbTintColor="#FFFFFF"
              onValueChange={(v: number | number[]) =>
                setStaffBattery(toSafeBatteryValue(v))
              }
            />

            <Text style={styles.modalLabel}>Charging Time (minutes)</Text>
            <TextInput
              style={styles.modalInput}
              value={staffChargingMinutes}
              onChangeText={setStaffChargingMinutes}
              placeholder={String(defaultChargingMinutes)}
              placeholderTextColor="#7E8EA8"
              keyboardType="numeric"
            />

            <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
              <Pressable
                style={[styles.modalSecondaryButton, { flex: 1 }]}
                onPress={() => setShowStaffEntryModal(false)}
                disabled={addingStaffEntry}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, { flex: 1 }]}
                onPress={onAddStaffEntry}
                disabled={addingStaffEntry}
              >
                {addingStaffEntry ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>Add to Queue</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    textAlign: "center",
  },
  etaBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  logoutButton: { padding: 8, position: "absolute", right: 0 },
  linkText: { color: "#C4D2FF", textAlign: "center", marginTop: 6 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  addStaffEntryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderRadius: 8,
    paddingVertical: 6,
    position: "absolute",
    right: 0,
    paddingHorizontal: 10,
  },
  addStaffEntryButtonText: {
    color: "#F4F8FF",
    fontWeight: "700",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "rgba(12,16,26,0.98)",
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: {
    color: "#F6FAFF",
    fontWeight: "700",
    fontSize: 18,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#9FB0CD",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
  },
  modalLabel: {
    color: "#C4D3EE",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    padding: 10,
    color: "#F4F8FF",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  categoryChipSelected: {
    backgroundColor: "rgba(132, 158, 255, 0.35)",
  },
  categoryChipText: {
    color: "#C4D3EE",
    fontWeight: "600",
    fontSize: 12,
  },
  categoryChipTextSelected: {
    color: "#F8FBFF",
  },
  modalPrimaryButton: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalPrimaryButtonText: { color: "#F8FBFF", fontWeight: "700" },
  modalSecondaryButton: {
    backgroundColor: "transparent",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalSecondaryButtonText: { color: "#DDE8FF", fontWeight: "700" },
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
    textAlign: "center",
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
  bayDisabled: {
    color: "#FF9B8A",
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
  actionRowWrap: {
    flexWrap: "wrap",
    justifyContent: "center",
  },
  startButtonFlexBasis: {
    flex: 0,
    flexBasis: "48%",
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
