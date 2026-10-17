import type { Request, Response, NextFunction } from 'express';
import { sendError, sendServerError } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

/** Errors raised by body-parser carry `type` and a 4xx `status`. */
interface HttpishError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

const CLIENT_MESSAGES: Record<string, [number, string]> = {
  'entity.parse.failed': [400, 'Malformed JSON body'],
  'entity.too.large': [413, 'Request body too large'],
  'encoding.unsupported': [415, 'Unsupported content encoding'],
  'charset.unsupported': [415, 'Unsupported charset'],
};

/**
 * Last-resort handler. Never returns stack traces or raw library/Prisma
 * messages, in any NODE_ENV (audit F9): details go to the server log only.
 */
export function errorHandler(
  err: HttpishError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  const known = err.type ? CLIENT_MESSAGES[err.type] : undefined;
  if (known) {
    return sendError(res, known[1], known[0]);
  }

  if (err.message === 'Not allowed by CORS') {
    return sendError(res, 'Origin not allowed', 403);
  }

  const status = err.status ?? err.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return sendError(res, 'Bad request', status);
  }

  console.error('Unhandled error:', err);
  return sendServerError(res);
}
