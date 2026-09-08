import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";

export default function CustomerLandingScreen() {
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
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <View style={styles.content}>
        <Text
          style={[styles.heading, styles.headingCentered]}
        >{`Welcome to ${showroomName}`}</Text>

        <View style={styles.sectionCard}>
          <Link href="/customer/join" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Join Queue</Text>
            </Pressable>
          </Link>

          <Link href="/customer/track" asChild>
            <Pressable style={styles.secondaryButtonRow}>
              <Ionicons
                name="search"
                size={16}
                color="#EAF2FF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.secondaryButtonText}>Track Queue</Text>
            </Pressable>
          </Link>
        </View>

        <Link href="/" asChild>
          <Pressable style={{ alignItems: "center", marginTop: 12 }}>
            <Text style={styles.linkText}>Back to main page</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    padding: 0,
    gap: 14,
    justifyContent: "center",
  },
  heading: {
    color: "#F4F8FF",
    fontSize: 26,
    fontWeight: "800",
  },
  subheading: {
    color: "#C4D3EE",
    marginBottom: 6,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    padding: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  primaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFF6F2",
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(196, 210, 255, 0.32)",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  secondaryButtonRow: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(196, 210, 255, 0.32)",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#EAF2FF",
    fontWeight: "700",
  },
  helperText: {
    color: "#D1DCF3",
    fontSize: 13,
    lineHeight: 18,
  },
  linkText: { color: "#C4D2FF", textAlign: "center", marginTop: 6 },
  headingCentered: { textAlign: "center", width: "100%" },
  bgGlowOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#39A0ED",
    opacity: 0.18,
    top: -70,
    right: -70,
  },
  bgGlowTwo: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#F26419",
    opacity: 0.16,
    bottom: -110,
    left: -90,
  },
});
