import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";

interface GlowProps {
  color: string;
  size?: number;
  opacity?: number;
  // Offset of the glow center relative to the parent's top-left
  x?: number;
  y?: number;
}

// Ambient radial glow. Position absolutely behind a hero element.
// Bright, tight core that fades smoothly to nothing — a halo, not a flat disc.
export default function Glow({
  color,
  size = 260,
  opacity = 0.14,
  x = 0,
  y = 0,
}: GlowProps) {
  // Unique gradient id per instance — a shared id makes every Glow on screen
  // reuse the first one's gradient (SVG <defs> id collision).
  const gid = useMemo(() => `glow_${Math.random().toString(36).slice(2)}`, []);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        { width: size, height: size, left: x - size / 2, top: y - size / 2 },
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="18%" stopColor={color} stopOpacity={opacity * 0.6} />
            <Stop offset="42%" stopColor={color} stopOpacity={opacity * 0.22} />
            <Stop offset="70%" stopColor={color} stopOpacity={opacity * 0.06} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
  },
});
