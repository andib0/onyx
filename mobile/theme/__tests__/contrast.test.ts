import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Appearance: { getColorScheme: () => "dark" },
}));

import {
  getPalette,
  getTints,
  getTagColors,
  type Palette,
  type Scheme,
} from "../../theme";
import { contrastRatio, composite, parseColor } from "../contrast";

// WCAG 2.1 thresholds: 1.4.3 (text 4.5, large text 3.0) and 1.4.11 (UI/graphics 3.0).
const TEXT = 4.5;
const UI = 3.0;

type Bg = keyof Palette | `tint.${string}`;
interface Pair {
  fg: string;
  bg: Bg;
  min: number;
  why: string;
}

const SURFACES: (keyof Palette)[] = ["bg", "surface", "surface2", "surfaceHover"];
const CARD_SURFACES: (keyof Palette)[] = ["bg", "surface", "surface2"];

// Every foreground/background pairing the app actually renders, derived from the
// token semantics in theme.ts and the audit table (docs/audit/06 §5.1).
function declaredPairs(): Pair[] {
  const pairs: Pair[] = [];
  const add = (fg: string, bgs: Bg[], min: number, why: string) => {
    for (const bg of bgs) pairs.push({ fg, bg, min, why });
  };

  // Body + secondary + tertiary text on every surface step (rows press to surfaceHover).
  add("text", SURFACES, TEXT, "body text");
  add("muted", SURFACES, TEXT, "secondary text (126 uses)");
  add("faint", SURFACES, TEXT, "chart axis labels, placeholders, version line");
  // Semantic colours used as text (streak line, Perfect day, recap missed, sync pill,
  // supplement Take-now, error copy, links/pressed rows).
  for (const t of ["accent", "good", "warning", "danger", "supplement"]) {
    add(t, SURFACES, TEXT, `${t} as text`);
  }
  add("accent2", CARD_SURFACES, TEXT, "log Entries pill value");
  // Chips/banners: semantic ink on its own soft tint (composited over surface).
  for (const t of ["accent", "good", "warning", "danger"]) {
    add(t, [`tint.${t}`], TEXT, `${t} chip / banner text`);
    add("text", [`tint.${t}`], TEXT, `body text on ${t} tint`);
    add("muted", [`tint.${t}`], TEXT, `secondary text on ${t} tint`);
  }
  // Ink on solid fills.
  add("onAccent", ["accent"], TEXT, "primary button / tab badge / segmented label");
  add("onFill", ["accent"], TEXT, "toast, confirm button, add/submit buttons");
  add("onFill", ["danger"], TEXT, "error toast, destructive confirm");
  add("onFill", ["good"], UI, "checked checkbox mark");
  add("onFill", ["supplement"], UI, "checked supplement mark");
  add("onFill", ["warning"], UI, "warning fill glyph");

  // Non-text UI (WCAG 1.4.11).
  add("controlBorder", CARD_SURFACES, UI, "unchecked checkbox, input + stepper outline");
  add("focusRing", CARD_SURFACES, UI, "focus / pressed ring");
  for (const t of ["accent", "good", "supplement", "warning", "danger"]) {
    add(t, CARD_SURFACES, UI, `${t} fill / progress / icon`);
  }
  add("muted", CARD_SURFACES, UI, "chevrons, inactive icons");
  add("timeSun", ["bg", "surface"], UI, "greeting glyph (day)");
  add("timeMoon", ["bg", "surface"], UI, "greeting glyph (night)");
  return pairs;
}

function check(scheme: Scheme) {
  const p = getPalette(scheme);
  const tints = getTints(scheme) as Record<string, string>;
  const tags = getTagColors(p);
  const pal = p as unknown as Record<string, string>;
  const pairs = declaredPairs();
  for (const [tag, color] of Object.entries(tags)) {
    for (const bg of CARD_SURFACES) {
      pairs.push({ fg: `tag.${tag}`, bg, min: UI, why: "schedule block bar / tag chip" });
    }
    pal[`tag.${tag}`] = color;
  }
  const surface = parseColor(p.surface);
  return pairs.map((pair) => {
    const bg = pair.bg.startsWith("tint.")
      ? composite(parseColor(tints[pair.bg.slice(5)]), surface)
      : parseColor(pal[pair.bg]);
    const fgRaw = pal[pair.fg];
    if (!fgRaw) throw new Error(`unknown token ${pair.fg}`);
    const fg = composite(parseColor(fgRaw), bg);
    const ratio = contrastRatio(fg, bg);
    return Object.assign({}, pair, { scheme, ratio });
  });
}

describe("theme contrast (WCAG 2.1 AA)", () => {
  for (const scheme of ["dark", "light"] as Scheme[]) {
    it(`${scheme} palette: every declared pair meets its threshold`, () => {
      const results = check(scheme);
      const failures = results
        .filter((r) => r.ratio < r.min)
        .map((r) => `${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)} < ${r.min} (${r.why})`);
      expect(results.length).toBeGreaterThan(80);
      expect(failures).toEqual([]);
    });
  }

  it("tag colours follow the live palette", () => {
    expect(getTagColors(getPalette("light")).Training).toBe(getPalette("light").good);
    expect(getTagColors(getPalette("dark")).Training).toBe(getPalette("dark").good);
  });
});
