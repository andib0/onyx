import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { computeCoverage, REPORT_FILE, resetCoverage } from './apiCoverage.js';

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

/** True when vitest was started without file/name filters (the full suite). */
function isFullRun(): boolean {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === 'run') continue;
    if (a === '--config' || a === '-c') {
      i++;
      continue;
    }
    if (a === '-t' || a === '--testNamePattern') return false;
    if (!a.startsWith('-')) return false;
  }
  return true;
}

export default function setup() {
  const url = assertSafeTestUrl(process.env.TEST_DATABASE_URL);
  // Build the schema from migrations (not db push) so API tests also prove the
  // migration history is complete.
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    stdio: 'pipe',
    env: Object.assign({}, process.env, { DATABASE_URL: url }),
  });
  resetCoverage();

  return function teardown() {
    const report = computeCoverage();
    if (!report) return;
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(
      `\nAPI route coverage: ${report.handled}/${report.total} routes have a 2xx and a 4xx test ` +
        `(2xx: ${report.happy}/${report.total}, 4xx: ${report.failure}/${report.total})`
    );
    for (const m of report.missing)
      console.log(`  missing ${m.needs.join('+')}: ${m.key}`);
    if (report.missing.length && isFullRun() && process.env.API_COVERAGE_STRICT !== '0') {
      // Throwing here is only logged by vitest; set the exit code explicitly.
      console.error(`FAIL: ${report.missing.length} route(s) lack API tests (see above)`);
      process.exitCode = 1;
    }
  };
}
