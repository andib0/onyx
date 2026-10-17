import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { authMiddleware } from '../src/middleware/auth.js';
import { VALIDATES } from '../src/middleware/validate.js';
import { listRoutes, type RouteInfo } from './routeTable.js';

/**
 * Static guarantees over the whole router (audit F4/F10). Runs without a
 * database: it only inspects the Express stack.
 */

const routes = listRoutes(app);

const validators = (r: RouteInfo) =>
  r.handlers.map((h) => (h as Record<symbol, unknown>)[VALIDATES]).filter(Boolean);

const PUBLIC = new Set([
  'GET /api/health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
]);

describe('route coverage', () => {
  it('finds the whole API', () => {
    expect(routes.length).toBeGreaterThanOrEqual(59);
  });

  it('every POST/PUT/PATCH route validates its body with Zod', () => {
    const missing = routes
      .filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method))
      .filter((r) => !validators(r).includes('body'))
      .map((r) => r.key);
    expect(missing).toEqual([]);
  });

  it('every route with a path parameter validates its params', () => {
    const missing = routes
      .filter((r) => r.path.includes(':'))
      .filter((r) => !validators(r).includes('params'))
      .map((r) => r.key);
    expect(missing).toEqual([]);
  });

  it('every non-public route requires a bearer token', () => {
    const open = routes
      .filter((r) => !PUBLIC.has(r.key))
      .filter((r) => !r.inherited.concat(r.handlers).includes(authMiddleware as never))
      .map((r) => r.key);
    expect(open).toEqual([]);
  });

  it('validators run after auth (no parsing work for anonymous callers)', () => {
    for (const r of routes) {
      if (PUBLIC.has(r.key)) continue;
      const authAt = r.handlers.indexOf(authMiddleware as never);
      if (authAt === -1) continue; // router-level auth runs before all handlers
      const firstValidator = r.handlers.findIndex(
        (h) => (h as Record<symbol, unknown>)[VALIDATES]
      );
      if (firstValidator !== -1) expect(firstValidator, r.key).toBeGreaterThan(authAt);
    }
  });
});
