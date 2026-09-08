import { GeocodeResult, searchAddress } from "@/lib/geocode";
import { useRef, useState } from "react";
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
import MapView, { Circle, Marker } from "react-native-maps";

const SEARCH_DEBOUNCE_MS = 500;
const DEFAULT_DELTA = 0.01;

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedLat = Number.parseFloat(latitude);
  const parsedLng = Number.parseFloat(longitude);
  const hasCoords = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

  const [region, setRegion] = useState({
    latitude: hasCoords ? parsedLat : referenceLatitude,
    longitude: hasCoords ? parsedLng : referenceLongitude,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  });

  const handleToggle = (value: boolean) => {
    onToggleEnabled(value);
    if (!value) {
      onChangeCoordinates("", "");
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const applyPickedLocation = (lat: number, lng: number) => {
    onChangeCoordinates(lat.toFixed(6), lng.toFixed(6));
    setRegion((prev) => ({ ...prev, latitude: lat, longitude: lng }));
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

          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={(event) => {
              const coordinate = event.nativeEvent.coordinate;
              applyPickedLocation(coordinate.latitude, coordinate.longitude);
            }}
          >
            <Circle
              center={{
                latitude: referenceLatitude,
                longitude: referenceLongitude,
              }}
              radius={radiusMeters}
              strokeColor="#2563eb"
              fillColor="rgba(37, 99, 235, 0.12)"
            />
            <Marker
              coordinate={{
                latitude: referenceLatitude,
                longitude: referenceLongitude,
              }}
              pinColor="#2563eb"
            />
            {hasCoords ? (
              <Marker
                coordinate={{ latitude: parsedLat, longitude: parsedLng }}
                draggable
                pinColor="#22c55e"
                onDragEnd={(event) => {
                  const coordinate = event.nativeEvent.coordinate;
                  applyPickedLocation(
                    coordinate.latitude,
                    coordinate.longitude,
                  );
                }}
              />
            ) : null}
          </MapView>

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
    height: 180,
    borderRadius: 8,
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
