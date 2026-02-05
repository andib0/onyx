import type { Response } from 'express';
import { supplementDbService } from '../services/supplementDb.service.js';
import { sendError, sendSuccess } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function listSupplements(req: AuthenticatedRequest, res: Response) {
  try {
    const query = String(req.query.search || '').trim();
    const limitRaw = Number(req.query.limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 50;
    const supplements = query
      ? await supplementDbService.search(query, limit)
      : await supplementDbService.list(limit);
    return sendSuccess(res, supplements);
  } catch (error) {
    console.error('List supplement DB error:', error);
    return sendError(res, 'Failed to get supplements', 500);
  }
}
