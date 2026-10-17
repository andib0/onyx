// Natural-language supplement entry: "Creatine 5g 8am" → name/dose/time.
// Todoist-style quick add — one line beats three fields.

export type ParsedSupplement = {
  item: string;
  dose: string;
  timeAt: string; // "HH:MM" or ""
};

const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i;
const DOSE_RE = /\b(\d+(?:[.,]\d+)?)\s*(g|mg|mcg|µg|iu|ml|caps?|tabs?|pills?)\b/i;

function to24h(hourRaw: number, minute: number, meridiem?: string): string {
  let hour = hourRaw;
  if (meridiem) {
    const m = meridiem.toLowerCase();
    if (m === "pm" && hour < 12) hour += 12;
    if (m === "am" && hour === 12) hour = 0;
  }
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseSupplementQuickAdd(text: string): ParsedSupplement {
  let rest = text;

  let timeAt = "";
  const timeMatch = rest.match(TIME_RE);
  if (timeMatch) {
    if (timeMatch[3]) {
      timeAt = to24h(Number(timeMatch[1]), Number(timeMatch[2] || 0), timeMatch[3]);
    } else if (timeMatch[4] !== undefined) {
      timeAt = to24h(Number(timeMatch[4]), Number(timeMatch[5]));
    }
    if (timeAt) rest = rest.replace(timeMatch[0], " ");
  }

  let dose = "";
  const doseMatch = rest.match(DOSE_RE);
  if (doseMatch) {
    dose = `${doseMatch[1].replace(",", ".")}${doseMatch[2].toLowerCase()}`;
    rest = rest.replace(doseMatch[0], " ");
  }

  const item = rest
    .replace(/\s+/g, " ")
    .replace(/\bat\b\s*$/i, "")
    .trim();
  return { item, dose, timeAt };
}
