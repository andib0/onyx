// Evidence sink for API tests: vitest hides console output of passing tests,
// so measured numbers are written to backend/test-results/<name>.json
// (git-ignored) and copied into docs/log by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results');

export function writeReport(name: string, data: unknown) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${name}.json`),
    JSON.stringify(Object.assign({ at: new Date().toISOString() }, data), null, 2)
  );
}
