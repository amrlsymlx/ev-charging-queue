import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
};

function dateStringToDate(value: string): Date {
  const [y, m, d] = (value || "").split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function dateToDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Native pickers (DateTimePicker) have no web implementation, so web renders
// a plain HTML <input type="date">. React.createElement (not JSX) sidesteps
// TypeScript's react-native JSX namespace, which doesn't know "input" — this
// branch never runs outside Platform.OS === "web".
export default function DateField({ value, onChange, placeholder }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === "web") {
    return React.createElement("input", {
      type: "date",
      value,
      onChange: (e: any) => onChange(e.target.value),
      style: webInputStyle,
    });
  }

  const onPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    if (event.type === "dismissed" || !selectedDate) return;
    onChange(dateToDateString(selectedDate));
  };

  return (
    <View>
      <Pressable style={styles.valueButton} onPress={() => setShowPicker(true)}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value || placeholder || "Select date"}
        </Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={dateStringToDate(value)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
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
  marginBottom: 8,
  boxSizing: "border-box",
} as const;

const styles = StyleSheet.create({
  valueButton: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  valueText: { color: "#F4F8FF", fontWeight: "600" },
  placeholderText: { color: "#7E8EA8" },
});
