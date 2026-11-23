import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useQueue } from "@/context/QueueContext";
import { setWebAlertHandler, type WebAlertRequest } from "@/lib/alert";

type AlertButton = NonNullable<WebAlertRequest["buttons"]>[number];

// Web-only replacement for window.alert/confirm so the dialog header reads
// "<showroom name> says" instead of the browser's "<site> says". Renders
// nothing on iOS/Android, where Alert.alert is used directly.
export default function WebAlertHost() {
  const { showroomName } = useQueue();
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
          <Text style={styles.says}>{showroomName} says</Text>
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
                <Text style={styles.buttonText}>{button.text ?? "OK"}</Text>
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
    backgroundColor: "rgba(3, 7, 18, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#10213B",
    borderRadius: 16,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  says: {
    color: "#9FB0CD",
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    color: "#F6FAFF",
    fontSize: 17,
    fontWeight: "800",
  },
  message: {
    color: "#D1DCF4",
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  button: {
    backgroundColor: "#F26419",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  buttonCancel: {
    backgroundColor: "rgba(132, 158, 255, 0.2)",
  },
  buttonDestructive: {
    backgroundColor: "#D64545",
  },
  buttonText: {
    color: "#FFF6F2",
    fontWeight: "700",
    fontSize: 14,
  },
});
