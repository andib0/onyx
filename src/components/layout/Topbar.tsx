import TimelineFilter from '../shared/TimelineFilter';

type TopbarProps = {
  title: string;
  subtitle: string;
  showAllTimeline: boolean;
  onToggleTimeline: () => void;
  onExport: () => void;
  onImport: () => void;
  onFocus: () => void;
  userEmail?: string;
  onLogout?: () => void;
};

function Topbar({
  title,
  subtitle,
  showAllTimeline,
  onToggleTimeline,
  onExport,
  onImport,
  onFocus,
  userEmail,
  onLogout,
}: TopbarProps) {
  return (
    <div className="topbar">
      <div>
        <div className="title">{title}</div>
        <div className="subtitle">{subtitle}</div>
      </div>
      <div className="controls">
        <TimelineFilter
          showAllTimeline={showAllTimeline}
          onToggleTimeline={onToggleTimeline}
        />
        <button onClick={onFocus} type="button">
          Focus
        </button>
        <button onClick={onExport} type="button">
          Export
        </button>
        <button onClick={onImport} type="button">
          Import
        </button>
        {userEmail && onLogout && (
          <>
            <span className="user-email">{userEmail}</span>
            <button onClick={onLogout} type="button" className="logout-btn">
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default Topbar;
