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

const DEFAULT_LATITUDE = 3.139;
const DEFAULT_LONGITUDE = 101.6869;
const SEARCH_DEBOUNCE_MS = 500;

type LeafletModule = {
  MapContainer: any;
  TileLayer: any;
  CircleMarker: any;
  Circle: any;
  useMap: any;
  useMapEvents: any;
};

function parseOrDefault(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Hoisted to module scope: defining these inside the screen's render body
// gave them a new identity on every re-render, which made React
// unmount/remount the whole Leaflet map every time the parent re-rendered —
// Leaflet would crash mid-teardown with "Cannot read properties of
// undefined (reading '_leaflet_pos')". Stable component identity here lets
// react-leaflet just update props instead of recreating the map.
function MapClickHandler({
  leaflet,
  onPick,
}: {
  leaflet: LeafletModule;
  onPick: (latitude: number, longitude: number) => void;
}) {
  leaflet.useMapEvents({
    click: (event: any) => {
      const { lat: latitude, lng: longitude } = event.latlng;
      onPick(latitude, longitude);
    },
  });
  return null;
}

function SyncMapCenter({
  leaflet,
  centerLat,
  centerLng,
}: {
  leaflet: LeafletModule;
  centerLat: number;
  centerLng: number;
}) {
  const map = leaflet.useMap();
  useEffect(() => {
    map.setView([centerLat, centerLng]);
  }, [map, centerLat, centerLng]);
  return null;
}

type WebMapProps = {
  leaflet: LeafletModule;
  parsedLat: number;
  parsedLng: number;
  parsedRadius: number;
  onPick: (latitude: number, longitude: number) => void;
};

function WebMap({
  leaflet,
  parsedLat,
  parsedLng,
  parsedRadius,
  onPick,
}: WebMapProps) {
  const { MapContainer, TileLayer, CircleMarker, Circle } = leaflet;

  return (
    <View style={styles.mapHost}>
      <MapContainer
        center={[parsedLat, parsedLng]}
        zoom={16}
        scrollWheelZoom
        style={styles.webLeafletMap as any}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={[parsedLat, parsedLng]}
          radius={parsedRadius}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 0.15,
          }}
        />
        <CircleMarker
          center={[parsedLat, parsedLng]}
          pathOptions={{ color: "#2563eb", fillColor: "#60a5fa" }}
          radius={10}
        />
        <MapClickHandler leaflet={leaflet} onPick={onPick} />
        <SyncMapCenter
          leaflet={leaflet}
          centerLat={parsedLat}
          centerLng={parsedLng}
        />
      </MapContainer>
    </View>
  );
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
  const [leaflet, setLeaflet] = useState<LeafletModule | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedLat = parseOrDefault(lat, DEFAULT_LATITUDE);
  const parsedLng = parseOrDefault(lng, DEFAULT_LONGITUDE);
  const parsedRadius = parseOrDefault(radius, 50);

  const openExternalMap = async () => {
    const url = `https://www.openstreetmap.org/?mlat=${parsedLat}&mlon=${parsedLng}#map=17/${parsedLat}/${parsedLng}`;
    await Linking.openURL(url);
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
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    const mod = require("react-leaflet") as LeafletModule;
    setLeaflet(mod);
  }, []);

  const applyPickedLocation = (latitude: number, longitude: number) => {
    setLat(latitude.toFixed(6));
    setLng(longitude.toFixed(6));
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
                <Text style={styles.mapFallbackText}>
                  Search for an address or click directly on the map to pick
                  latitude and longitude.
                </Text>

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

                {leaflet ? (
                  <WebMap
                    leaflet={leaflet}
                    parsedLat={parsedLat}
                    parsedLng={parsedLng}
                    parsedRadius={parsedRadius}
                    onPick={applyPickedLocation}
                  />
                ) : (
                  <Text style={styles.mapFallbackText}>
                    Loading interactive map...
                  </Text>
                )}

                <View style={styles.mapActionsRow}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={openExternalMap}
                  >
                    <Text style={styles.secondaryButtonText}>Open in map</Text>
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
    borderWidth: 0,
    borderColor: "transparent",
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
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  mapTitle: { color: "#F4F8FF", fontWeight: "700" },
  mapFallbackText: { color: "#C4D3EE", lineHeight: 18 },
  searchWrap: { position: "relative", zIndex: 20 },
  searchSpinner: { position: "absolute", right: 10, top: 12 },
  searchResults: {
    backgroundColor: "#101828",
    borderWidth: 0,
    borderColor: "transparent",
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
  mapHost: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 0,
    borderColor: "transparent",
  },
  webLeafletMap: {
    height: 260,
    width: "100%",
  },
  mapActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#E8F0FF", fontWeight: "600" },
  message: { color: "#FFD0A8", marginTop: 8 },
});
