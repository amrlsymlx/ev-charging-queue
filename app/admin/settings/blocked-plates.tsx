import { logActivity } from "@/lib/activityLog";
import { showAlert } from "@/lib/alert";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

type BlockedPlate = {
  id: string;
  plate_number: string;
  reason: string | null;
  created_at: string;
};

function normalizePlate(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export default function BlockedPlatesScreen() {
  const router = useRouter();
  const [plates, setPlates] = useState<BlockedPlate[]>([]);
  const [loading, setLoading] = useState(true);
  const [plateInput, setPlateInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blocked_plates")
      .select("id, plate_number, reason, created_at")
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    setPlates((data as BlockedPlate[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const onAdd = async () => {
    const normalized = normalizePlate(plateInput);

    if (!normalized) {
      setMessage("Enter a plate number.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("blocked_plates").insert([
      {
        plate_number: normalized,
        reason: reasonInput.trim() || null,
      },
    ]);

    setSaving(false);

    if (error) {
      setMessage(
        error.code === "23505"
          ? "That plate number is already blocked."
          : error.message,
      );
      return;
    }

    void logActivity({
      action: "blocked_plate.add",
      targetType: "blocked_plate",
      targetId: normalized,
      details: { reason: reasonInput.trim() || null },
    });

    setPlateInput("");
    setReasonInput("");
    await load();
  };

  const onRemove = (plate: BlockedPlate) => {
    showAlert(
      "Unblock plate",
      `Remove ${plate.plate_number} from the blocked list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("blocked_plates")
              .delete()
              .eq("id", plate.id);

            if (error) {
              setMessage(error.message);
              return;
            }

            void logActivity({
              action: "blocked_plate.remove",
              targetType: "blocked_plate",
              targetId: plate.plate_number,
            });

            await load();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Blocked Plate Numbers</Text>
          <Text style={styles.subtitle}>
            Customers with a blocked plate number cannot join the queue.
          </Text>

          <TextInput
            style={styles.input}
            value={plateInput}
            onChangeText={setPlateInput}
            placeholder="Plate Number"
            placeholderTextColor="#7E8EA8"
            autoCapitalize="characters"
          />
          <TextInput
            style={styles.input}
            value={reasonInput}
            onChangeText={setReasonInput}
            placeholder="Reason (optional)"
            placeholderTextColor="#7E8EA8"
          />

          <Pressable
            style={[
              styles.button,
              (saving || !plateInput.trim()) && styles.buttonDisabled,
            ]}
            onPress={onAdd}
            disabled={saving || !plateInput.trim()}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Add to Blocked List</Text>
            )}
          </Pressable>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.listHeading}>Blocked Plates</Text>
          <View style={styles.listWrapper}>
            {loading ? (
              <ActivityIndicator color="#D1DCF3" />
            ) : plates.length === 0 ? (
              <Text style={styles.row}>No blocked plate numbers.</Text>
            ) : (
              plates.map((plate, idx) => (
                <View
                  key={plate.id}
                  style={[
                    styles.plateRow,
                    idx !== plates.length - 1 && styles.plateDivider,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.plateNumber}>
                      {plate.plate_number}
                    </Text>
                    {plate.reason ? (
                      <Text style={styles.plateReason}>{plate.reason}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => onRemove(plate)}
                    style={{ padding: 8 }}
                    accessibilityLabel={`Remove ${plate.plate_number}`}
                  >
                    <Ionicons name="trash" size={18} color="#FFB3A0" />
                  </Pressable>
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
  subtitle: { color: "#9FB0CD", marginBottom: 8 },
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
  message: { color: "#FFD0A8", marginTop: 8 },
  linkText: { color: "#C4D2FF", textAlign: "center" },
  listHeading: { color: "#E0EBFF", fontWeight: "700", marginBottom: 8 },
  listWrapper: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  row: { color: "#D1DCF3", paddingVertical: 10 },
  plateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  plateDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  plateNumber: { color: "#F4F8FF", fontWeight: "700" },
  plateReason: { color: "#9FB0CD", marginTop: 2, fontSize: 12 },
});
