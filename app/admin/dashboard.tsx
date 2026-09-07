import { useQueue } from "@/context/QueueContext";
import { formatMinutes } from "@/lib/eta";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export default function AdminDashboard() {
  const { adminName = "Manager" } = useLocalSearchParams<{
    adminName?: string;
  }>();
  const { chargingSessions, queueEntries, bays, addChargingSessionRecord } =
    useQueue();

  const totalSessions = chargingSessions.length;
  const completed = chargingSessions.filter(
    (s) => s.status === "completed",
  ).length;
  const active = chargingSessions.filter((s) => s.status === "active").length;

  // simple utilization per bay (completed + active) / total sessions
  const utilization = bays.map((bay) => {
    const count = chargingSessions.filter((s) => s.bayId === bay.id).length;
    return { bayId: bay.id, name: bay.name, count };
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Manager Dashboard</Text>
        <Text style={styles.subheading}>
          Welcome, {adminName}. View activity records and utilization.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sessions</Text>
          <Text style={styles.row}>Total: {totalSessions}</Text>
          <Text style={styles.row}>Active: {active}</Text>
          <Text style={styles.row}>Completed: {completed}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Charger Utilization</Text>
          {utilization.map((u) => (
            <View key={u.bayId} style={styles.rowWrap}>
              <Text style={styles.row}>{u.name}</Text>
              <Text style={styles.row}>{u.count} sessions</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>History (latest 12)</Text>
          {chargingSessions
            .slice()
            .reverse()
            .slice(0, 12)
            .map((s) => (
              <View key={s.id} style={styles.rowWrap}>
                <Text style={styles.row}>
                  {s.saName} — {s.bayId}
                </Text>
                <Text style={styles.row}>
                  {s.status}{" "}
                  {s.startedAt
                    ? `• ${formatMinutes(s.plannedDurationMinutes)}`
                    : ""}
                </Text>
              </View>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070D1A" },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 26, color: "#F6FAFF", fontWeight: "800" },
  subheading: { color: "#C4D3EE" },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: { color: "#F6FAFF", fontWeight: "700", marginBottom: 6 },
  row: { color: "#D1DCF3" },
  rowWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
});
