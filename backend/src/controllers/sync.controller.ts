import type { Response } from 'express';
import { syncService } from '../services/sync.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function importState(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await syncService.importState(req.userId!, req.body);
    return sendSuccess(res, result, 'Data imported successfully');
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function exportState(req: AuthenticatedRequest, res: Response) {
  try {
    const state = await syncService.exportState(req.userId!);
    return sendSuccess(res, state);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getFullState(req: AuthenticatedRequest, res: Response) {
  try {
    const state = await syncService.getFullState(req.userId!);
    return sendSuccess(res, state);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
