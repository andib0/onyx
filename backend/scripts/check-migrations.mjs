// Migration drift judge (Bet 4): rebuilds a scratch database from
// prisma/migrations only, then asserts the result equals schema.prisma.
//
//   MIG_DATABASE_URL=postgresql://user:pw@localhost:5432/onyx_mig_check npm run db:check-migrations
//
// If MIG_DATABASE_URL is unset, the database name of TEST_DATABASE_URL is
// swapped for "onyx_mig_check". The target must be local and its name must
// contain "mig_check" — this script DROPS its public schema.
import { execSync } from 'node:child_process';

function resolveUrl() {
  if (process.env.MIG_DATABASE_URL) return process.env.MIG_DATABASE_URL;
  if (process.env.TEST_DATABASE_URL) {
    const u = new URL(process.env.TEST_DATABASE_URL);
    u.pathname = '/onyx_mig_check';
    return u.toString();
  }
  throw new Error(
    'Set MIG_DATABASE_URL (or TEST_DATABASE_URL) to a local *mig_check database'
  );
}

const url = resolveUrl();
const parsed = new URL(url);
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
  throw new Error(`Refusing non-local host ${parsed.hostname}`);
}
const dbName = parsed.pathname.replace(/^\//, '');
if (!dbName.includes('mig_check')) {
  throw new Error(`Refusing to wipe "${dbName}": name must contain "mig_check"`);
}

const env = Object.assign({}, process.env, { DATABASE_URL: url });
const run = (cmd, opts = {}) =>
  execSync(cmd, Object.assign({ env, stdio: 'pipe', encoding: 'utf8' }, opts));

console.log(`[check-migrations] resetting ${dbName}`);
run('npx prisma db execute --stdin --schema prisma/schema.prisma', {
  input: 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
});

console.log('[check-migrations] prisma migrate deploy');
run('npx prisma migrate deploy');

console.log('[check-migrations] prisma migrate diff (migrations DB -> schema.prisma)');
try {
  run(
    `npx prisma migrate diff --from-url "${url}" --to-schema-datamodel prisma/schema.prisma --exit-code --script`
  );
  console.log('[check-migrations] OK: migrations reproduce schema.prisma exactly');
} catch (e) {
  console.error('[check-migrations] DRIFT: migrations do not match schema.prisma');
  console.error(e.stdout || e.message);
  process.exit(1);
}
