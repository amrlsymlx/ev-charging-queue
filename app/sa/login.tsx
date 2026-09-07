import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { useQueue } from "@/context/QueueContext";

export default function SALoginScreen() {
  const router = useRouter();
  const { saUsers } = useQueue();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const onLogin = () => {
    const user = saUsers.find(
      (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
    );

    if (!user) {
      setMessage(
        "Unknown SA email. Try aina.sa@showroom.local or farid.sa@showroom.local.",
      );
      return;
    }

    const saName = name.trim() || user.name;

    router.push({
      pathname: "/sa/dashboard",
      params: { saName, role: user.role },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <View style={styles.card}>
        <Text style={styles.title}>Service Advisor Login</Text>
        <Text style={styles.subtitle}>
          Use a registered SA email to access dashboard controls.
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="SA Email"
          placeholderTextColor="#7E8EA8"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Display Name (optional)"
          placeholderTextColor="#7E8EA8"
        />

        <Pressable style={styles.button} onPress={onLogin}>
          <Text style={styles.buttonText}>Login to Dashboard</Text>
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  title: {
    fontSize: 25,
    color: "#F6FAFF",
    fontWeight: "800",
  },
  subtitle: {
    color: "#D1DCF3",
    lineHeight: 20,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    color: "#F4F8FF",
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  message: {
    color: "#FFD0A8",
    fontWeight: "600",
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
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#F26419",
    opacity: 0.14,
    bottom: -130,
    left: -110,
  },
});
