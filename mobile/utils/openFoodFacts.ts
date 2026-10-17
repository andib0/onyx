import type { Food } from "../api/foods";

// Barcode → nutrition via Open Food Facts API v2 (no key; descriptive UA as the
// OFF docs ask). Per-100 g values come from `*_100g` nutriments; the default
// portion is the product's `serving_quantity` when present (audit 05 #13: a
// 45 g bar was logged as 100 g). Energy falls back from kcal → kJ ÷ 4.184 →
// Atwater 4/4/9 from macros. Failures are classified so the UI can tell
// "offline / slow" from "not in the database", and every non-hit returns a
// prefill for manual entry.
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

const OFF_URL = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = [
  "product_name",
  "product_name_en",
  "generic_name",
  "brands",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
].join(",");
export const OFF_TIMEOUT_MS = 6000;
export const KJ_PER_KCAL = 4.184;

export type BarcodeFood = Food & {
  servingGrams: number | null; // default portion (g, or ml treated as g)
  servingLabel: string | null; // e.g. "1 bar (45 g)"
  energySource: "kcal" | "kj" | "macros" | null;
  missing: string[]; // macros OFF didn't provide (counted as unknown, not 0)
  barcode: string;
};

export type ManualPrefill = {
  barcode: string;
  name: string;
  brand: string | null;
  grams: number;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
};

export type BarcodeResult =
  | { status: "found"; food: BarcodeFood }
  | {
      status: "not_found" | "no_nutrition" | "offline" | "timeout" | "error";
      barcode: string;
      prefill: ManualPrefill;
      message: string;
    };

const MESSAGES: Record<Exclude<BarcodeResult["status"], "found">, string> = {
  not_found: "Not in Open Food Facts yet — enter it manually.",
  no_nutrition: "Found the product but no nutrition facts — enter them manually.",
  offline: "You're offline — couldn't look up the barcode.",
  timeout: "Open Food Facts didn't answer in 6 s — try again or enter manually.",
  error: "Barcode lookup failed — try again or enter manually.",
};

function num(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value.replace(",", ".")) : value;
  return typeof n === "number" && isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function emptyPrefill(barcode: string): ManualPrefill {
  return {
    barcode,
    name: "",
    brand: null,
    grams: 100,
    caloriesPer100g: null,
    proteinPer100g: null,
    carbsPer100g: null,
    fatPer100g: null,
  };
}

function fail(
  status: Exclude<BarcodeResult["status"], "found">,
  barcode: string,
  prefill?: ManualPrefill
): BarcodeResult {
  return {
    status,
    barcode,
    prefill: prefill ?? emptyPrefill(barcode),
    message: MESSAGES[status],
  };
}

type OffProduct = {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutriments?: Record<string, unknown>;
};

// Parse an OFF v2 product JSON (already fetched). Exported for fixture tests.
export function parseOffProduct(barcode: string, data: unknown): BarcodeResult {
  const body = (data || {}) as { status?: number; product?: OffProduct };
  const product = body.product;
  if (body.status !== 1 || !product) return fail("not_found", barcode);

  const name = String(
    product.product_name || product.product_name_en || product.generic_name || ""
  )
    .trim()
    .slice(0, 80);
  const brand = product.brands ? String(product.brands).split(",")[0].trim() : null;
  const n = product.nutriments || {};

  const protein = num(n["proteins_100g"]);
  const carbs = num(n["carbohydrates_100g"]);
  const fat = num(n["fat_100g"]);
  let calories = num(n["energy-kcal_100g"]);
  let energySource: BarcodeFood["energySource"] = calories !== null ? "kcal" : null;
  if (calories === null) {
    // `energy_100g` is always kJ in OFF
    const kj = num(n["energy-kj_100g"]) ?? num(n["energy_100g"]);
    if (kj !== null) {
      calories = Math.round((kj / KJ_PER_KCAL) * 10) / 10;
      energySource = "kj";
    }
  }
  if (calories === null && protein !== null && carbs !== null && fat !== null) {
    calories = Math.round((protein * 4 + carbs * 4 + fat * 9) * 10) / 10;
    energySource = "macros";
  }

  const missing = (
    [
      ["protein", protein],
      ["carbs", carbs],
      ["fat", fat],
      ["calories", calories],
    ] as Array<[string, number | null]>
  )
    .filter(([, v]) => v === null)
    .map(([k]) => k);

  const servingRaw = num(product.serving_quantity);
  const servingGrams =
    servingRaw !== null && servingRaw > 0 && servingRaw <= 2000 ? servingRaw : null;
  const unit = product.serving_quantity_unit || "g";
  const servingLabel =
    servingGrams !== null
      ? product.serving_size
        ? String(product.serving_size)
        : `${servingGrams} ${unit}`
      : null;

  const prefill: ManualPrefill = {
    barcode,
    name,
    brand,
    grams: servingGrams ?? 100,
    caloriesPer100g: calories,
    proteinPer100g: protein,
    carbsPer100g: carbs,
    fatPer100g: fat,
  };

  if (!name) return fail("no_nutrition", barcode, prefill);
  if (calories === null && protein === null && carbs === null && fat === null) {
    return fail("no_nutrition", barcode, prefill);
  }

  return {
    status: "found",
    food: {
      id: `off_${barcode}`,
      name,
      brand,
      caloriesPer100g: calories,
      proteinPer100g: protein,
      carbsPer100g: carbs,
      fatPer100g: fat,
      fiberPer100g: num(n["fiber_100g"]),
      sugarPer100g: num(n["sugars_100g"]),
      sodiumMgPer100g: (() => {
        const g = num(n["sodium_100g"]);
        return g === null ? null : Math.round(g * 1000);
      })(),
      isVerified: false,
      servingGrams,
      servingLabel,
      energySource,
      missing,
      barcode,
    },
  };
}

function isAbort(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "name" in err &&
    ((err as { name: string }).name === "AbortError" ||
      (err as { name: string }).name === "TimeoutError")
  );
}

export async function lookupBarcode(
  barcode: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<BarcodeResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? OFF_TIMEOUT_MS);
  try {
    const response = await doFetch(
      `${OFF_URL}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
      {
        headers: { "User-Agent": "Onyx-Daily/1.0 (personal nutrition app)" },
        signal: controller.signal,
      }
    );
    if (response.status === 404) return fail("not_found", barcode);
    if (!response.ok) return fail("error", barcode);
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return fail("error", barcode);
    }
    return parseOffProduct(barcode, data);
  } catch (err) {
    if (isAbort(err) || controller.signal.aborted) return fail("timeout", barcode);
    // fetch rejects with TypeError("Network request failed") when offline
    if (err instanceof TypeError) return fail("offline", barcode);
    return fail("error", barcode);
  } finally {
    clearTimeout(timer);
  }
}
