import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.bgCircleOne} />
      <View style={styles.bgCircleTwo} />

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Showroom Queue</Text>
        <Text style={styles.title}>EV Charging Queue System</Text>
        <Text style={styles.subtitle}>
          Scan, register, wait, and charge. Live updates for customers and
          service advisors.
        </Text>

        <Link href="/customer" asChild>
          <Pressable style={styles.primaryActionButton}>
            <Text style={styles.primaryButtonText}>Customer QR Landing</Text>
          </Pressable>
        </Link>

        <Link href="/sa/login" asChild>
          <Pressable style={styles.secondaryActionButton}>
            <Text style={styles.secondaryButtonText}>
              Service Advisor Dashboard
            </Text>
          </Pressable>
        </Link>

        <Link href="/admin/login" asChild>
          <Pressable style={styles.adminActionButton}>
            <Text style={styles.adminButtonText}>Manager Login</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    paddingHorizontal: 20,
    justifyContent: "center",
    overflow: "hidden",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 24,
    padding: 24,
    gap: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  eyebrow: {
    color: "#B7CBFF",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    color: "#F6FAFF",
    fontWeight: "800",
  },
  subtitle: {
    color: "#D1DCF4",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#F26419",
  },
  primaryActionButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
  },
  primaryButtonText: {
    color: "#FFF6F2",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "#10213B",
  },
  secondaryActionButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(196, 210, 255, 0.32)",
  },
  secondaryButtonText: {
    color: "#EAF2FF",
    fontWeight: "700",
    fontSize: 15,
  },
  adminActionButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "rgba(124, 255, 186, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(124, 255, 186, 0.22)",
    marginTop: 8,
  },
  adminButtonText: {
    color: "#E8FFF0",
    fontWeight: "700",
    fontSize: 15,
  },
  bgCircleOne: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#F26419",
    opacity: 0.18,
    top: -50,
    right: -50,
  },
  bgCircleTwo: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#39A0ED",
    opacity: 0.2,
    bottom: -90,
    left: -90,
  },
});
