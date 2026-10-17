// Query keys are namespaced per user so a second account on the device can
// never see (or persist over) the first one's data. Day data is keyed by the
// device-local date so a midnight rollover reads a fresh key.
export const qk = {
  today: (userId: string, date: string) => ["today", userId, date] as const,
  appState: (userId: string) => ["appState", userId] as const,
  programs: (userId: string) => ["programs", userId] as const,
  program: (userId: string, programId: string) => ["program", userId, programId] as const,
  userFoods: (userId: string) => ["userFoods", userId] as const,
  workoutHistory: (userId: string) => ["workoutHistory", userId] as const,
};

/** Keys persisted to disk (Bet 1). */
export const PERSISTED_ROOTS = new Set([
  "today",
  "appState",
  "programs",
  "program",
  "userFoods",
  "workoutHistory",
]);
