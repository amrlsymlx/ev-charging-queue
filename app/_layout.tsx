import { Stack } from "expo-router";

import { QueueProvider } from "@/context/QueueContext";

export default function RootLayout() {
  return (
    <QueueProvider>
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
