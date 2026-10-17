import { expect, type Page } from "@playwright/test";
import { newUser, type Session } from "./api";
import { e2eNow } from "./clock";

export interface OpenFocusOptions {
  tag: string;
  /** Local wall-clock time the app sees (Date is fixed; timers still run). */
  at?: { h: number; m: number };
  /** Seed data via the API before the UI loads. */
  seed?: (s: Session) => Promise<void>;
  /** Text that proves the seeded data rendered on Focus. */
  ready?: string | RegExp;
  /** Steady-state user: the Getting-started card was dismissed long ago. Default true. */
  dismissGettingStarted?: boolean;
  /** Days after the fixed Monday (e.g. 1 = Tuesday, a planned rest day). */
  dayOffset?: number;
}

/**
 * Web-only shim, NOT a product behaviour: `api/auth.ts refreshToken()` posts no body and
 * relies on the httpOnly refresh cookie. A cross-origin fetch from Expo web (:8281 →
 * :3201) neither sends nor stores that cookie, so every session restore 401s on web and
 * the AuthProvider drops the user right after login (Focus then renders an empty state).
 * Native keeps the cookie in its jar. Here we put the stored refresh token in the body —
 * which the endpoint already accepts — to emulate that jar. Remove when the client sends
 * the token itself (see docs/log/machinery.md, "Findings").
 */
export async function installRefreshShim(page: Page) {
  await page.route("**/api/auth/refresh", async (route) => {
    const body = route.request().postData();
    if (body) return route.continue();
    const rt = await page
      .evaluate(() => localStorage.getItem("onyx_refresh_token"))
      .catch(() => null);
    return route.continue({ postData: JSON.stringify({ refreshToken: rt }) });
  });
}

export function fixedTime(at: { h: number; m: number }, dayOffset = 0): Date {
  const d = e2eNow();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(at.h, at.m, 0, 0);
  return d;
}

/** Fresh user → seed → sign in through the UI → Focus with data visible. */
export async function openFocus(page: Page, o: OpenFocusOptions): Promise<Session> {
  if (o.at) await page.clock.setFixedTime(fixedTime(o.at, o.dayOffset));
  else await page.clock.install({ time: e2eNow() });
  const s = await newUser(o.tag);
  if (o.seed) await o.seed(s);
  if (o.dismissGettingStarted !== false) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("onyx_getting_started_dismissed", "1");
      } catch {
        /* storage unavailable */
      }
    });
  }
  await installRefreshShim(page);
  page.on("pageerror", (e) => console.log(`[page error] ${e.message.slice(0, 300)}`));
  if (process.env.E2E_DEBUG) {
    page.on("console", (m) => {
      if (m.type() === "error") console.log(`[console] ${m.text().slice(0, 400)}`);
    });
    page.on("request", (r) => {
      if (r.url().includes("/api/") && r.method() !== "GET")
        console.log(`[api] ${r.method()} ${r.url()} ${r.postData() ?? ""}`);
    });
    page.on("response", (r) => {
      if (r.url().includes("/api/") && r.status() >= 400)
        console.log(`[api] ${r.status()} ${r.url()}`);
    });
  }
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(s.email);
  await page.getByPlaceholder("Your password").fill(s.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The Day ring shows "Day"; "Day score …" is its accessibility label (stable hook).
  await expect(page.getByLabel(/^Day score/).first()).toBeVisible();
  if (o.ready)
    await expect(
      page.getByText(o.ready).or(page.getByLabel(o.ready)).first()
    ).toBeVisible();
  // Let entrance animations settle so the first measured tap is not racing them.
  await page.waitForTimeout(600);
  return s;
}
