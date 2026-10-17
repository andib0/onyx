import { Redirect } from "expo-router";

// Focus became Today (Bet 8). Kept so old deep links and notification routes land.
export default function FocusRedirect() {
  return <Redirect href="/(tabs)/today" />;
}
