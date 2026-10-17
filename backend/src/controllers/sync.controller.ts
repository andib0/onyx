import type { Response } from 'express';
import { syncService } from '../services/sync.service.js';
import { exportV2, importV2 } from '../services/sync/backup.js';
import { scoreService } from '../services/score/score.service.js';
import { addDays } from '../utils/dates.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function importState(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.query.v === '2') {
      const report = await importV2(req.userId!, req.body);
      return sendSuccess(res, report, 'Backup imported');
    }
    const result = await syncService.importState(req.userId!, req.body);
    // Replace-all import rewrote the source rows: refresh the last year of scores.
    const today = await scoreService.todayFor(req.userId!);
    await scoreService.recomputeRange(req.userId!, addDays(today, -364), today);
    return sendSuccess(res, result, 'Data imported successfully');
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function exportState(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.query.v === '2') {
      return sendSuccess(res, await exportV2(req.userId!));
    }
    const state = await syncService.exportState(req.userId!);
    return sendSuccess(res, state);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function seedStarter(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await syncService.seedStarterData(req.userId!);
    return sendSuccess(res, result);
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
