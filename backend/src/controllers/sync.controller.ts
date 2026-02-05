import type { Response } from 'express';
import { syncService } from '../services/sync.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function importState(req: AuthenticatedRequest, res: Response) {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      return sendError(res, 'Invalid state data');
    }

    const result = await syncService.importState(req.userId!, state);
    return sendSuccess(res, result, 'Data imported successfully');
  } catch (error) {
    console.error('Import error:', error);
    return sendError(res, 'Failed to import data', 500);
  }
}

export async function exportState(req: AuthenticatedRequest, res: Response) {
  try {
    const state = await syncService.exportState(req.userId!);
    return sendSuccess(res, state);
  } catch (error) {
    console.error('Export error:', error);
    return sendError(res, 'Failed to export data', 500);
  }
}

export async function getFullState(req: AuthenticatedRequest, res: Response) {
  try {
    const state = await syncService.getFullState(req.userId!);
    return sendSuccess(res, state);
  } catch (error) {
    console.error('Get state error:', error);
    return sendError(res, 'Failed to get state', 500);
  }
}
