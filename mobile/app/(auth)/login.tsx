import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { spacing, fontSizes, fonts, type Palette } from "../../theme";

export default function LoginScreen() {
  const { login, error, clearError, isLoading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    const success = await login(email.trim(), password);
    if (success) {
      router.replace("/(tabs)/focus");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>ONYX</Text>
          <Text style={styles.subtitle}>Daily Tracker</Text>

          <View style={styles.form}>
            <Input
              label="Email"
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) clearError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <Input
              label="Password"
              icon="lock-closed-outline"
              placeholder="Your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) clearError();
              }}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              error={error || undefined}
            />

            <Button
              label="Sign in"
              icon="log-in-outline"
              size="lg"
              loading={isLoading}
              onPress={handleLogin}
              style={styles.submit}
            />

            <Pressable
              onPress={() => router.push("/(auth)/register")}
              style={styles.link}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>Don't have an account? Register</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    flex: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    brand: {
      fontFamily: fonts.brand,
      fontSize: 48,
      color: colors.text,
      textAlign: "center",
      letterSpacing: 8,
    },
    subtitle: {
      fontSize: fontSizes.md,
      color: colors.muted,
      textAlign: "center",
      marginBottom: spacing.xxl,
    },
    form: {
      gap: spacing.md,
    },
    submit: {
      marginTop: spacing.sm,
    },
    link: {
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    linkText: {
      color: colors.accent,
      fontSize: fontSizes.md,
    },
  });
