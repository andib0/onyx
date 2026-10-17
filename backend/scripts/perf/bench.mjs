import fs from 'fs';
import { req, login, pct } from './lib.mjs';
const RUNS = 60;
const cfg = JSON.parse(
  fs.readFileSync(new URL('./bench_user.json', import.meta.url), 'utf8')
);
let { access, refresh } = await login(cfg.email);
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const eps = [
  [
    'POST /auth/refresh',
    () =>
      req('POST', '/auth/refresh', { body: { refreshToken: refresh } }).then((r) => {
        if (r.json.data) refresh = r.json.data.refreshToken;
        return r;
      }),
  ],
  ['GET /auth/me', () => req('GET', '/auth/me', { token: access })],
  ['GET /sync/export', () => req('GET', '/sync/export', { token: access })],
  ['GET /scores?days=30', () => req('GET', '/scores?days=30', { token: access })],
  ['GET /programs', () => req('GET', '/programs', { token: access })],
  [
    'PUT /preferences',
    () =>
      req('PUT', '/preferences', {
        token: access,
        body: { selectedProgramId: cfg.programId, selectedProgramDayId: cfg.dayId },
      }),
  ],
  [
    'GET /programs/:id',
    () => req('GET', `/programs/${cfg.programId}`, { token: access }),
  ],
  [
    'POST /scores',
    () =>
      req('POST', '/scores', {
        token: access,
        body: { date: today, score: 55, tasksDone: 3, tasksTotal: 7 },
      }),
  ],
  [
    'GET /workouts/sessions?limit=50 (Mondays)',
    () => req('GET', '/workouts/sessions?limit=50', { token: access }),
  ],
  ['GET /sync/state (unused by app)', () => req('GET', '/sync/state', { token: access })],
];
const rows = [];
for (const [name, fn] of eps) {
  for (let i = 0; i < 5; i++) await fn(); // warm-up
  const ms = [];
  let bytes = 0;
  let status;
  for (let i = 0; i < RUNS; i++) {
    const r = await fn();
    ms.push(r.ms);
    bytes = r.bytes;
    status = r.status;
  }
  rows.push({
    name,
    status,
    p50: pct(ms, 50),
    p95: pct(ms, 95),
    max: Math.max(...ms),
    bytes,
  });
}
for (const r of rows)
  console.log(
    `${r.name.padEnd(44)} ${r.status}  p50 ${r.p50.toFixed(1).padStart(6)} ms  p95 ${r.p95.toFixed(1).padStart(6)} ms  max ${r.max.toFixed(0).padStart(5)}  ${(r.bytes / 1024).toFixed(1)} KB`
  );

// Simulated cold app start, following the code's dependency graph:
// refresh -> me -> { export, scores, programs, PUT prefs, GET program/:id } in parallel (postScore fires 1.5 s later, excluded)
const walls = [];
const seqs = [];
for (let i = 0; i < 50; i++) {
  const t0 = performance.now();
  let seq = 0;
  const r1 = await eps[0][1]();
  seq += r1.ms;
  const r2 = await eps[1][1]();
  seq += r2.ms;
  const par = await Promise.all([
    eps[2][1](),
    eps[3][1](),
    eps[4][1](),
    eps[5][1](),
    eps[6][1](),
  ]);
  seq += par.reduce((s, r) => s + r.ms, 0);
  walls.push(performance.now() - t0);
  seqs.push(seq);
}
console.log(
  `\nApp-start critical path (7 requests: 2 serial + 5 parallel) wall: p50 ${pct(walls, 50).toFixed(1)} ms  p95 ${pct(walls, 95).toFixed(1)} ms`
);
console.log(
  `Same 7 requests fully serial (sum): p50 ${pct(seqs, 50).toFixed(1)} ms  p95 ${pct(seqs, 95).toFixed(1)} ms`
);
