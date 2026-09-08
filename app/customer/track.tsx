import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

function formatPlateNumber(input: string): string {
  if (!input) return "";
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const m = cleaned.match(/^([A-Z]*)(\d*)([A-Z]*)$/);
  if (!m) return cleaned;
  const [, leadingLetters, digits, trailingLetters] = m;
  const parts: string[] = [];
  if (leadingLetters) parts.push(leadingLetters);
  if (digits) parts.push(digits);
  if (trailingLetters) parts.push(trailingLetters);
  return parts.join(" ");
}

import { useQueue } from "@/context/QueueContext";

export default function CustomerTrackScreen() {
  const router = useRouter();
  const { findLatestEntryByPlate } = useQueue();
  const [lookupPlate, setLookupPlate] = useState("");
  const [formattedLookup, setFormattedLookup] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleLookup = () => {
    const entry = findLatestEntryByPlate(lookupPlate);

    if (!entry) {
      setMessage("No queue entry found for that plate number.");
      return;
    }

    router.push({
      pathname: "/customer/status",
      params: { id: entry.id },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <View style={styles.card}>
        <Text style={styles.title}>Track Queue</Text>
        <Text style={styles.subtitle}>
          Enter your plate number to view current queue status.
        </Text>

        <TextInput
          style={styles.input}
          value={lookupPlate}
          onChangeText={(t) => {
            setLookupPlate(t);
            setFormattedLookup(formatPlateNumber(t));
          }}
          placeholder="Car Plate Number"
          placeholderTextColor="#7A8495"
          autoCapitalize="characters"
        />

        {formattedLookup ? (
          <Text style={styles.formatted}>Formatted: {formattedLookup}</Text>
        ) : null}

        <Pressable style={styles.button} onPress={handleLookup}>
          <Text style={styles.buttonText}>Find My Queue</Text>
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      <Pressable
        style={{ alignItems: "center", marginTop: 10 }}
        onPress={() => router.push("/")}
      >
        <Text style={styles.linkText}>Back to main page</Text>
      </Pressable>

      <Pressable
        style={{ alignItems: "center", marginTop: 10 }}
        onPress={() => router.push("/customer/join")}
      >
        <Text style={styles.linkText}>Join Queue</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  title: {
    color: "#F6FAFF",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#D1DCF3",
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F4F8FF",
  },
  button: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(196, 210, 255, 0.32)",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  buttonText: {
    color: "#EAF2FF",
    fontWeight: "700",
  },
  message: {
    color: "#FFD0A8",
    fontWeight: "600",
  },
  formatted: { color: "#C4D3EE", marginTop: 8, fontSize: 13 },
  linkText: { color: "#C4D2FF", textAlign: "center" },
  bgGlowOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#39A0ED",
    opacity: 0.16,
    top: -90,
    right: -90,
  },
  bgGlowTwo: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#F26419",
    opacity: 0.14,
    bottom: -130,
    left: -110,
  },
});
