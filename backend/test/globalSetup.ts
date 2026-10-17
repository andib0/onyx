import { execSync } from 'node:child_process';

export function assertSafeTestUrl(raw: string | undefined): string {
  if (!raw) {
    throw new Error('TEST_DATABASE_URL is not set (e.g. postgresql://user:pw@localhost:5432/onyx_test)');
  }
  const url = new URL(raw);
  const host = url.hostname;
  const db = url.pathname.replace(/^\//, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`Refusing to run API tests against non-local host "${host}"`);
  }
  if (!db.endsWith('_test')) {
    throw new Error(`Refusing to reset database "${db}": name must end in _test`);
  }
  return raw;
}

export default function setup() {
  const url = assertSafeTestUrl(process.env.TEST_DATABASE_URL);
  execSync('npx prisma db push --force-reset --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    env: Object.assign({}, process.env, { DATABASE_URL: url }),
  });
}
