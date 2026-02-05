import type { Response } from 'express';
import { scheduleService } from '../services/schedule.service.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function getBlocks(req: AuthenticatedRequest, res: Response) {
  try {
    const blocks = await scheduleService.getBlocks(req.userId!);
    return sendSuccess(res, blocks);
  } catch (error) {
    return sendError(res, 'Failed to get schedule blocks', 500);
  }
}

export async function createBlock(req: AuthenticatedRequest, res: Response) {
  try {
    const block = await scheduleService.createBlock(req.userId!, req.body);
    return sendCreated(res, block);
  } catch (error) {
    return sendError(res, 'Failed to create schedule block');
  }
}

export async function updateBlock(req: AuthenticatedRequest, res: Response) {
  try {
    const block = await scheduleService.updateBlock(req.userId!, req.params.id, req.body);
    return sendSuccess(res, block);
  } catch (error) {
    return sendNotFound(res, 'Schedule block not found');
  }
}

export async function deleteBlock(req: AuthenticatedRequest, res: Response) {
  try {
    await scheduleService.deleteBlock(req.userId!, req.params.id);
    return sendSuccess(res, null, 'Block deleted');
  } catch (error) {
    return sendNotFound(res, 'Schedule block not found');
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
    return sendError(res, 'Failed to get completions', 500);
  }
}

export async function toggleCompletion(req: AuthenticatedRequest, res: Response) {
  try {
    const { blockId, date, isComplete } = req.body;
    if (!blockId || !date || typeof isComplete !== 'boolean') {
      return sendError(res, 'blockId, date, and isComplete are required');
    }
    const completion = await scheduleService.toggleCompletion(req.userId!, blockId, date, isComplete);
    return sendSuccess(res, completion);
  } catch (error) {
    return sendError(res, 'Failed to toggle completion');
  }
}
