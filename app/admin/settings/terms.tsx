import { logActivity } from "@/lib/activityLog";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function TermsEditorScreen() {
  const router = useRouter();
  const [terms, setTerms] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("showroom_settings")
      .select("terms_and_conditions")
      .eq("id", "main")
      .maybeSingle();

    if (error) setMessage(error.message);
    if (data) setTerms(data.terms_and_conditions || "");

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async () => {
    if (!terms.trim()) {
      setMessage("Terms & Conditions cannot be empty.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("showroom_settings")
      .update({ terms_and_conditions: terms.trim() })
      .eq("id", "main");

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    void logActivity({
      action: "terms.update",
      targetType: "showroom_settings",
      targetId: "main",
    });

    setMessage("Terms & Conditions saved.");
    router.replace("/admin/dashboard");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Terms & Conditions</Text>
          <Text style={styles.subtitle}>
            This text is shown to customers on the Join Queue screen before
            they agree and submit.
          </Text>

          {loading ? (
            <ActivityIndicator color="#D1DCF3" />
          ) : (
            <>
              <TextInput
                style={styles.textArea}
                value={terms}
                onChangeText={setTerms}
                placeholder="Enter Terms & Conditions"
                placeholderTextColor="#7E8EA8"
                multiline
                textAlignVertical="top"
              />

              <Pressable
                style={[styles.button, saving && styles.buttonDisabled]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Save</Text>
                )}
              </Pressable>

              {message ? <Text style={styles.message}>{message}</Text> : null}
            </>
          )}
        </View>
      </ScrollView>

      <Pressable
        style={{ alignItems: "center", marginTop: 12, marginBottom: 12 }}
        onPress={() => router.back()}
      >
        <Text style={styles.linkText}>Back to Settings</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070D1A" },
  content: { padding: 16 },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    borderRadius: 12,
  },
  title: { fontSize: 20, color: "#F6FAFF", fontWeight: "700" },
  subtitle: { color: "#9FB0CD", marginBottom: 12, lineHeight: 18 },
  textArea: {
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 8,
    padding: 10,
    color: "#F4F8FF",
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    minHeight: 220,
  },
  button: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#F8FBFF", fontWeight: "700" },
  message: { color: "#FFD0A8", marginTop: 8 },
  linkText: { color: "#C4D2FF", textAlign: "center" },
});
