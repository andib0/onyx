import type { Response } from 'express';
import { foodsService } from '../services/foods.service.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function searchFoods(req: AuthenticatedRequest, res: Response) {
  try {
    // Validated by searchFoodsQuerySchema: search 2..100 chars, limit 1..100.
    const query = String(req.query.search);
    const limit = Number(req.query.limit);
    const foods = await foodsService.search(query, limit);
    return sendSuccess(res, foods);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getFood(req: AuthenticatedRequest, res: Response) {
  try {
    const food = await foodsService.getById(req.params.id);
    if (!food) {
      return sendNotFound(res, 'Food not found');
    }
    return sendSuccess(res, food);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function createFood(req: AuthenticatedRequest, res: Response) {
  try {
    const food = await foodsService.create(req.body);
    return sendCreated(res, food);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
