import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { http } from './helpers.js';

/**
 * Dedicated limiter on /auth/refresh (audit F6). The suite normally runs with
 * DISABLE_RATE_LIMIT=1; this file turns limits back on. Vitest isolates each
 * test file, so the in-memory counters start empty here.
 */
describe('/auth/refresh rate limit', () => {
  beforeAll(() => {
    process.env.DISABLE_RATE_LIMIT = '0';
  });
  afterAll(() => {
    process.env.DISABLE_RATE_LIMIT = '1';
  });

  it('allows 30 refreshes per minute, then answers 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      const res = await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: 'garbage' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 30).every((s) => s === 401)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it('cannot be disabled in production', async () => {
    process.env.DISABLE_RATE_LIMIT = '1';
    process.env.NODE_ENV = 'production';
    try {
      const res = await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: 'garbage' });
      expect(res.status).toBe(429);
    } finally {
      process.env.NODE_ENV = 'test';
      process.env.DISABLE_RATE_LIMIT = '0';
    }
  });
});
