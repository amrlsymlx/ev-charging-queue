import { showAlert } from "@/lib/alert";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    if (!newPassword || newPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
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

            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              placeholderTextColor="#7E8EA8"
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm Password"
              placeholderTextColor="#7E8EA8"
              secureTextEntry
              autoCapitalize="none"
            />

            <Pressable
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={saving}
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
  input: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#F4F8FF",
    marginBottom: 10,
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
