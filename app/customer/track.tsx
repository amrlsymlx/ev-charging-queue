import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

function formatPlateNumber(input: string): string {
  if (!input) return "";
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!cleaned) return "";

  // Space-separate every run of consecutive letters/digits, in whatever
  // order they appear (e.g. "1122dndn22" -> "1122 DNDN 22"), not just the
  // single leading/trailing-letter shape most plates use.
  const parts = cleaned.match(/[A-Z]+|[0-9]+/g);
  return parts ? parts.join(" ") : cleaned;
}

import PlateBadge from "@/components/PlateBadge";
import { useQueue } from "@/context/QueueContext";
import { Ionicons } from "@expo/vector-icons";
import { deleteSecureItem, getSecureItem, setSecureItem } from "@/lib/secureStorage";

const REMEMBER_KEY = "customer_track_lookup";

const PHONE_PREFIXES = [
  "+6011",
  "+6012",
  "+6013",
  "+6014",
  "+6016",
  "+6017",
  "+6018",
  "+6019",
  "+6010",
];

export default function CustomerTrackScreen() {
  const router = useRouter();
  const { findMyEntryByPlateAndPhone } = useQueue();
  const [lookupPlate, setLookupPlate] = useState("");
  const [formattedLookup, setFormattedLookup] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+6017");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [showPrefixPicker, setShowPrefixPicker] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getSecureItem(REMEMBER_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          setLookupPlate(obj.plateNumber || "");
          setFormattedLookup(formatPlateNumber(obj.plateNumber || ""));
          setPhonePrefix(obj.phonePrefix || "+6017");
          setPhoneLocal(obj.phoneLocal || "");
          setRememberMe(true);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleLookup = async () => {
    if (!phoneLocal.trim()) {
      setMessage("Enter the phone number used to join the queue.");
      return;
    }

    setSearching(true);
    setMessage(null);

    const plateNumber = formattedLookup || formatPlateNumber(lookupPlate);
    const fullPhone = `${phonePrefix}${phoneLocal}`;

    const entry = await findMyEntryByPlateAndPhone(plateNumber, fullPhone);

    setSearching(false);

    if (!entry) {
      // Deliberately generic — doesn't reveal whether the plate exists but
      // the phone didn't match, vs. no entry at all for that plate.
      setMessage(
        "No queue entry found for that plate number and phone number.",
      );
      return;
    }

    try {
      if (rememberMe) {
        await setSecureItem(
          REMEMBER_KEY,
          JSON.stringify({ plateNumber, phonePrefix, phoneLocal }),
        );
      } else {
        await deleteSecureItem(REMEMBER_KEY);
      }
    } catch {
      // ignore storage errors
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
          Enter your plate number and the phone number you joined with to
          view your queue status.
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

        {formattedLookup ? <PlateBadge plateNumber={formattedLookup} /> : null}

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
              {PHONE_PREFIXES.map((p) => (
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

        <View style={styles.rememberRow}>
          <Switch value={rememberMe} onValueChange={setRememberMe} />
          <Text style={styles.rememberText}>Remember me</Text>
        </View>

        <Pressable
          style={[styles.button, searching && styles.buttonDisabled]}
          onPress={() => {
            void handleLookup();
          }}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator color="#EAF2FF" />
          ) : (
            <Text style={styles.buttonText}>Find My Queue</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      <Pressable
        style={{ alignItems: "center", marginTop: 10 }}
        onPress={() => router.push("/customer")}
      >
        <Text style={styles.linkText}>Back to main page</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 16,
    padding: 18,
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
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F4F8FF",
  },
  phoneRow: {
    flexDirection: "row",
    gap: 8,
    position: "relative",
    alignItems: "center",
    zIndex: 30,
  },
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
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rememberText: {
    color: "#D1DCF3",
    marginLeft: 8,
  },
  button: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#EAF2FF",
    fontWeight: "700",
  },
  message: {
    color: "#FFD0A8",
    fontWeight: "600",
  },
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
