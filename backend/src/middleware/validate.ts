import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { sendError } from '../utils/response.js';

export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Marks a middleware as a Zod validator for `source`. The route-coverage test
 * walks the Express stack and looks for this marker on every mutating route.
 */
export const VALIDATES = Symbol.for('onyx.validates');

type ValidatorMiddleware = ((req: Request, res: Response, next: NextFunction) => void) & {
  [VALIDATES]: ValidationSource;
};

/**
 * Validates and replaces `req[source]` with the parsed value (unknown keys are
 * stripped, defaults and coercions applied), so handlers never see raw input.
 */
export function validate(
  schema: ZodSchema,
  source: ValidationSource = 'body'
): ValidatorMiddleware {
  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      // First message only: the app shows it verbatim (e.g. password rules).
      return sendError(res, result.error.errors[0].message, 400);
    }
    if (source === 'params') {
      Object.assign(req.params, result.data);
    } else {
      (req as unknown as Record<string, unknown>)[source] = result.data;
    }
    next();
  };
  return Object.assign(middleware, { [VALIDATES]: source }) as ValidatorMiddleware;
}
