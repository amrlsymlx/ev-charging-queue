import { GeocodeResult, searchAddress } from "@/lib/geocode";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";

const SEARCH_DEBOUNCE_MS = 500;

type LeafletModule = {
  MapContainer: any;
  TileLayer: any;
  CircleMarker: any;
  Circle: any;
  useMap: any;
  useMapEvents: any;
};

export type LocationPickerCardProps = {
  title?: string;
  latitude: string;
  longitude: string;
  onChangeCoordinates: (latitude: string, longitude: string) => void;
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  referenceLatitude: number;
  referenceLongitude: number;
  radiusMeters: number;
  helperText?: string;
};

// Hoisted to module scope: defining these inside LocationPickerCard's render
// body gave them a new identity on every re-render, which made React
// unmount/remount the whole Leaflet map every time the parent re-rendered
// (e.g. every second from a live countdown tick) — Leaflet would crash
// mid-teardown with "Cannot read properties of undefined (reading
// '_leaflet_pos')". Stable component identity here lets react-leaflet just
// update props instead of recreating the map.
function MapClickHandler({
  leaflet,
  onChangeCoordinates,
}: {
  leaflet: LeafletModule;
  onChangeCoordinates: LocationPickerCardProps["onChangeCoordinates"];
}) {
  leaflet.useMapEvents({
    click: (event: any) => {
      const { lat: clickLat, lng: clickLng } = event.latlng;
      onChangeCoordinates(clickLat.toFixed(6), clickLng.toFixed(6));
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
  centerLat: number;
  centerLng: number;
  referenceLatitude: number;
  referenceLongitude: number;
  radiusMeters: number;
  hasCoords: boolean;
  parsedLat: number;
  parsedLng: number;
  onChangeCoordinates: LocationPickerCardProps["onChangeCoordinates"];
};

function WebMap({
  leaflet,
  centerLat,
  centerLng,
  referenceLatitude,
  referenceLongitude,
  radiusMeters,
  hasCoords,
  parsedLat,
  parsedLng,
  onChangeCoordinates,
}: WebMapProps) {
  const { MapContainer, TileLayer, CircleMarker, Circle } = leaflet;

  return (
    <View style={styles.mapHost}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={16}
        scrollWheelZoom
        style={{ height: 180, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={[referenceLatitude, referenceLongitude]}
          radius={radiusMeters}
          pathOptions={{
            color: "#2563eb",
            fillColor: "#2563eb",
            fillOpacity: 0.12,
          }}
        />
        <CircleMarker
          center={[referenceLatitude, referenceLongitude]}
          pathOptions={{ color: "#2563eb", fillColor: "#2563eb" }}
          radius={6}
        />
        {hasCoords ? (
          <CircleMarker
            center={[parsedLat, parsedLng]}
            pathOptions={{ color: "#22c55e", fillColor: "#4ade80" }}
            radius={10}
          />
        ) : null}
        <MapClickHandler
          leaflet={leaflet}
          onChangeCoordinates={onChangeCoordinates}
        />
        <SyncMapCenter
          leaflet={leaflet}
          centerLat={centerLat}
          centerLng={centerLng}
        />
      </MapContainer>
    </View>
  );
}

export default function LocationPickerCard({
  title = "GPS Info (temporary)",
  latitude,
  longitude,
  onChangeCoordinates,
  enabled,
  onToggleEnabled,
  referenceLatitude,
  referenceLongitude,
  radiusMeters,
  helperText,
}: LocationPickerCardProps) {
  const [leaflet, setLeaflet] = useState<LeafletModule | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedLat = Number.parseFloat(latitude);
  const parsedLng = Number.parseFloat(longitude);
  const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const centerLat = hasCoords ? parsedLat : referenceLatitude;
  const centerLng = hasCoords ? parsedLng : referenceLongitude;

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

  const handleToggle = (value: boolean) => {
    onToggleEnabled(value);
    if (!value) {
      onChangeCoordinates("", "");
      setSearchQuery("");
      setSearchResults([]);
    }
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
    onChangeCoordinates(
      result.latitude.toFixed(6),
      result.longitude.toFixed(6),
    );
    setSearchQuery(result.label);
    setSearchResults([]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            {enabled ? "Enabled" : "Disabled"}
          </Text>
          <Switch value={enabled} onValueChange={handleToggle} />
        </View>
      </View>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      {!enabled ? (
        <Text style={styles.disabledText}>
          GPS disabled — simulating unavailable location.
        </Text>
      ) : (
        <>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.input}
              value={searchQuery}
              onChangeText={onChangeSearchQuery}
              placeholder="Search for a location or address"
              placeholderTextColor="#7A8495"
            />
            {searching ? (
              <ActivityIndicator color="#D1DCF3" style={styles.searchSpinner} />
            ) : null}
            {searchResults.length > 0 ? (
              <ScrollView style={styles.searchResults} nestedScrollEnabled>
                {searchResults.map((result, index) => (
                  <Pressable
                    key={`${result.latitude}-${result.longitude}-${index}`}
                    style={styles.searchResultRow}
                    onPress={() => onSelectSearchResult(result)}
                  >
                    <Text style={styles.searchResultText} numberOfLines={2}>
                      {result.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {searchError ? (
              <Text style={styles.message}>{searchError}</Text>
            ) : null}
          </View>

          {leaflet ? (
            <WebMap
              leaflet={leaflet}
              centerLat={centerLat}
              centerLng={centerLng}
              referenceLatitude={referenceLatitude}
              referenceLongitude={referenceLongitude}
              radiusMeters={radiusMeters}
              hasCoords={hasCoords}
              parsedLat={parsedLat}
              parsedLng={parsedLng}
              onChangeCoordinates={onChangeCoordinates}
            />
          ) : (
            <Text style={styles.mapFallbackText}>
              Loading interactive map...
            </Text>
          )}

          <View style={styles.coordRow}>
            <TextInput
              style={[styles.input, styles.coordInput]}
              value={latitude}
              keyboardType="decimal-pad"
              onChangeText={(value) => onChangeCoordinates(value, longitude)}
              placeholder="Your Latitude"
              placeholderTextColor="#7A8495"
            />
            <TextInput
              style={[styles.input, styles.coordInput]}
              value={longitude}
              keyboardType="decimal-pad"
              onChangeText={(value) => onChangeCoordinates(latitude, value)}
              placeholder="Your Longitude"
              placeholderTextColor="#7A8495"
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontWeight: "700", fontSize: 17, color: "#F6FAFF" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { color: "#D1DCF3", fontSize: 13 },
  helperText: { color: "#D1DCF3", fontSize: 13 },
  disabledText: { color: "#FFD0A8", fontSize: 13 },
  searchWrap: { position: "relative", zIndex: 20 },
  searchSpinner: { position: "absolute", right: 10, top: 12 },
  searchResults: {
    maxHeight: 180,
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
  mapFallbackText: { color: "#C4D3EE", lineHeight: 18 },
  mapHost: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 0,
    borderColor: "transparent",
  },
  coordRow: { flexDirection: "row", gap: 8 },
  coordInput: { flex: 1 },
  input: {
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F4F8FF",
  },
  message: { color: "#FFD0A8", marginTop: 4 },
});
