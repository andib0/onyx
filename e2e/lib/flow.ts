// Tap/time instrument for the core-action flows (audit 06 §1, plan Bet 8).
//
// Every user-visible interaction in a measured flow goes through this wrapper so the
// counts come from the same instrument before and after the navigation redesign:
//   taps        flow.tap(locator)            (click / tap)
//   inputs      flow.type(locator, text)     (one text field filled = 1 input; the
//                                             focusing click is not counted separately)
//   transitions route changes (framenavigated, incl. history.pushState) are counted
//               automatically; sheets/modals that do not change the URL are counted
//               with flow.sheet(name)
//   scrolls     a tap/type whose target was outside the viewport first (the user would
//               have had to scroll) — Playwright scrolls it into view for us
//   ms          wall time from flow.begin() to the confirmation assertion in flow.end()
//
// Budgets (≤ 2 taps, ≤ 5 s) are reported; E2E_ENFORCE_BUDGETS=1 turns them into
// assertions (the redesign enables it).
import { expect, type Locator, type Page } from "@playwright/test";
import { writeFlowResult, type FlowResult } from "./report";

export const BUDGET = { taps: 2, ms: 5000 };
const enforce = process.env.E2E_ENFORCE_BUDGETS === "1";

export interface FlowMeta {
  id: string;
  n: string;
  action: string;
  budget?: { taps: number; ms: number };
}

export class Flow {
  taps = 0;
  inputs = 0;
  transitions = 0;
  scrolls = 0;
  steps: string[] = [];
  private t0 = 0;
  private running = false;
  private lastPath = "";
  private onNav = () => {
    if (!this.running) return;
    const p = new URL(this.page.url()).pathname;
    if (p !== this.lastPath) {
      this.transitions += 1;
      this.steps.push(`→ ${p}`);
      this.lastPath = p;
    }
  };

  constructor(
    readonly page: Page,
    readonly meta: FlowMeta
  ) {}

  /** Start counting. Call when the user is on Focus with data loaded. */
  begin() {
    this.lastPath = new URL(this.page.url()).pathname;
    this.page.on("framenavigated", this.onNav);
    this.running = true;
    this.t0 = performance.now();
  }

  private async offscreen(target: Locator): Promise<boolean> {
    await target.waitFor({ state: "visible" });
    const inView = await target.evaluate(
      (el) =>
        new Promise<boolean>((resolve) => {
          const io = new IntersectionObserver((entries) => {
            resolve(entries[0].intersectionRatio > 0);
            io.disconnect();
          });
          io.observe(el);
        })
    );
    return !inView;
  }

  async tap(target: Locator, label?: string) {
    if (await this.offscreen(target)) {
      this.scrolls += 1;
      this.steps.push("↓ scroll");
    }
    this.taps += 1;
    this.steps.push(`tap ${label ?? (await describe(target))}`);
    await target.click();
  }

  /**
   * An uncounted click that stands in for passive time (e.g. "Skip rest" instead of
   * waiting out a 90 s rest timer under a fixed test clock). Logged in steps.
   */
  async assist(target: Locator, why: string) {
    this.steps.push(`(uncounted: ${why})`);
    await target.click();
  }

  async type(target: Locator, text: string, label?: string) {
    if (await this.offscreen(target)) {
      this.scrolls += 1;
      this.steps.push("↓ scroll");
    }
    this.inputs += 1;
    this.steps.push(`type "${text}" into ${label ?? (await describe(target))}`);
    await target.fill(text);
  }

  /** A sheet or modal opened without a route change. */
  sheet(name: string) {
    this.transitions += 1;
    this.steps.push(`⧉ ${name}`);
  }

  /** Stop the clock once `confirmed` resolves; record (and optionally enforce) budgets. */
  async end(confirmed: () => Promise<void>, note?: string): Promise<FlowResult> {
    await confirmed();
    const ms = Math.round(performance.now() - this.t0);
    this.running = false;
    this.page.off("framenavigated", this.onNav);
    const budget = this.meta.budget ?? BUDGET;
    const r: FlowResult = {
      id: this.meta.id,
      n: this.meta.n,
      action: this.meta.action,
      status: "measured",
      taps: this.taps,
      inputs: this.inputs,
      transitions: this.transitions,
      scrolls: this.scrolls,
      ms,
      budget,
      withinBudget: this.taps <= budget.taps && ms <= budget.ms,
      steps: this.steps,
      note,
      at: new Date().toISOString(),
    };
    writeFlowResult(r);
    console.log(
      `[flow ${r.n} ${r.id}] taps=${r.taps} inputs=${r.inputs} screens=${r.transitions} scrolls=${r.scrolls} ${ms} ms`
    );
    if (enforce) {
      expect
        .soft(this.taps, `${r.id}: taps within budget`)
        .toBeLessThanOrEqual(budget.taps);
      expect.soft(ms, `${r.id}: wall time within budget`).toBeLessThanOrEqual(budget.ms);
    }
    return r;
  }
}

/**
 * Runs a flow body; if it throws (step not reachable, confirmation never shows), the
 * partial counts are written as status "blocked" with the error, then the error is
 * rethrown. Pair with `test.fail(...)` for a known product bug so the test flips to
 * "unexpectedly passed" the day the bug is fixed.
 */
export async function guarded(f: Flow, body: () => Promise<void>, knownBug?: string) {
  try {
    await body();
  } catch (e) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    writeFlowResult({
      id: f.meta.id,
      n: f.meta.n,
      action: f.meta.action,
      status: "blocked",
      taps: f.taps,
      inputs: f.inputs,
      transitions: f.transitions,
      scrolls: f.scrolls,
      ms: 0,
      budget: f.meta.budget ?? BUDGET,
      withinBudget: false,
      steps: f.steps,
      note: `${knownBug ?? "flow failed"} — after ${f.taps} taps/${f.inputs} inputs: ${msg.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 160)}`,
      at: new Date().toISOString(),
    });
    throw e;
  }
}

/** Record a core action that cannot run in this environment (e.g. barcode on web). */
export function recordNotApplicable(meta: FlowMeta, note: string) {
  writeFlowResult({
    id: meta.id,
    n: meta.n,
    action: meta.action,
    status: "n/a",
    taps: 0,
    inputs: 0,
    transitions: 0,
    scrolls: 0,
    ms: 0,
    budget: meta.budget ?? BUDGET,
    withinBudget: null,
    steps: [],
    note,
    at: new Date().toISOString(),
  });
}

async function describe(l: Locator): Promise<string> {
  const s = String(l);
  return s.replace(/^locator\(|\)$/g, "").slice(0, 80);
}
