import { showAlert } from "@/lib/alert";
import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from "@/lib/secureStorage";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import type { User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

export default function AdminLoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const isManager = (user: User) => {
    const role = user.app_metadata?.role || user.user_metadata?.role;
    return role === "manager" || role === "admin";
  };

  const onLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setMessage("Please enter manager email and password.");
      return;
    }

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

    if (!isManager(data.user)) {
      await supabase.auth.signOut();
      setMessage(
        "Invalid manager account. Try login as SA.",
      );
      setLoading(false);
      return;
    }

    setPassword("");
    setLoading(false);
    try {
      const KEY = "manager_credentials";
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
    router.replace({
      pathname: "/admin/dashboard",
      params: { adminEmail: data.user.email ?? normalizedEmail },
    });
  };

  const onOpenForgotPassword = () => {
    setForgotEmail(email.trim());
    setForgotMessage(null);
    setShowForgotModal(true);
  };

  const onSendResetLink = async () => {
    const normalizedEmail = forgotEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setForgotMessage("Enter your manager email.");
      return;
    }

    setForgotSending(true);
    setForgotMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: Linking.createURL("/admin/reset-password") },
    );

    setForgotSending(false);
    setShowForgotModal(false);
    setForgotEmail("");

    // Always show the same message, whether or not the email exists, so the
    // form can't be used to probe which manager emails are registered.
    showAlert(
      "Check your email",
      "If that email belongs to a manager account, a password reset link has been sent.",
    );

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("resetPasswordForEmail failed:", error.message);
    }
  };

  useEffect(() => {
    // load saved credentials on client only
    (async () => {
      try {
        const KEY = "manager_credentials";
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
      <View style={styles.card}>
        <Text style={[styles.title, styles.titleCentered]}>Manager Login</Text>

        <TextInput
          style={[styles.input, styles.fieldSpacing]}
          value={email}
          onChangeText={setEmail}
          placeholder="Manager Email"
          placeholderTextColor="#7E8EA8"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={[styles.inputRow, styles.fieldSpacing]}>
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
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
            },
            styles.fieldSpacing,
          ]}
        >
          <Switch value={rememberMe} onValueChange={setRememberMe} />
          <Text style={{ color: "#D1DCF3", marginLeft: 8 }}>Remember me</Text>
        </View>

        <Pressable style={styles.button} onPress={onLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF6F2" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={onOpenForgotPassword}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Forgot password?</Text>
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      <Pressable
        style={{ alignItems: "center", marginTop: 12 }}
        onPress={() => router.push("/")}
      >
        <Text style={styles.linkText}>Back to main page</Text>
      </Pressable>

      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your manager email and we&apos;ll send you a link to
              reset your password.
            </Text>

            <TextInput
              style={styles.input}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              placeholder="Manager Email"
              placeholderTextColor="#7E8EA8"
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />

            {forgotMessage ? (
              <Text style={styles.message}>{forgotMessage}</Text>
            ) : null}

            <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
              <Pressable
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => {
                  setShowForgotModal(false);
                  setForgotMessage(null);
                }}
                disabled={forgotSending}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.button, { flex: 1, marginTop: 0 }]}
                onPress={onSendResetLink}
                disabled={forgotSending}
              >
                {forgotSending ? (
                  <ActivityIndicator color="#FFF6F2" />
                ) : (
                  <Text style={styles.buttonText}>Send Link</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  title: {
    fontSize: 22,
    color: "#F6FAFF",
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: { color: "#D1DCF3", marginBottom: 8 },
  titleCentered: { textAlign: "center" },
  fieldSpacing: { marginBottom: 12 },
  input: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#F4F8FF",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  inputFlex: {
    flex: 1,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#F4F8FF",
  },
  eyeButton: {
    padding: 8,
    marginLeft: 6,
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    alignItems: "center",
  },
  buttonText: { color: "#FFF6F2", fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#DDE8FF", fontWeight: "700" },
  message: { color: "#FFD0A8", marginTop: 8 },
  linkText: { color: "#C4D2FF", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "rgba(12,16,26,0.98)",
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: {
    color: "#F6FAFF",
    fontWeight: "700",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8,
  },
});
