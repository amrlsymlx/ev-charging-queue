import PublicBoardPanel from "@/components/PublicBoardPanel";
import { useLocalSearchParams } from "expo-router";

export default function PublicBoardScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();

  return <PublicBoardPanel showCustomerActions={from === "customer"} />;
}
