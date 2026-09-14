import { showAlert } from "@/lib/alert";
import { SUPABASE_URL, supabase } from "@/lib/supabase";
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

const ID_RULES = [
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

const PASSWORD_RULES = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
];

export default function CreateSaScreen() {
  const router = useRouter();
  const { checkingAuth, authorized } = useRequireRole(
    ["manager", "admin"],
    "/admin/login",
  );
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const idRuleResults = ID_RULES.map((rule) => ({
    ...rule,
    met: rule.test(id),
  }));
  const idValid = idRuleResults.every((rule) => rule.met);

  const passwordRuleResults = PASSWORD_RULES.map((rule) => ({
    ...rule,
    met: rule.test(password),
  }));
  const passwordValid = passwordRuleResults.every((rule) => rule.met);

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
    if (!id.trim() || !password) {
      setMessage("Enter SA ID and password.");
      return;
    }

    if (!idValid) {
      setMessage("SA name does not meet all requirements.");
      return;
    }

    if (!passwordValid) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const normalizedId = id.trim().toLowerCase();
      const email = normalizedId.includes("@")
        ? normalizedId
        : `${normalizedId}@sa.internal`;
      // include current session token so the function can verify caller is a manager
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage("Manager session missing. Please Login again.");
        setSaving(false);
        return;
      }

      const payload = { email, password, name: id.trim() };

      const res = await supabase.functions.invoke("create-sa-account", {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.error) {
        // Fallback path for environments where invoke fails to reach the function.
        const functionUrl = buildFunctionUrl("create-sa-account");
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
        "SA account creation success!",
        `SA ID: ${normalizedId}\nPassword: ${password}`,
      );
      setId("");
      setPassword("");
      // navigate back to the dashboard's Settings tab so it can refresh
      router.replace({
        pathname: "/admin/dashboard",
        params: { tab: "settings" },
      });
    } catch (err: any) {
      const detail = err?.message || "Unknown error";
      setMessage(
        `Failed to create SA account. ${detail}. Ensure function is deployed and SUPABASE_SERVICE_ROLE_KEY secret is set.`,
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
          <Text style={styles.title}>Create SA Account</Text>
          <Text style={styles.subtitle}>Enter SA ID and password.</Text>

          <TextInput
            style={styles.input}
            value={id}
            onChangeText={setId}
            placeholder="SA ID"
            placeholderTextColor="#7E8EA8"
            autoCapitalize="none"
          />
          {id.length > 0 ? (
            <View style={styles.ruleList}>
              {idRuleResults.map((rule) => (
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
          {password.length > 0 ? (
            <View style={styles.ruleList}>
              {passwordRuleResults.map((rule) => (
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
              (saving || !idValid || !passwordValid) && styles.buttonDisabled,
            ]}
            onPress={onCreate}
            disabled={saving || !idValid || !passwordValid}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Create</Text>
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
    backgroundColor: "rgba(20, 40, 34, 0.98)",
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  inputFlex: {
    flex: 1,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    padding: 10,
    color: "#F4F8FF",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  eyeButton: { padding: 10 },
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
