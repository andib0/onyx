import type { Response } from 'express';
import { preferencesService } from '../services/preferences.service.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { UpdatePreferencesInput } from '../validators/preferences.schema.js';

export async function getPreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const prefs = await preferencesService.getPreferences(req.userId!);
    return sendSuccess(res, prefs);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function updatePreferences(req: AuthenticatedRequest, res: Response) {
  try {
    // Only the fields in updatePreferencesSchema survive validation (audit F4).
    const data = req.body as UpdatePreferencesInput;
    const prefs = await preferencesService.updatePreferences(req.userId!, data);
    return sendSuccess(res, prefs);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
