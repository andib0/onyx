import type { Request, Response, NextFunction } from 'express';
import { sendError, sendServerError } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  console.error('Error:', err);

  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }

  return sendServerError(res);
}
