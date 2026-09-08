import { GeocodeResult, searchAddress } from "@/lib/geocode";
import { supabase } from "@/lib/supabase";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import MapView, { Circle, Marker } from "react-native-maps";

const DEFAULT_LATITUDE = 3.139;
const DEFAULT_LONGITUDE = 101.6869;
const DEFAULT_DELTA = 0.01;
const SEARCH_DEBOUNCE_MS = 500;

function toFixedCoord(value: number): string {
  return value.toFixed(6);
}

function parseOrDefault(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ShowroomSettingsScreen() {
  const router = useRouter();
  const [showroomName, setShowroomName] = useState("Main Showroom");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("50");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [region, setRegion] = useState({
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  });

  const parsedLat = parseOrDefault(lat, DEFAULT_LATITUDE);
  const parsedLng = parseOrDefault(lng, DEFAULT_LONGITUDE);
  const parsedRadius = parseOrDefault(radius, 50);

  const applyPickedLocation = (latitude: number, longitude: number) => {
    setLat(toFixedCoord(latitude));
    setLng(toFixedCoord(longitude));
    setRegion((prev) => ({
      ...prev,
      latitude,
      longitude,
    }));
  };

  const openExternalMap = async () => {
    const url = `https://www.openstreetmap.org/?mlat=${parsedLat}&mlon=${parsedLng}#map=17/${parsedLat}/${parsedLng}`;
    await Linking.openURL(url);
  };

  const onChangeSearchQuery = (value: string) => {
    setSearchQuery(value);
    setSearchError(null);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!value.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchAddress(value);
        setSearchResults(results);
      } catch (e: any) {
        setSearchError(e?.message || "Location search failed.");
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const onSelectSearchResult = (result: GeocodeResult) => {
    applyPickedLocation(result.latitude, result.longitude);
    setSearchQuery(result.label);
    setSearchResults([]);
  };

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

      const loadedLat =
        typeof data.latitude === "number" ? data.latitude : DEFAULT_LATITUDE;
      const loadedLng =
        typeof data.longitude === "number" ? data.longitude : DEFAULT_LONGITUDE;
      setRegion((prev) => ({
        ...prev,
        latitude: loadedLat,
        longitude: loadedLng,
      }));
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const nextLat = Number.parseFloat(lat);
    const nextLng = Number.parseFloat(lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
    setRegion((prev) => ({
      ...prev,
      latitude: nextLat,
      longitude: nextLng,
    }));
  }, [lat, lng]);

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

              <View style={styles.mapCard}>
                <Text style={styles.mapTitle}>Map Picker</Text>

                <View style={styles.searchWrap}>
                  <TextInput
                    style={styles.input}
                    value={searchQuery}
                    onChangeText={onChangeSearchQuery}
                    placeholder="Search for a location or address"
                    placeholderTextColor="#7E8EA8"
                  />
                  {searching ? (
                    <ActivityIndicator
                      color="#D1DCF3"
                      style={styles.searchSpinner}
                    />
                  ) : null}
                  {searchResults.length > 0 ? (
                    <View style={styles.searchResults}>
                      {searchResults.map((result, index) => (
                        <Pressable
                          key={`${result.latitude}-${result.longitude}-${index}`}
                          style={styles.searchResultRow}
                          onPress={() => onSelectSearchResult(result)}
                        >
                          <Text
                            style={styles.searchResultText}
                            numberOfLines={2}
                          >
                            {result.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {searchError ? (
                    <Text style={styles.message}>{searchError}</Text>
                  ) : null}
                </View>

                <MapView
                  style={styles.map}
                  region={region}
                  onRegionChangeComplete={setRegion}
                  onPress={(event) => {
                    const coordinate = event.nativeEvent.coordinate;
                    applyPickedLocation(
                      coordinate.latitude,
                      coordinate.longitude,
                    );
                  }}
                >
                  <Circle
                    center={{ latitude: parsedLat, longitude: parsedLng }}
                    radius={parsedRadius}
                    strokeColor="#2563eb"
                    fillColor="rgba(37, 99, 235, 0.15)"
                  />
                  <Marker
                    coordinate={{ latitude: parsedLat, longitude: parsedLng }}
                    draggable
                    onDragEnd={(event) => {
                      const coordinate = event.nativeEvent.coordinate;
                      applyPickedLocation(
                        coordinate.latitude,
                        coordinate.longitude,
                      );
                    }}
                  />
                </MapView>

                <View style={styles.mapActionsRow}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={openExternalMap}
                  >
                    <Text style={styles.secondaryButtonText}>Open in map</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() =>
                      applyPickedLocation(region.latitude, region.longitude)
                    }
                  >
                    <Text style={styles.secondaryButtonText}>
                      Use map center
                    </Text>
                  </Pressable>
                </View>
              </View>

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
    marginTop: 10,
  },
  buttonText: { color: "#F8FBFF", fontWeight: "700" },
  mapCard: {
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  mapTitle: { color: "#F4F8FF", fontWeight: "700" },
  searchWrap: { position: "relative", zIndex: 20 },
  searchSpinner: { position: "absolute", right: 10, top: 12 },
  searchResults: {
    backgroundColor: "#101828",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    marginTop: -4,
    marginBottom: 8,
    overflow: "hidden",
  },
  searchResultRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  searchResultText: { color: "#E8F0FF" },
  map: {
    width: "100%",
    height: 220,
    borderRadius: 8,
  },
  mapActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#E8F0FF", fontWeight: "600" },
  message: { color: "#FFD0A8", marginTop: 8 },
});
