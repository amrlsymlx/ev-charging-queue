import { showAlert } from "@/lib/alert";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const PASSWORD_RULES = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    key: "uppercase",
    label: "At least one uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    key: "number",
    label: "At least one number",
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    key: "special",
    label: "At least one special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
];

// Supabase's password-recovery email links back to this screen with
// access_token/refresh_token in the URL (query on native deep links, hash
// fragment on web). The app's Supabase client has detectSessionInUrl off
// (see lib/supabase.ts) so we parse those tokens ourselves and establish
// the recovery session before letting the manager set a new password.
function parseAuthTokensFromUrl(url: string) {
  const fragment = url.split("#")[1] ?? "";
  const query = url.split("?")[1]?.split("#")[0] ?? "";
  const params = new URLSearchParams(fragment || query);

  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
    error: params.get("error_description") || params.get("error"),
  };
}

export default function AdminResetPasswordScreen() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isInvite, setIsInvite] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ruleResults = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        met: rule.test(newPassword),
      })),
    [newPassword],
  );
  const passwordValid = ruleResults.every((rule) => rule.met);
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = passwordValid && passwordsMatch && !saving;

  useEffect(() => {
    (async () => {
      try {
        const currentUrl =
          typeof window !== "undefined" ? window.location.href : "";
        const { accessToken, refreshToken, type, error } =
          parseAuthTokensFromUrl(currentUrl);

        setIsInvite(type === "invite" || type === "signup");

        if (error) {
          setMessage(error);
          setChecking(false);
          return;
        }

        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            setMessage(setSessionError.message);
            setChecking(false);
            return;
          }

          // Drop the tokens from the visible URL now that the session is set.
          if (typeof window !== "undefined" && window.history?.replaceState) {
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
          }

          setSessionReady(true);
          setChecking(false);
          return;
        }

        // No tokens in the URL — check whether a recovery session already
        // exists (e.g. the client already picked it up before this mounted).
        const { data } = await supabase.auth.getUser();
        setSessionReady(!!data.user);
        setChecking(false);
      } catch {
        setChecking(false);
      }
    })();
  }, []);

  const onSubmit = async () => {
    if (!passwordValid) {
      setMessage("Password does not meet all requirements.");
      return;
    }

    if (!passwordsMatch) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    showAlert(
      isInvite ? "Account ready" : "Password updated",
      isInvite
        ? "Your password has been set. Please log in to continue."
        : "Your password has been reset. Please log in with your new password.",
    );
    router.replace("/admin/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {isInvite ? "Welcome to the Team" : "Reset Manager Password"}
        </Text>

        {checking ? (
          <ActivityIndicator color="#D1DCF3" />
        ) : !sessionReady ? (
          <>
            <Text style={styles.subtitle}>
              {isInvite
                ? "This invite link is invalid or has expired. Ask a manager to resend your invite."
                : "This reset link is invalid or has expired. Request a new one from the manager login screen."}
            </Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <Pressable
              style={styles.button}
              onPress={() => router.replace("/admin/login")}
            >
              <Text style={styles.buttonText}>Back to Login</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {isInvite
                ? "Your email has been verified. Set a password to activate your manager account."
                : "Enter a new password."}
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New Password"
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

            {newPassword.length > 0 ? (
              <View style={styles.ruleList}>
                {ruleResults.map((rule) => (
                  <View key={rule.key} style={styles.ruleRow}>
                    <Ionicons
                      name={rule.met ? "checkmark-circle" : "close-circle"}
                      size={16}
                      color={rule.met ? "#7FE0A8" : "#FF9B9B"}
                    />
                    <Text
                      style={[
                        styles.ruleText,
                        rule.met && styles.ruleTextMet,
                      ]}
                    >
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm Password"
                placeholderTextColor="#7E8EA8"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowConfirmPassword((s) => !s)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye" : "eye-off"}
                  size={20}
                  color="#9FB0CD"
                />
              </Pressable>
            </View>

            {confirmPassword.length > 0 && !passwordsMatch ? (
              <Text style={styles.mismatchText}>Passwords do not match.</Text>
            ) : null}

            <Pressable
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {isInvite ? "Set Password & Activate" : "Set New Password"}
                </Text>
              )}
            </Pressable>

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D1A",
    justifyContent: "center",
    paddingHorizontal: 16,
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
    fontSize: 20,
    color: "#F6FAFF",
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: { color: "#D1DCF3", marginBottom: 12, textAlign: "center" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
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
  ruleList: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  ruleText: {
    color: "#D1DCF3",
    marginLeft: 6,
    fontSize: 13,
  },
  ruleTextMet: {
    color: "#7FE0A8",
  },
  mismatchText: {
    color: "#FF9B9B",
    marginBottom: 10,
    fontSize: 13,
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#FFF6F2", fontWeight: "700" },
  message: { color: "#FFD0A8", marginTop: 8, textAlign: "center" },
});
