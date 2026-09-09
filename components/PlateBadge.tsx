import { StyleSheet, Text, View } from "react-native";

export default function PlateBadge({
  plateNumber,
}: {
  plateNumber: string;
}) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text} numberOfLines={1}>
        {plateNumber}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    color: "#333333",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 1,
    textAlign: "center",
  },
});
