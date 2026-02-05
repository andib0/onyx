import type { Response } from 'express';
import { preferencesService } from '../services/preferences.service.js';
import { sendError, sendSuccess } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function getPreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const prefs = await preferencesService.getPreferences(req.userId!);
    return sendSuccess(res, prefs);
  } catch (error) {
    console.error('Get preferences error:', error);
    return sendError(res, 'Failed to get preferences', 500);
  }
}

export async function updatePreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const data = req.body || {};
    const prefs = await preferencesService.updatePreferences(req.userId!, data);
    return sendSuccess(res, prefs);
  } catch (error) {
    console.error('Update preferences error:', error);
    return sendError(res, 'Failed to update preferences', 500);
  }
}
