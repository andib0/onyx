import type { Response } from 'express';
import { scoresService } from '../services/scores.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function upsertScore(req: AuthenticatedRequest, res: Response) {
  try {
    const date = (req.body?.date as string) || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return sendError(res, 'Invalid date');
    }
    const result = await scoresService.upsertScore(req.userId!, req.body);
    return sendSuccess(res, result);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getScores(req: AuthenticatedRequest, res: Response) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
    const scores = await scoresService.getScores(req.userId!, days);
    return sendSuccess(res, scores);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
