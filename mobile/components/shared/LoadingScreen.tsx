import { View, ActivityIndicator, StyleSheet } from "react-native";
import ScreenContainer from "../layout/ScreenContainer";
import { colors, spacing } from "../../theme";

export default function LoadingScreen() {
  return (
    <ScreenContainer>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
});
