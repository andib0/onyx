import type { Food } from "../api/foods";

// Barcode → nutrition via Open Food Facts (no API key; be a good citizen with
// a descriptive UA). Returns a synthetic Food shaped for foodToMealTemplate —
// nothing is written to the backend food table.

const OFF_URL = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = "product_name,brands,nutriments";

function num(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value) : (value as number);
  return typeof n === "number" && isFinite(n) ? Math.round(n * 10) / 10 : null;
}

export async function lookupBarcode(barcode: string): Promise<Food | null> {
  try {
    const response = await fetch(
      `${OFF_URL}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
      {
        headers: { "User-Agent": "Onyx-Daily/1.0 (personal nutrition app)" },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const product = data?.product;
    if (data?.status !== 1 || !product?.product_name) return null;

    const n = product.nutriments || {};
    return {
      id: `off_${barcode}`,
      name: String(product.product_name).slice(0, 80),
      brand: product.brands ? String(product.brands).split(",")[0].trim() : undefined,
      caloriesPer100g: num(n["energy-kcal_100g"]),
      proteinPer100g: num(n["proteins_100g"]),
      carbsPer100g: num(n["carbohydrates_100g"]),
      fatPer100g: num(n["fat_100g"]),
    } as Food;
  } catch {
    return null;
  }
}
