// Render-count harness: mounts the real provider tree (AppStateProvider and every
// domain provider) with stubbed platform modules, network and the two hooks owned
// elsewhere (useProgram, useWorkout), then counts how many screen-like consumers
// re-render per event. Guards against re-render cascades (Bet 11).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState, type ReactNode } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Platform stubs ──
vi.mock("react-native", () => ({
  AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
  Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios },
  Appearance: {
    getColorScheme: () => "dark",
    addChangeListener: () => ({ remove() {} }),
  },
  StyleSheet: { create: <T,>(s: T) => s },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    multiRemove: async () => {},
    getAllKeys: async () => [],
  },
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("expo-document-picker", () => ({}));
vi.mock("expo-file-system", () => ({ File: class {}, Paths: {} }));
vi.mock("expo-sharing", () => ({}));
vi.mock("../../utils/notifications", () => ({
  loadNotificationPrefs: async () => ({ supplements: false }),
  syncSupplementReminders: async () => {},
}));
vi.mock("../../components/ui/Toast", () => ({ default: () => null }));

// ── Network ──
vi.mock("../../api/sync", () => ({
  exportUserData: async () => ({
    success: true,
    data: {
      schedule: [
        { id: "b1", start: "09:00", end: "10:00", title: "Deep work", tag: "Work" },
      ],
      supplementsList: [{ id: "s1", item: "Creatine", dose: "5 g", timeAt: "08:00" }],
    },
  }),
  importAppData: async () => ({ success: true }),
}));
vi.mock("../../api/scores", () => ({
  getScores: async () => ({ success: true, data: [] }),
}));
vi.mock("../../api/meals", () => ({
  toggleMealLog: async () => ({ success: true }),
  updateMealTemplate: async () => ({ success: true }),
  createMealTemplate: async () => ({ success: true }),
  deleteMealTemplate: async () => ({ success: true }),
}));

// ── Auth (stable session) ──
const AUTH = {
  user: { id: "u1", email: "a@b.c", weight: 80, preferences: null },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: async () => true,
  register: async () => true,
  logout: async () => {},
  clearError: () => {},
  refreshUser: async () => {},
};
vi.mock("../AuthContext", () => ({ useAuth: () => AUTH }));

// ── Hooks owned by another workstream: stubbed with controllable state ──
const control: {
  setPrograms?: (p: { id: string; name: string }[]) => void;
  tick?: () => void;
} = {};
vi.mock("../../hooks/useProgram", () => ({
  default: function useProgramStub() {
    const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
    control.setPrograms = setPrograms;
    return {
      programs,
      selectedProgramId: "",
      selectedProgramDayId: "",
      programDetail: null,
      selectedProgramDay: null,
      programRows: EMPTY_ROWS,
      programLabel: "",
      trainingDayActive: false,
      shouldShowProgramSetup: false,
      handleSelectProgram: () => {},
      setSelectedProgramDayId: () => {},
      setProgramSetupDismissed: () => {},
      resetProgram: () => {},
      refreshPrograms: async () => {},
    };
  },
}));
const EMPTY_ROWS: never[] = [];
vi.mock("../../hooks/useWorkout", () => ({
  default: function useWorkoutStub() {
    const [now, setNow] = useState(0);
    control.tick = () => setNow((n) => n + 1);
    return {
      workout: { isActive: now > 0, now },
      workoutCompletedToday: false,
      startWorkout: () => {},
      togglePauseWorkout: () => {},
      stopWorkout: () => {},
      completeWorkoutSet: () => {},
      skipWorkoutRest: () => {},
      undoLastWorkoutSet: () => {},
      jumpToWorkoutExercise: () => {},
      extendWorkoutRest: () => {},
    };
  },
}));

import { AppStateProvider } from "../AppStateContext";
import { useToastContext } from "../ToastContext";
import { useData } from "../DataContext";
import { useProgram } from "../ProgramContext";
import { useSchedule } from "../ScheduleContext";
import { useMeals } from "../MealsContext";
import { useSupplements } from "../SupplementsContext";
import { useTimeline } from "../TimelineContext";

// ── Counted consumers (shaped like the real screens' subscriptions) ──
const renders: Record<string, number> = {};
const bump = (name: string) => {
  renders[name] = (renders[name] ?? 0) + 1;
};
const api: { showToast?: (m: string) => void; setMealChecked?: (id: string) => void } =
  {};

function FocusLike() {
  bump("FocusScreen");
  const { showToast } = useToastContext();
  const { appState } = useData();
  useSchedule();
  useSupplements();
  const { setMealChecked } = useMeals();
  useTimeline();
  useProgram(); // the real Focus reads program + workout state
  api.showToast = showToast;
  api.setMealChecked = (id: string) => {
    setMealChecked(id, true).catch(() => {});
  };
  void appState;
  return null;
}
function FocusWorkoutCard() {
  bump("WorkoutSection");
  useProgram();
  return null;
}
function TabLayoutLike() {
  bump("TabLayout");
  useMeals();
  useSupplements();
  return null;
}
function ScheduleLike() {
  bump("ScheduleScreen");
  useSchedule();
  useToastContext();
  return null;
}
function SettingsLike() {
  bump("SettingsScreen");
  useToastContext();
  useData();
  return null;
}
function NutritionLike() {
  bump("NutritionScreen");
  useMeals();
  useData();
  useToastContext();
  return null;
}
const CONSUMERS = [
  "FocusScreen",
  "WorkoutSection",
  "TabLayout",
  "ScheduleScreen",
  "SettingsScreen",
  "NutritionScreen",
];

function Tree({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={client}>
      <AppStateProvider>{children}</AppStateProvider>
    </QueryClientProvider>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const { stateLoading } = useData();
  useEffect(() => {
    if (!stateLoading) onReady();
  }, [stateLoading, onReady]);
  return null;
}

// Drains microtasks and React Query's setTimeout(0)-batched notifications.
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
      else await new Promise((r) => setTimeout(r, 0));
    });
  }
};

async function measure(
  event: () => void | Promise<void>
): Promise<Record<string, number>> {
  const before = Object.assign({}, renders);
  await act(async () => {
    await event();
  });
  await flush();
  const diff: Record<string, number> = {};
  for (const name of CONSUMERS) diff[name] = (renders[name] ?? 0) - (before[name] ?? 0);
  return diff;
}
const touched = (d: Record<string, number>) =>
  Object.values(d).filter((n) => n > 0).length;

describe("provider render counts", () => {
  let root: TestRenderer.ReactTestRenderer;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    for (const k of Object.keys(renders)) delete renders[k];
    let ready = false;
    await act(async () => {
      root = TestRenderer.create(
        <Tree>
          <Ready onReady={() => (ready = true)} />
          <FocusLike />
          <FocusWorkoutCard />
          <TabLayoutLike />
          <ScheduleLike />
          <SettingsLike />
          <NutritionLike />
        </Tree>
      );
    });
    await flush();
    expect(ready).toBe(true);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("a toast re-renders no consumer (show and auto-hide)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const shown = await measure(() => api.showToast!("Saved"));
    const hidden = await measure(() => {
      vi.advanceTimersByTime(10_000);
    });
    vi.useRealTimers();
    console.info("toast show", shown, "hide", hidden);
    expect(touched(shown)).toBe(0);
    expect(touched(hidden)).toBe(0);
  });

  it("programs list resolving re-renders only program consumers (Focus + workout card)", async () => {
    const d = await measure(() => control.setPrograms!([{ id: "p1", name: "PPL" }]));
    console.info("programs resolve", d);
    expect(d.WorkoutSection).toBe(1);
    expect(d.FocusScreen).toBe(1);
    expect(touched(d)).toBe(2);
  });

  it("a meal check re-renders meal/data consumers once each", async () => {
    const d = await measure(() => api.setMealChecked!("m1"));
    console.info("meal check", d);
    expect(d.ScheduleScreen).toBe(0);
    expect(d.WorkoutSection).toBe(0);
    for (const name of CONSUMERS) expect(d[name]).toBeLessThanOrEqual(1);
  });

  it("a workout tick only reaches program consumers", async () => {
    const d = await measure(() => control.tick!());
    console.info("workout tick", d);
    expect(d.WorkoutSection).toBe(1);
    // Until the workout clock moves into its own context (useWorkout owner),
    // a tick still reaches every useProgram() consumer — but nothing else.
    expect(d.FocusScreen).toBe(1);
    expect(touched(d)).toBe(2);
  });
});
