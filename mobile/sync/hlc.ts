// Hybrid logical clock (Bet 2), same format and rules as the server reference
// in backend/src/utils/hlc.ts: `<13-digit ms>-<4-digit counter>-<deviceId>`.
// Fixed widths make plain string comparison equal to HLC order; the deviceId
// breaks ties between devices deterministically.

export const HLC_RE = /^\d{13}-\d{4}-[A-Za-z0-9_-]{1,64}$/;

export function isHlc(s: unknown): s is string {
  return typeof s === "string" && HLC_RE.test(s);
}

export function hlcMillis(hlc: string): number {
  return Number(hlc.slice(0, 13));
}

export function formatHlc(ms: number, counter: number, deviceId: string): string {
  const msPart = String(Math.max(0, Math.floor(ms))).padStart(13, "0");
  return `${msPart}-${String(counter).padStart(4, "0")}-${deviceId}`;
}

export type HlcState = { lastMs: number; counter: number };

export type HlcClock = {
  tick: () => string;
  receive: (remote: string | null | undefined) => void;
  state: () => HlcState;
};

/**
 * One clock per device. `now` is the (possibly skewed) wall clock; `receive`
 * merges a stamp seen from the server so later local stamps sort after it.
 * `initial` restores the persisted state so stamps stay monotonic across app
 * restarts even if the wall clock moved backwards.
 */
export function createHlcClock(
  deviceId: string,
  now: () => number = Date.now,
  initial?: HlcState | null
): HlcClock {
  let lastMs = initial ? initial.lastMs : 0;
  let counter = initial ? initial.counter : 0;
  const tick = (): string => {
    const pt = now();
    if (pt > lastMs) {
      lastMs = pt;
      counter = 0;
    } else {
      counter += 1;
      if (counter > 9999) {
        lastMs += 1;
        counter = 0;
      }
    }
    return formatHlc(lastMs, counter, deviceId);
  };
  const receive = (remote: string | null | undefined): void => {
    if (!isHlc(remote)) return;
    const rMs = hlcMillis(remote);
    const rCounter = Number(remote.slice(14, 18));
    if (rMs > lastMs) {
      lastMs = rMs;
      counter = rCounter;
    } else if (rMs === lastMs && rCounter > counter) {
      counter = rCounter;
    }
  };
  return { tick, receive, state: () => ({ lastMs, counter }) };
}

/** Device ids must match the server's `[A-Za-z0-9_-]{1,64}`. */
export function sanitizeDeviceId(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return clean || "device";
}
