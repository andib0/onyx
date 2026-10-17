// Flows run on a fixed "Monday 09:00 local" so plan-dependent UI (training vs rest day,
// greeting, check-in timing) is deterministic regardless of when the suite runs.
// Node-side seeding and the browser clock must both use this instant.
function nextMonday9(from = new Date()): Date {
  const d = new Date(from);
  d.setHours(9, 0, 0, 0);
  const add = (8 - d.getDay()) % 7; // 0 when already Monday
  d.setDate(d.getDate() + add);
  return d;
}

export const E2E_NOW = nextMonday9();
export const e2eNow = (): Date => new Date(E2E_NOW);
