// Exercises scripts/migrate-deploy.sh against the three database states it
// must handle (Bet 4): empty, built by `prisma db push` from an older schema
// (production), and already migrated. Uses the scratch *mig_check database.
//
//   MIG_DATABASE_URL=postgresql://…/onyx_mig_check npm run db:verify-deploy
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const url =
  process.env.MIG_DATABASE_URL ??
  (() => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Set MIG_DATABASE_URL');
    const u = new URL(process.env.TEST_DATABASE_URL);
    u.pathname = '/onyx_mig_check';
    return u.toString();
  })();
const parsed = new URL(url);
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))
  throw new Error('local only');
if (!parsed.pathname.includes('mig_check'))
  throw new Error('database name must contain mig_check');

const env = Object.assign({}, process.env, { DATABASE_URL: url });
const sh = (cmd, input) =>
  execSync(cmd, {
    env,
    input,
    stdio: input ? ['pipe', 'pipe', 'pipe'] : 'pipe',
    encoding: 'utf8',
  });
const sql = (text) =>
  sh('npx prisma db execute --stdin --schema prisma/schema.prisma', text);
const reset = () => sql('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
const deploy = () => sh('bash scripts/migrate-deploy.sh');
const diffEmpty = () => {
  try {
    sh(
      `npx prisma migrate diff --from-url "${url}" --to-schema-datamodel prisma/schema.prisma --exit-code`
    );
    return true;
  } catch {
    return false;
  }
};
const check = (cond, msg) => {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok   ${msg}`);
};

// Old schema as it was when production last deployed with `db push` before the
// score macros / exercise library commits (2026-06-13, commit 9a2801b).
const oldSchema = path.join(os.tmpdir(), `onyx-old-schema-${process.pid}.prisma`);
fs.writeFileSync(oldSchema, sh('git show 9a2801b:backend/prisma/schema.prisma'));

const db = new PrismaClient({ datasources: { db: { url } } });
try {
  // 1. Empty database.
  reset();
  let out = deploy();
  check(out.includes('database state: empty'), 'empty DB detected');
  check(diffEmpty(), 'empty DB → schema matches schema.prisma');
  out = deploy();
  check(out.includes('database state: migrated'), 'second run sees migrated DB');
  check(diffEmpty(), 'second run is a no-op');

  // 2. Database built by `db push` from an older schema, with data (incl. the
  //    duplicate sets that non-idempotent retries produced).
  reset();
  sh(`npx prisma db push --schema "${oldSchema}" --skip-generate --accept-data-loss`);
  sql(`
    INSERT INTO "User"(id, email, "passwordHash", username, "updatedAt") VALUES ('u1','a@b.c','x','andi', now());
    INSERT INTO "UserPreferences"(id, "userId") VALUES ('p1','u1');
    INSERT INTO "ScheduleBlock"(id, "userId", start, "end", title) VALUES ('b1','u1','07:00','07:15','Wake');
    INSERT INTO "Completion"(id, "userId", "blockId", date, "isComplete") VALUES ('c1','u1','b1','2026-06-01', true);
    INSERT INTO "WorkoutSession"(id, "userId", date) VALUES ('s1','u1','2026-06-01');
    INSERT INTO "WorkoutSetLog"(id, "userId", "sessionId", "exerciseName", "setNumber", reps, "createdAt")
      VALUES ('w1','u1','s1','Bench',1,5, now() - interval '1 minute'), ('w2','u1','s1','Bench',1,5, now()),
             ('w3','u1','s1','Bench',2,5, now());
    INSERT INTO "DailyScore"(id, "userId", date, score, "updatedAt") VALUES ('d1','u1','2026-06-01', 80, now());
  `);
  out = deploy();
  check(out.includes('database state: pushed'), 'db-push DB detected');
  check(
    out.includes('marking 20261017000000_baseline_drift_fix as applied'),
    'baseline resolved'
  );
  check(diffEmpty(), 'db-push DB → schema matches schema.prisma after deploy');
  const [{ n: users }] = await db.$queryRawUnsafe(
    'SELECT count(*)::int AS n FROM "User"'
  );
  const [{ n: comps }] = await db.$queryRawUnsafe(
    'SELECT count(*)::int AS n FROM "Completion"'
  );
  const sets = await db.$queryRawUnsafe('SELECT id FROM "WorkoutSetLog" ORDER BY id');
  const [{ epoch }] = await db.$queryRawUnsafe('SELECT "dataEpoch" AS epoch FROM "User"');
  const [{ score }] = await db.$queryRawUnsafe('SELECT score FROM "DailyScore"');
  check(users === 1 && comps === 1 && score === 80, 'existing rows preserved');
  check(
    JSON.stringify(sets.map((s) => s.id)) === JSON.stringify(['w1', 'w3']),
    'duplicate set removed, earliest kept'
  );
  check(
    typeof epoch === 'string' && epoch.length === 36,
    'existing user got a dataEpoch'
  );
  out = deploy();
  check(out.includes('database state: migrated'), 'redeploy after baseline is a no-op');

  // 3. db-push DB at exactly the baseline schema (production's likely state).
  reset();
  sh(
    'npx prisma db push --schema prisma/baseline/schema.baseline.prisma --skip-generate'
  );
  out = deploy();
  check(out.includes('database state: pushed'), 'baseline db-push DB detected');
  check(diffEmpty(), 'baseline db-push DB → schema matches after deploy');
  console.log('verify-migrate-deploy: all checks passed');
} finally {
  await db.$disconnect();
  fs.rmSync(oldSchema, { force: true });
}
