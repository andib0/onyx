// Realistic day data, created through the public API (never the DB directly).
import { api, localDateKey, WEEKDAYS, type Session } from "./api";
import { e2eNow } from "./clock";

export const AM_SUPPLEMENTS = ["Creatine", "Vitamin D", "Omega-3"];

export async function seedDay(s: Session) {
  await api.post(s, "/schedule", {
    start: "07:30",
    end: "08:30",
    title: "Deep work",
    tag: "work",
  });
  await api.post(s, "/schedule", { start: "12:00", end: "12:30", title: "Lunch walk" });
  for (const item of AM_SUPPLEMENTS) {
    await api.post(s, "/supplements", { item, dose: "1 cap", timeAt: "08:00" });
  }
  await api.post(s, "/meals/templates", {
    dayOfWeek: WEEKDAYS[e2eNow().getDay()],
    name: "Breakfast oats",
    examples: "oats + whey",
  });
}

interface ProgramExercise {
  exerciseName: string;
  sets: string | number;
  reps: string;
}
interface ProgramDetail {
  id: string;
  name: string;
  days: { id: string; name: string; exercises: ProgramExercise[] }[];
}

/**
 * Selects "Beginner Full Body 3x/Week · Full Body A" (5 exercises, 14 sets — the audit's
 * ≈15-set session) and logs last week's session so weights/reps prefill (audit row 1).
 */
export async function seedProgram(s: Session): Promise<{ sets: number; day: string }> {
  const list = await api.get<{ id: string; name: string }[]>(s, "/programs");
  const pick = list.find((p) => p.name.startsWith("Beginner Full Body")) ?? list[0];
  const detail = await api.get<ProgramDetail>(s, `/programs/${pick.id}`);
  const day = detail.days[0];
  await api.put(s, "/preferences", {
    selectedProgramId: pick.id,
    selectedProgramDayId: day.id,
  });
  const lastWeek = e2eNow();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const session = await api.post<{ id: string }>(s, "/workouts/sessions", {
    date: localDateKey(lastWeek),
    programDayName: day.name,
  });
  let sets = 0;
  for (const ex of day.exercises) {
    const n = Number(ex.sets) || 0;
    sets += n;
    for (let i = 1; i <= n; i++) {
      await api.post(s, `/workouts/sessions/${session.id}/sets`, {
        exerciseName: ex.exerciseName,
        setNumber: i,
        weightKg: 40,
        reps: 8,
      });
    }
  }
  await api.patch(s, `/workouts/sessions/${session.id}/finish`, {
    durationSeconds: 3000,
  });
  return { sets, day: day.name };
}
