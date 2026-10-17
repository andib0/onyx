import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KJ_PER_KCAL,
  OFF_TIMEOUT_MS,
  lookupBarcode,
  parseOffProduct,
} from "../openFoodFacts";
import { foodToMealTemplate } from "../nutrition";

type Fixture = {
  label: string;
  barcode: string;
  http: number;
  body: unknown;
  expect: {
    status: string;
    kcal?: number;
    grams?: number | null;
    energySource?: string;
    protein?: number;
    missing?: string[];
    prefillName?: string;
  };
};

const here = dirname(fileURLToPath(import.meta.url));
const { fixtures } = JSON.parse(
  readFileSync(resolve(here, "fixtures/off-products.json"), "utf8")
) as { fixtures: Fixture[] };

// Replays a recorded response through the real lookupBarcode (no network).
const recorded = (f: Fixture): typeof fetch =>
  (async () =>
    ({
      ok: f.http >= 200 && f.http < 300,
      status: f.http,
      json: async () => f.body,
    }) as Response) as unknown as typeof fetch;

describe("Open Food Facts fixtures (≥ 10 products incl. kJ-only and missing serving)", () => {
  it("has enough fixtures", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    expect(fixtures.some((f) => f.expect.energySource === "kj")).toBe(true);
    expect(fixtures.some((f) => f.expect.grams === null)).toBe(true);
  });

  for (const f of fixtures) {
    it(f.label, async () => {
      const result = await lookupBarcode(f.barcode, { fetchImpl: recorded(f) });
      expect(result.status).toBe(f.expect.status);
      if (result.status === "found") {
        const food = result.food;
        expect(food.caloriesPer100g).toBe(f.expect.kcal);
        expect(food.servingGrams).toBe(f.expect.grams);
        expect(food.energySource).toBe(f.expect.energySource);
        if (f.expect.protein !== undefined)
          expect(food.proteinPer100g).toBe(f.expect.protein);
        if (f.expect.missing) expect(food.missing).toEqual(f.expect.missing);
        // Default logged portion = serving when OFF has one, else 100 g
        expect(foodToMealTemplate(food).grams).toBe(f.expect.grams ?? 100);
      } else {
        expect(result.prefill.barcode).toBe(f.barcode);
        expect(result.message.length).toBeGreaterThan(0);
        if (f.expect.prefillName) expect(result.prefill.name).toBe(f.expect.prefillName);
      }
    });
  }
});

describe("energy conversion", () => {
  it("kJ → kcal divides by 4.184 (thermochemical calorie)", () => {
    expect(KJ_PER_KCAL).toBe(4.184);
    const r = parseOffProduct("1", {
      status: 1,
      product: { product_name: "x", nutriments: { "energy-kj_100g": 418.4 } },
    });
    expect(r.status === "found" && r.food.caloriesPer100g).toBe(100);
  });

  it("a 60 g bar logs 60 g, not 100 g (audit 05 #13: 2.2× over-count)", () => {
    const f = fixtures.find((x) => x.barcode === "5060088702534")!;
    const r = parseOffProduct(f.barcode, f.body);
    if (r.status !== "found") throw new Error("expected found");
    const meal = foodToMealTemplate(r.food);
    expect(meal.grams).toBe(60);
    expect(meal.examples).toBe("1 serving (60 g)");
  });
});

describe("network failures are distinguishable from not-found", () => {
  afterEach(() => vi.useRealTimers());

  it("offline (fetch TypeError) → offline with a manual prefill", async () => {
    const offline = (async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    const r = await lookupBarcode("123", { fetchImpl: offline });
    expect(r.status).toBe("offline");
    if (r.status !== "found")
      expect(r.prefill).toMatchObject({ barcode: "123", grams: 100 });
  });

  it("no answer within 6 s → timeout (AbortController)", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      })) as unknown as typeof fetch;
    const pending = lookupBarcode("456", { fetchImpl: hanging });
    await vi.advanceTimersByTimeAsync(OFF_TIMEOUT_MS - 1);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const r = await pending;
    expect(aborted).toBe(true);
    expect(r.status).toBe("timeout");
    expect(OFF_TIMEOUT_MS).toBe(6000);
  });

  it("malformed JSON → error", async () => {
    const bad = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      }) as unknown as Response) as unknown as typeof fetch;
    expect((await lookupBarcode("789", { fetchImpl: bad })).status).toBe("error");
  });
});
