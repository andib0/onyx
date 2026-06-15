import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  useReducedMotion,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, motion, type Palette } from "../../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View
        style={styles.backdrop}
        entering={reduceMotion ? undefined : FadeIn.duration(motion.fast)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <AnimatedPressable
          style={styles.sheet}
          onPress={() => {}}
          entering={
            reduceMotion
              ? undefined
              : ZoomIn.springify()
                  .damping(motion.springTight.damping)
                  .stiffness(motion.springTight.stiffness)
          }
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                destructive ? styles.dangerButton : styles.confirmButton,
                pressed && styles.pressed,
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </AnimatedPressable>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: fontSizes.md,
    color: colors.muted,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.accent,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  cancelText: {
    fontSize: fontSizes.md,
    fontWeight: "600",
    color: colors.text,
  },
  confirmText: {
    fontSize: fontSizes.md,
    fontWeight: "600",
    color: "#fff",
  },
  pressed: {
    opacity: 0.85,
  },
});
