import type { Response } from 'express';
import { programsService } from '../services/programs.service.js';
import { sendError, sendNotFound, sendSuccess } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function listPrograms(req: AuthenticatedRequest, res: Response) {
  try {
    const programs = await programsService.listPrograms(req.userId!);
    return sendSuccess(res, programs);
  } catch (error) {
    console.error('List programs error:', error);
    return sendError(res, 'Failed to get programs', 500);
  }
}

export async function getProgram(req: AuthenticatedRequest, res: Response) {
  try {
    const program = await programsService.getProgram(req.params.id, req.userId!);
    if (!program) return sendNotFound(res, 'Program not found');
    return sendSuccess(res, program);
  } catch (error) {
    console.error('Get program error:', error);
    return sendError(res, 'Failed to get program', 500);
  }
}
