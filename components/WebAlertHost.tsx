import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { setWebAlertHandler, type WebAlertRequest } from "@/lib/alert";

type AlertButton = NonNullable<WebAlertRequest["buttons"]>[number];

// Web-only replacement for window.alert/confirm, styled like the app's other
// modals instead of the browser's "<site> says" dialog. Renders nothing on
// iOS/Android, where Alert.alert is used directly.
export default function WebAlertHost() {
  const [queue, setQueue] = useState<WebAlertRequest[]>([]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    setWebAlertHandler((request) => setQueue((current) => [...current, request]));
    return () => setWebAlertHandler(null);
  }, []);

  if (Platform.OS !== "web") return null;

  const current = queue[0];
  if (!current) return null;

  const buttons: AlertButton[] =
    current.buttons && current.buttons.length > 0
      ? current.buttons
      : [{ text: "OK" }];

  const press = (button?: AlertButton) => {
    setQueue((items) => items.slice(1));
    button?.onPress?.();
  };

  // Escape / backdrop behaves like Cancel when there is one, else like the
  // only button (matches window.alert / window.confirm).
  const dismiss = () =>
    press(
      buttons.find((b) => b.style === "cancel") ??
        (buttons.length === 1 ? buttons[0] : undefined),
    );

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <Pressable style={styles.overlay} onPress={dismiss}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? (
            <Text style={styles.message}>{current.message}</Text>
          ) : null}
          <View style={styles.buttonRow}>
            {buttons.map((button, index) => (
              <Pressable
                key={`${button.text ?? "button"}-${index}`}
                style={[
                  styles.button,
                  button.style === "cancel" && styles.buttonCancel,
                  button.style === "destructive" && styles.buttonDestructive,
                ]}
                onPress={() => press(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === "cancel" && styles.buttonTextCancel,
                  ]}
                >
                  {button.text ?? "OK"}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    width: "86%",
    maxWidth: 480,
    backgroundColor: "rgba(12,16,26,0.98)",
    borderRadius: 12,
    padding: 18,
    gap: 8,
  },
  title: {
    color: "#F6FAFF",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  message: {
    color: "#D1DCF4",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  button: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: "center",
  },
  buttonCancel: {
    backgroundColor: "transparent",
  },
  buttonDestructive: {
    backgroundColor: "rgba(214, 69, 69, 0.3)",
  },
  buttonText: {
    color: "#F8FBFF",
    fontWeight: "700",
    fontSize: 14,
  },
  buttonTextCancel: {
    color: "#C4D2FF",
  },
});
