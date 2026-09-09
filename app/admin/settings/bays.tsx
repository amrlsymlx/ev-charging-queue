import { useQueue } from "@/context/QueueContext";
import { promptForInput, showAlert } from "@/lib/alert";
import { ChargingBay } from "@/types/domain";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";

const DISABLE_REASONS = ["Maintenance", "Faulty", "Priority", "Other"];

export default function BaysScreen() {
  const router = useRouter();
  const { bays, addBay, renameBay, deleteBay, setBayEnabled } = useQueue();

  const [bayName, setBayName] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renamingBayId, setRenamingBayId] = useState<string | null>(null);
  const [deletingBayId, setDeletingBayId] = useState<string | null>(null);

  const [disableModalBay, setDisableModalBay] = useState<ChargingBay | null>(
    null,
  );
  const [selectedReason, setSelectedReason] = useState<string>(
    DISABLE_REASONS[0],
  );
  const [customReason, setCustomReason] = useState("");
  const [updatingBayId, setUpdatingBayId] = useState<string | null>(null);

  const onAddBay = async () => {
    if (!bayName.trim()) {
      setMessage("Enter a bay name.");
      return;
    }

    setAdding(true);
    setMessage(null);

    try {
      await addBay(bayName.trim());
      setBayName("");
    } catch (err: any) {
      setMessage(err?.message || "Failed to add bay.");
    } finally {
      setAdding(false);
    }
  };

  const openDisableModal = (bay: ChargingBay) => {
    setDisableModalBay(bay);
    setSelectedReason(DISABLE_REASONS[0]);
    setCustomReason("");
  };

  const onConfirmDisable = async () => {
    if (!disableModalBay) return;

    const reason =
      selectedReason === "Other" ? customReason.trim() : selectedReason;

    if (!reason) {
      setMessage("Enter a reason for disabling this bay.");
      return;
    }

    setUpdatingBayId(disableModalBay.id);
    try {
      await setBayEnabled(disableModalBay.id, false, reason);
      setDisableModalBay(null);
    } catch (err: any) {
      showAlert("Failed to disable bay", err?.message || "Unknown error");
    } finally {
      setUpdatingBayId(null);
    }
  };

  const onEnableBay = async (bay: ChargingBay) => {
    setUpdatingBayId(bay.id);
    try {
      await setBayEnabled(bay.id, true);
    } catch (err: any) {
      showAlert("Failed to enable bay", err?.message || "Unknown error");
    } finally {
      setUpdatingBayId(null);
    }
  };

  const onRenameBay = async (bay: ChargingBay) => {
    const newName = await promptForInput(
      `Rename ${bay.name}`,
      "Enter new bay name",
      bay.name,
    );
    if (!newName || !newName.trim() || newName.trim() === bay.name) return;

    setRenamingBayId(bay.id);
    try {
      await renameBay(bay.id, newName.trim());
    } catch (err: any) {
      showAlert("Failed to rename bay", err?.message || "Unknown error");
    } finally {
      setRenamingBayId(null);
    }
  };

  const onDeleteBay = (bay: ChargingBay) => {
    if (bay.status === "occupied") {
      showAlert(
        "Bay in use",
        "This bay is currently charging a vehicle. End the session before deleting it.",
      );
      return;
    }

    showAlert(
      "Delete bay",
      `Delete ${bay.name}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingBayId(bay.id);
            try {
              await deleteBay(bay.id);
            } catch (err: any) {
              showAlert("Failed to delete bay", err?.message || "Unknown error");
            } finally {
              setDeletingBayId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Charging Bays</Text>
          <Text style={styles.subtitle}>
            Add bays and enable or disable them. A disabled bay stays
            visible but is labeled disabled with its reason, and customers
            can't be started into it.
          </Text>

          <Text style={styles.fieldLabel}>Bay Name</Text>
          <TextInput
            style={styles.input}
            value={bayName}
            onChangeText={setBayName}
            placeholder="e.g. Bay 3"
            placeholderTextColor="#7E8EA8"
          />

          <Pressable
            style={[
              styles.button,
              (adding || !bayName.trim()) && styles.buttonDisabled,
            ]}
            onPress={onAddBay}
            disabled={adding || !bayName.trim()}
          >
            {adding ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Add Bay</Text>
            )}
          </Pressable>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.listHeading}>All Bays</Text>
          <View style={styles.listWrapper}>
            {bays.length === 0 ? (
              <Text style={styles.row}>No bays yet.</Text>
            ) : (
              bays.map((bay, idx) => (
                <View
                  key={bay.id}
                  style={[
                    styles.bayRow,
                    idx !== bays.length - 1 && styles.bayDivider,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.bayNameRow}>
                      <Text style={styles.bayName}>{bay.name}</Text>
                      {renamingBayId === bay.id ? (
                        <ActivityIndicator
                          color="#D1DCF3"
                          style={{ marginLeft: 8 }}
                        />
                      ) : (
                        <Pressable
                          onPress={() => onRenameBay(bay)}
                          style={{ padding: 4, marginLeft: 6 }}
                          accessibilityLabel={`Rename ${bay.name}`}
                        >
                          <Ionicons name="pencil" size={14} color="#9FB0CD" />
                        </Pressable>
                      )}
                    </View>
                    <Text
                      style={
                        !bay.enabled
                          ? styles.bayStatusDisabled
                          : bay.status === "occupied"
                            ? styles.bayStatusOccupied
                            : styles.bayStatusAvailable
                      }
                    >
                      {!bay.enabled
                        ? `DISABLED — ${bay.disabledReason || "Unspecified"}`
                        : bay.status.toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {updatingBayId === bay.id ? (
                      <ActivityIndicator color="#D1DCF3" />
                    ) : (
                      <Switch
                        value={bay.enabled}
                        onValueChange={(value) => {
                          if (value) {
                            void onEnableBay(bay);
                          } else {
                            openDisableModal(bay);
                          }
                        }}
                      />
                    )}

                    {deletingBayId === bay.id ? (
                      <ActivityIndicator
                        color="#D1DCF3"
                        style={{ marginLeft: 12 }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => onDeleteBay(bay)}
                        style={{ padding: 8, marginLeft: 4 }}
                        accessibilityLabel={`Delete ${bay.name}`}
                      >
                        <Ionicons name="trash" size={18} color="#FFB3A0" />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <Pressable
        style={{ alignItems: "center", marginTop: 12, marginBottom: 12 }}
        onPress={() => router.back()}
      >
        <Text style={styles.linkText}>Back to Settings</Text>
      </Pressable>

      <Modal
        visible={!!disableModalBay}
        transparent
        animationType="fade"
        onRequestClose={() => setDisableModalBay(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              Disable {disableModalBay?.name}
            </Text>
            <Text style={styles.subtitle}>Choose a reason.</Text>

            {DISABLE_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={[
                  styles.reasonOption,
                  selectedReason === reason && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <View
                  style={[
                    styles.radio,
                    selectedReason === reason && styles.radioSelected,
                  ]}
                />
                <Text style={styles.reasonOptionText}>{reason}</Text>
              </Pressable>
            ))}

            {selectedReason === "Other" ? (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Describe the reason"
                placeholderTextColor="#7E8EA8"
              />
            ) : null}

            <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
              <Pressable
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => setDisableModalBay(null)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.button, { flex: 1 }]}
                onPress={onConfirmDisable}
              >
                <Text style={styles.buttonText}>Disable</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  subtitle: { color: "#9FB0CD", marginBottom: 8, lineHeight: 18 },
  fieldLabel: {
    color: "#C4D3EE",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    padding: 10,
    color: "#F4F8FF",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  button: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#F8FBFF", fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#DDE8FF", fontWeight: "700" },
  message: { color: "#FFD0A8", marginTop: 8 },
  linkText: { color: "#C4D2FF", textAlign: "center" },
  listHeading: { color: "#E0EBFF", fontWeight: "700", marginBottom: 8 },
  listWrapper: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  row: { color: "#D1DCF3", paddingVertical: 10 },
  bayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  bayDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  bayNameRow: { flexDirection: "row", alignItems: "center" },
  bayName: { color: "#F4F8FF", fontWeight: "700" },
  bayStatusAvailable: {
    color: "#7CFFBA",
    fontWeight: "600",
    marginTop: 2,
    fontSize: 12,
  },
  bayStatusOccupied: {
    color: "#FFD0A8",
    fontWeight: "600",
    marginTop: 2,
    fontSize: 12,
  },
  bayStatusDisabled: {
    color: "#FF9B8A",
    fontWeight: "600",
    marginTop: 2,
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
    marginBottom: 4,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  reasonOptionSelected: {},
  reasonOptionText: { color: "#F4F8FF", marginLeft: 10 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.32)",
  },
  radioSelected: {
    borderColor: "#849EFF",
    backgroundColor: "#849EFF",
  },
});
