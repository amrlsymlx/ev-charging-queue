import { useQueue } from "@/context/QueueContext";
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

export default function AdminLoginScreen() {
  const router = useRouter();
  const { saUsers } = useQueue();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const onLogin = () => {
    const user = saUsers.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );

    if (!user || user.role !== "admin") {
      setMessage("Unknown admin email. Use an admin account.");
      return;
    }

    router.push({
      pathname: "/admin/dashboard",
      params: { adminName: user.name },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Manager Login</Text>
        <Text style={styles.subtitle}>
          Managers must login to view reports and records.
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Manager Email"
          placeholderTextColor="#7E8EA8"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable style={styles.button} onPress={onLogin}>
          <Text style={styles.buttonText}>Login as Manager</Text>
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
  },
  title: { fontSize: 22, color: "#F6FAFF", fontWeight: "800" },
  subtitle: { color: "#D1DCF3", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#F4F8FF",
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    alignItems: "center",
  },
  buttonText: { color: "#FFF6F2", fontWeight: "700" },
  message: { color: "#FFD0A8", marginTop: 8 },
});
