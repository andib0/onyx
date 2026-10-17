// Startup performance marks (Bet 1). Printed once each as
//   ONYX_PERF <name> <ms since process start>
// and read from logcat by scripts/measure-tti.sh. On Android the base is RN's
// startup timing (app start, same clock as performance.now()); elsewhere it is
// the page's time origin (performance.now() is already relative to it).
type PerfLike = {
  now?: () => number;
  rnStartupTiming?: { startTime?: number | null };
};

const perf = (globalThis as { performance?: PerfLike }).performance;
const now = (): number => (perf && perf.now ? perf.now() : Date.now());

function startBase(): number {
  try {
    const s = perf && perf.rnStartupTiming ? perf.rnStartupTiming.startTime : null;
    if (typeof s === "number" && s > 0 && s <= now()) return s;
  } catch {
    // older runtimes: no startup timing
  }
  return perf && perf.now ? 0 : now();
}

const BASE = startBase();
const seen = new Set<string>();
const marks: Record<string, number> = {};

export function perfMark(name: string): void {
  if (seen.has(name)) return;
  seen.add(name);
  const ms = Math.round(now() - BASE);
  marks[name] = ms;
  console.log(`ONYX_PERF ${name} ${ms}`);
}

export function perfMarks(): Record<string, number> {
  return Object.assign({}, marks);
}
