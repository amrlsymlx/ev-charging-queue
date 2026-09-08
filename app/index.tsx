import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function Index() {
  const [showroomName, setShowroomName] = useState("Showroom");

  useEffect(() => {
    const loadShowroom = async () => {
      const { data, error } = await supabase
        .from("showroom_settings")
        .select("showroom_name")
        .eq("id", "main")
        .maybeSingle();

      if (!error && data) {
        setShowroomName(data.showroom_name || "Showroom");
      }
    };

    void loadShowroom();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.bgCircleOne} />
      <View style={styles.bgCircleTwo} />

      <View style={styles.card}>
        <Text style={styles.eyebrow}>{showroomName}</Text>
        <Text style={styles.title}>EV Charger Queue Management</Text>

        <View style={styles.buttonRow}>
          <Link href="/customer" asChild>
            <Pressable style={styles.primaryActionButtonRow}>
              <Text style={styles.primaryButtonText}>Customer QR Landing</Text>
            </Pressable>
          </Link>

          <Link href="/sa/login" asChild>
            <Pressable style={styles.secondaryActionButtonRow}>
              <Text style={styles.secondaryButtonText}>SA Login</Text>
            </Pressable>
          </Link>

          <Link href="/admin/login" asChild>
            <Pressable style={styles.adminActionButtonRow}>
              <Text style={styles.adminButtonText}>Manager Login</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    paddingHorizontal: 8,
    paddingVertical: 12,
    justifyContent: "center",
    overflow: "hidden",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 10,
    gap: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    alignItems: "center",
  },
  eyebrow: {
    color: "#B7CBFF",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
    textAlign: "center",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    color: "#F6FAFF",
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
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
  primaryButtonText: {
    color: "#FFF6F2",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: "#10213B",
  },
  secondaryButtonText: {
    color: "#EAF2FF",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  adminButtonText: {
    color: "#E8FFF0",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 8,
  },
  primaryActionButtonRow: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
    flex: 1,
  },
  secondaryActionButtonRow: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
    flex: 1,
  },
  adminActionButtonRow: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124, 255, 186, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    flex: 1,
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
