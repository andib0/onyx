import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema } from './auth.schema.js';

describe('registerSchema', () => {
  const valid = {
    email: 'a@b.com',
    password: 'password1!',
  };

  it('accepts a valid payload', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts optional profile fields including timezone', () => {
    const result = registerSchema.safeParse({
      ...valid,
      username: 'andi',
      age: 30,
      weight: 80,
      timezone: 'Europe/Belgrade',
    });
    expect(result.success).toBe(true);
  });

  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short1!' }).success).toBe(
      false
    );
    expect(registerSchema.safeParse({ ...valid, password: 'nodigits!!' }).success).toBe(
      false
    );
    expect(registerSchema.safeParse({ ...valid, password: 'nospecial1' }).success).toBe(
      false
    );
  });

  it('rejects invalid email', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });

  it('rejects out-of-range age/weight', () => {
    expect(registerSchema.safeParse({ ...valid, age: 12 }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, weight: 500 }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires email and password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
