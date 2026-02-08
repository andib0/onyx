import type { MetaData } from "../../types/appTypes";
import { getGoalLabel } from "../../utils/nutrition";
import logo from "../../assets/logo.svg";

type SidebarProps = {
  view: string;
  navProgress: number;
  navDay?: string;
  meta: MetaData;
  programGoal?: string;
  userWeight?: number | null;
  onChangeView: (view: string) => void;
  onLogout: () => void;
};

function Sidebar({
  view,
  navProgress,
  navDay = "",
  meta,
  programGoal,
  userWeight,
  onChangeView,
  onLogout,
}: SidebarProps) {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || meta.timezone || "Local";
  const goalLabel = getGoalLabel(programGoal);
  const weightLabel = userWeight && userWeight > 0 ? `${userWeight} kg` : "-";
  const navItems = [
    { key: "focus", label: "Focus", left: "Active context", right: "Now" },
    { key: "today", label: "Today", left: "Timeline", right: `${navProgress}%` },
    {
      key: "program",
      label: "Program",
      left: "Push / Pull / Legs",
      right: navDay || "-",
    },
    { key: "nutrition", label: "Nutrition", left: goalLabel, right: weightLabel },
    {
      key: "supplements",
      label: "Supplements",
      left: "Current stack",
      right: "Sleep-first",
    },
    { key: "log", label: "Log", left: "Daily inputs", right: "BW / sleep / steps" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebarTop">
        <div className="brand">
          <img src={logo} alt="logo" className="onyx-logo" />
          <div className="brandHeader">
            <div className="brandTitle">
              <h1>Onyx</h1>
            </div>
            <div className="brandMeta">
              {timezone} · Bedtime {meta.sleepTarget}
            </div>
          </div>
        </div>

        <div className="nav" role="navigation" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`navBtn${view === item.key ? " active" : ""}`}
              data-view={item.key}
              onClick={() => onChangeView(item.key)}
              type="button"
            >
              {item.label}
              <div className="sub">
                <span>{item.left}</span>
                <span>{item.right}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebarBottom">
        <button
          className="navBtn navBtnLogout"
          onClick={onLogout}
          type="button"
          data-view="logout"
        >
          Logout
          <div className="sub">
            <span>Sign out</span>
            <span></span>
          </div>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
