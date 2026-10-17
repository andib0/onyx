import type { Response } from 'express';
import { scoresService } from '../services/scores.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { UpsertScoreInput } from '../validators/scores.schema.js';

export async function upsertScore(req: AuthenticatedRequest, res: Response) {
  try {
    // Body validated by upsertScoreSchema (real date, bounded numbers).
    const result = await scoresService.upsertScore(
      req.userId!,
      req.body as UpsertScoreInput
    );
    return sendSuccess(res, result);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getScores(req: AuthenticatedRequest, res: Response) {
  try {
    const days = Number(req.query.days); // validated: int 1..365, default 30
    const scores = await scoresService.getScores(req.userId!, days);
    return sendSuccess(res, scores);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
