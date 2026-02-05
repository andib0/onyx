import type { Response } from 'express';
import { supplementsService } from '../services/supplements.service.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function getSupplements(req: AuthenticatedRequest, res: Response) {
  try {
    const supplements = await supplementsService.getSupplements(req.userId!);
    return sendSuccess(res, supplements);
  } catch (error) {
    return sendError(res, 'Failed to get supplements', 500);
  }
}

export async function createSupplement(req: AuthenticatedRequest, res: Response) {
  try {
    const supplement = await supplementsService.createSupplement(req.userId!, req.body);
    return sendCreated(res, supplement);
  } catch (error) {
    return sendError(res, 'Failed to create supplement');
  }
}

export async function updateSupplement(req: AuthenticatedRequest, res: Response) {
  try {
    const supplement = await supplementsService.updateSupplement(req.userId!, req.params.id, req.body);
    return sendSuccess(res, supplement);
  } catch (error) {
    return sendNotFound(res, 'Supplement not found');
  }
}

export async function deleteSupplement(req: AuthenticatedRequest, res: Response) {
  try {
    await supplementsService.deleteSupplement(req.userId!, req.params.id);
    return sendSuccess(res, null, 'Supplement deleted');
  } catch (error) {
    return sendNotFound(res, 'Supplement not found');
  }
}

export async function getLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    const logs = await supplementsService.getLogs(
      req.userId!,
      startDate as string | undefined,
      endDate as string | undefined
    );
    return sendSuccess(res, logs);
  } catch (error) {
    return sendError(res, 'Failed to get supplement logs', 500);
  }
}

export async function toggleLog(req: AuthenticatedRequest, res: Response) {
  try {
    const { date, isTaken } = req.body;
    const supplementId = req.params.id;
    if (!date || typeof isTaken !== 'boolean') {
      return sendError(res, 'date and isTaken are required');
    }
    const log = await supplementsService.toggleLog(req.userId!, supplementId, date, isTaken);
    return sendSuccess(res, log);
  } catch (error) {
    return sendError(res, 'Failed to toggle supplement log');
  }
}
