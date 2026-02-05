import type { Response } from 'express';
import { logsService } from '../services/logs.service.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function getLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const logs = await logsService.getLogs(
      req.userId!,
      startDate as string | undefined,
      endDate as string | undefined
    );
    return sendSuccess(res, logs);
  } catch (error) {
    return sendError(res, 'Failed to get logs', 500);
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
    return sendError(res, 'Failed to get log', 500);
  }
}

export async function createOrUpdateLog(req: AuthenticatedRequest, res: Response) {
  try {
    const log = await logsService.createOrUpdateLog(req.userId!, req.body);
    return sendCreated(res, log);
  } catch (error) {
    return sendError(res, 'Failed to save log');
  }
}

export async function deleteLog(req: AuthenticatedRequest, res: Response) {
  try {
    await logsService.deleteLog(req.userId!, req.params.id);
    return sendSuccess(res, null, 'Log deleted');
  } catch (error) {
    return sendNotFound(res, 'Log not found');
  }
}

export async function getStats(req: AuthenticatedRequest, res: Response) {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await logsService.getStats(req.userId!, days);
    return sendSuccess(res, stats);
  } catch (error) {
    return sendError(res, 'Failed to get stats', 500);
  }
}
