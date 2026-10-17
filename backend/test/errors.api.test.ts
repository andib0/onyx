import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { auth, http, registerUser } from './helpers.js';

/** Error shaping and body limits (audit F6/F9). */

const ORIGINAL_ENV = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
  vi.restoreAllMocks();
});

function noLeak(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/stack|node_modules|\.ts:\d+|at [A-Za-z]+ \(/);
  expect(text).not.toMatch(/prisma|Invalid `/i);
}

describe.each(['development', 'production'])('NODE_ENV=%s', (envName) => {
  it('malformed JSON -> 400 JSON envelope without a stack', async () => {
    process.env.NODE_ENV = envName;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await http()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.c", "password": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Malformed JSON body' });
    noLeak(res.body);
  });

  it('unexpected errors -> generic 500, no message or stack', () => {
    process.env.NODE_ENV = envName;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error(
      'Invalid `prisma.user.update()` invocation in C:\\app\\src\\services\\x.ts:12:3'
    );
    let status = 0;
    let payload: unknown;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
        return this;
      },
    } as unknown as Response;
    errorHandler(err, {} as Request, res, () => {});
    expect(status).toBe(500);
    expect(payload).toEqual({ success: false, error: 'Internal server error' });
    noLeak(payload);
  });
});

describe('body limits', () => {
  const big = (kb: number) => 'x'.repeat(kb * 1024);

  it('rejects bodies over 100kb on ordinary routes with 413', async () => {
    const u = await registerUser();
    const res = await http()
      .post('/api/logs')
      .set(auth(u))
      .send({ date: '2026-10-17', notes: big(150) });
    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it('allows large bodies on /sync/import only', async () => {
    const u = await registerUser();
    const res = await http()
      .post('/api/sync/import')
      .set(auth(u))
      .send({ top3: { '2026-10-17': big(150) } });
    expect(res.status).not.toBe(413);
  });

  it('rejects oversized unauthenticated bodies before any auth work', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ email: 'a@b.c', password: big(200) });
    expect(res.status).toBe(413);
  });
});

describe('unknown routes', () => {
  it('answer with the JSON envelope', async () => {
    const res = await http().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Not found' });
  });
});
