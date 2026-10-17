import { useProgram } from "../../contexts/ProgramContext";
import { useData } from "../../contexts/DataContext";
import { useUndo } from "../../hooks/ui/undo";
import { trainAnywayToday } from "../../hooks/ui/useTodayPlan";
import WorkoutSection from "../focus/WorkoutSection";
import { plannedSetCount } from "../../utils/dayOutcome";
import { workoutCountsAsDone } from "../../utils/workoutClock";

const FINISH_KEY = "workout-finish";

// Today's workout wired to the program + the undo bar. Used on Today (compact
// when idle) and Train (full preview). `trainingDay` comes from useTodayPlan so
// the implementation intention decides rest vs training on both screens.
export default function WorkoutCard({
  trainingDay,
  compact = false,
}: {
  trainingDay: boolean;
  compact?: boolean;
}) {
  const {
    workout,
    workoutCompletedToday,
    programRows,
    programLabel,
    selectedProgramId,
    trainAnyway,
    startWorkout,
    togglePauseWorkout,
    stopWorkout,
    completeWorkoutSet,
    skipWorkoutRest,
    undoLastWorkoutSet,
    jumpToWorkoutExercise,
    extendWorkoutRest,
  } = useProgram();
  const { todayKeyValue } = useData();
  const { showUndo, pendingKey } = useUndo();

  const setsLogged = Object.values(workout.setsThisSession).reduce(
    (n, list) => n + list.length,
    0
  );
  const planned = plannedSetCount(programRows);
  const counts = workoutCountsAsDone(setsLogged, planned);

  // Finish = 1 tap; the stop is deferred behind the undo bar, so Undo simply
  // keeps the session running (nothing to roll back on the server).
  const finish = () =>
    showUndo({
      key: FINISH_KEY,
      message: counts
        ? `Workout done · ${setsLogged}/${planned} sets`
        : `Ended early · ${setsLogged}/${planned} sets, not counted`,
      onCommit: stopWorkout,
      onUndo: () => {},
    });

  return (
    <WorkoutSection
      workout={workout}
      workoutCompletedToday={workoutCompletedToday}
      programRows={programRows}
      programLabel={programLabel}
      trainingDayActive={trainingDay}
      onTrainAnyway={
        selectedProgramId
          ? () => {
              trainAnywayToday(todayKeyValue);
              trainAnyway();
            }
          : undefined
      }
      onStart={startWorkout}
      onTogglePause={togglePauseWorkout}
      onStop={stopWorkout}
      onFinish={finish}
      finishing={pendingKey === FINISH_KEY ? (counts ? "done" : "ended") : false}
      onCompleteSet={completeWorkoutSet}
      onSkipRest={skipWorkoutRest}
      onUndoSet={undoLastWorkoutSet}
      onJumpExercise={jumpToWorkoutExercise}
      onExtendRest={extendWorkoutRest}
      compact={compact}
    />
  );
}
