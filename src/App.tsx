import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import useCompletion from './hooks/useCompletion';
import useLog from './hooks/useLog';
import useSupplements from './hooks/useSupplements';
import useToday from './hooks/useToday';
import useToast from './hooks/useToast';
import { useAuth } from './contexts/AuthContext';
import { exportUserData, importLocalStorageData } from './api/sync';
import {
  createMealTemplate,
  deleteMealTemplate,
  toggleMealLog,
  updateMealTemplate,
} from './api/meals';
import { getProgram, listPrograms } from './api/programs';
import { updatePreferences } from './api/preferences';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ViewContainer from './components/layout/ViewContainer';
import Toast from './components/ui/Toast';
import ConfirmModal from './components/ui/ConfirmModal';
import ProgramSetupModal from './components/ui/ProgramSetupModal';
import LogView from './views/LogView';
import NutritionView from './views/NutritionView';
import ProgramView from './views/ProgramView';
import SupplementsView from './views/SupplementsView';
import TodayView from './views/TodayView';
import FocusView from './views/FocusView';
import { AuthView } from './views/AuthView';

import { DATA } from './data/weekdayData';
import { ensureState, loadPrefs, savePrefs, todayKey } from './utils/storage';
import { getWeekdayName, toMinutes } from './utils/time';
import type { ProgramDetail, ProgramSummary } from './api/programs';
import type { AppState, MealTemplate, ScheduleBlock, SupplementItem } from './types/appTypes';

const TITLES: Record<string, [string, string]> = {
  focus: ['Focus', 'Only what matters right now.'],
  today: [
    'Today',
    'Execute the timeline. Mark blocks as done. Keep caffeine controlled.',
  ],
  program: ['Program', '3-day split with progression rules (double progression).'],
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

  const weekdayName = getWeekdayName();
  const [selectedMealDay, setSelectedMealDay] = useState(weekdayName);
  const [appState, setAppState] = useState<AppState>(() => normalizeState({}));
  const [stateLoading, setStateLoading] = useState(false);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedProgramDayId, setSelectedProgramDayId] = useState('');
  const [programDetail, setProgramDetail] = useState<ProgramDetail | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [programSetupDismissed, setProgramSetupDismissed] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importPendingState, setImportPendingState] = useState<AppState | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const mealTemplatesForDay = getMealTemplatesForDay(selectedMealDay, appState);
  const todayKeyValue = todayKey();

  const handleImportClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  const handleSelectProgram = (id: string) => {
    setSelectedProgramId(id);
    const program = programs.find((item) => item.id === id);
    if (program && program.days.length) {
      const dayId = program.days[0].id;
      setSelectedProgramDayId(dayId);
    } else {
      setSelectedProgramDayId('');
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const filename = String(file.name || '').toLowerCase();
    if (!filename.endsWith('.json')) {
      showToast('Import failed: expected a .json file.');
      event.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const obj = JSON.parse(text) as Partial<AppState>;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        throw new Error('Invalid data.');
      }
      setImportPendingState(normalizeState(obj));
      setShowImportModal(true);
    } catch (error) {
      const message =
        error && error instanceof Error
          ? `Import failed: ${error.message}`
          : 'Import failed.';
      showToast(message);
    } finally {
      event.target.value = '';
    }
  };

  const exportJson = async () => {
    const result = await exportUserData();
    if (!result.success || !result.data) {
      showToast(result.error || 'Export failed.');
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'daily_tracker_data.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('Exported JSON.');
  };

  const cancelImport = () => {
    setImportPendingState(null);
    setShowImportModal(false);
  };

  const confirmImport = async () => {
    if (!importPendingState) return;
    setShowImportModal(false);
    const result = await importLocalStorageData(importPendingState as never);
    if (!result.success) {
      showToast(result.error || 'Import failed.');
      setImportPendingState(null);
      return;
    }
    const refreshed = await exportUserData();
    if (refreshed.success && refreshed.data) {
      setAppState(normalizeState(refreshed.data));
    }
    showToast('Import complete. Backend data replaced.');
    setImportPendingState(null);
  };

  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) {
      setAppState(normalizeState({}));
      setPrograms([]);
      setProgramDetail(null);
      setSelectedProgramId('');
      setSelectedProgramDayId('');
      setPrefsReady(false);
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
      })
      .finally(() => {
        if (!cancelled) setStateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return undefined;
    let cancelled = false;
    listPrograms().then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setPrograms(result.data);
      } else {
        setPrograms([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const prefs = user?.preferences;
    if (!prefs || prefsReady) return;
    setSelectedProgramId(prefs.selectedProgramId || '');
    setSelectedProgramDayId(prefs.selectedProgramDayId || '');
    setPrefsReady(true);
  }, [isAuthenticated, prefsReady, user?.preferences]);

  const shouldShowProgramSetup =
    isAuthenticated &&
    prefsReady &&
    !programSetupDismissed &&
    programs.length > 0 &&
    (!selectedProgramId || !selectedProgramDayId);

  useEffect(() => {
    if (!isAuthenticated || !prefsReady) return;
    updatePreferences({
      selectedProgramId: selectedProgramId || null,
      selectedProgramDayId: selectedProgramDayId || null,
    });
  }, [isAuthenticated, prefsReady, selectedProgramDayId, selectedProgramId]);

  useEffect(() => {
    if (!selectedProgramId) {
      setProgramDetail(null);
      setSelectedProgramDayId('');
      return;
    }
    let cancelled = false;
    getProgram(selectedProgramId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setProgramDetail(result.data);
        setSelectedProgramDayId((prev) => {
          const dayExists = result.data!.days.some((day) => day.id === prev);
          if (dayExists) return prev;
          return result.data!.days[0]?.id || '';
        });
      } else {
        setProgramDetail(null);
        setSelectedProgramDayId('');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProgramId]);

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

  const selectedProgramDay =
    programDetail?.days.find((day) => day.id === selectedProgramDayId) || null;
  const programRows = selectedProgramDay
    ? selectedProgramDay.exercises.map((exercise) => ({
        ex: exercise.exerciseName,
        sets: exercise.sets,
        reps: exercise.reps,
        rir: exercise.rir || '',
        rest: exercise.restSeconds || '',
        notes: exercise.notes || '',
        prog: exercise.progression || '',
      }))
    : [];
  const programLabel =
    programDetail && selectedProgramDay
      ? `${programDetail.name} - ${selectedProgramDay.name}`
      : 'No program selected';
  const trainingDayActive = !!selectedProgramDay;

  const timelineBlocks = useMemo(() => {
    const baseBlocks = (scheduleBlocks || []).map((block) =>
      Object.assign({}, block, { readonly: false, source: 'schedule' as const })
    );
    const supplementBlocks = (supplementsList || []).map((supplementItem, index) => {
      const start = supplementItem.timeAt || '08:00';
      const end = addMinutesToTime(start, 15);
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
    });
    const nutritionBlocks = createNutritionBlocks(baseBlocks, mealTemplatesForDay);
    const programBlocks = createProgramBlocks(baseBlocks, programLabel, trainingDayActive);
    return baseBlocks
      .concat(programBlocks, nutritionBlocks, supplementBlocks)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  }, [mealTemplatesForDay, programLabel, scheduleBlocks, supplementsList, trainingDayActive]);

  const { visibleBlocks, nextStartBlock, nextStartInMinutes } = useToday(
    timelineBlocks,
    showAllTimeline
  );

  const { logEntries, addLogEntry, clearLogEntries, deleteLogEntry } = useLog(
    appState,
    setAppState,
    showToast
  );

  useEffect(() => {
    const nextPrefs = Object.assign({}, loadPrefs(), {
      showAllTimeline,
    });
    savePrefs(nextPrefs);
  }, [showAllTimeline]);

  useEffect(() => {
    if (isFocusRoute) return undefined;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target && target.tagName ? target.tagName : '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (event.key === '1') {
        lastNonFocusView.current = 'today';
        setView('today');
      }
      if (event.key === '2') {
        lastNonFocusView.current = 'program';
        setView('program');
      }
      if (event.key === '3') {
        lastNonFocusView.current = 'nutrition';
        setView('nutrition');
      }
      if (event.key === '4') {
        lastNonFocusView.current = 'supplements';
        setView('supplements');
      }
      if (event.key === '5') {
        lastNonFocusView.current = 'log';
        setView('log');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFocusRoute]);

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

  const setMealChecked = async (mealId: string, isChecked: boolean) => {
    const result = await toggleMealLog(mealId, todayKeyValue, isChecked);
    if (!result.success) {
      showToast(result.error || 'Failed to update meal log.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.mealLog = Object.assign({}, next.mealLog, {
        [todayKeyValue]: Object.assign({}, next.mealLog[todayKeyValue] || {}, {
          [mealId]: isChecked,
        }),
      });
      return next;
    });
  };

  const updateMealTemplateForDay = async (
    dayName: string,
    mealId: string,
    patch: Partial<MealTemplate>
  ) => {
    const result = await updateMealTemplate(mealId, Object.assign({}, patch, { dayOfWeek: dayName }));
    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to update meal template.');
      return;
    }
    const data = result.data;
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      const current = (next.mealTemplatesByDay && next.mealTemplatesByDay[dayName]) || [];
      const updated = current.map((item) => {
        if (item.id !== mealId) return item;
        return Object.assign({}, item, {
          name: data.name,
          examples: data.examples || '',
          grams: data.grams,
          foodId: data.foodId,
          tags: data.tags || [],
        });
      });
      next.mealTemplatesByDay = Object.assign({}, next.mealTemplatesByDay, {
        [dayName]: updated,
      });
      return next;
    });
  };

  const addMealTemplateForDay = async (dayName: string, template: MealTemplate) => {
    const result = await createMealTemplate({
      dayOfWeek: dayName,
      name: template.name,
      examples: template.examples,
      grams: template.grams != null ? Number(template.grams) : undefined,
      foodId: template.foodId || undefined,
      tags: template.tags,
    });
    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to add meal template.');
      return;
    }
    const addData = result.data;
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      const current = (next.mealTemplatesByDay && next.mealTemplatesByDay[dayName]) || [];
      next.mealTemplatesByDay = Object.assign({}, next.mealTemplatesByDay, {
        [dayName]: current.concat([
          {
            id: addData.id,
            name: addData.name,
            examples: addData.examples || '',
            grams: addData.grams,
            foodId: addData.foodId,
            tags: addData.tags || [],
          },
        ]),
      });
      return next;
    });
    showToast('Meal template added.');
  };

  const removeMealTemplateForDay = async (dayName: string, mealId: string) => {
    const result = await deleteMealTemplate(mealId);
    if (!result.success) {
      showToast(result.error || 'Failed to remove meal template.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      const current = (next.mealTemplatesByDay && next.mealTemplatesByDay[dayName]) || [];
      const updated = current.filter((item) => item.id !== mealId);
      next.mealTemplatesByDay = Object.assign({}, next.mealTemplatesByDay, {
        [dayName]: updated,
      });
      return next;
    });
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
    if (!programDetail || !selectedProgramDay) return 'No program selected.';
    const header = [
      `${programDetail.name} - ${selectedProgramDay.name}`,
      'Progression: follow the plan guidance and progress weekly.',
      '',
    ];
    const lines = selectedProgramDay.exercises.map(
      (exercise, index) =>
        `${index + 1}) ${exercise.exerciseName} - ${exercise.sets}x${exercise.reps} (RIR ${exercise.rir || '-' }), rest ${exercise.restSeconds || '-'}s. Notes: ${exercise.notes || '-'}${exercise.progression ? `. Prog: ${exercise.progression}` : ''}`
    );
    return header.concat(lines).join('\n');
  };

  const navDayLabel = trainingDayActive && selectedProgramDay
    ? selectedProgramDay.name
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

  if (authLoading || (isAuthenticated && stateLoading)) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-primary, #0a0a0a)',
          color: 'var(--text-primary, #fff)',
        }}
      >
        Loading...
      </div>
    );
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
            onExport={exportJson}
            onImport={handleImportClick}
            onFocus={() => handleChangeView('focus')}
            userEmail={user?.email}
            onLogout={logout}
          />
        ) : null}

        <ViewContainer active={!isFocusRoute && view === 'today'}>
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
        </ViewContainer>

        <ViewContainer active={!isFocusRoute && view === 'program'}>
          <ProgramView
            programDayLabel={programLabel}
            programRows={programRows}
            trainingDayActive={trainingDayActive}
            onCopyProgramDay={() => copyText(programToText())}
            programs={programs}
            selectedProgramId={selectedProgramId}
            selectedProgramDayId={selectedProgramDayId}
            onSelectProgram={handleSelectProgram}
            onSelectProgramDay={setSelectedProgramDayId}
          />
        </ViewContainer>

        <ViewContainer active={!isFocusRoute && view === 'nutrition'}>
          <NutritionView
            nutritionTargets={DATA.nutritionTargets}
            mealTemplates={mealTemplatesForDay}
            weekdayName={weekdayName}
            selectedMealDay={selectedMealDay}
            mealDayOptions={MEAL_DAYS}
            mealCheckMap={appState.mealLog[todayKeyValue] || {}}
            onToggleMealCheck={setMealChecked}
            onUpdateMealTemplate={updateMealTemplateForDay}
            onRemoveMealTemplate={removeMealTemplateForDay}
            onAddMealTemplate={addMealTemplateForDay}
            onSelectMealDay={setSelectedMealDay}
          />
        </ViewContainer>

        <ViewContainer active={!isFocusRoute && view === 'supplements'}>
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
        </ViewContainer>

        <ViewContainer active={!isFocusRoute && view === 'log'}>
          <LogView
            logEntries={logEntries}
            onAddLogEntry={addLogEntry}
            onClearLogEntries={clearLogEntries}
            onDeleteLogEntry={deleteLogEntry}
          />
        </ViewContainer>

        <ViewContainer active={isFocusRoute}>
          <FocusView
            scheduleBlocks={scheduleBlocks}
            supplementsList={supplementsList}
            supplementChecksForToday={supplementChecksForToday}
            onToggleSupplement={setSupplementChecked}
          />
        </ViewContainer>
      </main>

      <Toast message={toastMessage} visible={toastVisible} />
      <ProgramSetupModal
        open={shouldShowProgramSetup}
        programs={programs}
        selectedProgramId={selectedProgramId}
        selectedProgramDayId={selectedProgramDayId}
        onSelectProgram={handleSelectProgram}
        onSelectProgramDay={setSelectedProgramDayId}
        onConfirm={() => setProgramSetupDismissed(true)}
        onSkip={() => setProgramSetupDismissed(true)}
      />
      <ConfirmModal
        open={showImportModal}
        title="Overwrite backend data?"
        description="Importing will replace your current backend data (schedule, supplements, meals, logs). This cannot be undone."
        confirmLabel="Overwrite"
        cancelLabel="Cancel"
        onConfirm={confirmImport}
        onCancel={cancelImport}
      />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </div>
  );
}

function addMinutesToTime(timeValue: string, minutesToAdd: number): string {
  const start = toMinutes(timeValue);
  const capped = Math.min(start + minutesToAdd, 1439);
  return formatMinutes(capped);
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function createProgramBlocks(
  scheduleBlocks: Array<ScheduleBlock>,
  programLabel: string,
  trainingDayActive: boolean
): ScheduleBlock[] {
  if (!trainingDayActive) return [];
  const sorted = (scheduleBlocks || []).slice().sort((a, b) => {
    return toMinutes(a.start) - toMinutes(b.start);
  });
  const trainingIndex = sorted.findIndex((block) => {
    const text = `${block.title || ''} ${block.tag || ''}`.toLowerCase();
    return text.includes('warm-up') || text.includes('gym') || block.tag === 'Training';
  });
  if (trainingIndex === -1) return [];
  const startBlock = sorted[trainingIndex];
  const nextBlock = sorted[trainingIndex + 1];
  if (!nextBlock) return [];
  const start = startBlock.end;
  const end = nextBlock.start;
  if (toMinutes(end) <= toMinutes(start)) return [];
  return [
    {
      id: `program_${programLabel.replace(/[^a-z0-9]+/gi, '_')}`,
      start,
      end,
      title: 'Program session',
      purpose: 'Follow the current training day plan.',
      good: programLabel,
      tag: 'Program',
      readonly: true,
      source: 'program',
    },
  ];
}

function createNutritionBlocks(
  scheduleBlocks: Array<ScheduleBlock>,
  mealTemplates: MealTemplate[]
): ScheduleBlock[] {
  if (!mealTemplates || !mealTemplates.length) return [];
  const nutritionSlots = (scheduleBlocks || [])
    .filter((block) => block.tag === 'Nutrition')
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const count = Math.min(nutritionSlots.length, mealTemplates.length);
  if (!count) return [];
  return Array.from({ length: count }).map((_, index) => {
    const slot = nutritionSlots[index];
    const meal = mealTemplates[index];
    const tags = Array.isArray(meal.tags)
      ? meal.tags.map((tag) => `${tag.label} ${tag.value}`).join('; ')
      : '';
    return {
      id: `nutrition_${meal.id || index}`,
      start: slot.start,
      end: slot.end,
      title: meal.name,
      purpose: meal.examples || slot.purpose,
      good: tags || slot.good,
      tag: 'Nutrition',
      readonly: true,
      source: 'nutrition',
    };
  });
}

function normalizeState(rawState: Partial<AppState>): AppState {
  const base = ensureState(rawState);
  const incomingList = Array.isArray(rawState && rawState.supplementsList)
    ? rawState.supplementsList
    : [];
  base.supplementsList = incomingList.map((item) =>
    Object.assign({}, item, {
      id: item.id || undefined,
      timeAt: item.timeAt || inferTimeAt(item),
    })
  );
  const incomingSchedule = Array.isArray(rawState && rawState.schedule)
    ? rawState.schedule
    : [];
  base.schedule = incomingSchedule.map((item) =>
    Object.assign({}, item, { id: item.id || undefined })
  );
  base.log = base.log.map((entry) => {
    if (entry && entry.id) return entry;
    return Object.assign({}, entry, { id: entry.id || undefined });
  });
  base.mealTemplatesByDay = normalizeMealTemplatesByDay(rawState && rawState.mealTemplatesByDay);
  return base;
}

const MEAL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function normalizeMealTemplatesByDay(
  rawTemplates: Record<string, MealTemplate[]> | undefined
): Record<string, MealTemplate[]> {
  const source = rawTemplates && typeof rawTemplates === 'object' ? rawTemplates : {};
  return MEAL_DAYS.reduce<Record<string, MealTemplate[]>>((result, dayName) => {
    const list = Array.isArray(source[dayName]) ? source[dayName] : [];
    result[dayName] = normalizeMealList(list, dayName);
    return result;
  }, {});
}

function normalizeMealList(list: MealTemplate[], dayName: string): MealTemplate[] {
  return (list || []).map((meal, index) => {
    const tags = Array.isArray(meal.tags)
      ? meal.tags.map((tag) => Object.assign({}, tag))
      : [];
    return Object.assign({}, meal, {
      id: meal.id || `meal_${dayName}_${index}`,
      tags,
    });
  });
}

function getMealTemplatesForDay(weekdayName: string, state: AppState): MealTemplate[] {
  if (state && state.mealTemplatesByDay && state.mealTemplatesByDay[weekdayName]) {
    return state.mealTemplatesByDay[weekdayName];
  }
  return [];
}

function inferTimeAt(item: SupplementItem): string {
  if (item.timeAt) return item.timeAt;
  return '08:00';
}

export default App;
