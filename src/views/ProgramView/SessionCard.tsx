import Card from '../../components/ui/Card';

type SessionCardProps = {
  programDayLabel: string;
  trainingDayActive: boolean;
  workoutSeconds: number;
  workoutRunning: boolean;
  restRemainingSeconds: number;
  restTotalSeconds: number;
  restRunning: boolean;
  restLabel: string;
  onCopyProgramDay: () => void;
  onToggleWorkout: () => void;
  onResetWorkout: () => void;
  onToggleRest: () => void;
  onResetRest: () => void;
  formatTime: (seconds: number) => string;
};

function SessionCard({
  programDayLabel,
  trainingDayActive,
  workoutSeconds,
  workoutRunning,
  restRemainingSeconds,
  restTotalSeconds,
  restRunning,
  restLabel,
  onCopyProgramDay,
  onToggleWorkout,
  onResetWorkout,
  onToggleRest,
  onResetRest,
  formatTime,
}: SessionCardProps) {
  return (
    <Card>
      <div className="row">
        <h2>Training program (4 days/week)</h2>
        {trainingDayActive ? (
          <div className="controls">
            <button onClick={onCopyProgramDay} type="button">
              Copy session
            </button>
          </div>
        ) : null}
      </div>
      <p>
        <b>Today:</b> {programDayLabel}
      </p>
      {trainingDayActive ? (
        <div className="timerRow">
          <div className="timerBlock">
            <div className="small">Session timer</div>
            <div className="timerValue">{formatTime(workoutSeconds)}</div>
            <div className="timerActions">
              <button onClick={onToggleWorkout} type="button">
                {workoutRunning ? 'Pause' : 'Start'}
              </button>
              <button onClick={onResetWorkout} type="button">
                Reset
              </button>
            </div>
          </div>
          <div className="timerBlock">
            <div className="small">Rest timer</div>
            <div className="timerValue">{formatTime(restRemainingSeconds)}</div>
            <div className="timerSub">
              {restLabel
                ? `${restLabel} (${formatTime(restTotalSeconds)})`
                : 'Pick a set to start rest.'}
            </div>
            <div className="timerActions">
              <button onClick={onToggleRest} type="button" disabled={!restTotalSeconds}>
                {restRunning ? 'Pause' : 'Start'}
              </button>
              <button onClick={onResetRest} type="button">
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {!trainingDayActive ? (
        <div className="footerNote">Rest day. Focus on recovery, steps, and sleep.</div>
      ) : null}
      {trainingDayActive ? (
        <p>
          <b>Progression:</b> double progression. Compounds 6-10; accessories 10-15+.
          Most sets 1-3 RIR; last accessory set can be 0-1 RIR.
        </p>
      ) : null}
    </Card>
  );
}

export default SessionCard;
