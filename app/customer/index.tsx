import { Link } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function CustomerLandingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <View style={styles.content}>
        <Text style={styles.heading}>QR Landing</Text>
        <Text style={styles.subheading}>Choose one action to continue.</Text>

        <View style={styles.sectionCard}>
          <Link href="/customer/join" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Join Queue</Text>
            </Pressable>
          </Link>

          <Link href="/customer/track" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Track Queue</Text>
            </Pressable>
          </Link>

          <Text style={styles.helperText}>
            This page only provides these two actions for customers.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
  },
  content: {
    flex: 1,
    padding: 18,
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
    padding: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
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
  secondaryButtonText: {
    color: "#EAF2FF",
    fontWeight: "700",
  },
  helperText: {
    color: "#D1DCF3",
    fontSize: 13,
    lineHeight: 18,
  },
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
