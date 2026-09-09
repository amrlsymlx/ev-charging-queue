import { showAlert } from "@/lib/alert";
import { SUPABASE_URL, supabase } from "@/lib/supabase";
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

export default function CreateManagerScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

      const payload = { email: normalizedEmail, name: trimmedName };

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

  return (
    <SafeAreaView style={styles.container}>
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

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Manager Email"
          placeholderTextColor="#7E8EA8"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable
          style={[
            styles.button,
            (saving || !email.trim() || !displayName.trim()) &&
              styles.buttonDisabled,
          ]}
          onPress={onCreate}
          disabled={saving || !email.trim() || !displayName.trim()}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Send Invite</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      <Pressable
        style={{ alignItems: "center", marginTop: 12 }}
        onPress={() => router.back()}
      >
        <Text style={styles.linkText}>Back to Settings</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070D1A", padding: 16 },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    borderRadius: 12,
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
