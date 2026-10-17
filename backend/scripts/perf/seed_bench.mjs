import fs from 'fs';
import { req, register } from './lib.mjs';
const out = (...a) => console.log(...a);
const DAYS = 60;
const u = await register('bench');
const A = u.access;
await req('POST', '/sync/seed-starter', { token: A });
const st = (await req('GET', '/sync/export', { token: A })).json.data;

const dateKey = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let rnd = 42;
const rand = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;

st.completion = {};
st.suppLog = {};
st.mealLog = {};
st.log = [];
for (let i = 0; i < DAYS; i++) {
  const d = dateKey(i);
  const wd = WD[new Date(d + 'T12:00:00').getDay()];
  st.completion[d] = Object.fromEntries(st.schedule.map((b) => [b.id, rand() < 0.75]));
  st.suppLog[d] = Object.fromEntries(st.supplementsList.map((s) => [s.id, rand() < 0.8]));
  st.mealLog[d] = Object.fromEntries(
    (st.mealTemplatesByDay[wd] || []).map((m) => [m.id, rand() < 0.85])
  );
  st.log.push({
    date: d,
    day: ['Push', 'Pull', 'Legs', 'Rest'][i % 4],
    bw: (80 + rand()).toFixed(1),
    sleep: (6 + rand() * 2).toFixed(1),
    steps: String(Math.round(6000 + rand() * 6000)),
    top: 'Bench 100x5',
    notes: 'note ' + i,
  });
}
const imp = await req('POST', '/sync/import', { token: A, body: st });
out('import:', imp.status, Math.round(imp.ms), 'ms');

const progs = (await req('GET', '/programs', { token: A })).json.data;
const prog = progs.find((p) => p.days && p.days.length) || progs[0];
const detail = (await req('GET', `/programs/${prog.id}`, { token: A })).json.data;
const day = detail.days[0];
await req('PUT', '/preferences', {
  token: A,
  body: { selectedProgramId: prog.id, selectedProgramDayId: day.id },
});

let n = 0;
for (let i = 0; i < DAYS; i++) {
  const d = dateKey(i);
  await req('POST', '/scores', {
    token: A,
    body: {
      date: d,
      score: Math.round(rand() * 100),
      tasksDone: 5,
      tasksTotal: 7,
      suppDone: 3,
      suppTotal: 4,
      mealsDone: 3,
      mealsTotal: 4,
      workoutDone: i % 4 !== 3,
      protein: 150,
      calories: 2400,
    },
  });
  if (i % 4 === 3) continue; // rest day
  const s = (
    await req('POST', '/workouts/sessions', {
      token: A,
      body: { date: d, programDayName: day.name },
    })
  ).json.data;
  for (const ex of day.exercises.slice(0, 6))
    for (let set = 1; set <= 3; set++) {
      await req('POST', `/workouts/sessions/${s.id}/sets`, {
        token: A,
        body: {
          exerciseName: ex.exerciseName,
          setNumber: set,
          weightKg: 60 + rand() * 60,
          reps: 5 + Math.round(rand() * 5),
        },
      });
      n++;
    }
  await req('PATCH', `/workouts/sessions/${s.id}/finish`, {
    token: A,
    body: { durationSeconds: 3600 },
  });
}
out(
  'program:',
  prog.name,
  '/',
  day.name,
  'exercises:',
  day.exercises.length,
  '| sets logged:',
  n
);
fs.writeFileSync(
  new URL('./bench_user.json', import.meta.url),
  JSON.stringify({
    email: u.email,
    refresh: u.refresh,
    programId: prog.id,
    dayId: day.id,
  })
);
