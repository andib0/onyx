import { useEffect, useMemo, useState } from 'react';

import Card from '../../components/ui/Card';
import MovementList from './MovementList';
import SessionCard from './SessionCard';
import { formatTime, parseRestSeconds } from '../../utils/formatting';
import type { ProgramSummary } from '../../api/programs';

type ProgramRow = {
  ex: string;
  sets: string;
  reps: string;
  rir: string;
  rest: string;
  notes: string;
  prog: string;
};

type ProgramViewProps = {
  programDayLabel: string;
  programRows: ProgramRow[];
  trainingDayActive: boolean;
  onCopyProgramDay: () => void;
  programs: ProgramSummary[];
  selectedProgramId: string;
  selectedProgramDayId: string;
  onSelectProgram: (id: string) => void;
  onSelectProgramDay: (id: string) => void;
};

function ProgramView({
  programDayLabel,
  programRows,
  trainingDayActive,
  onCopyProgramDay,
  programs,
  selectedProgramId,
  selectedProgramDayId,
  onSelectProgram,
  onSelectProgramDay,
}: ProgramViewProps) {
  const [workoutRunning, setWorkoutRunning] = useState(false);
  const [workoutSeconds, setWorkoutSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restTotalSeconds, setRestTotalSeconds] = useState(0);
  const [restRemainingSeconds, setRestRemainingSeconds] = useState(0);
  const [restLabel, setRestLabel] = useState('');

  useEffect(() => {
    if (!workoutRunning) return undefined;
    const intervalId = setInterval(() => {
      setWorkoutSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [workoutRunning]);

  useEffect(() => {
    if (!restRunning) return undefined;
    const intervalId = setInterval(() => {
      setRestRemainingSeconds((prev) => {
        if (prev <= 1) {
          setRestRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [restRunning]);

  const startRest = (programRow: ProgramRow) => {
    const seconds = parseRestSeconds(programRow.rest);
    if (!seconds) return;
    setRestTotalSeconds(seconds);
    setRestRemainingSeconds(seconds);
    setRestLabel(programRow.ex);
    setRestRunning(true);
  };

  const resetRest = () => {
    setRestRunning(false);
    setRestTotalSeconds(0);
    setRestRemainingSeconds(0);
    setRestLabel('');
  };

  const toggleWorkout = () => {
    setWorkoutRunning((prev) => !prev);
  };

  const resetWorkout = () => {
    setWorkoutRunning(false);
    setWorkoutSeconds(0);
  };

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) || null,
    [programs, selectedProgramId]
  );
  const dayOptions = selectedProgram ? selectedProgram.days : [];

  return (
    <>
      <Card>
        <div className="row">
          <div>
            <h2>Program selection</h2>
            <div className="small">Pick a program and the day you are running.</div>
          </div>
          <div className="controls">
            <select
              value={selectedProgramId}
              onChange={(event) => onSelectProgram(event.target.value)}
              aria-label="Select program"
            >
              <option value="">Select program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            <select
              value={selectedProgramDayId}
              onChange={(event) => onSelectProgramDay(event.target.value)}
              aria-label="Select program day"
              disabled={!selectedProgram}
            >
              <option value="">Select day</option>
              {dayOptions.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <SessionCard
        programDayLabel={programDayLabel}
        trainingDayActive={trainingDayActive}
        workoutSeconds={workoutSeconds}
        workoutRunning={workoutRunning}
        restRemainingSeconds={restRemainingSeconds}
        restTotalSeconds={restTotalSeconds}
        restRunning={restRunning}
        restLabel={restLabel}
        onCopyProgramDay={onCopyProgramDay}
        onToggleWorkout={toggleWorkout}
        onResetWorkout={resetWorkout}
        onToggleRest={() => setRestRunning((prev) => !prev)}
        onResetRest={resetRest}
        formatTime={formatTime}
      />

      {trainingDayActive ? (
        <Card style={{ marginTop: 14 }}>
          <h2>Warm-up + rules</h2>
          <p>
            <b>Warm-up:</b> 3-5 min cardio, 2 mobility drills, then 3-5 ramp sets
            for first compound.
          </p>
          <p>
            <b>Stop condition:</b> if form breaks, stop the set and reduce load.
            Repeatable progress wins.
          </p>
        </Card>
      ) : null}

      {trainingDayActive ? (
        <Card style={{ marginTop: 14 }}>
          <MovementList
            programRows={programRows}
            onStartRest={startRest}
            parseRestSeconds={parseRestSeconds}
          />
        </Card>
      ) : null}
    </>
  );
}

export default ProgramView;
