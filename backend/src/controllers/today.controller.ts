import type { Response } from 'express';
import { getToday } from '../services/today.service.js';
import { scoreService } from '../services/score/score.service.js';
import { isCalendarDate } from '../utils/dates.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function today(req: AuthenticatedRequest, res: Response) {
  try {
    const raw = req.query.date;
    if (raw !== undefined && (typeof raw !== 'string' || !isCalendarDate(raw))) {
      return sendError(res, 'Invalid date (expected YYYY-MM-DD)');
    }
    // The device's local date is authoritative; without it, the user's timezone.
    const date =
      (raw as string | undefined) ?? (await scoreService.todayFor(req.userId!));
    return sendSuccess(res, await getToday(req.userId!, date));
  } catch (error) {
    const appError = handleServiceError(error);
    // A valid token for an account the server no longer has (e.g. the database
    // was recreated): the client must re-register and rehydrate (import v2).
    if (appError.code === 'ACCOUNT_NOT_FOUND') {
      return res
        .status(401)
        .json({ success: false, error: appError.message, code: appError.code });
    }
    return sendError(res, appError.message, appError.statusCode);
  }
}
