import type { ProgramSummary } from '../../api/programs';

type ProgramSetupModalProps = {
  open: boolean;
  programs: ProgramSummary[];
  selectedProgramId: string;
  selectedProgramDayId: string;
  onSelectProgram: (id: string) => void;
  onSelectProgramDay: (id: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
};

function ProgramSetupModal({
  open,
  programs,
  selectedProgramId,
  selectedProgramDayId,
  onSelectProgram,
  onSelectProgramDay,
  onConfirm,
  onSkip,
}: ProgramSetupModalProps) {
  if (!open) return null;

  const selectedProgram =
    programs.find((program) => program.id === selectedProgramId) || null;
  const dayOptions = selectedProgram ? selectedProgram.days : [];

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Program setup">
      <div className="modalCard">
        <h3>Pick your program</h3>
        <p>
          Select a program and the day you are running. You can change this later in
          the Program view.
        </p>
        <div className="modalForm">
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
        <div className="modalActions">
          <button type="button" className="btnSecondary" onClick={onSkip}>
            Skip for now
          </button>
          <button
            type="button"
            className="btnDanger"
            onClick={onConfirm}
            disabled={!selectedProgramId || !selectedProgramDayId}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProgramSetupModal;
