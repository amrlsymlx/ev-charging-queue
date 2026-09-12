import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

const SHARE_LINKS = [
  { key: "customer", label: "Customer QR Landing", path: "/customer" },
  { key: "board", label: "Live Queue Board", path: "/public/board" },
] as const;

export default function Index() {
  const [showroomName, setShowroomName] = useState("Showroom");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const loadShowroom = async () => {
      const { data, error } = await supabase
        .from("showroom_settings")
        .select("showroom_name")
        .eq("id", "main")
        .maybeSingle();

      if (!error && data) {
        setShowroomName(data.showroom_name || "Showroom");
      }
    };

    void loadShowroom();
  }, []);

  const copyLink = async (key: string, path: string) => {
    await Clipboard.setStringAsync(Linking.createURL(path));
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgCircleOne} />
      <View style={styles.bgCircleTwo} />

      <View style={styles.card}>
        <Text style={styles.eyebrow}>{showroomName}</Text>
        <Text style={styles.title}>EV Charger Queue Management</Text>

        <View style={styles.buttonRow}>
          <Link href="/customer" asChild>
            <Pressable style={styles.primaryActionButtonRow}>
              <Text style={styles.primaryButtonText}>Customer QR Landing</Text>
            </Pressable>
          </Link>

          <Link href="/public/board" asChild>
            <Pressable style={styles.boardActionButtonRow}>
              <Text style={styles.boardButtonText}>Live Queue Board</Text>
            </Pressable>
          </Link>

          <Link href="/sa/login" asChild>
            <Pressable style={styles.secondaryActionButtonRow}>
              <Text style={styles.secondaryButtonText}>SA Login</Text>
            </Pressable>
          </Link>

          <Link href="/admin/login" asChild>
            <Pressable style={styles.adminActionButtonRow}>
              <Text style={styles.adminButtonText}>Manager Login</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Shareable Links</Text>

        {SHARE_LINKS.map(({ key, label, path }) => {
          const link = Linking.createURL(path);
          const isCopied = copiedKey === key;
          return (
            <View key={key} style={styles.linkRow}>
              <View style={styles.linkTextWrap}>
                <Text style={styles.linkLabel}>{label}</Text>
                <Text style={styles.linkUrl} numberOfLines={1}>
                  {link}
                </Text>
              </View>
              <Pressable
                style={styles.copyButton}
                onPress={() => copyLink(key, path)}
                accessibilityLabel={`Copy ${label} link`}
              >
                <Ionicons
                  name={isCopied ? "checkmark" : "copy-outline"}
                  size={16}
                  color="#F4F8FF"
                />
                <Text style={styles.copyButtonText}>
                  {isCopied ? "Copied" : "Copy"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    paddingHorizontal: 8,
    paddingVertical: 12,
    justifyContent: "center",
    overflow: "hidden",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 10,
    gap: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    alignItems: "center",
  },
  eyebrow: {
    color: "#B7CBFF",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
    textAlign: "center",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    color: "#F6FAFF",
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: "#D1DCF4",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#F26419",
  },
  primaryButtonText: {
    color: "#FFF6F2",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: "#10213B",
  },
  secondaryButtonText: {
    color: "#EAF2FF",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  adminButtonText: {
    color: "#E8FFF0",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 8,
  },
  primaryActionButtonRow: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
    flex: 1,
  },
  secondaryActionButtonRow: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderWidth: 0,
    borderColor: "transparent",
    flex: 1,
  },
  adminActionButtonRow: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124, 255, 186, 0.12)",
    borderWidth: 0,
    borderColor: "transparent",
    flex: 1,
  },
  boardActionButtonRow: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(242, 196, 76, 0.18)",
    borderWidth: 0,
    borderColor: "transparent",
    flex: 1,
  },
  boardButtonText: {
    color: "#FFF6E0",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  linkTextWrap: {
    flex: 1,
  },
  linkLabel: {
    color: "#F4F8FF",
    fontWeight: "700",
    fontSize: 13,
  },
  linkUrl: {
    color: "#9FB0CD",
    fontSize: 12,
    marginTop: 2,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  copyButtonText: {
    color: "#F4F8FF",
    fontWeight: "700",
    fontSize: 12,
  },
  bgCircleOne: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#F26419",
    opacity: 0.18,
    top: -50,
    right: -50,
  },
  bgCircleTwo: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#39A0ED",
    opacity: 0.2,
    bottom: -90,
    left: -90,
  },
});
