import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { AppError, handleServiceError } from './errors.js';

describe('handleServiceError', () => {
  it('passes AppError through unchanged', () => {
    const err = new AppError('nope', 409, 'DUPLICATE');
    expect(handleServiceError(err)).toBe(err);
  });

  it('maps Prisma P2025 to 404', () => {
    const err = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: 'test',
    });
    const mapped = handleServiceError(err);
    expect(mapped.statusCode).toBe(404);
    expect(mapped.code).toBe('NOT_FOUND');
  });

  it('maps Prisma P2002 to 409', () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    expect(handleServiceError(err).statusCode).toBe(409);
  });

  it('maps unknown errors to 500', () => {
    const mapped = handleServiceError(new Error('boom'));
    expect(mapped.statusCode).toBe(500);
    expect(mapped.message).toBe('Internal server error');
  });
});
