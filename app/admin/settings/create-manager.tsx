import { showAlert } from "@/lib/alert";
import { SITE_URL, SUPABASE_URL, supabase } from "@/lib/supabase";
import { useRequireRole } from "@/lib/useRequireRole";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_RULES = [
  {
    key: "length",
    label: "At least 5 characters",
    test: (value: string) => value.trim().length >= 5,
  },
  {
    key: "alphanumeric",
    label: "Letters and numbers only",
    test: (value: string) => /^[A-Za-z0-9]+$/.test(value.trim()),
  },
];

const EMAIL_RULES = [
  {
    key: "format",
    label: "Valid email address",
    test: (value: string) => EMAIL_FORMAT.test(value.trim()),
  },
];

export default function CreateManagerScreen() {
  const router = useRouter();
  const { checkingAuth, authorized } = useRequireRole(
    ["manager", "admin"],
    "/admin/login",
  );
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const emailRuleResults = EMAIL_RULES.map((rule) => ({
    ...rule,
    met: rule.test(email),
  }));
  const isEmailValid = emailRuleResults.every((rule) => rule.met);

  const nameRuleResults = NAME_RULES.map((rule) => ({
    ...rule,
    met: rule.test(displayName),
  }));
  const isNameValid = nameRuleResults.every((rule) => rule.met);

  const buildFunctionUrl = (fnName: string) => {
    try {
      const host = new URL(SUPABASE_URL).host;
      const projectRef = host.split(".")[0];
      if (!projectRef) return null;
      return `https://${projectRef}.functions.supabase.co/${fnName}`;
    } catch {
      return null;
    }
  };

  const onCreate = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!normalizedEmail || !trimmedName) {
      setMessage("Enter manager email and display name.");
      return;
    }

    if (!EMAIL_FORMAT.test(normalizedEmail)) {
      setMessage("Enter a valid email address.");
      return;
    }

    if (!isNameValid) {
      setMessage("Display name does not meet all requirements.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // include current session token so the function can verify caller is a manager
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage("Manager session missing. Please Login again.");
        setSaving(false);
        return;
      }

      // The edge function runs server-side and has no notion of this app's
      // origin, so the client (which does) passes the accept-invite
      // destination explicitly — same URL admin/login.tsx uses for its own
      // password-reset flow.
      const payload = {
        email: normalizedEmail,
        name: trimmedName,
        redirectTo: `${SITE_URL}/admin/reset-password`,
      };

      const res = await supabase.functions.invoke("create-manager-account", {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.error) {
        // Fallback path for environments where invoke fails to reach the function.
        const functionUrl = buildFunctionUrl("create-manager-account");
        if (!functionUrl) {
          throw new Error(
            "Unable to resolve Edge Function URL from SUPABASE_URL.",
          );
        }

        const fallbackResponse = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!fallbackResponse.ok) {
          const raw = await fallbackResponse.text();
          throw new Error(
            `Edge Function HTTP ${fallbackResponse.status}: ${raw || "request failed"}`,
          );
        }
      }

      showAlert(
        "Invite sent!",
        `${trimmedName} <${normalizedEmail}> will receive an email to verify their address and set a password.`,
      );
      setEmail("");
      setDisplayName("");
      // navigate back to the dashboard's Settings tab so it can refresh
      router.replace({
        pathname: "/admin/dashboard",
        params: { tab: "settings" },
      });
    } catch (err: any) {
      const detail = err?.message || "Unknown error";
      setMessage(
        `Failed to invite manager account. ${detail}. Ensure function is deployed and SUPABASE_SERVICE_ROLE_KEY secret is set.`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth || !authorized) {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.overlay}>
          <ActivityIndicator color="#D1DCF3" />
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => router.back()}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Create Manager Account</Text>
          <Text style={styles.subtitle}>
            Enter the new manager&apos;s email and display name. They&apos;ll
            get an email to verify their address and set their own password.
          </Text>

          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display Name"
            placeholderTextColor="#7E8EA8"
          />
          {displayName.length > 0 ? (
            <View style={styles.ruleList}>
              {nameRuleResults.map((rule) => (
                <View key={rule.key} style={styles.ruleRow}>
                  <Ionicons
                    name={rule.met ? "checkmark-circle" : "close-circle"}
                    size={16}
                    color={rule.met ? "#7FE0A8" : "#FF9B9B"}
                  />
                  <Text style={[styles.ruleText, rule.met && styles.ruleTextMet]}>
                    {rule.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Manager Email"
            placeholderTextColor="#7E8EA8"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {email.length > 0 ? (
            <View style={styles.ruleList}>
              {emailRuleResults.map((rule) => (
                <View key={rule.key} style={styles.ruleRow}>
                  <Ionicons
                    name={rule.met ? "checkmark-circle" : "close-circle"}
                    size={16}
                    color={rule.met ? "#7FE0A8" : "#FF9B9B"}
                  />
                  <Text style={[styles.ruleText, rule.met && styles.ruleTextMet]}>
                    {rule.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            style={[
              styles.button,
              (saving || !isEmailValid || !isNameValid) &&
                styles.buttonDisabled,
            ]}
            onPress={onCreate}
            disabled={saving || !isEmailValid || !isNameValid}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Send Invite</Text>
            )}
          </Pressable>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            style={{ alignItems: "center", marginTop: 12 }}
            onPress={() => router.back()}
          >
            <Text style={styles.linkText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "rgba(12,16,26,0.98)",
    padding: 18,
    borderRadius: 14,
  },
  title: { fontSize: 20, color: "#F6FAFF", fontWeight: "700" },
  subtitle: { color: "#9FB0CD", marginBottom: 8 },
  input: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    padding: 10,
    color: "#F4F8FF",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  ruleList: {
    marginTop: -4,
    marginBottom: 8,
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
  button: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: { color: "#F8FBFF", fontWeight: "700" },
  message: { color: "#FFD0A8", marginTop: 8 },
  linkText: { color: "#C4D2FF", textAlign: "center", marginTop: 6 },
});
