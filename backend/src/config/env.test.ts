import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const good = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/x',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('parseEnv', () => {
  it('accepts a complete env and applies defaults', () => {
    const r = parseEnv(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.env.PORT).toBe('3001');
  });

  it('rejects short secrets, missing DB url and identical secrets', () => {
    expect(parseEnv(Object.assign({}, good, { JWT_SECRET: 'short' })).ok).toBe(false);
    expect(parseEnv(Object.assign({}, good, { DATABASE_URL: undefined })).ok).toBe(false);
    expect(
      parseEnv(Object.assign({}, good, { JWT_REFRESH_SECRET: good.JWT_SECRET })).ok
    ).toBe(false);
  });
});

describe('server boot with a bad env (audit F5)', () => {
  it('exits with code 1 before listening', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const backend = path.resolve(here, '../..');
    const r = spawnSync(
      process.execPath,
      ['--import', 'tsx', '-e', "await import('./src/config/env.ts')"],
      {
        cwd: backend,
        encoding: 'utf8',
        // No dotenv here: only these vars are visible to the child.
        env: {
          PATH: process.env.PATH,
          SYSTEMROOT: process.env.SYSTEMROOT,
          DATABASE_URL: good.DATABASE_URL,
          JWT_SECRET: 'too-short',
          JWT_REFRESH_SECRET: good.JWT_REFRESH_SECRET,
        },
        timeout: 30000,
      }
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('JWT_SECRET');
    expect(r.stderr).not.toContain('too-short');
  });
});
