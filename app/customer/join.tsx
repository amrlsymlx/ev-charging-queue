import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

import { useQueue } from "@/context/QueueContext";
import { supabase } from "@/lib/supabase";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function CustomerJoinScreen() {
  const router = useRouter();
  const { addQueueEntry } = useQueue();

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [batteryPercentage, setBatteryPercentage] = useState("50");
  const [currentLatitude, setCurrentLatitude] = useState("");
  const [currentLongitude, setCurrentLongitude] = useState("");

  const [showroomName, setShowroomName] = useState("Showroom");
  const [showroomLatitude, setShowroomLatitude] = useState<number | null>(null);
  const [showroomLongitude, setShowroomLongitude] = useState<number | null>(
    null,
  );
  const [gpsLimitMeters, setGpsLimitMeters] = useState(50);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadShowroomSettings = async () => {
      setLoadingSettings(true);
      const { data, error } = await supabase
        .from("showroom_settings")
        .select("showroom_name, latitude, longitude, gps_radius_m")
        .eq("id", "main")
        .maybeSingle();

      if (error) {
        if (error.code !== "PGRST116") {
          setMessage(error.message);
        }
        setLoadingSettings(false);
        return;
      }

      if (data) {
        setShowroomName(data.showroom_name || "Showroom");
        setShowroomLatitude(data.latitude ?? null);
        setShowroomLongitude(data.longitude ?? null);
        setGpsLimitMeters(data.gps_radius_m ?? 50);
      }

      setLoadingSettings(false);
    };

    void loadShowroomSettings();
  }, []);

  const parsedCurrentLat = Number(currentLatitude);
  const parsedCurrentLng = Number(currentLongitude);

  const distanceMeters = useMemo(() => {
    if (
      showroomLatitude === null ||
      showroomLongitude === null ||
      Number.isNaN(parsedCurrentLat) ||
      Number.isNaN(parsedCurrentLng)
    ) {
      return null;
    }

    return haversineMeters(
      parsedCurrentLat,
      parsedCurrentLng,
      showroomLatitude,
      showroomLongitude,
    );
  }, [parsedCurrentLat, parsedCurrentLng, showroomLatitude, showroomLongitude]);

  const gpsValidated =
    distanceMeters !== null && distanceMeters <= gpsLimitMeters;

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

    if (loadingSettings) {
      setMessage("Loading showroom settings. Try again shortly.");
      return;
    }

    if (showroomLatitude === null || showroomLongitude === null) {
      setMessage(
        "Showroom GPS is not configured by manager yet. Your request will go to override approval.",
      );
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
          <Text style={styles.caption}>Showroom: {showroomName}</Text>
          {loadingSettings ? (
            <ActivityIndicator color="#D1DCF3" />
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={currentLatitude}
                keyboardType="decimal-pad"
                onChangeText={setCurrentLatitude}
                placeholder="Your Latitude"
                placeholderTextColor="#7A8495"
              />
              <TextInput
                style={styles.input}
                value={currentLongitude}
                keyboardType="decimal-pad"
                onChangeText={setCurrentLongitude}
                placeholder="Your Longitude"
                placeholderTextColor="#7A8495"
              />
              <Text style={styles.caption}>
                Radius limit: {gpsLimitMeters}m
                {distanceMeters === null
                  ? ""
                  : ` | Distance: ${Math.round(distanceMeters)}m`}
              </Text>
            </>
          )}
          <Text style={gpsValidated ? styles.gpsOk : styles.gpsWarning}>
            {gpsValidated
              ? "Within configured radius: registration is allowed."
              : "Outside configured radius or location unavailable: registration will create a GPS override request."}
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
