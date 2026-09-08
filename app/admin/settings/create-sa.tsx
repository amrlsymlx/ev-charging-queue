import { SUPABASE_URL, supabase } from "@/lib/supabase";
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

export default function CreateSaScreen() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

    setSaving(true);
    setMessage(null);

    try {
      const email = id.includes("@") ? id.trim() : `${id.trim()}@sa.internal`;
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

      setMessage("SA account created.");
      setId("");
      setPassword("");
      // navigate back to dashboard so it can refresh
      router.replace("/admin/dashboard");
    } catch (err: any) {
      const detail = err?.message || "Unknown error";
      setMessage(
        `Failed to create SA account. ${detail}. Ensure function is deployed and SUPABASE_SERVICE_ROLE_KEY secret is set.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const [checkingFn, setCheckingFn] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const checkFunctionConnectivity = async () => {
    setCheckingFn(true);
    setMessage(null);
    setDebugInfo(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage("Manager session missing — Login as manager first.");
        setCheckingFn(false);
        return;
      }

      // Try supabase invoke first
      const invokeRes = await supabase.functions.invoke("create-sa-account", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!invokeRes.error) {
        setMessage("Function reachable (invoke succeeded).");
        setCheckingFn(false);
        setDebugInfo(JSON.stringify(invokeRes, null, 2));
        return;
      }

      // If invoke reported an error, attempt direct fetch to function URL for more details
      const fnUrl = (() => {
        try {
          const host = new URL(SUPABASE_URL).host;
          const projectRef = host.split(".")[0];
          return projectRef
            ? `https://${projectRef}.functions.supabase.co/create-sa-account`
            : null;
        } catch {
          return null;
        }
      })();

      if (!fnUrl) {
        setMessage(
          `Unable to derive function URL from SUPABASE_URL; invoke returned: ${invokeRes.error?.message || JSON.stringify(invokeRes)}`,
        );
        setCheckingFn(false);
        setDebugInfo(JSON.stringify(invokeRes, null, 2));
        return;
      }

      try {
        const resp = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        });

        const text = await resp.text();
        if (!resp.ok) {
          setMessage(`Function HTTP ${resp.status}: ${text}`);
        } else {
          setMessage(`Function reachable (HTTP ${resp.status}): ${text}`);
        }
        setDebugInfo(`fetchResponse: ${resp.status}\nbody:\n${text}`);
      } catch (fetchErr: any) {
        setMessage(fetchErr?.message || String(fetchErr));
        setDebugInfo(
          JSON.stringify({ invokeRes, fetchError: String(fetchErr) }, null, 2),
        );
      }
    } catch (err: any) {
      setMessage(err?.message || String(err));
      setDebugInfo(String(err));
    } finally {
      setCheckingFn(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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

        <Pressable style={styles.button} onPress={onCreate} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Create</Text>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.button,
            {
              marginTop: 8,
              backgroundColor: "transparent",
              borderWidth: 0,
              borderColor: "transparent",
            },
          ]}
          onPress={checkFunctionConnectivity}
          disabled={checkingFn}
        >
          {checkingFn ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Check Function Connectivity</Text>
          )}
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {(() => {
          try {
            const host = new URL(SUPABASE_URL).host;
            const projectRef = host.split(".")[0];
            const fnUrl = projectRef
              ? `https://${projectRef}.functions.supabase.co/create-sa-account`
              : null;
            return fnUrl ? (
              <Text style={[styles.message, { color: "#A8D0FF" }]}>
                Function URL: {fnUrl}
              </Text>
            ) : null;
          } catch {
            return null;
          }
        })()}

        {debugInfo ? (
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.message, { color: "#9FB0CD" }]}>
              Debug info:
            </Text>
            <Text style={{ color: "#8EA6C9", fontSize: 12 }}>{debugInfo}</Text>
          </View>
        ) : null}
      </View>
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
  button: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#F8FBFF", fontWeight: "700" },
  message: { color: "#FFD0A8", marginTop: 8 },
});
