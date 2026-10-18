import { prisma } from '../config/database.js';
import { ACCESS_TOKEN_TTL_MS } from '../utils/jwt.js';

/**
 * Access-token revocation (audit F8).
 *
 * Every access token carries its session family (`fam`). A family is live
 * while it has at least one RefreshToken row; logout and reuse detection
 * delete those rows. The auth middleware asks `isFamilyLive()` per request:
 *
 * - revoked cache hit  -> reject, no DB (TTL = access-token lifetime: after
 *   that every token of the family has expired anyway)
 * - live cache hit     -> accept, no DB (short TTL bounds staleness if a
 *   second instance ever revokes the family)
 * - miss               -> one indexed `findFirst` on RefreshToken(familyId)
 *
 * Revocations in this process update the cache synchronously, so on the
 * single Render instance logout takes effect on the very next request. After
 * a restart the caches are empty and the DB is the source of truth.
 */

const LIVE_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 10_000;

class TtlLru {
  private map = new Map<string, number>();
  constructor(
    private ttlMs: number,
    private max: number
  ) {}
  has(key: string, now = Date.now()): boolean {
    const exp = this.map.get(key);
    if (exp === undefined) return false;
    if (exp <= now) {
      this.map.delete(key);
      return false;
    }
    // Refresh recency (Map keeps insertion order; oldest is evicted first).
    this.map.delete(key);
    this.map.set(key, exp);
    return true;
  }
  add(key: string, now = Date.now()) {
    this.map.delete(key);
    this.map.set(key, now + this.ttlMs);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
  delete(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const revoked = new TtlLru(ACCESS_TOKEN_TTL_MS, MAX_ENTRIES);
const live = new TtlLru(LIVE_TTL_MS, MAX_ENTRIES);

/** Call after deleting a family's refresh rows. */
export function markFamilyRevoked(familyId: string) {
  live.delete(familyId);
  revoked.add(familyId);
}

export async function isFamilyLive(userId: string, familyId: string): Promise<boolean> {
  if (revoked.has(familyId)) return false;
  if (live.has(familyId)) return true;
  const row = await prisma.refreshToken.findFirst({
    where: { familyId, userId },
    select: { id: true },
  });
  if (row) {
    live.add(familyId);
    return true;
  }
  revoked.add(familyId);
  return false;
}

/** Tests only: forget everything so the next check goes to the DB. */
export function resetSessionCache() {
  revoked.clear();
  live.clear();
}
