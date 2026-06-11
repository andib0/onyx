import type { Response } from 'express';
import { programsService } from '../services/programs.service.js';
import { sendCreated, sendError, sendNotFound, sendSuccess } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function listPrograms(req: AuthenticatedRequest, res: Response) {
  try {
    const programs = await programsService.listPrograms(req.userId!);
    return sendSuccess(res, programs);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getProgram(req: AuthenticatedRequest, res: Response) {
  try {
    const program = await programsService.getProgram(req.params.id, req.userId!);
    if (!program) return sendNotFound(res, 'Program not found');
    return sendSuccess(res, program);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function createProgram(req: AuthenticatedRequest, res: Response) {
  try {
    const program = await programsService.createProgram(req.userId!, req.body);
    return sendCreated(res, program);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function updateProgram(req: AuthenticatedRequest, res: Response) {
  try {
    const program = await programsService.updateProgram(
      req.userId!,
      req.params.id,
      req.body
    );
    if (!program) return sendNotFound(res, 'Program not found or not editable');
    return sendSuccess(res, program);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function deleteProgram(req: AuthenticatedRequest, res: Response) {
  try {
    const deleted = await programsService.deleteProgram(req.userId!, req.params.id);
    if (!deleted) return sendNotFound(res, 'Program not found or not deletable');
    return sendSuccess(res, null, 'Program deleted');
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
