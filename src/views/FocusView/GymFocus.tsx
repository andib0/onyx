import type { ScheduleBlock } from '../../types/appTypes';

type GymFocusProps = {
  block: ScheduleBlock;
  progressPercent: number;
  minutesRemaining: number;
  isActive: boolean;
};

function GymFocus({
  block,
  progressPercent,
  minutesRemaining,
  isActive,
}: GymFocusProps) {
  return (
    <section className={`focusPanel${isActive ? ' focusPanelActive' : ''}`}>
      <div className="focusPanelHeader">
        <div>
          <div className="focusLabel">Training focus</div>
          <h2>{block.title}</h2>
        </div>
        <div className="focusMeta">
          <span>
            {block.start} - {block.end}
          </span>
          <span>{minutesRemaining} min left</span>
        </div>
      </div>
      <div className="focusProgress">
        <div className="focusProgressBar" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="focusBody">
        <div className="focusPurpose">{block.purpose}</div>
        <div className="focusGood">
          <span>Definition of done:</span>
          <span>{block.good}</span>
        </div>
      </div>
    </section>
  );
}

export default GymFocus;
