// WCAG 2.1 contrast helpers (pure). Used by the theme contrast test.
export type RGBA = [number, number, number, number];

export function parseColor(input: string): RGBA {
  const c = input.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) {
      h = h
        .split("")
        .map((x) => x + x)
        .join("");
    }
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      a,
    ];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Unparseable colour: ${input}`);
  const p = m[1].split(",").map((s) => parseFloat(s));
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

/** Alpha-composite `fg` over an opaque `bg`. */
export function composite(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export function luminance(c: RGBA): number {
  return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
}

export function contrastRatio(a: RGBA, b: RGBA): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
