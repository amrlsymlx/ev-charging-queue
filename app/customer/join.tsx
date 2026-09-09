import { Ionicons } from "@expo/vector-icons";
// @ts-ignore: optional native dependency may not be installed in web/dev environment
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import BatteryIndicator from "../../components/BatteryIndicator";
import LocationPickerCard from "../../components/LocationPickerCard";
import PlateBadge from "../../components/PlateBadge";
import { useQueue } from "../../context/QueueContext";
import { showAlert } from "../../lib/alert";
import { formatClockTime, formatCountdown } from "../../lib/eta";
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
  const { addQueueEntry, waitingEntries, bays, getEtaForPosition } =
    useQueue();

  const [name, setName] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+6017");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [showPrefixPicker, setShowPrefixPicker] = useState(false);
  const [plateNumber, setPlateNumber] = useState("");
  const [formattedPlate, setFormattedPlate] = useState("");
  const [batteryPercentage, setBatteryPercentage] = useState<number>(50);
  const [currentLatitude, setCurrentLatitude] = useState("");
  const [currentLongitude, setCurrentLongitude] = useState("");
  const [gpsTestEnabled, setGpsTestEnabled] = useState(true);

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadShowroomSettings = async () => {
      setLoadingSettings(true);
      const { data, error } = await supabase
        .from("showroom_settings")
        .select("*")
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
        setGpsTestEnabled(data.gps_test_enabled ?? true);
      }

      setLoadingSettings(false);
    };

    void loadShowroomSettings();
  }, []);

  const handleRetryLocation = async () => {
    setMessage(
      "Retrying location... (permission/location logic not yet implemented)",
    );
    console.debug("Retrying location request - placeholder");
    // Future: trigger permissions and attempt to read device location here.
  };

  // Ticks every second so the live estimate below stays in sync with the
  // actual bay countdowns it's derived from.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const estimatedWaitSeconds = useMemo(() => {
    try {
      const position = (waitingEntries || []).length + 1;
      return getEtaForPosition(position);
    } catch (e) {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingEntries, bays, getEtaForPosition, tick]);

  const estimatedWait = useMemo(() => {
    if (estimatedWaitSeconds === null) return "--";
    return formatCountdown(estimatedWaitSeconds);
  }, [estimatedWaitSeconds]);

  const estimatedStart = useMemo(() => {
    if (estimatedWaitSeconds === null) return "--";
    return formatClockTime(new Date(Date.now() + estimatedWaitSeconds * 1000));
  }, [estimatedWaitSeconds]);

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

  const gpsStatus = useMemo<"denied" | "out" | "valid" | "unknown">(() => {
    const latEmpty = currentLatitude === "";
    const lngEmpty = currentLongitude === "";
    const latNaN = Number.isNaN(parsedCurrentLat);
    const lngNaN = Number.isNaN(parsedCurrentLng);

    if (latEmpty || lngEmpty || latNaN || lngNaN) return "denied";
    if (distanceMeters === null) return "unknown";
    return distanceMeters <= gpsLimitMeters ? "valid" : "out";
  }, [
    currentLatitude,
    currentLongitude,
    parsedCurrentLat,
    parsedCurrentLng,
    distanceMeters,
    gpsLimitMeters,
  ]);

  const blink = useRef(new Animated.Value(1));

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink.current, {
          toValue: 0.25,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(blink.current, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const handleSubmit = async () => {
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

    setSubmitting(true);
    try {
      const entry = await addQueueEntry({
        name,
        phoneNumber: fullPhone,
        plateNumber: formattedPlate || formatPlateNumber(plateNumber),
        batteryPercentage: battery,
        gpsValidated,
        gpsOverrideRequested: !gpsValidated,
      });

      if (gpsValidated) {
        setMessage("Queue join success, track your queue now.");
        showAlert("Queue join success", "Track your queue now", [
          { text: "Later", style: "cancel" },
          {
            text: "Track Queue",
            onPress: () => router.push("/customer/track"),
          },
        ]);
        return;
      }

      setMessage(
        "Override request submitted. You can monitor status while waiting for SA approval.",
      );

      router.push({
        pathname: "/customer/status",
        params: { id: entry.id },
      });
    } catch (err: any) {
      setMessage(err?.message || "Failed to join queue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, styles.headingCentered]}>Join Queue</Text>
        <Text style={[styles.subheading, styles.subheadingCentered]}>
          Allow location check and submit Queue Register
        </Text>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, styles.sectionTitleCentered]}>
            Queue Register
          </Text>
          <Text style={[styles.etaBadge, styles.caption]}>
            Estimated wait: {estimatedWait}
            {estimatedStart && estimatedStart !== "--"
              ? ` (Start charging at ${estimatedStart})`
              : ""}
          </Text>
          <Animated.View
            style={
              gpsStatus === "valid"
                ? [
                    styles.gpsIndicator,
                    styles.gpsIndicatorValid,
                    { opacity: blink.current },
                  ]
                : gpsStatus === "out"
                  ? [
                      styles.gpsIndicator,
                      styles.gpsIndicatorOut,
                      { opacity: blink.current },
                    ]
                  : [
                      styles.gpsIndicator,
                      styles.gpsIndicatorDenied,
                      { opacity: blink.current },
                    ]
            }
          />
          {gpsStatus === "denied" ? (
            <Text style={[styles.gpsDenied, styles.gpsStatusCentered]}>
              Location access not allowed or unavailable. Please enable location
              access and try again. Or ask SA on duty to approve.
            </Text>
          ) : gpsStatus === "valid" ? (
            <Text style={[styles.gpsOk, styles.gpsStatusCentered]}>
              Location approved. Proceed with registration.
            </Text>
          ) : gpsStatus === "out" ? (
            <Text style={[styles.gpsOut, styles.gpsStatusCentered]}>
              Outside showroom location, please try again. Or ask SA on duty to
              approve.
            </Text>
          ) : (
            <Text style={[styles.gpsOut, styles.gpsStatusCentered]}>
              Error. Ask SA on duty to approve.
            </Text>
          )}
          {gpsStatus !== "valid" ? (
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                void handleRetryLocation();
              }}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          ) : null}
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
              <Ionicons
                name="chevron-down"
                size={14}
                color="#F4F8FF"
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: "#F4F8FF" }}>{phonePrefix}</Text>
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

          {formattedPlate ? <PlateBadge plateNumber={formattedPlate} /> : null}

          <View style={{ marginTop: 6 }}>
            <BatteryIndicator percentage={toSafeBatteryValue(batteryPercentage)} />
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
            style={[
              styles.primaryButton,
              (!agreed || submitting) && styles.disabledButton,
            ]}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={!agreed || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF6F2" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {gpsStatus === "valid"
                  ? "Join"
                  : "Join (Request approval from SA on duty)"}
              </Text>
            )}
          </Pressable>
        </View>

        <Pressable
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 12,
          }}
          onPress={() => router.push("/customer/track")}
          accessibilityLabel="Track Queue"
        >
          <Ionicons
            name="search"
            size={16}
            color="#C4D2FF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.linkText}>Track Queue</Text>
        </Pressable>

        <Pressable
          style={{ alignItems: "center", marginTop: 8 }}
          onPress={() => router.push("/")}
        >
          <Text style={styles.linkText}>Back to main page</Text>
        </Pressable>

        {loadingSettings ? (
          <View style={styles.sectionCard}>
            <ActivityIndicator color="#D1DCF3" />
          </View>
        ) : gpsTestEnabled ? (
          <LocationPickerCard
            latitude={currentLatitude}
            longitude={currentLongitude}
            onChangeCoordinates={(latitude, longitude) => {
              setCurrentLatitude(latitude);
              setCurrentLongitude(longitude);
            }}
            enabled={gpsTestEnabled}
            onToggleEnabled={setGpsTestEnabled}
            referenceLatitude={showroomLatitude ?? 3.139}
            referenceLongitude={showroomLongitude ?? 101.6869}
            radiusMeters={gpsLimitMeters}
            helperText={`Showroom: ${showroomName} | Radius limit: ${gpsLimitMeters}m${
              distanceMeters === null
                ? ""
                : ` | Distance: ${Math.round(distanceMeters)}m`
            }`}
          />
        ) : null}

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
                    borderWidth: 0,
                    borderColor: "transparent",
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
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  content: { padding: 16, gap: 14, paddingBottom: 34 },
  heading: { color: "#F4F8FF", fontSize: 26, fontWeight: "800" },
  subheading: { color: "#C4D3EE", marginBottom: 6, lineHeight: 20 },
  headingCentered: { textAlign: "center", width: "100%" },
  subheadingCentered: { textAlign: "center", width: "100%" },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
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
    overflow: "visible",
  },
  sectionTitle: { fontWeight: "700", fontSize: 17, color: "#F6FAFF" },
  sectionTitleCentered: { textAlign: "center", width: "100%" },
  caption: { fontSize: 13, color: "#D1DCF3" },
  etaBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  linkText: { color: "#C4D2FF", textAlign: "center" },
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
  gpsOut: { color: "#FFD0A8", fontWeight: "600", zIndex: 0 },
  gpsDenied: { color: "#FF6B6B", fontWeight: "700", zIndex: 0 },
  gpsStatusCentered: { textAlign: "center", width: "100%", marginBottom: 8 },
  gpsIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 6,
  },
  gpsIndicatorValid: { backgroundColor: "#7CFFBA" },
  gpsIndicatorOut: { backgroundColor: "#FFD0A8" },
  gpsIndicatorDenied: { backgroundColor: "#FF6B6B" },
  primaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
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
    borderWidth: 0,
    borderColor: "transparent",
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
    borderWidth: 0,
    borderColor: "transparent",
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
  retryButton: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  retryButtonText: { color: "#C4D2FF", fontWeight: "700" },
});
