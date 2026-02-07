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
};

function ProgramFocusSection({
  programDayLabel,
  programRows,
  trainingDayActive,
}: ProgramFocusSectionProps) {
  return (
    <section className="focusPanel">
      <div className="focusPanelHeader">
        <div>
          <div className="focusLabel">Training</div>
          <h2>{programDayLabel}</h2>
        </div>
        <div className="focusMeta">
          <span>{trainingDayActive ? `${programRows.length} exercises` : 'Rest day'}</span>
        </div>
      </div>
      {trainingDayActive && programRows.length > 0 ? (
        <div className="focusCompactList">
          {programRows.map((row, index) => (
            <div className="focusCompactItem" key={`${row.ex}-${index}`}>
              <span className="focusCompactIndex">{index + 1}</span>
              <span className="focusCompactName">{row.ex}</span>
              <span className="focusCompactDetail">
                {row.sets}x{row.reps}
                {row.rest ? ` · ${row.rest}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {!trainingDayActive ? (
        <div className="focusComingUp">Rest day. Focus on recovery, steps, and sleep.</div>
      ) : null}
    </section>
  );
}

export default ProgramFocusSection;
