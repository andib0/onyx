import { execSync } from 'node:child_process';

export function assertSafeTestUrl(raw: string | undefined): string {
  if (!raw) {
    throw new Error(
      'TEST_DATABASE_URL is not set (e.g. postgresql://user:pw@localhost:5432/onyx_test)'
    );
  }
  const url = new URL(raw);
  const host = url.hostname;
  const db = url.pathname.replace(/^\//, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`Refusing to run API tests against non-local host "${host}"`);
  }
  if (!db.endsWith('_test') && !db.startsWith('onyx_test_')) {
    throw new Error(
      `Refusing to reset database "${db}": name must end in _test or start with onyx_test_`
    );
  }
  return raw;
}

export default function setup() {
  const url = assertSafeTestUrl(process.env.TEST_DATABASE_URL);
  // Build the schema from migrations (not db push) so API tests also prove the
  // migration history is complete.
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    stdio: 'pipe',
    env: Object.assign({}, process.env, { DATABASE_URL: url }),
  });
}
