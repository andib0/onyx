import type { Response } from 'express';
import { exercisesService } from '../services/exercises.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function searchExercises(req: AuthenticatedRequest, res: Response) {
  try {
    const query = (req.query.search as string) || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 50);
    const results = await exercisesService.search(query, limit);
    return sendSuccess(res, results);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
