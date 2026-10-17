import { Text, type StyleProp, type TextStyle } from "react-native";
import { useWorkoutClock } from "../../../hooks/useWorkout";
import type { WorkoutTiming } from "../../../utils/workoutClock";
import { formatSeconds } from "./format";

// The only component that re-renders on the 500 ms workout tick.
export default function SessionClock({
  timing,
  ticking,
  style,
}: {
  timing: WorkoutTiming;
  ticking: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const { sessionSeconds } = useWorkoutClock(timing, ticking);
  return (
    <Text
      style={style}
      accessibilityLabel={`Session time ${formatSeconds(sessionSeconds)}`}
    >
      {formatSeconds(sessionSeconds)}
    </Text>
  );
}
