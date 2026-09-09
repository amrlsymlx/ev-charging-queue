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
          name="admin/dashboard"
          options={{ title: "Manager Dashboard" }}
        />
      </Stack>
    </QueueProvider>
  );
}
