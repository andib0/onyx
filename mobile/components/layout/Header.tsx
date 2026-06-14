import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, fonts, type Palette } from "../../theme";

interface HeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export default function Header({ title, subtitle, right }: HeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    left: {
      flex: 1,
    },
    right: {
      flexShrink: 0,
    },
    title: {
      fontSize: fontSizes.xxl,
      fontFamily: fonts.display,
      color: colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      marginTop: 2,
    },
  });
