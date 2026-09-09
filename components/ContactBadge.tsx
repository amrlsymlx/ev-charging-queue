import { StyleSheet, Text, View } from "react-native";

function stripCountryCode(phoneNumber: string) {
  return phoneNumber.replace(/^\+6/, "");
}

export default function ContactBadge({
  phoneNumber,
  name,
}: {
  phoneNumber: string;
  name: string;
}) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text} numberOfLines={1}>
        {stripCountryCode(phoneNumber)} - {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "center",
    backgroundColor: "#D7F5DD",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    color: "#1F5C33",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
});
