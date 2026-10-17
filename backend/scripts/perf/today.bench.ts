// /api/today latency budget (Bet 1): seed one realistic year for one user,
// then time 200 sequential GET /api/today requests in-process (supertest over
// loopback, real Postgres). Fails if p95 > 150 ms.
//
//   TEST_DATABASE_URL=postgresql://…@localhost:5432/onyx_test_sync npm run perf:today
//
// Uses PERF_DATABASE_URL, else TEST_DATABASE_URL. Local databases only; it
// adds a new user and never deletes anything.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RUNS = Number(process.env.PERF_RUNS ?? 200);
const WARMUP = 20;
const BUDGET_P95_MS = 150;
const DATE = '2026-10-17';

const url = process.env.PERF_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Set PERF_DATABASE_URL or TEST_DATABASE_URL (local)');
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname)) {
  throw new Error('perf:today runs against a local database only');
}
Object.assign(process.env, {
  DATABASE_URL: url,
  DISABLE_RATE_LIMIT: '1',
  NODE_ENV: 'test',
  JWT_SECRET: process.env.JWT_SECRET ?? 'bench-jwt-secret-at-least-32-chars-long!!',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ?? 'bench-refresh-secret-at-least-32-chars!!',
});

const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function main() {
  const { default: request } = await import('supertest');
  const { default: app } = await import('../../src/app.js');
  const { prisma } = await import('../../src/config/database.js');
  const { seedYear } = await import('../../test/fixtures/seedYear.js');

  const email = `perf-today-${Date.now()}@onyx.test`;
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'perf-Passw0rd-123!', timezone: 'UTC' });
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status}`);
  const token = reg.body.data.accessToken as string;
  const userId = reg.body.data.user.id as string;

  const t0 = performance.now();
  const seeded = await seedYear(prisma, userId, { to: DATE });
  const seedMs = performance.now() - t0;

  const server = app.listen(0);
  const agent = request.agent(server);
  const get = (p: string) => agent.get(p).set('Authorization', `Bearer ${token}`);

  for (let i = 0; i < WARMUP; i++) await get(`/api/today?date=${DATE}`);
  const times: number[] = [];
  let bytes = 0;
  let gz = 0;
  for (let i = 0; i < RUNS; i++) {
    const s = performance.now();
    const res = await get(`/api/today?date=${DATE}`);
    times.push(performance.now() - s);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (i === 0) {
      bytes = Buffer.byteLength(res.text);
      gz = zlib.gzipSync(res.text).length;
    }
  }
  const sorted = times.slice().sort((a, b) => a - b);

  // Reference: the legacy startup payload the app downloads today.
  const legacy = await get('/api/sync/export');
  const legacyBytes = Buffer.byteLength(legacy.text);

  server.close();
  await prisma.$disconnect();

  const result = {
    runs: RUNS,
    seededRows: seeded.rows,
    seedMs: Math.round(seedMs),
    p50Ms: Number(pct(sorted, 50).toFixed(1)),
    p95Ms: Number(pct(sorted, 95).toFixed(1)),
    p99Ms: Number(pct(sorted, 99).toFixed(1)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(1)),
    payloadBytes: bytes,
    payloadGzipBytes: gz,
    legacySyncExportBytes: legacyBytes,
    budgetP95Ms: BUDGET_P95_MS,
  };
  const outDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../test-results'
  );
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'perf-today.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (result.p95Ms > BUDGET_P95_MS) {
    console.error(`FAIL: /api/today p95 ${result.p95Ms} ms > ${BUDGET_P95_MS} ms`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
