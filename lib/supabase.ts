import AsyncStorage from "@react-native-async-storage/async-storage";
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

// The deployed web app's canonical origin. Auth redirect links (password
// reset, manager invites) must always point here — Supabase only honors a
// redirectTo that exactly matches an entry in its Redirect URLs allow list,
// so deriving this from window.location.origin would break whenever the
// flow is triggered from a preview deploy or a local dev server, silently
// falling back to the Site URL (the app's index page) instead.
export const SITE_URL =
  extras?.SITE_URL ||
  extras?.EXPO_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  process.env.EXPO_PUBLIC_SITE_URL ||
  "https://kpachargemanage.netlify.app";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase keys not found. Set SUPABASE_URL and SUPABASE_ANON_KEY in app config or env.",
  );
}

// AsyncStorage touches `window`, which doesn't exist during Expo Router's web SSR pass.
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};
const authStorage = typeof window === "undefined" ? noopStorage : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
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
