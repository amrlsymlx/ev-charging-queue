import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  label: string;
  value: string; // "HH:MM"
  onChange: (value: string) => void;
};

function timeStringToDate(value: string): Date {
  const [h, m] = (value || "").split(":").map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return date;
}

function dateToTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// Native pickers (DateTimePicker) have no web implementation, so web renders
// a plain HTML <input type="time">. React.createElement (not JSX) sidesteps
// TypeScript's react-native JSX namespace, which doesn't know "input" — this
// branch never runs outside Platform.OS === "web".
export default function TimeField({ label, value, onChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === "web") {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        {React.createElement("input", {
          type: "time",
          value,
          onChange: (e: any) => onChange(e.target.value),
          style: webInputStyle,
        })}
      </View>
    );
  }

  const onPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (event.type === "dismissed" || !selectedDate) return;
    onChange(dateToTimeString(selectedDate));
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.valueButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.valueText}>{value || "--:--"}</Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={timeStringToDate(value)}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

const webInputStyle = {
  colorScheme: "dark",
  backgroundColor: "rgba(255,255,255,0.04)",
  color: "#F4F8FF",
  border: "none",
  borderRadius: 8,
  padding: 10,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
} as const;

const styles = StyleSheet.create({
  field: { flex: 1 },
  label: {
    color: "#C4D3EE",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  valueButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
  },
  valueText: { color: "#F4F8FF", fontWeight: "600" },
});
