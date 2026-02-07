import type { Response } from 'express';
import { scheduleService } from '../services/schedule.service.js';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function getBlocks(req: AuthenticatedRequest, res: Response) {
  try {
    const blocks = await scheduleService.getBlocks(req.userId!);
    return sendSuccess(res, blocks);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function createBlock(req: AuthenticatedRequest, res: Response) {
  try {
    const block = await scheduleService.createBlock(req.userId!, req.body);
    return sendCreated(res, block);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function updateBlock(req: AuthenticatedRequest, res: Response) {
  try {
    const block = await scheduleService.updateBlock(req.userId!, req.params.id, req.body);
    return sendSuccess(res, block);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function deleteBlock(req: AuthenticatedRequest, res: Response) {
  try {
    await scheduleService.deleteBlock(req.userId!, req.params.id);
    return sendSuccess(res, null, 'Block deleted');
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getCompletions(req: AuthenticatedRequest, res: Response) {
  try {
    const date = req.query.date as string;
    if (!date) {
      return sendError(res, 'Date is required');
    }
    const completions = await scheduleService.getCompletions(req.userId!, date);
    return sendSuccess(res, completions);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function toggleCompletion(req: AuthenticatedRequest, res: Response) {
  try {
    const { blockId, date, isComplete } = req.body;
    const completion = await scheduleService.toggleCompletion(req.userId!, blockId, date, isComplete);
    return sendSuccess(res, completion);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
