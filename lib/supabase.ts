import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import "react-native-url-polyfill/auto";

// Read keys from Expo `extra` config or environment for local dev.
const extras =
  (Constants.expoConfig && (Constants.expoConfig.extra as any)) ||
  (Constants.manifest && (Constants.manifest.extra as any));

// Support either SUPABASE_* or EXPO_PUBLIC_SUPABASE_* naming conventions
export const SUPABASE_URL =
  extras?.SUPABASE_URL ||
  extras?.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "";

export const SUPABASE_ANON_KEY =
  extras?.SUPABASE_ANON_KEY ||
  extras?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase keys not found. Set SUPABASE_URL and SUPABASE_ANON_KEY in app config or env.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export const createIsolatedSupabaseClient = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

export default supabase;
