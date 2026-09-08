import { Alert, Platform } from "react-native";

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

// RN's Alert.alert only implements ios/android and silently no-ops on web.
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join("\n\n");

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((b) => b.style === "cancel");
  const confirmButton =
    buttons.find((b) => b.style === "destructive") ??
    buttons[buttons.length - 1];

  if (window.confirm(text)) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}

export async function promptForInput(
  title: string,
  placeholder?: string,
  defaultValue?: string,
): Promise<string | null> {
  if (Platform.OS === "web") {
    const result = window.prompt(
      [title, placeholder].filter(Boolean).join("\n"),
      defaultValue,
    );
    return result === null ? null : String(result);
  }

  // On native, use Alert.prompt where available (iOS). Fallback to Alert.alert.
  return new Promise((resolve) => {
    // @ts-ignore - Alert.prompt may not exist on Android
    if (typeof (Alert as any).prompt === "function") {
      (Alert as any).prompt(
        title,
        placeholder,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
          { text: "OK", onPress: (val: string) => resolve(val) },
        ],
        "plain-text",
        defaultValue,
      );
      return;
    }

    Alert.alert(title, placeholder, [
      { text: "OK", onPress: () => resolve(null) },
    ]);
  });
}
