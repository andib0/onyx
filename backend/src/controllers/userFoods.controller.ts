import type { Response } from 'express';
import { userFoodsService } from '../services/userFoods.service.js';
import { sendError, sendSuccess } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function listUserFoods(req: AuthenticatedRequest, res: Response) {
  try {
    const foods = await userFoodsService.list(req.userId!);
    return sendSuccess(res, foods);
  } catch (error) {
    console.error('List user foods error:', error);
    return sendError(res, 'Failed to get user foods', 500);
  }
}

export async function addUserFood(req: AuthenticatedRequest, res: Response) {
  try {
    const { foodId } = req.body || {};
    if (!foodId) return sendError(res, 'foodId is required');
    const item = await userFoodsService.add(req.userId!, String(foodId));
    return sendSuccess(res, item);
  } catch (error) {
    console.error('Add user food error:', error);
    return sendError(res, 'Failed to add user food', 500);
  }
}

export async function removeUserFood(req: AuthenticatedRequest, res: Response) {
  try {
    await userFoodsService.remove(req.userId!, req.params.id);
    return sendSuccess(res, null, 'Removed');
  } catch (error) {
    console.error('Remove user food error:', error);
    return sendError(res, 'Failed to remove user food', 500);
  }
}
