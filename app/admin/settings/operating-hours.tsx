import DateField from "@/components/DateField";
import TimeField from "@/components/TimeField";
import { logActivity } from "@/lib/activityLog";
import { showAlert } from "@/lib/alert";
import { DAY_LABELS, DISPLAY_DAY_ORDER, formatHHMM } from "@/lib/operatingHours";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";

type DayForm = {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  lastRegistrationTime: string;
};

type Holiday = {
  holiday_date: string;
  label: string | null;
};

function defaultDayForm(dayOfWeek: number): DayForm {
  return {
    dayOfWeek,
    isClosed: false,
    openTime: "09:00",
    closeTime: "18:00",
    lastRegistrationTime: "17:30",
  };
}

export default function OperatingHoursScreen() {
  const router = useRouter();
  const [days, setDays] = useState<DayForm[]>(
    DISPLAY_DAY_ORDER.map(defaultDayForm),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayLabel, setHolidayLabel] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [holidayMessage, setHolidayMessage] = useState<string | null>(null);

  const loadHours = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("operating_hours")
      .select(
        "day_of_week, is_closed, open_time, close_time, last_registration_time",
      )
      .order("day_of_week", { ascending: true });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const byDay = new Map((data || []).map((row: any) => [row.day_of_week, row]));

    setDays(
      DISPLAY_DAY_ORDER.map((dayOfWeek) => {
        const row = byDay.get(dayOfWeek);
        if (!row) return defaultDayForm(dayOfWeek);
        return {
          dayOfWeek,
          isClosed: !!row.is_closed,
          openTime: formatHHMM(row.open_time),
          closeTime: formatHHMM(row.close_time),
          lastRegistrationTime: formatHHMM(row.last_registration_time),
        };
      }),
    );
    setLoading(false);
  };

  const loadHolidays = async () => {
    const { data, error } = await supabase
      .from("public_holidays")
      .select("holiday_date, label")
      .order("holiday_date", { ascending: true });

    if (error) {
      setHolidayMessage(error.message);
      return;
    }
    setHolidays((data as Holiday[]) || []);
  };

  useEffect(() => {
    void loadHours();
    void loadHolidays();
  }, []);

  const updateDay = (dayOfWeek: number, patch: Partial<DayForm>) => {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)),
    );
  };

  const onSave = async () => {
    setSaving(true);
    setMessage(null);

    const payload = days.map((day) => ({
      day_of_week: day.dayOfWeek,
      is_closed: day.isClosed,
      open_time: day.openTime,
      close_time: day.closeTime,
      last_registration_time: day.lastRegistrationTime,
    }));

    const { error } = await supabase
      .from("operating_hours")
      .upsert(payload, { onConflict: "day_of_week" });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    void logActivity({
      action: "operating_hours.update",
      targetType: "operating_hours",
      targetId: "weekly",
      details: { days: payload },
    });

    setMessage("Operating hours saved.");
  };

  const onAddHoliday = async () => {
    const trimmedDate = holidayDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setHolidayMessage("Enter the date as YYYY-MM-DD.");
      return;
    }

    setAddingHoliday(true);
    setHolidayMessage(null);

    const { error } = await supabase.from("public_holidays").insert([
      {
        holiday_date: trimmedDate,
        label: holidayLabel.trim() || null,
      },
    ]);

    setAddingHoliday(false);

    if (error) {
      setHolidayMessage(
        error.code === "23505"
          ? "That date is already marked as a holiday."
          : error.message,
      );
      return;
    }

    void logActivity({
      action: "public_holiday.add",
      targetType: "public_holiday",
      targetId: trimmedDate,
      details: { label: holidayLabel.trim() || null },
    });

    setHolidayDate("");
    setHolidayLabel("");
    await loadHolidays();
  };

  const onRemoveHoliday = (holiday: Holiday) => {
    showAlert(
      "Remove holiday",
      `Remove ${holiday.holiday_date} from public holidays?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("public_holidays")
              .delete()
              .eq("holiday_date", holiday.holiday_date);

            if (error) {
              setHolidayMessage(error.message);
              return;
            }

            void logActivity({
              action: "public_holiday.remove",
              targetType: "public_holiday",
              targetId: holiday.holiday_date,
            });

            await loadHolidays();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Operating Hours</Text>
          <Text style={styles.subtitle}>
            Set opening, closing, and last registration times for each day.
            Customers can join the queue up until the last registration time.
          </Text>

          {loading ? (
            <ActivityIndicator color="#D1DCF3" />
          ) : (
            <>
              {days.map((day) => (
                <View key={day.dayOfWeek} style={styles.dayRow}>
                  <View style={styles.dayHeaderRow}>
                    <Text style={styles.dayName}>
                      {DAY_LABELS[day.dayOfWeek]}
                    </Text>
                    <View style={styles.closedToggleRow}>
                      <Text style={styles.closedLabel}>Closed</Text>
                      <Switch
                        value={day.isClosed}
                        onValueChange={(v) =>
                          updateDay(day.dayOfWeek, { isClosed: v })
                        }
                      />
                    </View>
                  </View>

                  {!day.isClosed ? (
                    <View style={styles.timeFieldsRow}>
                      <TimeField
                        label="Open"
                        value={day.openTime}
                        onChange={(v) =>
                          updateDay(day.dayOfWeek, { openTime: v })
                        }
                      />
                      <TimeField
                        label="Close"
                        value={day.closeTime}
                        onChange={(v) =>
                          updateDay(day.dayOfWeek, { closeTime: v })
                        }
                      />
                      <TimeField
                        label="Last Registration"
                        value={day.lastRegistrationTime}
                        onChange={(v) =>
                          updateDay(day.dayOfWeek, {
                            lastRegistrationTime: v,
                          })
                        }
                      />
                    </View>
                  ) : null}
                </View>
              ))}

              <Pressable style={styles.button} onPress={onSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Save Operating Hours</Text>
                )}
              </Pressable>

              {message ? <Text style={styles.message}>{message}</Text> : null}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Public Holidays</Text>
          <Text style={styles.subtitle}>
            On these dates, the queue follows Sunday&apos;s operating hours
            regardless of the actual day of the week.
          </Text>

          <DateField value={holidayDate} onChange={setHolidayDate} />
          <TextInput
            style={styles.input}
            value={holidayLabel}
            onChangeText={setHolidayLabel}
            placeholder="Label (optional, e.g. Merdeka Day)"
            placeholderTextColor="#7E8EA8"
          />

          <Pressable
            style={[
              styles.button,
              (addingHoliday || !holidayDate.trim()) && styles.buttonDisabled,
            ]}
            onPress={onAddHoliday}
            disabled={addingHoliday || !holidayDate.trim()}
          >
            {addingHoliday ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Add Public Holiday</Text>
            )}
          </Pressable>

          {holidayMessage ? (
            <Text style={styles.message}>{holidayMessage}</Text>
          ) : null}

          <View style={[styles.listWrapper, { marginTop: 12 }]}>
            {holidays.length === 0 ? (
              <Text style={styles.row}>No public holidays added.</Text>
            ) : (
              holidays.map((holiday, idx) => (
                <View
                  key={holiday.holiday_date}
                  style={[
                    styles.holidayRow,
                    idx !== holidays.length - 1 && styles.holidayDivider,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holidayDate}>
                      {holiday.holiday_date}
                    </Text>
                    {holiday.label ? (
                      <Text style={styles.holidayLabel}>{holiday.label}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => onRemoveHoliday(holiday)}
                    style={{ padding: 8 }}
                    accessibilityLabel={`Remove ${holiday.holiday_date}`}
                  >
                    <Ionicons name="trash" size={18} color="#FFB3A0" />
                  </Pressable>
                </View>
              ))
            )}
          </View>
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
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    borderRadius: 12,
  },
  title: { fontSize: 20, color: "#F6FAFF", fontWeight: "700" },
  subtitle: { color: "#9FB0CD", marginBottom: 8, lineHeight: 18 },
  dayRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayName: { color: "#F4F8FF", fontWeight: "700" },
  closedToggleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  closedLabel: { color: "#9FB0CD", fontSize: 12 },
  timeFieldsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  timeField: { flex: 1 },
  fieldLabel: {
    color: "#C4D3EE",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
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
    marginTop: 10,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#F8FBFF", fontWeight: "700" },
  message: { color: "#FFD0A8", marginTop: 8 },
  linkText: { color: "#C4D2FF", textAlign: "center" },
  listWrapper: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  row: { color: "#D1DCF3", paddingVertical: 10 },
  holidayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  holidayDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  holidayDate: { color: "#F4F8FF", fontWeight: "700" },
  holidayLabel: { color: "#9FB0CD", marginTop: 2, fontSize: 12 },
});
