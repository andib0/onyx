// Hybrid logical clock timestamps (Bet 2).
//
// Format: `<13-digit unix ms>-<4-digit counter>-<deviceId>`, e.g.
// "1760716800000-0003-pixel6a". Fixed-width numeric fields make plain string
// comparison (UTF-16 / byte order, `COLLATE "C"` in SQL) equal to HLC order;
// the deviceId breaks ties between devices deterministically.

export const HLC_RE = /^\d{13}-\d{4}-[A-Za-z0-9_-]{1,64}$/;

/** Writes stamped further than this into the server's future are rejected, so a
 *  device with a wildly wrong clock cannot win every future conflict. */
export const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export function isHlc(s: unknown): s is string {
  return typeof s === 'string' && HLC_RE.test(s);
}

export function hlcMillis(hlc: string): number {
  return Number(hlc.slice(0, 13));
}

/** null when acceptable, else a human-readable reason. */
export function hlcProblem(hlc: string, now = Date.now()): string | null {
  if (!isHlc(hlc))
    return 'Invalid hlc (expected <13-digit ms>-<4-digit counter>-<deviceId>)';
  if (hlcMillis(hlc) > now + MAX_FUTURE_SKEW_MS) return 'hlc is too far in the future';
  return null;
}

export function compareHlc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Last-writer-wins rule: an incoming stamp applies only if strictly newer. */
export function hlcWins(incoming: string, stored: string | null | undefined): boolean {
  return !stored || incoming > stored;
}

export function formatHlc(ms: number, counter: number, deviceId: string): string {
  return `${String(Math.max(0, Math.floor(ms))).padStart(13, '0')}-${String(counter).padStart(4, '0')}-${deviceId}`;
}

/**
 * Reference HLC clock (what a client keeps per device). `now()` is the local
 * physical clock, which may be skewed; `receive()` merges a stamp seen from the
 * server/other device so later local stamps sort after it.
 */
export function createHlcClock(deviceId: string, now: () => number = Date.now) {
  let lastMs = 0;
  let counter = 0;
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
  const receive = (remote: string): void => {
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
  return { tick, receive };
}
