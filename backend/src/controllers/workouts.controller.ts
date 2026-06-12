import type { Response } from 'express';
import { workoutsService } from '../services/workouts.service.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function startSession(req: AuthenticatedRequest, res: Response) {
  try {
    const session = await workoutsService.startSession(req.userId!, req.body);
    return sendCreated(res, session);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function logSet(req: AuthenticatedRequest, res: Response) {
  try {
    const set = await workoutsService.logSet(req.userId!, req.params.id, req.body);
    if (!set) {
      return sendNotFound(res, 'Workout session not found');
    }
    return sendCreated(res, set);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function finishSession(req: AuthenticatedRequest, res: Response) {
  try {
    const session = await workoutsService.finishSession(req.userId!, req.params.id, req.body);
    if (!session) {
      return sendNotFound(res, 'Workout session not found');
    }
    return sendSuccess(res, session);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function deleteSet(req: AuthenticatedRequest, res: Response) {
  try {
    const deleted = await workoutsService.deleteSet(req.userId!, req.params.id);
    if (!deleted) {
      return sendNotFound(res, 'Set not found');
    }
    return sendSuccess(res, null, 'Set deleted');
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getSessions(req: AuthenticatedRequest, res: Response) {
  try {
    const { limit, offset } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 30, 1), 100);
    const parsedOffset = Math.max(parseInt(offset as string) || 0, 0);
    const sessions = await workoutsService.getSessions(req.userId!, parsedLimit, parsedOffset);
    return sendSuccess(res, sessions);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getExerciseHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const namesParam = (req.query.names as string) || '';
    const names = namesParam
      .split('|')
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 50);
    const excludeSessionId = (req.query.excludeSessionId as string) || undefined;
    const history = await workoutsService.getExerciseHistory(req.userId!, names, excludeSessionId);
    return sendSuccess(res, history);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
