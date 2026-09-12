import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import PublicBoardPanel from "@/components/PublicBoardPanel";
import SAQueuePanel from "@/components/SAQueuePanel";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";

export default function SADashboardScreen() {
  const router = useRouter();
  const { saName = "SA" } = useLocalSearchParams<{
    saName?: string;
    role?: string;
  }>();
  const [tab, setTab] = useState<"queue" | "board">("queue");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>SA Dashboard</Text>
          <Text style={styles.greeting}>Hello, {saName}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/")}
            style={styles.logoutButton}
            accessibilityLabel="Home"
          >
            <Ionicons name="home" size={20} color="#F4F8FF" />
          </Pressable>
          <Pressable
            onPress={async () => {
              try {
                await supabase.auth.signOut();
              } catch {
                // ignore
              }
              router.replace("/sa/login");
            }}
            style={styles.logoutButton}
            accessibilityLabel="Logout"
          >
            <Ionicons name="log-out" size={20} color="#F4F8FF" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "queue" ? (
          <SAQueuePanel saName={String(saName)} embedded />
        ) : (
          <PublicBoardPanel embedded />
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        <Pressable onPress={() => setTab("queue")} style={styles.tabButton}>
          <Ionicons
            name="flash"
            size={28}
            color={tab === "queue" ? "#F6FAFF" : "#9FB0CD"}
          />
        </Pressable>
        <Pressable onPress={() => setTab("board")} style={styles.tabButton}>
          <Ionicons
            name="grid"
            size={26}
            color={tab === "board" ? "#F6FAFF" : "#9FB0CD"}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 96,
  },
  heading: {
    color: "#F4F8FF",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  greeting: {
    color: "#C4D2FF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    position: "absolute",
    right: 16,
  },
  logoutButton: { padding: 8 },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    height: 64,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  tabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  bgGlowOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#39A0ED",
    opacity: 0.16,
    top: -90,
    right: -80,
  },
  bgGlowTwo: {
    position: "absolute",
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "#F26419",
    opacity: 0.14,
    bottom: -140,
    left: -120,
  },
});
