import type { Response } from 'express';
import { logsService } from '../services/logs.service.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function getLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate, limit, offset } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset as string) || 0, 0);
    const logs = await logsService.getLogs(
      req.userId!,
      startDate as string | undefined,
      endDate as string | undefined,
      parsedLimit,
      parsedOffset
    );
    return sendSuccess(res, logs);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getLog(req: AuthenticatedRequest, res: Response) {
  try {
    const date = req.params.date;
    const log = await logsService.getLog(req.userId!, date);
    if (!log) {
      return sendNotFound(res, 'Log not found for this date');
    }
    return sendSuccess(res, log);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function createOrUpdateLog(req: AuthenticatedRequest, res: Response) {
  try {
    const log = await logsService.createOrUpdateLog(req.userId!, req.body);
    return sendCreated(res, log);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function deleteLog(req: AuthenticatedRequest, res: Response) {
  try {
    await logsService.deleteLog(req.userId!, req.params.id);
    return sendSuccess(res, null, 'Log deleted');
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getStats(req: AuthenticatedRequest, res: Response) {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await logsService.getStats(req.userId!, days);
    return sendSuccess(res, stats);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
