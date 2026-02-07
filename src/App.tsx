import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import useCompletion from './hooks/useCompletion';
import useLog from './hooks/useLog';
import useSupplements from './hooks/useSupplements';
import useToday from './hooks/useToday';
import useToast from './hooks/useToast';
import useProgram from './hooks/useProgram';
import useMeals from './hooks/useMeals';
import useImportExport from './hooks/useImportExport';
import { useAuth } from './contexts/AuthContext';
import { exportUserData } from './api/sync';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ViewContainer from './components/layout/ViewContainer';
import Toast from './components/ui/Toast';
import ConfirmModal from './components/ui/ConfirmModal';
import ProgramSetupModal from './components/ui/ProgramSetupModal';
import ErrorBoundary from './components/ErrorBoundary';
import LogView from './views/LogView';
import NutritionView from './views/NutritionView';
import ProgramView from './views/ProgramView';
import SupplementsView from './views/SupplementsView';
import TodayView from './views/TodayView';
import FocusView from './views/FocusView';
import { AuthView } from './views/AuthView';

import { DATA } from './data/weekdayData';
import { loadPrefs, savePrefs, todayKey } from './utils/storage';
import { toMinutes } from './utils/time';
import {
  normalizeState,
  getMealTemplatesForDay,
  addMinutesToTime,
  createProgramBlocks,
  createNutritionBlocks,
  MEAL_DAYS,
} from './utils/normalize';
import { SUPPLEMENT_BLOCK_DURATION_MINUTES } from './constants';
import type { AppState, ScheduleBlock } from './types/appTypes';

const TITLES: Record<string, [string, string]> = {
  focus: ['Focus', 'Only what matters right now.'],
  today: [
    'Today',
    'Execute the timeline. Mark blocks as done. Keep caffeine controlled.',
  ],
  program: [
    'Program',
    '3-day split with progression rules (double progression).',
  ],
  nutrition: ['Nutrition', 'Lean bulk targets + packed lunch templates.'],
  supplements: ['Supplements', 'Current stack. Sleep and safety first.'],
  log: ['Log', 'Track bodyweight, sleep, steps, and top sets.'],
};

function App() {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [view, setView] = useState('today');
  const location = useLocation();
  const navigate = useNavigate();
  const isFocusRoute = location.pathname === '/focus';
  const lastNonFocusView = useRef('today');
  const didInit = useRef(false);
  const [showAllTimeline, setShowAllTimeline] = useState(() => {
    const prefs = loadPrefs();
    return prefs.showAllTimeline === true;
  });

  const { toastMessage, toastVisible, showToast } = useToast();
  const [appState, setAppState] = useState<AppState>(() => normalizeState({}));
  const [stateLoading, setStateLoading] = useState(false);
  const todayKeyValue = todayKey();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Extracted hooks
  const program = useProgram(isAuthenticated, authLoading, user);

  const meals = useMeals(appState, setAppState, todayKeyValue, showToast);

  const importExport = useImportExport(
    (state: AppState) => setAppState(state),
    showToast,
    importInputRef
  );

  // Load app state from backend
  const resetProgram = program.resetProgram;
  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on logout
      setAppState(normalizeState({}));
      resetProgram();
      setStateLoading(false);
      return undefined;
    }
    let cancelled = false;
    setStateLoading(true);
    exportUserData()
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setAppState(normalizeState(result.data));
        } else {
          setAppState(normalizeState({}));
        }
      })
      .finally(() => {
        if (!cancelled) setStateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, resetProgram]);

  const {
    completionByBlockId,
    scheduleBlocks,
    setBlockCompletion,
    updateScheduleBlock,
    removeScheduleBlock,
    addScheduleBlock,
  } = useCompletion(appState, setAppState, todayKeyValue, showToast);

  const {
    supplementsList,
    supplementChecksForToday,
    supplementLogByDate,
    setSupplementChecked,
    addSupplementItem,
    updateSupplementItem,
    removeSupplementItem,
    clearSupplementChecks,
  } = useSupplements(appState, setAppState, todayKeyValue, showToast);

  const mealTemplatesForDay = getMealTemplatesForDay(
    meals.selectedMealDay,
    appState
  );
  const mealTemplatesForToday = getMealTemplatesForDay(
    meals.weekdayName,
    appState
  );

  // Build timeline
  const timelineBlocks = useMemo(() => {
    const baseBlocks = (scheduleBlocks || []).map((block) =>
      Object.assign({}, block, {
        readonly: false,
        source: 'schedule' as const,
      })
    );
    const supplementBlocks = (supplementsList || []).map(
      (supplementItem, index) => {
        const start = supplementItem.timeAt || '08:00';
        const end = addMinutesToTime(start, SUPPLEMENT_BLOCK_DURATION_MINUTES);
        return {
          id: `supp_block_${supplementItem.id || index}`,
          start,
          end,
          title: supplementItem.item,
          purpose: supplementItem.goal || 'Supplement',
          good: supplementItem.dose || '',
          tag: 'Supplement',
          readonly: true,
          source: 'supplement' as const,
        };
      }
    );
    const nutritionBlocks = createNutritionBlocks(
      baseBlocks,
      mealTemplatesForDay
    );
    const programBlocks = createProgramBlocks(
      baseBlocks,
      program.programLabel,
      program.trainingDayActive
    );
    return (baseBlocks as Array<ScheduleBlock>)
      .concat(programBlocks, nutritionBlocks, supplementBlocks)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  }, [
    mealTemplatesForDay,
    program.programLabel,
    scheduleBlocks,
    supplementsList,
    program.trainingDayActive,
  ]);

  const { visibleBlocks, nextStartBlock, nextStartInMinutes } = useToday(
    timelineBlocks,
    showAllTimeline
  );

  const { logEntries, addLogEntry, clearLogEntries, deleteLogEntry } = useLog(
    appState,
    setAppState,
    showToast
  );

  // Persist timeline preference
  useEffect(() => {
    const nextPrefs = Object.assign({}, loadPrefs(), { showAllTimeline });
    savePrefs(nextPrefs);
  }, [showAllTimeline]);

  // Keyboard shortcuts
  useEffect(() => {
    if (isFocusRoute) return undefined;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target && target.tagName ? target.tagName : '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      const keyMap: Record<string, string> = {
        '1': 'today',
        '2': 'program',
        '3': 'nutrition',
        '4': 'supplements',
        '5': 'log',
      };
      const nextView = keyMap[event.key];
      if (nextView) {
        lastNonFocusView.current = nextView;
        setView(nextView);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFocusRoute]);

  // Initial redirect
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (location.pathname === '/') {
      navigate('/focus', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleChangeView = (nextView: string) => {
    if (nextView === 'focus') {
      navigate('/focus');
      return;
    }
    lastNonFocusView.current = nextView;
    setView(nextView);
    if (isFocusRoute) navigate('/');
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied.');
    } catch {
      showToast('Copy failed.');
    }
  };

  const programToText = () => {
    if (!program.programDetail || !program.selectedProgramDay)
      return 'No program selected.';
    const header = [
      `${program.programDetail.name} - ${program.selectedProgramDay.name}`,
      'Progression: follow the plan guidance and progress weekly.',
      '',
    ];
    const lines = program.selectedProgramDay.exercises.map(
      (exercise, index) =>
        `${index + 1}) ${exercise.exerciseName} - ${exercise.sets}x${exercise.reps} (RIR ${exercise.rir || '-'}), rest ${exercise.restSeconds || '-'}s. Notes: ${exercise.notes || '-'}${exercise.progression ? `. Prog: ${exercise.progression}` : ''}`
    );
    return header.concat(lines).join('\n');
  };

  // Derived values
  const navDayLabel =
    program.trainingDayActive && program.selectedProgramDay
      ? program.selectedProgramDay.name
      : 'Rest';
  const timelineTotalBlocks = timelineBlocks.length;
  const timelineDoneCount = timelineBlocks.reduce((count, block) => {
    const blockId = block.id || '';
    return completionByBlockId[blockId] ? count + 1 : count;
  }, 0);
  const timelineProgressPercent = timelineTotalBlocks
    ? Math.round((timelineDoneCount / timelineTotalBlocks) * 100)
    : 0;
  const timelineRemainingCount = timelineTotalBlocks - timelineDoneCount;
  const meta = user?.preferences || DATA.meta;

  // Loading state
  if (authLoading || (isAuthenticated && stateLoading)) {
    return <div className="loadingScreen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  return (
    <div className="app">
      <Sidebar
        view={isFocusRoute ? 'focus' : view}
        navProgress={timelineProgressPercent}
        navDay={navDayLabel}
        meta={meta}
        onChangeView={handleChangeView}
        onLogout={logout}
      />

      <main className="main">
        {!isFocusRoute ? (
          <Topbar
            title={TITLES[view][0]}
            subtitle={TITLES[view][1]}
            showAllTimeline={showAllTimeline}
            onToggleTimeline={() => setShowAllTimeline((prev) => !prev)}
            onExport={importExport.exportJson}
            onImport={importExport.handleImportClick}
            onFocus={() => handleChangeView('focus')}
          />
        ) : null}

        <ViewContainer active={!isFocusRoute && view === 'today'}>
          <ErrorBoundary>
            <TodayView
              timelineBlocks={visibleBlocks}
              completionByBlockId={completionByBlockId}
              progressLabel={`${timelineDoneCount}/${timelineTotalBlocks}`}
              progressPercent={timelineProgressPercent}
              remainingCount={timelineRemainingCount}
              nextStartBlock={nextStartBlock}
              nextStartInMinutes={nextStartInMinutes}
              onToggleBlockCompletion={setBlockCompletion}
              onUpdateScheduleBlock={updateScheduleBlock}
              onRemoveScheduleBlock={removeScheduleBlock}
              onAddScheduleBlock={addScheduleBlock}
            />
          </ErrorBoundary>
        </ViewContainer>

        <ViewContainer active={!isFocusRoute && view === 'program'}>
          <ErrorBoundary>
            <ProgramView
              programDayLabel={program.programLabel}
              programRows={program.programRows}
              trainingDayActive={program.trainingDayActive}
              onCopyProgramDay={() => copyText(programToText())}
              programs={program.programs}
              selectedProgramId={program.selectedProgramId}
              selectedProgramDayId={program.selectedProgramDayId}
              onSelectProgram={program.handleSelectProgram}
              onSelectProgramDay={program.setSelectedProgramDayId}
            />
          </ErrorBoundary>
        </ViewContainer>

        <ViewContainer active={!isFocusRoute && view === 'nutrition'}>
          <ErrorBoundary>
            <NutritionView
              nutritionTargets={DATA.nutritionTargets}
              mealTemplates={mealTemplatesForDay}
              weekdayName={meals.weekdayName}
              selectedMealDay={meals.selectedMealDay}
              mealDayOptions={MEAL_DAYS}
              mealCheckMap={appState.mealLog[todayKeyValue] || {}}
              onToggleMealCheck={meals.setMealChecked}
              onUpdateMealTemplate={meals.updateMealTemplateForDay}
              onRemoveMealTemplate={meals.removeMealTemplateForDay}
              onAddMealTemplate={meals.addMealTemplateForDay}
              onSelectMealDay={meals.setSelectedMealDay}
            />
          </ErrorBoundary>
        </ViewContainer>

        <ViewContainer active={!isFocusRoute && view === 'supplements'}>
          <ErrorBoundary>
            <SupplementsView
              supplementsList={supplementsList}
              supplementChecks={supplementChecksForToday}
              supplementLogByDate={supplementLogByDate}
              todayKeyValue={todayKeyValue}
              onToggleSupplement={setSupplementChecked}
              onClearSupplementChecks={clearSupplementChecks}
              onAddSupplement={addSupplementItem}
              onUpdateSupplement={updateSupplementItem}
              onRemoveSupplement={removeSupplementItem}
            />
          </ErrorBoundary>
        </ViewContainer>

        <ViewContainer active={!isFocusRoute && view === 'log'}>
          <ErrorBoundary>
            <LogView
              logEntries={logEntries}
              onAddLogEntry={addLogEntry}
              onClearLogEntries={clearLogEntries}
              onDeleteLogEntry={deleteLogEntry}
            />
          </ErrorBoundary>
        </ViewContainer>

        <ViewContainer active={isFocusRoute}>
          <ErrorBoundary>
            <FocusView
              scheduleBlocks={scheduleBlocks}
              supplementsList={supplementsList}
              supplementChecksForToday={supplementChecksForToday}
              onToggleSupplement={setSupplementChecked}
              programRows={program.programRows}
              programDayLabel={program.programLabel}
              trainingDayActive={program.trainingDayActive}
              mealTemplates={mealTemplatesForToday}
              mealCheckMap={appState.mealLog[todayKeyValue] || {}}
              onToggleMealCheck={meals.setMealChecked}
            />
          </ErrorBoundary>
        </ViewContainer>
      </main>

      <Toast message={toastMessage} visible={toastVisible} />
      <ProgramSetupModal
        open={program.shouldShowProgramSetup}
        programs={program.programs}
        selectedProgramId={program.selectedProgramId}
        selectedProgramDayId={program.selectedProgramDayId}
        onSelectProgram={program.handleSelectProgram}
        onSelectProgramDay={program.setSelectedProgramDayId}
        onConfirm={() => program.setProgramSetupDismissed(true)}
        onSkip={() => program.setProgramSetupDismissed(true)}
      />
      <ConfirmModal
        open={importExport.showImportModal}
        title="Overwrite backend data?"
        description="Importing will replace your current backend data (schedule, supplements, meals, logs). This cannot be undone."
        confirmLabel="Overwrite"
        cancelLabel="Cancel"
        onConfirm={importExport.confirmImport}
        onCancel={importExport.cancelImport}
      />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={importExport.handleImportFile}
      />
    </div>
  );
}

export default App;
