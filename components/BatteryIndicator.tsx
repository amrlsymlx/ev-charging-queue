import { StyleSheet, Text, View } from "react-native";

function getJuiceColor(percentage: number): string {
  if (percentage <= 30) return "#FF5B5B";
  if (percentage <= 79) return "#F2C94C";
  return "#3CE685";
}

export default function BatteryIndicator({
  percentage,
}: {
  percentage: number;
}) {
  const safePercentage = Math.max(0, Math.min(100, Math.round(percentage)));
  const juiceColor = getJuiceColor(safePercentage);

  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <View style={styles.track}>
          <View
            style={[
              styles.juice,
              { width: `${safePercentage}%`, backgroundColor: juiceColor },
            ]}
          />
        </View>
        <View style={styles.nub} />
      </View>
      <Text style={styles.label}>{safePercentage}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
  },
  track: {
    width: 60,
    height: 22,
    borderWidth: 2,
    borderColor: "#F4F8FF",
    borderRadius: 4,
    padding: 2,
    overflow: "hidden",
  },
  juice: {
    height: "100%",
    borderRadius: 1,
  },
  nub: {
    width: 3,
    height: 10,
    backgroundColor: "#F4F8FF",
    marginLeft: 2,
    borderRadius: 1,
  },
  label: {
    color: "#F4F8FF",
    fontWeight: "700",
    fontSize: 13,
  },
});
