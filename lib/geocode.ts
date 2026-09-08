export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
};

// Nominatim (OpenStreetMap) free geocoding search, no API key required.
export async function searchAddress(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Location search failed (${response.status}).`);
  }

  const data = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return data.map((item) => ({
    label: item.display_name,
    latitude: Number.parseFloat(item.lat),
    longitude: Number.parseFloat(item.lon),
  }));
}
