// Local-only startup latency benchmark. Run: node scripts/perf/seed_bench.mjs (once), then node scripts/perf/bench.mjs
// against `npm run dev` on :3001 pointed at a local dev DB. Never point BASE at production.
export const BASE = 'http://localhost:3001/api';
if (!BASE.startsWith('http://localhost')) throw new Error('local only');
let ipCounter = Math.floor(Math.random() * 200);
// Rotate X-Forwarded-For so the local 100 req/min limiter (trust proxy=1) does not skew results.
export function xff() {
  ipCounter++;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}
export async function req(method, path, { token, body, cookie, noXff, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (!noXff) headers['X-Forwarded-For'] = xff();
  const t0 = performance.now();
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  const ms = performance.now() - t0;
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return {
    status: res.status,
    json,
    ms,
    bytes: text.length,
    setCookie: res.headers.get('set-cookie'),
  };
}
export const PW = 'Passw0rd!x';
export async function register(tag) {
  const email = `audit-sync-${tag}-${Date.now()}@example.test`;
  const r = await req('POST', '/auth/register', {
    body: { email, password: PW, timezone: 'Europe/Tirane', weight: 80 },
  });
  if (r.status >= 300) throw new Error('register ' + JSON.stringify(r.json));
  return {
    email,
    access: r.json.data.accessToken,
    refresh: r.json.data.refreshToken,
    id: r.json.data.user.id,
  };
}
export async function login(email) {
  const r = await req('POST', '/auth/login', { body: { email, password: PW } });
  if (r.status >= 300) throw new Error('login ' + JSON.stringify(r.json));
  return { access: r.json.data.accessToken, refresh: r.json.data.refreshToken };
}
export function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
