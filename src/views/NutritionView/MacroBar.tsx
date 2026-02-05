type MacroData = {
  key: string;
  unit: string;
  taken: number;
  target: number;
  planned: number;
  percent: number;
};

type MacroBarProps = {
  macro: MacroData;
};

function MacroBar({ macro }: MacroBarProps) {
  return (
    <div className="macroItem">
      <div className="macroTop">
        <div className="macroName">{macro.key}</div>
        <div className="macroValue">
          {Math.round(macro.taken)} {macro.unit} / {Math.round(macro.target)}{' '}
          {macro.unit}
        </div>
      </div>
      <div className="macroBar">
        <div className="macroFill" style={{ width: `${macro.percent}%` }} />
      </div>
      <div className="macroSub">
        Planned {Math.round(macro.planned)} {macro.unit}
      </div>
    </div>
  );
}

export default MacroBar;
