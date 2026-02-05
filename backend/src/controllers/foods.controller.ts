import type { Response } from 'express';
import { foodsService } from '../services/foods.service.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function searchFoods(req: AuthenticatedRequest, res: Response) {
  try {
    const query = req.query.search as string;
    if (!query || query.length < 2) {
      return sendError(res, 'Search query must be at least 2 characters');
    }
    const limit = parseInt(req.query.limit as string) || 50;
    const foods = await foodsService.search(query, limit);
    return sendSuccess(res, foods);
  } catch (error) {
    return sendError(res, 'Failed to search foods', 500);
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
    return sendError(res, 'Failed to get food', 500);
  }
}

export async function createFood(req: AuthenticatedRequest, res: Response) {
  try {
    const food = await foodsService.create(req.body);
    return sendCreated(res, food);
  } catch (error) {
    return sendError(res, 'Failed to create food');
  }
}
