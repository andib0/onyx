import type { Response } from 'express';
import type { ApiResponse } from '../types/index.js';

export function sendSuccess<T>(res: Response, data: T, message?: string, status = 200) {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return res.status(status).json(response);
}

export function sendError(res: Response, error: string, status = 400) {
  const response: ApiResponse = {
    success: false,
    error,
  };
  return res.status(status).json(response);
}

export function sendCreated<T>(res: Response, data: T, message?: string) {
  return sendSuccess(res, data, message, 201);
}

/** 201 when the row was created, 200 when an idempotent create found it already. */
export function sendIdempotent<T>(res: Response, result: { row: T; created: boolean }) {
  return sendSuccess(res, result.row, undefined, result.created ? 201 : 200);
}

export function sendUnauthorized(res: Response, message = 'Unauthorized') {
  return sendError(res, message, 401);
}

export function sendForbidden(res: Response, message = 'Forbidden') {
  return sendError(res, message, 403);
}

export function sendNotFound(res: Response, message = 'Not found') {
  return sendError(res, message, 404);
}

export function sendServerError(res: Response, message = 'Internal server error') {
  return sendError(res, message, 500);
}
