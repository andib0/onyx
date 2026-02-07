import useActiveContext from '../../hooks/useActiveContext';
import type { FocusBlock } from '../../hooks/useActiveContext';
import type { ScheduleBlock, SupplementItem, MealTemplate } from '../../types/appTypes';
import { useAuth } from '../../contexts/AuthContext';
import { toMinutes } from '../../utils/time';
import GymFocus from './GymFocus';
import MealFocus from './MealFocus';
import SupplementFocus from './SupplementFocus';
import ProgramFocusSection from './ProgramFocusSection';
import NutritionFocusSection from './NutritionFocusSection';

type ProgramRow = {
  ex: string;
  sets: string;
  reps: string;
  rir: string;
  rest: string;
  notes: string;
  prog: string;
};

type FocusViewProps = {
  scheduleBlocks: ScheduleBlock[];
  supplementsList: SupplementItem[];
  supplementChecksForToday: Record<string, boolean>;
  onToggleSupplement: (supplementId: string, isChecked: boolean) => void;
  programRows: ProgramRow[];
  programDayLabel: string;
  trainingDayActive: boolean;
  mealTemplates: MealTemplate[];
  mealCheckMap: Record<string, boolean>;
  onToggleMealCheck: (mealId: string, isChecked: boolean) => void;
};

type FocusPanelBlock = FocusBlock & {
  isUpcoming: boolean;
  minutesUntilStart: number | null;
};

const formatClockTime = (nowMinutes: number) => {
  const hours = Math.floor(nowMinutes / 60);
  const minutes = nowMinutes % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedHours = String(hours).padStart(2, '0');
  return `${paddedHours}:${paddedMinutes}`;
};

function DefaultFocusPanel({
  focusBlock,
}: {
  focusBlock: FocusPanelBlock;
}) {
  const block = focusBlock.block;
  const duration = Math.max(toMinutes(block.end) - toMinutes(block.start), 0);
  return (
    <section
      className={`focusPanel${focusBlock.isUpcoming ? '' : ' focusPanelActive'}`}
    >
      <div className="focusPanelHeader">
        <div>
          <div className="focusLabel">
            {focusBlock.isUpcoming ? 'Up next' : 'Active block'}
          </div>
          <h2>{block.title}</h2>
        </div>
        <div className="focusMeta">
          <span>
            {block.start} - {block.end}
          </span>
          {focusBlock.isUpcoming ? (
            <span>
              Starts in {focusBlock.minutesUntilStart === null ? '-' : focusBlock.minutesUntilStart}{' '}
              min
            </span>
          ) : (
            <span>{focusBlock.minutesRemaining} min left</span>
          )}
        </div>
      </div>
      <div className="focusProgress">
        <div
          className="focusProgressBar"
          style={{ width: `${focusBlock.progressPercent}%` }}
        />
      </div>
      <div className="focusBody">
        <div className="focusPurpose">{block.purpose}</div>
        <div className="focusGood">
          <span>Definition of done:</span>
          <span>{block.good}</span>
        </div>
        {focusBlock.isUpcoming ? (
          <div className="focusHint">Planned duration: {duration} min.</div>
        ) : null}
      </div>
    </section>
  );
}

const getGreeting = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 14) return 'Good day';
  if (hour >= 14 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
};

function FocusView({
  scheduleBlocks,
  supplementsList,
  supplementChecksForToday,
  onToggleSupplement,
  programRows,
  programDayLabel,
  trainingDayActive,
  mealTemplates,
  mealCheckMap,
  onToggleMealCheck,
}: FocusViewProps) {
  const { user } = useAuth();
  const {
    nowMinutes,
    focusBlocks,
    nextBlock,
    minutesUntilNext,
    supplementWindow,
  } = useActiveContext(scheduleBlocks, supplementsList, supplementChecksForToday);

  const greeting = getGreeting(nowMinutes);
  const displayName = user?.username || user?.email?.split('@')[0] || '';

  const blocksToShow: FocusPanelBlock[] = focusBlocks.length
    ? focusBlocks.map((focusBlock) =>
        Object.assign({}, focusBlock, {
          isUpcoming: false,
          minutesUntilStart: null,
        })
      )
    : nextBlock
    ? [
        {
          block: nextBlock,
          context: 'default',
          progressPercent: 0,
          minutesRemaining: Math.max(toMinutes(nextBlock.end) - nowMinutes, 0),
          isUpcoming: true,
          minutesUntilStart: minutesUntilNext,
        },
      ]
    : [];

  return (
    <main className="focusView">
      <header className="focusHeader">
        <div>
          <div className="focusTime">{formatClockTime(nowMinutes)}</div>
          <div className="focusGreeting">
            {greeting}{displayName ? `, ${displayName}` : ''}.
          </div>
          <div className="focusSubtitle">
            {blocksToShow.length
              ? 'Only what matters right now.'
              : 'No scheduled blocks right now.'}
          </div>
        </div>
      </header>

      <div className="focusStack">
        {blocksToShow.map((focusBlock) => {
          const blockId = focusBlock.block.id || '';
          if (focusBlock.context === 'gym') {
            return (
              <GymFocus
                key={`focus-gym-${blockId}`}
                block={focusBlock.block}
                progressPercent={focusBlock.progressPercent}
                minutesRemaining={focusBlock.minutesRemaining}
                isActive={!focusBlock.isUpcoming}
              />
            );
          }
          if (focusBlock.context === 'meal') {
            return (
              <MealFocus
                key={`focus-meal-${blockId}`}
                block={focusBlock.block}
                progressPercent={focusBlock.progressPercent}
                minutesRemaining={focusBlock.minutesRemaining}
                isActive={!focusBlock.isUpcoming}
              />
            );
          }
          return (
            <DefaultFocusPanel
              key={`focus-default-${blockId}`}
              focusBlock={focusBlock}
            />
          );
        })}

        {supplementWindow ? (
          <SupplementFocus
            pendingSupplements={supplementWindow.pending}
            totalInWindow={supplementWindow.totalInWindow}
            onToggleSupplement={onToggleSupplement}
          />
        ) : null}

        <div className="focusSectionDivider" />

        <ProgramFocusSection
          programDayLabel={programDayLabel}
          programRows={programRows}
          trainingDayActive={trainingDayActive}
        />

        <NutritionFocusSection
          mealTemplates={mealTemplates}
          mealCheckMap={mealCheckMap}
          onToggleMealCheck={onToggleMealCheck}
        />

        <SupplementFocus
          pendingSupplements={supplementsList.filter(
            (s) => !supplementChecksForToday[s.id || '']
          )}
          totalInWindow={supplementsList.length}
          onToggleSupplement={onToggleSupplement}
        />
      </div>
    </main>
  );
}

export default FocusView;
