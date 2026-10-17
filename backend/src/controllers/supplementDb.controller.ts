import type { Response } from 'express';
import { supplementDbService } from '../services/supplementDb.service.js';
import { sendError, sendSuccess } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function listSupplements(req: AuthenticatedRequest, res: Response) {
  try {
    // Validated by supplementDbQuerySchema: search <= 100 chars, limit 1..200.
    const query = String(req.query.search || '').trim();
    const limit = Number(req.query.limit);
    const supplements = query
      ? await supplementDbService.search(query, limit)
      : await supplementDbService.list(limit);
    return sendSuccess(res, supplements);
  } catch (error) {
    console.error('List supplement DB error:', error);
    return sendError(res, 'Failed to get supplements', 500);
  }
}
