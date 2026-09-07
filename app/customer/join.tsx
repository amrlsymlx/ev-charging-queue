import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { useQueue } from "@/context/QueueContext";

const GPS_LIMIT_METERS = 50;

export default function CustomerJoinScreen() {
  const router = useRouter();
  const { addQueueEntry } = useQueue();

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [batteryPercentage, setBatteryPercentage] = useState("50");
  const [distanceMeters, setDistanceMeters] = useState("40");
  const [message, setMessage] = useState<string | null>(null);

  const parsedDistance = Number(distanceMeters);
  const gpsValidated =
    Number.isFinite(parsedDistance) && parsedDistance <= GPS_LIMIT_METERS;

  const handleSubmit = () => {
    const battery = Number(batteryPercentage);

    if (
      !name.trim() ||
      !phoneNumber.trim() ||
      !plateNumber.trim() ||
      Number.isNaN(battery)
    ) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (battery < 0 || battery > 100) {
      setMessage("Battery percentage must be between 0 and 100.");
      return;
    }

    const entry = addQueueEntry({
      name,
      phoneNumber,
      plateNumber,
      batteryPercentage: battery,
      gpsValidated,
      gpsOverrideRequested: !gpsValidated,
    });

    setMessage(
      gpsValidated
        ? "Queue created successfully. Redirecting to status page..."
        : "Override request submitted. You can monitor status while waiting for SA approval.",
    );

    router.push({
      pathname: "/customer/status",
      params: { id: entry.id },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Join Queue</Text>
        <Text style={styles.subheading}>
          Complete GPS check and submit your registration.
        </Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>GPS Validation</Text>
          <Text style={styles.caption}>Distance from showroom (meters)</Text>
          <TextInput
            style={styles.input}
            value={distanceMeters}
            keyboardType="numeric"
            onChangeText={setDistanceMeters}
            placeholder="e.g. 35"
            placeholderTextColor="#7A8495"
          />
          <Text style={gpsValidated ? styles.gpsOk : styles.gpsWarning}>
            {gpsValidated
              ? "Within 50m: registration is allowed."
              : "Outside 50m: registration will create a GPS override request."}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Registration Form</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#7A8495"
          />
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Phone Number"
            placeholderTextColor="#7A8495"
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            value={plateNumber}
            onChangeText={setPlateNumber}
            placeholder="Car Plate Number"
            placeholderTextColor="#7A8495"
            autoCapitalize="characters"
          />
          <TextInput
            style={styles.input}
            value={batteryPercentage}
            onChangeText={setBatteryPercentage}
            placeholder="Battery %"
            placeholderTextColor="#7A8495"
            keyboardType="numeric"
          />

          <Pressable style={styles.primaryButton} onPress={handleSubmit}>
            <Text style={styles.primaryButtonText}>
              {gpsValidated ? "Join Queue" : "Request Override and Join"}
            </Text>
          </Pressable>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
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
    padding: 18,
    gap: 14,
    paddingBottom: 34,
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
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 17,
    color: "#F6FAFF",
  },
  caption: {
    fontSize: 13,
    color: "#D1DCF3",
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
  gpsOk: {
    color: "#7CFFBA",
    fontWeight: "600",
  },
  gpsWarning: {
    color: "#FFD0A8",
    fontWeight: "600",
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
  message: {
    color: "#FFE2CC",
    lineHeight: 20,
    paddingHorizontal: 2,
  },
  bgGlowOne: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#39A0ED",
    opacity: 0.16,
    top: -80,
    right: -60,
  },
  bgGlowTwo: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: "#F26419",
    opacity: 0.14,
    bottom: -120,
    left: -90,
  },
});
