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

export default function RegisterScreen() {
  const { register, error, clearError, isLoading } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [localError, setLocalError] = useState("");

  const clearErrors = () => {
    if (error) clearError();
    if (localError) setLocalError("");
  };

  const handleRegister = async () => {
    setLocalError("");
    if (!email.trim() || !password.trim()) {
      setLocalError("Email and password are required.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }
    const profile: { username?: string; age?: number; weight?: number } = {};
    if (username.trim()) profile.username = username.trim();
    if (age.trim()) profile.age = Number(age);
    if (weight.trim()) profile.weight = Number(weight);

    const success = await register(email.trim(), password, profile);
    if (success) {
      router.replace("/onboarding");
    }
  };

  const displayError = localError || error || "";

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
          <Text style={styles.subtitle}>Create account</Text>

          <View style={styles.form}>
            <Input
              label="Username"
              icon="person-outline"
              placeholder="Optional"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username"
            />
            <Input
              label="Email"
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearErrors();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Input
              label="Password"
              icon="lock-closed-outline"
              placeholder="Choose a password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearErrors();
              }}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <Input
              label="Confirm password"
              icon="lock-closed-outline"
              placeholder="Repeat password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                clearErrors();
              }}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Input
                  label="Age"
                  placeholder="—"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  maxLength={3}
                  mono
                />
              </View>
              <View style={styles.half}>
                <Input
                  label="Weight"
                  unit="kg"
                  placeholder="—"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  mono
                />
              </View>
            </View>

            {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

            <Button
              label="Create account"
              icon="person-add-outline"
              size="lg"
              loading={isLoading}
              onPress={handleRegister}
              style={styles.submit}
            />

            <Pressable
              onPress={() => router.back()}
              style={styles.link}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
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
      paddingVertical: spacing.xxl,
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
    row: {
      flexDirection: "row",
      gap: spacing.md,
    },
    half: {
      flex: 1,
    },
    error: {
      color: colors.danger,
      fontSize: fontSizes.sm,
      textAlign: "center",
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
