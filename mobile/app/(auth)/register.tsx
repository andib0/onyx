import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
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
import { spacing, radii, fontSizes, fonts, type Palette } from "../../theme";

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
          <Text style={styles.subtitle}>Create Account</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username (optional)"
              placeholderTextColor={colors.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) clearError();
                if (localError) setLocalError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (localError) setLocalError("");
              }}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.muted}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (localError) setLocalError("");
              }}
              secureTextEntry
            />

            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Age"
                placeholderTextColor={colors.muted}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Weight (kg)"
                placeholderTextColor={colors.muted}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
              />
            </View>

            {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? "Creating..." : "Create Account"}
              </Text>
            </Pressable>

            <Pressable onPress={() => router.back()} style={styles.link}>
              <Text style={styles.linkText}>Already have an account? Sign In</Text>
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
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  halfInput: {
    flex: 1,
  },
  error: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: fontSizes.lg,
    fontWeight: "600",
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
