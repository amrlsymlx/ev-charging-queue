import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { supabase } from "@/lib/supabase";

export default function SALoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onLogin = async () => {
    const rawId = email.trim().toLowerCase();

    if (!rawId || !password) {
      setMessage("Please enter SA ID and password.");
      return;
    }

    // Must match the same ID-to-email mapping used when the manager created the account.
    const normalizedEmail = rawId.includes("@")
      ? rawId
      : `${rawId}@sa.internal`;

    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      setMessage(error?.message || "Login failed. Please check credentials.");
      setLoading(false);
      return;
    }

    const { data: saAccount, error: saLookupError } = await supabase
      .from("sa_users")
      .select("name, role")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (saLookupError) {
      await supabase.auth.signOut();
      setMessage(saLookupError.message);
      setLoading(false);
      return;
    }

    if (!saAccount) {
      await supabase.auth.signOut();
      setMessage(
        "This SA account is not active. Ask manager to create or re-enable your account.",
      );
      setLoading(false);
      return;
    }

    const userRole =
      saAccount.role ||
      data.user.app_metadata?.role ||
      data.user.user_metadata?.role;

    if (userRole !== "sa" && userRole !== "admin") {
      await supabase.auth.signOut();
      setMessage("Account role is not allowed for SA dashboard.");
      setLoading(false);
      return;
    }

    const saName = saAccount.name || "SA";
    setPassword("");
    setLoading(false);

    router.replace({
      pathname: "/sa/dashboard",
      params: { saName, role: userRole },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <View style={styles.card}>
        <Text style={styles.title}>Service Advisor Login</Text>
        <Text style={styles.subtitle}>
          Use manager-created SA credentials to access dashboard controls.
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="SA ID"
          placeholderTextColor="#7E8EA8"
          autoCapitalize="none"
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#7E8EA8"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <Pressable
            onPress={() => setShowPassword((s) => !s)}
            style={styles.eyeButton}
          >
            <Ionicons
              name={showPassword ? "eye" : "eye-off"}
              size={20}
              color="#9FB0CD"
            />
          </Pressable>
        </View>

        <Pressable style={styles.button} onPress={onLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Login to Dashboard</Text>
          )}
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  inputFlex: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    color: "#F4F8FF",
  },
  eyeButton: { padding: 8, marginLeft: 6 },
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
