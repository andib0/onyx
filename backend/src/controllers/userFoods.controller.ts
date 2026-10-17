import type { Response } from 'express';
import { userFoodsService } from '../services/userFoods.service.js';
import { sendError, sendNotFound, sendSuccess } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

function fail(res: Response, error: unknown) {
  const appError = handleServiceError(error);
  return sendError(res, appError.message, appError.statusCode);
}

export async function listUserFoods(req: AuthenticatedRequest, res: Response) {
  try {
    const foods = await userFoodsService.list(req.userId!);
    return sendSuccess(res, foods);
  } catch (error) {
    return fail(res, error);
  }
}

export async function addUserFood(req: AuthenticatedRequest, res: Response) {
  try {
    const { foodId } = req.body as { foodId: string }; // validated by addUserFoodSchema
    const item = await userFoodsService.add(req.userId!, foodId);
    return sendSuccess(res, item);
  } catch (error) {
    // Unknown foodId → FK violation → 400 via handleServiceError.
    return fail(res, error);
  }
}

export async function removeUserFood(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await userFoodsService.remove(req.userId!, req.params.id);
    if (result.count === 0) return sendNotFound(res, 'Saved food not found');
    return sendSuccess(res, null, 'Removed');
  } catch (error) {
    return fail(res, error);
  }
}
