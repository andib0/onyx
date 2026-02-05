import type { Request, Response, NextFunction } from 'express';
import { sendServerError } from '../utils/response.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
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
