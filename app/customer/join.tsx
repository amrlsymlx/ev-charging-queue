import { Ionicons } from "@expo/vector-icons";
// @ts-ignore: optional native dependency may not be installed in web/dev environment
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { useQueue } from "../../context/QueueContext";
import { supabase } from "../../lib/supabase";

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
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

function formatPlateNumber(input: string): string {
  if (!input) return "";
  // Remove non-alphanumeric and uppercase
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  // Match leading letters, digits, trailing letters
  const m = cleaned.match(/^([A-Z]*)(\d*)([A-Z]*)$/);
  if (!m) return cleaned;

  const [, leadingLetters, digits, trailingLetters] = m;

  const parts: string[] = [];
  if (leadingLetters) parts.push(leadingLetters);
  if (digits) parts.push(digits);
  if (trailingLetters) parts.push(trailingLetters);

  return parts.join(" ");
}

function toSafeBatteryValue(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function CustomerJoinScreen() {
  const router = useRouter();
  const { addQueueEntry } = useQueue();

  const [name, setName] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+6017");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [showPrefixPicker, setShowPrefixPicker] = useState(false);
  const [plateNumber, setPlateNumber] = useState("");
  const [formattedPlate, setFormattedPlate] = useState("");
  const [batteryPercentage, setBatteryPercentage] = useState<number>(50);
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
  const [agreed, setAgreed] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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
    if (!agreed) {
      setMessage("You must agree to the Terms & Conditions before proceeding.");
      return;
    }

    const battery = Number(batteryPercentage);

    if (!name.trim()) {
      setMessage("Name is required.");
      return;
    }

    if (name.trim().length < 5) {
      setMessage("Name must be at least 5 characters.");
      return;
    }

    if (!phoneLocal.trim()) {
      setMessage("Phone number is required.");
      return;
    }

    if (phoneLocal.trim().length < 7) {
      setMessage("Phone number must be at least 7 digits.");
      return;
    }

    if (!/^[0-9]+$/.test(phoneLocal.trim())) {
      setMessage("Phone number must contain only digits.");
      return;
    }

    if (!plateNumber.trim()) {
      setMessage("Car plate number is required.");
      return;
    }

    if (plateNumber.trim().length < 2) {
      setMessage("Car plate number must be at least 2 characters.");
      return;
    }

    if (Number.isNaN(battery)) {
      setMessage("Please enter a valid battery percentage.");
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

    const fullPhone = `${phonePrefix}${phoneLocal}`;

    const entry = addQueueEntry({
      name,
      phoneNumber: fullPhone,
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
      <ScrollView
        contentContainerStyle={styles.content}
        style={{ overflow: "visible" }}
      >
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

          <View style={styles.phoneRow}>
            <Pressable
              onPress={() => setShowPrefixPicker((v) => !v)}
              style={[
                styles.prefixButton,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Text style={{ color: "#F4F8FF", marginRight: 6 }}>
                {phonePrefix}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#F4F8FF" />
            </Pressable>

            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={phoneLocal}
              onChangeText={(t) => setPhoneLocal(t.replace(/[^0-9]/g, ""))}
              placeholder="Phone Number (without prefix)"
              placeholderTextColor="#7A8495"
              keyboardType="phone-pad"
              maxLength={12}
            />

            {showPrefixPicker ? (
              <View style={styles.prefixMenu}>
                {[
                  "+6011",
                  "+6012",
                  "+6013",
                  "+6014",
                  "+6016",
                  "+6017",
                  "+6018",
                  "+6019",
                  "+6010",
                ].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => {
                      setPhonePrefix(p);
                      setShowPrefixPicker(false);
                    }}
                    style={styles.prefixItem}
                  >
                    <Text style={{ color: "#D1DCF3" }}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          <TextInput
            style={styles.input}
            value={plateNumber}
            onChangeText={(t) => {
              // Update raw value
              setPlateNumber(t);
              // Update formatted display
              setFormattedPlate(formatPlateNumber(t));
            }}
            placeholder="Car Plate Number"
            placeholderTextColor="#7A8495"
            autoCapitalize="characters"
          />

          {formattedPlate ? (
            <Text style={styles.formattedPlate}>
              Formatted: {formattedPlate}
            </Text>
          ) : null}

          <View style={{ marginTop: 6 }}>
            <Text style={styles.caption}>
              Battery: {toSafeBatteryValue(batteryPercentage)}%
            </Text>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={toSafeBatteryValue(batteryPercentage)}
              minimumTrackTintColor="#7CFFBA"
              maximumTrackTintColor="#7A8495"
              thumbTintColor="#FFFFFF"
              onValueChange={(v: number | number[]) =>
                setBatteryPercentage(toSafeBatteryValue(v))
              }
            />
          </View>

          <View style={{ marginTop: 8, marginBottom: 6 }}>
            <Pressable
              onPress={() => setAgreed((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center" }}
              accessibilityLabel="Agree to terms"
            >
              <View
                style={[
                  styles.checkbox,
                  agreed ? styles.checkboxChecked : null,
                ]}
              >
                {agreed ? (
                  <Ionicons name="checkmark" size={14} color="#F8FBFF" />
                ) : null}
              </View>

              <Text style={{ color: "#D1DCF3", marginLeft: 8 }}>
                I agree to the{" "}
                <Text
                  style={{ color: "#C4D2FF" }}
                  onPress={() => setShowTermsModal(true)}
                >
                  Terms & Conditions
                </Text>
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.primaryButton, !agreed && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={!agreed}
          >
            <Text style={styles.primaryButtonText}>
              {gpsValidated ? "Join Queue" : "Request Override and Join"}
            </Text>
          </Pressable>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>

      <Modal
        visible={showTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.termsContainer}>
            <Text style={styles.termsTitle}>Terms & Conditions</Text>
            <ScrollView style={styles.termsContent}>
              <Text style={styles.termsText}>
                By joining the queue you agree to follow the showroom's
                instructions, allow SA personnel to inspect and handle your
                vehicle, and accept that any service actions are performed at
                your own risk. This is a sample terms text — replace with the
                real policy.
              </Text>
              <Text style={[styles.termsText, { marginTop: 8 }]}>
                Further provisions can be added here.
              </Text>
            </ScrollView>

            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <Pressable
                style={[styles.primaryButton, { flex: 1, marginRight: 8 }]}
                onPress={() => {
                  setAgreed(true);
                  setShowTermsModal(false);
                }}
              >
                <Text style={styles.primaryButtonText}>I Agree</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.primaryButton,
                  {
                    flex: 1,
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.24)",
                  },
                ]}
                onPress={() => setShowTermsModal(false)}
              >
                <Text style={[styles.primaryButtonText, { color: "#C4D2FF" }]}>
                  Close
                </Text>
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
  content: { padding: 18, gap: 14, paddingBottom: 34 },
  heading: { color: "#F4F8FF", fontSize: 26, fontWeight: "800" },
  subheading: { color: "#C4D3EE", marginBottom: 6, lineHeight: 20 },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    padding: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
    overflow: "visible",
  },
  sectionTitle: { fontWeight: "700", fontSize: 17, color: "#F6FAFF" },
  caption: { fontSize: 13, color: "#D1DCF3" },
  input: {
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F4F8FF",
  },
  gpsOk: { color: "#7CFFBA", fontWeight: "600" },
  gpsWarning: { color: "#FFD0A8", fontWeight: "600", zIndex: 0 },
  primaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: { color: "#FFF6F2", fontWeight: "700" },
  disabledButton: { opacity: 0.5 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxChecked: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderColor: "rgba(196,210,255,0.32)",
  },
  message: {
    color: "#FFE2CC",
    lineHeight: 20,
    paddingHorizontal: 2,
    zIndex: 0,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  termsContainer: {
    width: "100%",
    maxWidth: 680,
    backgroundColor: "#0C101A",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  termsTitle: {
    color: "#F6FAFF",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 8,
  },
  termsContent: { maxHeight: 320 },
  termsText: { color: "#D1DCF3", lineHeight: 20 },
  prefixButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneRow: {
    flexDirection: "row",
    gap: 8,
    position: "relative",
    alignItems: "center",
    zIndex: 30,
  },
  prefixMenu: {
    position: "absolute",
    zIndex: 99999,
    top: 52,
    left: 0,
    minWidth: 96,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#111827",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 20,
    opacity: 1,
    paddingVertical: 0,
  },
  prefixItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#111827",
    opacity: 1,
  },
  formattedPlate: { color: "#C4D3EE", marginTop: 8, fontSize: 13 },
});
