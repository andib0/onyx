import type { Response } from 'express';
import { scoresService } from '../services/scores.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function upsertScore(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await scoresService.upsertScore(req.userId!, req.body.date);
    return sendSuccess(res, result);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getScores(req: AuthenticatedRequest, res: Response) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
    if (req.query.v === '2') {
      return sendSuccess(res, await scoresService.getScoresV2(req.userId!, days));
    }
    // v1 shape (array of DailyScore rows) kept for the current app; rows now
    // also carry outcomeScore / kept / routinePct / components.
    const { rows } = await scoresService.getScores(req.userId!, days);
    return sendSuccess(res, rows);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
