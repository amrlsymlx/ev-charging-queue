import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

export default function ShowroomSettingsScreen() {
  const router = useRouter();
  const [showroomName, setShowroomName] = useState("Main Showroom");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("50");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("showroom_settings")
      .select("showroom_name, latitude, longitude, gps_radius_m")
      .eq("id", "main")
      .maybeSingle();

    if (data) {
      setShowroomName(data.showroom_name || "Main Showroom");
      setLat(String(data.latitude ?? ""));
      setLng(String(data.longitude ?? ""));
      setRadius(String(data.gps_radius_m ?? 50));
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async () => {
    setSaving(true);
    setMessage(null);

    const nlat = parseFloat(lat);
    const nlng = parseFloat(lng);
    const nradius = parseInt(radius || "0", 10) || 0;

    const payload = {
      id: "main",
      showroom_name: showroomName.trim(),
      latitude: Number.isFinite(nlat) ? nlat : null,
      longitude: Number.isFinite(nlng) ? nlng : null,
      gps_radius_m: nradius,
    } as any;

    const { error } = await supabase
      .from("showroom_settings")
      .upsert([payload]);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setMessage("Showroom settings saved.");
    router.replace("/admin/dashboard");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Showroom Settings</Text>

          {loading ? (
            <ActivityIndicator color="#D1DCF3" />
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={showroomName}
                onChangeText={setShowroomName}
                placeholder="Showroom Name"
                placeholderTextColor="#7E8EA8"
              />
              <TextInput
                style={styles.input}
                value={lat}
                onChangeText={setLat}
                placeholder="Latitude"
                placeholderTextColor="#7E8EA8"
                keyboardType="decimal-pad"
              />
              <TextInput
                style={styles.input}
                value={lng}
                onChangeText={setLng}
                placeholder="Longitude"
                placeholderTextColor="#7E8EA8"
                keyboardType="decimal-pad"
              />
              <TextInput
                style={styles.input}
                value={radius}
                onChangeText={setRadius}
                placeholder="GPS Radius (meters)"
                placeholderTextColor="#7E8EA8"
                keyboardType="numeric"
              />

              <Pressable
                style={styles.button}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Save</Text>
                )}
              </Pressable>

              {message ? <Text style={styles.message}>{message}</Text> : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070D1A" },
  content: { padding: 16 },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    borderRadius: 12,
  },
  title: { fontSize: 20, color: "#F6FAFF", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: 10,
    color: "#F4F8FF",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  button: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#F8FBFF", fontWeight: "700" },
  message: { color: "#FFD0A8", marginTop: 8 },
});
