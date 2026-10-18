import Constants from "expo-constants";

import * as SecureStore from "./tokenStore";

// EXPO_PUBLIC_API_URL lets local dev/e2e runs target a local API instead of production.
export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  "http://localhost:3001/api";

const ACCESS_TOKEN_KEY = "onyx_access_token";
const REFRESH_TOKEN_KEY = "onyx_refresh_token";

/** Every request gives up after this long (Bet 1: a sleeping Render instance
 *  must never hold the UI; the outbox retries later). */
export const REQUEST_TIMEOUT_MS = 8_000;
/** Refresh proactively when the access token expires within this window. */
const EXPIRY_SKEW_MS = 60_000;

let cachedAccessToken: string | null = null;
/** server clock - device clock, learned from a fresh token's `iat`. Expiry is
 *  judged on server time so a device with a wrong date neither refreshes on
 *  every request nor trusts an expired token. */
let clockOffsetMs = 0;
const CLOCK_OFFSET_KEY = "onyx_clock_offset";
let refreshPromise: Promise<RefreshOutcome> | null = null;

export type RefreshOutcome = "ok" | "rejected" | "transient";

// ── Listeners: auth expiry (refresh token definitively rejected) and
// connectivity (did a request reach the server?) ──
const authExpiredListeners = new Set<() => void>();
export function onAuthExpired(cb: () => void): () => void {
  authExpiredListeners.add(cb);
  return () => {
    authExpiredListeners.delete(cb);
  };
}
const networkListeners = new Set<(reachable: boolean) => void>();
export function onNetworkResult(cb: (reachable: boolean) => void): () => void {
  networkListeners.add(cb);
  return () => {
    networkListeners.delete(cb);
  };
}
function reportNetwork(reachable: boolean) {
  for (const cb of networkListeners) cb(reachable);
}

export function setAccessToken(token: string | null) {
  cachedAccessToken = token;
  if (token) {
    const claims = decodeJwt(token) as { iat?: number } | null;
    if (claims && typeof claims.iat === "number") {
      clockOffsetMs = claims.iat * 1000 - Date.now();
      SecureStore.setItem(CLOCK_OFFSET_KEY, String(clockOffsetMs)).catch(() => {});
    }
    SecureStore.setItem(ACCESS_TOKEN_KEY, token).catch(() => {});
  } else {
    SecureStore.deleteItem(ACCESS_TOKEN_KEY).catch(() => {});
  }
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function loadAccessToken(): Promise<string | null> {
  try {
    const [token, offset] = await Promise.all([
      SecureStore.getItem(ACCESS_TOKEN_KEY),
      SecureStore.getItem(CLOCK_OFFSET_KEY),
    ]);
    cachedAccessToken = token;
    if (offset) clockOffsetMs = Number(offset) || 0;
    return token;
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItem(REFRESH_TOKEN_KEY);
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  cachedAccessToken = null;
  await Promise.all([
    SecureStore.deleteItem(ACCESS_TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItem(REFRESH_TOKEN_KEY).catch(() => {}),
  ]);
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "===".slice((b64.length + 3) % 4);
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  if (atobFn) return atobFn(padded);
  // Hermes ships atob (RN ≥ 0.74); Buffer covers Node test runs.
  const B = (
    globalThis as {
      Buffer?: { from: (s: string, e: string) => { toString: (e: string) => string } };
    }
  ).Buffer;
  return B ? B.from(padded, "base64").toString("binary") : "";
}

/** JWT claims decoded locally (no signature check — the server does that). */
export function decodeJwt(token: string | null): { sub?: string; exp?: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

export function accessTokenExpiresSoon(
  token: string | null,
  now = Date.now() + clockOffsetMs
): boolean {
  const claims = decodeJwt(token);
  if (!claims || typeof claims.exp !== "number") return !token;
  return claims.exp * 1000 - now < EXPIRY_SKEW_MS;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  /** Server error code, e.g. ACCOUNT_NOT_FOUND, SESSION_EXPIRED. */
  code?: string;
  /** HTTP status; 0 when the server was never reached. */
  status?: number;
  /** The request never produced a usable server answer: offline, DNS,
   *  timeout, or a non-JSON response (proxy/edge page while the API boots). */
  networkError?: boolean;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({}, init, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function networkFailure<T>(error: unknown, status = 0): ApiResponse<T> {
  const aborted =
    error &&
    typeof error === "object" &&
    (error as { name?: string }).name === "AbortError";
  return {
    success: false,
    status,
    networkError: true,
    error: aborted
      ? "Request timed out"
      : error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Network error",
  };
}

/**
 * Refreshes the access token once (single flight). Only a 401/403 (or 400) from
 * /auth/refresh — the server saying "this refresh token is no good" — counts as
 * rejected; offline, timeouts, 5xx and non-JSON answers are transient and keep
 * the session.
 */
export function refreshAccessToken(): Promise<RefreshOutcome> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async (): Promise<RefreshOutcome> => {
    const storedRefreshToken = await getRefreshToken();
    if (!storedRefreshToken) return "rejected";
    let response: Response;
    try {
      response = await fetchWithTimeout(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });
    } catch {
      reportNetwork(false);
      return "transient";
    }
    const body = await readJson(response);
    if (!body) {
      reportNetwork(false);
      return "transient";
    }
    reportNetwork(true);
    if (response.status === 401 || response.status === 403 || response.status === 400) {
      return "rejected";
    }
    const data = body.data as { accessToken?: string; refreshToken?: string } | undefined;
    if (response.ok && body.success && data?.accessToken) {
      setAccessToken(data.accessToken);
      if (data.refreshToken) await setRefreshToken(data.refreshToken);
      return "ok";
    }
    return "transient";
  })().finally(() => {
    refreshPromise = null;
  });
  refreshPromise.then((outcome) => {
    if (outcome === "rejected") for (const cb of authExpiredListeners) cb();
  });
  return refreshPromise;
}

const PUBLIC_AUTH = ["/auth/login", "/auth/register", "/auth/refresh"];

function sessionExpired<T>(): ApiResponse<T> {
  return {
    success: false,
    status: 401,
    code: "SESSION_EXPIRED",
    error: "Session expired — please sign in again",
  };
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const isPublic = PUBLIC_AUTH.some((p) => endpoint.startsWith(p));

  // Lazy refresh: only when the stored access token is missing or about to
  // expire (decoded locally) — never on every launch.
  if (!isPublic && accessTokenExpiresSoon(cachedAccessToken)) {
    const outcome = await refreshAccessToken();
    if (outcome === "rejected") return sessionExpired<T>();
    if (outcome === "transient" && !cachedAccessToken) {
      return networkFailure<T>("Offline — can't refresh the session");
    }
  }

  const send = (token: string | null) =>
    fetchWithTimeout(
      `${API_BASE}${endpoint}`,
      Object.assign({}, options, {
        headers: Object.assign(
          { "Content-Type": "application/json" },
          token && !isPublic ? { Authorization: `Bearer ${token}` } : {},
          options.headers || {}
        ),
      })
    );

  let response: Response;
  try {
    response = await send(cachedAccessToken);
  } catch (error) {
    reportNetwork(false);
    return networkFailure<T>(error);
  }

  if (response.status === 401 && !isPublic) {
    const first = await readJson(response);
    if (first && first.code === "ACCOUNT_NOT_FOUND") {
      reportNetwork(true);
      return Object.assign({}, first, { success: false, status: 401 }) as ApiResponse<T>;
    }
    const outcome = await refreshAccessToken();
    if (outcome === "rejected") return sessionExpired<T>();
    if (outcome === "transient") return networkFailure<T>("Couldn't refresh the session");
    try {
      response = await send(cachedAccessToken);
    } catch (error) {
      reportNetwork(false);
      return networkFailure<T>(error);
    }
    if (response.status === 401) {
      reportNetwork(true);
      return sessionExpired<T>();
    }
  }

  const body = await readJson(response);
  if (!body) {
    // An HTML error page or empty body: the API did not really answer.
    reportNetwork(false);
    return networkFailure<T>(
      `Unexpected response (HTTP ${response.status})`,
      response.status
    );
  }
  reportNetwork(true);
  return Object.assign({}, body, {
    success: Boolean(body.success) && response.ok,
    status: response.status,
  }) as ApiResponse<T>;
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string) => apiClient<T>(endpoint, { method: "GET" }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => apiClient<T>(endpoint, { method: "DELETE" }),
};
