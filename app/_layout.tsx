import Head from "expo-router/head";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";

import { QueueProvider, useQueue } from "@/context/QueueContext";
import { getSecureItem, setSecureItem } from "@/lib/secureStorage";
import { supabase } from "@/lib/supabase";

function DocumentTitle() {
  const { showroomName } = useQueue();
  return (
    <Head>
      <title>{`${showroomName} Charger`}</title>
    </Head>
  );
}

// Device-level (not true per-IP — this is a static site with no server to
// inspect request IPs) tracking: once a device has opened a customer-facing
// route, it can no longer land on the landing page ("/", with its SA/Manager
// login links) — even by editing the address bar back to it — unless it
// currently holds a valid staff session. This never blocks any route other
// than "/" itself.
const CUSTOMER_DEVICE_KEY = "customer_device_marked";

function CustomerDeviceGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const isCustomerRoute =
        pathname.startsWith("/customer") || pathname.startsWith("/public");

      if (isCustomerRoute) {
        try {
          await setSecureItem(CUSTOMER_DEVICE_KEY, "1");
        } catch {
          // ignore storage errors
        }
        return;
      }

      if (pathname !== "/") return;

      let marked = false;
      try {
        marked = (await getSecureItem(CUSTOMER_DEVICE_KEY)) === "1";
      } catch {
        marked = false;
      }
      if (!marked) return;

      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const role = user?.app_metadata?.role || user?.user_metadata?.role;
      const isStaff = role === "sa" || role === "manager" || role === "admin";
      if (isStaff) return;

      router.replace("/customer");
    })();
  }, [pathname, router]);

  return null;
}

export default function RootLayout() {
  return (
    <QueueProvider>
      <DocumentTitle />
      <CustomerDeviceGate />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: "#0B1020" },
          headerTintColor: "#EAF2FF",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#070D1A" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "EV Charging Queue" }} />
        <Stack.Screen name="customer/index" options={{ title: "QR Landing" }} />
        <Stack.Screen name="customer/join" options={{ title: "Join Queue" }} />
        <Stack.Screen
          name="customer/track"
          options={{ title: "Track Queue" }}
        />
        <Stack.Screen
          name="customer/status"
          options={{ title: "Queue Status" }}
        />
        <Stack.Screen
          name="public/board"
          options={{ title: "Live Queue Board" }}
        />
        <Stack.Screen name="sa/login" options={{ title: "SA Login" }} />
        <Stack.Screen name="sa/dashboard" options={{ title: "Dashboard" }} />
        <Stack.Screen name="admin/login" options={{ title: "Manager Login" }} />
        <Stack.Screen
          name="admin/reset-password"
          options={{ title: "Reset Password" }}
        />
        <Stack.Screen
          name="admin/dashboard"
          options={{ title: "Manager Dashboard" }}
        />
        <Stack.Screen
          name="admin/settings/blocked-plates"
          options={{ title: "Blocked Plate Numbers", presentation: "modal" }}
        />
        <Stack.Screen
          name="admin/settings/bays"
          options={{ title: "Charging Bays", presentation: "modal" }}
        />
        <Stack.Screen
          name="admin/settings/terms"
          options={{ title: "Terms & Conditions", presentation: "modal" }}
        />
        <Stack.Screen
          name="admin/settings/operating-hours"
          options={{ title: "Operating Hours", presentation: "modal" }}
        />
        <Stack.Screen
          name="admin/settings/showroom"
          options={{ title: "Showroom Settings", presentation: "modal" }}
        />
        <Stack.Screen
          name="admin/settings/create-sa"
          options={{ title: "Create SA Account", presentation: "modal" }}
        />
        <Stack.Screen
          name="admin/settings/create-manager"
          options={{ title: "Create Manager Account", presentation: "modal" }}
        />
      </Stack>
    </QueueProvider>
  );
}
