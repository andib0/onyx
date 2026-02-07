import Card from '../../components/ui/Card';

type SessionCardProps = {
  programDayLabel: string;
  trainingDayActive: boolean;
  timerMode: 'session' | 'rest';
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
  onSwitchToSession: () => void;
  formatTime: (seconds: number) => string;
};

function SessionCard({
  programDayLabel,
  trainingDayActive,
  timerMode,
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
  onSwitchToSession,
  formatTime,
}: SessionCardProps) {
  const isSessionMode = timerMode === 'session';
  const isRestMode = timerMode === 'rest';

  const timerDisplay = isSessionMode
    ? formatTime(workoutSeconds)
    : formatTime(restRemainingSeconds);

  const isRunning = isSessionMode ? workoutRunning : restRunning;

  const handleToggle = () => {
    if (isSessionMode) {
      onToggleWorkout();
    } else {
      onToggleRest();
    }
  };

  const handleReset = () => {
    if (isSessionMode) {
      onResetWorkout();
    } else {
      onResetRest();
    }
  };

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
        <div
          className={`sessionTimerWrap${isSessionMode ? ' sessionMode' : ' restMode'}`}
        >
          <div className="sessionTimerLabel">
            {isSessionMode
              ? 'Session'
              : `Rest — ${restLabel || 'waiting'}`}
          </div>
          <div className="sessionTimerValue">{timerDisplay}</div>
          {isRestMode && restTotalSeconds > 0 ? (
            <div className="sessionTimerSub">
              {formatTime(restTotalSeconds)} total
            </div>
          ) : null}
          <div className="sessionTimerActions">
            <button
              onClick={handleToggle}
              type="button"
              disabled={isRestMode && !restTotalSeconds}
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button onClick={handleReset} type="button">
              Reset
            </button>
            {isRestMode ? (
              <button onClick={onSwitchToSession} type="button">
                Back to session
              </button>
            ) : null}
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
