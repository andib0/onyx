import type { Express } from 'express';

/**
 * Lists every route registered on the Express app by walking its router stack
 * (Express 4 internals: app._router.stack, layer.route, layer.handle.stack).
 * Tests use this so a newly added route can't silently skip the IDOR matrix,
 * validation coverage or the per-route API tests.
 */

type Fn = ((...args: never[]) => unknown) & Record<PropertyKey, unknown>;

interface Layer {
  name: string;
  handle: Fn & { stack?: Layer[] };
  regexp: RegExp & { fast_slash?: boolean };
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: Fn; method?: string }>;
  };
}

export interface RouteInfo {
  method: string;
  /** Full path, e.g. "/api/meals/templates/:id". */
  path: string;
  /** "METHOD /path" */
  key: string;
  /** Route-level handlers, in order (middleware + controller). */
  handlers: Fn[];
  /** Router-level `use()` middleware that runs before this route (e.g. auth). */
  inherited: Fn[];
}

/** Turns Express 4's mount regexp (e.g. /^\/api\/?(?=\/|$)/i) back into "/api". */
function mountPath(layer: Layer): string {
  if (layer.regexp.fast_slash) return '';
  const src = layer.regexp.source
    .replace(/^\^/, '')
    .replace('\\/?(?=\\/|$)', '')
    .replace(/\\\//g, '/');
  if (!/^(\/[A-Za-z0-9_-]+)+$/.test(src)) {
    throw new Error(`routeTable: cannot decode mount path from ${layer.regexp}`);
  }
  return src;
}

function walk(stack: Layer[], prefix: string, inherited: Fn[], out: RouteInfo[]) {
  const uses: Fn[] = [];
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter((m) => m !== '_all');
      for (const m of methods) {
        const method = m.toUpperCase();
        const path = (prefix + layer.route.path).replace(/(.)\/$/, '$1');
        out.push({
          method,
          path,
          key: `${method} ${path}`,
          handlers: layer.route.stack
            .filter((s) => !s.method || s.method === m)
            .map((s) => s.handle),
          inherited: inherited.concat(uses),
        });
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer), inherited.concat(uses), out);
    } else if (layer.regexp.fast_slash) {
      uses.push(layer.handle);
    }
  }
}

export function listRoutes(app: Express): RouteInfo[] {
  const root = (app as unknown as { _router: { stack: Layer[] } })._router;
  const out: RouteInfo[] = [];
  walk(root.stack, '', [], out);
  return out;
}
