import { formatTime } from "../../utils/formatting";
import type { WorkoutState } from "../../hooks/useWorkout";

type ProgramRow = {
  ex: string;
  sets: string;
  reps: string;
  rir: string;
  rest: string;
  notes: string;
  prog: string;
};

type ProgramFocusSectionProps = {
  programDayLabel: string;
  programRows: ProgramRow[];
  trainingDayActive: boolean;
  workout: WorkoutState;
  onStartWorkout: () => void;
  onTogglePause: () => void;
  onStopWorkout: () => void;
  onSkipInterval: () => void;
};

function ProgramFocusSection({
  programDayLabel,
  programRows,
  trainingDayActive,
  workout,
  onStartWorkout,
  onTogglePause,
  onStopWorkout,
  onSkipInterval,
}: ProgramFocusSectionProps) {
  const currentRow = programRows[workout.exerciseIndex] || null;

  const timerProgress =
    workout.intervalTotal > 0
      ? Math.round(
          ((workout.intervalTotal - workout.secondsRemaining) / workout.intervalTotal) *
            100
        )
      : 0;

  const completedCount = workout.completedExercises.size;

  return (
    <section className="focusPanel">
      <div className="focusPanelHeader">
        <div>
          <div className="focusLabel">Training</div>
          <h2>{programDayLabel}</h2>
        </div>
        <div className="focusMeta">
          {trainingDayActive ? (
            <>
              <span>
                {completedCount}/{programRows.length} exercises
              </span>
              {workout.isActive ? (
                <span>{formatTime(workout.sessionSeconds)} elapsed</span>
              ) : null}
            </>
          ) : (
            <span>Rest day</span>
          )}
        </div>
      </div>

      {trainingDayActive && programRows.length > 0 ? (
        <>
          {!workout.isActive && !workout.isFinished ? (
            <div className="workoutStartWrap">
              <div className="workoutStartInfo">
                {programRows.length} exercises today. Auto-advancing: 60s per set, 30s
                rest between sets.
              </div>
              <button type="button" className="workoutStartBtn" onClick={onStartWorkout}>
                Start workout
              </button>
            </div>
          ) : null}

          {workout.isFinished ? (
            <div className="workoutFinished">
              <div className="workoutFinishedTitle">Workout complete!</div>
              <div className="workoutFinishedMeta">
                {formatTime(workout.sessionSeconds)} total · {completedCount} exercises
                done
              </div>
              <button type="button" className="workoutStartBtn" onClick={onStopWorkout}>
                Reset
              </button>
            </div>
          ) : null}

          {workout.isActive && !workout.isFinished && currentRow ? (
            <div className="workoutActive">
              <div
                className={`workoutTimerWrap${
                  workout.mode === "work" ? " workoutTimerWork" : " workoutTimerRest"
                }`}
              >
                <div className="workoutTimerLabel">
                  {workout.mode === "work"
                    ? `Set ${workout.currentSet} of ${workout.totalSets}`
                    : "Rest"}
                </div>
                <div className="workoutTimerValue">
                  {formatTime(workout.secondsRemaining)}
                </div>
                <div className="workoutTimerProgress">
                  <div
                    className="workoutTimerProgressBar"
                    style={{ width: `${timerProgress}%` }}
                  />
                </div>
                <div className="workoutTimerActions">
                  <button type="button" onClick={onTogglePause}>
                    {workout.isPaused ? "Resume" : "Pause"}
                  </button>
                  <button type="button" onClick={onSkipInterval}>
                    Skip
                  </button>
                  <button type="button" onClick={onStopWorkout}>
                    Stop
                  </button>
                </div>
              </div>

              <div className="workoutExerciseCard">
                <div className="workoutExerciseHeader">
                  <span className="workoutExerciseIndex">
                    {workout.exerciseIndex + 1}/{programRows.length}
                  </span>
                  <span className="workoutExerciseName">{currentRow.ex}</span>
                </div>
                <div className="workoutExerciseDetails">
                  <div className="workoutExerciseDetail">
                    <span className="workoutDetailLabel">Sets × Reps</span>
                    <span className="workoutDetailValue">
                      {currentRow.sets}×{currentRow.reps}
                    </span>
                  </div>
                  <div className="workoutExerciseDetail">
                    <span className="workoutDetailLabel">RIR</span>
                    <span className="workoutDetailValue">{currentRow.rir || "-"}</span>
                  </div>
                  <div className="workoutExerciseDetail">
                    <span className="workoutDetailLabel">Rest</span>
                    <span className="workoutDetailValue">{currentRow.rest || "-"}</span>
                  </div>
                </div>
                {currentRow.notes ? (
                  <div className="workoutExerciseNotes">{currentRow.notes}</div>
                ) : null}
                {currentRow.prog ? (
                  <div className="workoutExerciseProg">
                    <span className="workoutDetailLabel">Progression:</span>{" "}
                    {currentRow.prog}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Exercise list showing completed state */}
          <div className="workoutExerciseList">
            {programRows.map((row, index) => {
              const isDone = workout.completedExercises.has(index);
              const isCurrent =
                workout.isActive &&
                !workout.isFinished &&
                index === workout.exerciseIndex;
              let className = "focusCompactItem";
              if (isDone) className += " focusCompactItemDone";
              if (isCurrent) className += " focusCompactItemCurrent";
              return (
                <div className={className} key={`${row.ex}-${index}`}>
                  <span className="focusCompactIndex">{isDone ? "✓" : index + 1}</span>
                  <span className="focusCompactName">{row.ex}</span>
                  <span className="focusCompactDetail">
                    {row.sets}×{row.reps}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {!trainingDayActive ? (
        <div className="focusComingUp">
          Rest day. Focus on recovery, steps, and sleep.
        </div>
      ) : null}
    </section>
  );
}

export default ProgramFocusSection;
