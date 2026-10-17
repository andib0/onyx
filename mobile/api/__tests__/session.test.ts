// Session restore + API client classification (Bet 1).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const secure = new Map<string, string>();
const async = new Map<string, string>();
vi.mock("../tokenStore", () => ({
  getItem: async (k: string) => secure.get(k) ?? null,
  setItem: async (k: string, v: string) => void secure.set(k, v),
  deleteItem: async (k: string) => void secure.delete(k),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => async.get(k) ?? null,
    setItem: async (k: string, v: string) => void async.set(k, v),
    removeItem: async (k: string) => void async.delete(k),
  },
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("../../sync/writes", () => ({ updateProfile: async () => ({ success: true }) }));

import { restoreSession, SESSION_USER_KEY } from "../session";
import {
  apiClient,
  onAuthExpired,
  REQUEST_TIMEOUT_MS,
  setAccessToken,
  loadAccessToken,
} from "../client";

const NOW = Date.UTC(2026, 9, 17, 9, 0, 0);
const b64 = (o: object) =>
  Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "");
const jwt = (sub: string, expSec: number) => `h.${b64({ sub, exp: expSec })}.sig`;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;
let expired = 0;
onAuthExpired(() => {
  expired++;
});

beforeEach(async () => {
  secure.clear();
  async.clear();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(NOW);
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  expired = 0;
  setAccessToken(null);
});
afterEach(() => {
  vi.useRealTimers();
});

const signedIn = async (opts: { accessExp: number; cachedUser?: boolean }) => {
  secure.set("onyx_refresh_token", jwt("u1", NOW / 1000 + 7 * 86400));
  secure.set("onyx_access_token", jwt("u1", opts.accessExp));
  if (opts.cachedUser !== false)
    async.set(
      SESSION_USER_KEY,
      JSON.stringify({ id: "u1", email: "a@b.c", createdAt: "" })
    );
  await loadAccessToken();
};

describe("restoreSession", () => {
  it("restores from stored tokens + cached user with zero network calls (offline)", async () => {
    await signedIn({ accessExp: NOW / 1000 - 3600 }); // even with an expired access token
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const r = await restoreSession();
    expect(r.source).toBe("cache");
    expect(r.user?.id).toBe("u1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no refresh token → signed out, no network", async () => {
    const r = await restoreSession();
    expect(r.user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no cached user and the API times out → stays signed in (identity from the JWT)", async () => {
    await signedIn({ accessExp: NOW / 1000 + 600, cachedUser: false });
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        })
    );
    const p = restoreSession();
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    const r = await p;
    expect(r.source).toBe("offline-stub");
    expect(r.user?.id).toBe("u1");
    expect(secure.has("onyx_refresh_token")).toBe(true);
    expect(expired).toBe(0);
  });

  it("no cached user and a 502 HTML page while Render boots → stays signed in", async () => {
    await signedIn({ accessExp: NOW / 1000 + 600, cachedUser: false });
    fetchMock.mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", { status: 502 })
    );
    const r = await restoreSession();
    expect(r.source).toBe("offline-stub");
    expect(expired).toBe(0);
  });

  it("refresh token definitively rejected (401 from /auth/refresh) → signed out", async () => {
    await signedIn({ accessExp: NOW / 1000 - 10, cachedUser: false });
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/refresh")
        ? json(401, { success: false, error: "Invalid refresh token" })
        : json(200, { success: true, data: { user: { id: "u1" } } })
    );
    const r = await restoreSession();
    expect(r.user).toBeNull();
    expect(secure.has("onyx_refresh_token")).toBe(false);
    await Promise.resolve();
    expect(expired).toBe(1);
  });
});

describe("apiClient", () => {
  it("gives up after 8 s and reports a network-class error", async () => {
    await signedIn({ accessExp: NOW / 1000 + 600 });
    fetchMock.mockImplementation(
      (_u: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          )
        )
    );
    const p = apiClient("/today");
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    let settled = false;
    p.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    const r = await p;
    expect(r).toMatchObject({
      success: false,
      networkError: true,
      error: "Request timed out",
    });
  });

  it("non-JSON answers are network-class errors, JSON errors are not", async () => {
    await signedIn({ accessExp: NOW / 1000 + 600 });
    fetchMock.mockResolvedValueOnce(new Response("<html>503</html>", { status: 503 }));
    expect(await apiClient("/today")).toMatchObject({ networkError: true, status: 503 });
    fetchMock.mockResolvedValueOnce(json(400, { success: false, error: "bad" }));
    const r = await apiClient("/today");
    expect(r.networkError).toBeFalsy();
    expect(r.status).toBe(400);
  });

  it("refreshes lazily when the access token is about to expire, sending the token in the body", async () => {
    await signedIn({ accessExp: NOW / 1000 + 30 });
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/refresh")
        ? json(200, {
            success: true,
            data: { accessToken: jwt("u1", NOW / 1000 + 900), refreshToken: "r2" },
          })
        : json(200, { success: true, data: 1 })
    );
    const r = await apiClient("/today");
    expect(r.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/refresh$/);
    // Cross-origin web fetches never send the httpOnly cookie (machinery B1).
    expect(JSON.parse(init.body).refreshToken).toBeTruthy();
    expect(secure.get("onyx_refresh_token")).toBe("r2");
  });

  it("does not refresh while the access token is fresh", async () => {
    await signedIn({ accessExp: NOW / 1000 + 600 });
    fetchMock.mockResolvedValue(json(200, { success: true, data: 1 }));
    await apiClient("/today");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("judges token expiry on server time when the device clock is days ahead", async () => {
    await signedIn({ accessExp: NOW / 1000 + 600 });
    vi.setSystemTime(NOW + 2 * 86400_000); // device clock wrong by two days
    // A fresh token issued "now" by the server teaches the client the offset.
    setAccessToken(`h.${b64({ sub: "u1", iat: NOW / 1000, exp: NOW / 1000 + 900 })}.sig`);
    fetchMock.mockResolvedValue(json(200, { success: true, data: 1 }));
    await apiClient("/today");
    expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh storm
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/today$/);
  });

  it("401 → refresh → retry once", async () => {
    await signedIn({ accessExp: NOW / 1000 + 600 });
    let calls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh"))
        return json(200, {
          success: true,
          data: { accessToken: jwt("u1", NOW / 1000 + 900) },
        });
      calls++;
      return calls === 1
        ? json(401, { success: false })
        : json(200, { success: true, data: 2 });
    });
    const r = await apiClient<number>("/today");
    expect(r.data).toBe(2);
  });

  it("401 and the refresh is offline → network-class error, session kept", async () => {
    await signedIn({ accessExp: NOW / 1000 + 600 });
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh")) throw new TypeError("Network request failed");
      return json(401, { success: false });
    });
    const r = await apiClient("/today");
    expect(r.networkError).toBe(true);
    expect(expired).toBe(0);
    expect(secure.has("onyx_refresh_token")).toBe(true);
  });

  it("401 ACCOUNT_NOT_FOUND is surfaced without a refresh", async () => {
    await signedIn({ accessExp: NOW / 1000 + 600 });
    fetchMock.mockResolvedValue(json(401, { success: false, code: "ACCOUNT_NOT_FOUND" }));
    const r = await apiClient("/today");
    expect(r.code).toBe("ACCOUNT_NOT_FOUND");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
