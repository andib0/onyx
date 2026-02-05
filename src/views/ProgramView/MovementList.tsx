type ProgramRow = {
  ex: string;
  sets: string;
  reps: string;
  rir: string;
  rest: string;
  notes: string;
  prog: string;
};

type MovementListProps = {
  programRows: ProgramRow[];
  onStartRest: (row: ProgramRow) => void;
  parseRestSeconds: (value: string) => number;
};

function MovementList({ programRows, onStartRest, parseRestSeconds }: MovementListProps) {
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Exercise</th>
            <th style={{ width: 70 }}>Sets</th>
            <th style={{ width: 90 }}>Reps</th>
            <th style={{ width: 60 }}>RIR</th>
            <th style={{ width: 92 }}>Rest</th>
            <th>Notes</th>
            <th>Progression</th>
            <th style={{ width: 86 }}></th>
          </tr>
        </thead>
        <tbody>
          {programRows.map((programRow, index) => (
            <tr key={`${programRow.ex}-${index}`}>
              <td className="muted">{index + 1}</td>
              <td>{programRow.ex}</td>
              <td className="muted">{programRow.sets}</td>
              <td className="muted">{programRow.reps}</td>
              <td className="muted">{programRow.rir}</td>
              <td className="muted">{programRow.rest}</td>
              <td className="muted">{programRow.notes}</td>
              <td className="muted">{programRow.prog}</td>
              <td>
                <button
                  type="button"
                  onClick={() => onStartRest(programRow)}
                  disabled={!parseRestSeconds(programRow.rest)}
                >
                  Rest
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MovementList;
