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
  completedExercises: Set<number>;
};

function MovementList({ programRows, completedExercises }: MovementListProps) {
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
          </tr>
        </thead>
        <tbody>
          {programRows.map((programRow, index) => {
            const isDone = completedExercises.has(index);
            return (
              <tr
                key={`${programRow.ex}-${index}`}
                className={isDone ? "exerciseRowDone" : ""}
              >
                <td className={isDone ? "" : "muted"}>{isDone ? "\u2713" : index + 1}</td>
                <td>{programRow.ex}</td>
                <td className="muted">{programRow.sets}</td>
                <td className="muted">{programRow.reps}</td>
                <td className="muted">{programRow.rir}</td>
                <td className="muted">{programRow.rest}</td>
                <td className="muted">{programRow.notes}</td>
                <td className="muted">{programRow.prog}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default MovementList;
