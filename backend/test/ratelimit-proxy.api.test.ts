import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { http } from './helpers.js';

/**
 * Audit F7: with `trust proxy` = 1 (one hop: the proxy appends the real client
 * address as the right-most X-Forwarded-For entry), a client that prepends
 * spoofed addresses must not get a fresh bucket per request.
 * Fresh file = fresh in-memory counters (vitest isolates files).
 */
describe('general rate limit behind one trusted proxy hop', () => {
  beforeAll(() => {
    process.env.DISABLE_RATE_LIMIT = '0';
  });
  afterAll(() => {
    process.env.DISABLE_RATE_LIMIT = '1';
  });

  const REAL_CLIENT = '203.0.113.7';

  it('ignores rotating left-most X-Forwarded-For values', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 101; i++) {
      const spoofed = `198.51.100.${i % 250}, 192.0.2.${(i * 7) % 250}`;
      const res = await http()
        .get('/api/health')
        .set('X-Forwarded-For', `${spoofed}, ${REAL_CLIENT}`);
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 100).every((s) => s === 200)).toBe(true);
    expect(statuses[100]).toBe(429);

    // The same client without any spoofing is still limited.
    const again = await http().get('/api/health').set('X-Forwarded-For', REAL_CLIENT);
    expect(again.status).toBe(429);
  });

  it('keys on the trusted hop, so a different real client is unaffected', async () => {
    // The limited address in the spoofable (left) position changes nothing.
    const res = await http()
      .get('/api/health')
      .set('X-Forwarded-For', `${REAL_CLIENT}, 203.0.113.99`);
    expect(res.status).toBe(200);
  });

  it('collapses IPv6 clients to their /64', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 101; i++) {
      const res = await http()
        .get('/api/health')
        .set('X-Forwarded-For', `2001:db8:aa:bb:${i.toString(16)}::1`);
      statuses.push(res.status);
    }
    expect(statuses[99]).toBe(200);
    expect(statuses[100]).toBe(429);
  });
});
