import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { listRoutes } from './routeTable.js';

/**
 * Route coverage for the API suite. Every request made through helpers.http()
 * is matched against the router's route table and appended to hits.jsonl;
 * test/globalSetup.ts reads it after the run, prints handled/total and fails
 * the run if any route lacks a 2xx test or a 4xx (auth/validation) test.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
export const COVERAGE_DIR = path.resolve(
  here,
  '../node_modules/.cache/onyx-api-coverage'
);
export const HITS_FILE = path.join(COVERAGE_DIR, 'hits.jsonl');
export const ROUTES_FILE = path.join(COVERAGE_DIR, 'routes.json');
export const REPORT_FILE = path.join(COVERAGE_DIR, 'report.json');

/** Routes that cannot fail with 4xx: public, no input. */
export const NO_FAILURE_MODE: Record<string, string> = {
  'GET /api/health': 'public liveness probe with no input',
};

function toMatcher(routePath: string): RegExp {
  const src = routePath
    .split('/')
    .map((seg) =>
      seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('/');
  return new RegExp(`^${src}/?$`, 'i');
}

export function wrapWithRecorder(app: Express): Express {
  const routes = listRoutes(app).map((r) => ({
    key: r.key,
    method: r.method,
    re: toMatcher(r.path),
  }));
  fs.mkdirSync(COVERAGE_DIR, { recursive: true });
  fs.writeFileSync(ROUTES_FILE, JSON.stringify(routes.map((r) => r.key)));

  const outer = express();
  outer.use((req, res, next) => {
    const urlPath = req.originalUrl.split('?')[0];
    res.on('finish', () => {
      const route = routes.find((r) => r.method === req.method && r.re.test(urlPath));
      if (!route) return;
      fs.appendFileSync(
        HITS_FILE,
        JSON.stringify({ key: route.key, status: res.statusCode }) + '\n'
      );
    });
    next();
  });
  outer.use(app);
  return outer;
}

export interface CoverageReport {
  total: number;
  handled: number;
  happy: number;
  failure: number;
  missing: Array<{ key: string; needs: string[] }>;
}

/** Reads the hits written during the run (called from globalSetup teardown). */
export function computeCoverage(): CoverageReport | null {
  if (!fs.existsSync(ROUTES_FILE)) return null;
  const keys: string[] = JSON.parse(fs.readFileSync(ROUTES_FILE, 'utf8'));
  const hits = fs.existsSync(HITS_FILE)
    ? fs
        .readFileSync(HITS_FILE, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { key: string; status: number })
    : [];
  const ok = new Set(hits.filter((h) => h.status < 300).map((h) => h.key));
  const bad = new Set(
    hits.filter((h) => h.status >= 400 && h.status < 500).map((h) => h.key)
  );
  const missing: CoverageReport['missing'] = [];
  for (const key of keys) {
    const needs: string[] = [];
    if (!ok.has(key)) needs.push('2xx');
    if (!bad.has(key) && !NO_FAILURE_MODE[key]) needs.push('4xx');
    if (needs.length) missing.push({ key, needs });
  }
  return {
    total: keys.length,
    handled: keys.length - missing.length,
    happy: keys.filter((k) => ok.has(k)).length,
    failure: keys.filter((k) => bad.has(k) || NO_FAILURE_MODE[k]).length,
    missing,
  };
}

export function resetCoverage() {
  fs.rmSync(COVERAGE_DIR, { recursive: true, force: true });
}
