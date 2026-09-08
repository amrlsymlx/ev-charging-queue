import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";

import {
    deleteSecureItem,
    getSecureItem,
    setSecureItem,
} from "@/lib/secureStorage";
import { supabase } from "@/lib/supabase";

export default function SALoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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
    // persist credentials if requested
    try {
      const KEY = "sa_credentials";
      if (rememberMe) {
        await setSecureItem(
          KEY,
          JSON.stringify({ email: normalizedEmail, password }),
        );
      } else {
        await deleteSecureItem(KEY);
      }
    } catch (e) {
      // ignore storage errors
    }

    setPassword("");
    setLoading(false);

    router.replace({
      pathname: "/sa/dashboard",
      params: { saName, role: userRole },
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const KEY = "sa_credentials";
        const raw = await getSecureItem(KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          setEmail(obj.email || "");
          setPassword(obj.password || "");
          setRememberMe(true);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />
      <View style={styles.card}>
        <Text style={[styles.title, styles.titleCentered]}>SA Login</Text>

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

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 8,
          }}
        >
          <Switch value={rememberMe} onValueChange={setRememberMe} />
          <Text style={{ color: "#D1DCF3", marginLeft: 8 }}>Remember me</Text>
        </View>

        <Pressable style={styles.button} onPress={onLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <Pressable
        style={{ alignItems: "center", marginTop: 12 }}
        onPress={() => router.push("/")}
      >
        <Text style={styles.linkText}>Back to main page</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
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
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  title: {
    fontSize: 25,
    color: "#F6FAFF",
    fontWeight: "800",
    marginBottom: 8,
  },
  titleCentered: { textAlign: "center", width: "100%" },
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
  linkText: { color: "#C4D2FF", textAlign: "center", marginTop: 6 },
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
