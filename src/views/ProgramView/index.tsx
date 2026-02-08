import { useMemo } from "react";

import Card from "../../components/ui/Card";
import MovementList from "./MovementList";
import type { ProgramSummary } from "../../api/programs";

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
  completedExercises: Set<number>;
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
  completedExercises,
}: ProgramViewProps) {
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

      {trainingDayActive ? (
        <Card style={{ marginTop: 14 }}>
          <MovementList
            programRows={programRows}
            completedExercises={completedExercises}
          />
        </Card>
      ) : null}

      {trainingDayActive ? (
        <Card style={{ marginTop: 14 }}>
          <h2>Warm-up + rules</h2>
          <p>
            <b>Warm-up:</b> 3-5 min cardio, 2 mobility drills, then 3-5 ramp sets for
            first compound.
          </p>
          <p>
            <b>Stop condition:</b> if form breaks, stop the set and reduce load.
            Repeatable progress wins.
          </p>
        </Card>
      ) : null}
    </>
  );
}

export default ProgramView;
