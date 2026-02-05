import type { Response } from 'express';
import { mealsService } from '../services/meals.service.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function getTemplates(req: AuthenticatedRequest, res: Response) {
  try {
    const dayOfWeek = req.query.day as string | undefined;
    const templates = await mealsService.getTemplates(req.userId!, dayOfWeek);
    return sendSuccess(res, templates);
  } catch (error) {
    return sendError(res, 'Failed to get meal templates', 500);
  }
}

export async function createTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    const template = await mealsService.createTemplate(req.userId!, req.body);
    return sendCreated(res, template);
  } catch (error) {
    return sendError(res, 'Failed to create meal template');
  }
}

export async function updateTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    const template = await mealsService.updateTemplate(req.userId!, req.params.id, req.body);
    return sendSuccess(res, template);
  } catch (error) {
    return sendNotFound(res, 'Meal template not found');
  }
}

export async function deleteTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    await mealsService.deleteTemplate(req.userId!, req.params.id);
    return sendSuccess(res, null, 'Meal template deleted');
  } catch (error) {
    return sendNotFound(res, 'Meal template not found');
  }
}

export async function updateGrams(req: AuthenticatedRequest, res: Response) {
  try {
    const { grams } = req.body;
    const templateId = req.params.id;
    if (typeof grams !== 'number' || grams < 0) {
      return sendError(res, 'grams must be a non-negative number');
    }
    const template = await mealsService.getTemplateById(req.userId!, templateId);
    if (!template) {
      return sendNotFound(res, 'Meal template not found');
    }
    if (!template.foodId) {
      return sendError(res, 'Template has no linked food for recalculation');
    }
    const updated = await mealsService.updateGrams(req.userId!, templateId, grams, template.foodId);
    return sendSuccess(res, updated);
  } catch (error) {
    return sendError(res, 'Failed to update grams');
  }
}

export async function getLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const date = req.query.date as string | undefined;
    const logs = await mealsService.getLogs(req.userId!, date);
    return sendSuccess(res, logs);
  } catch (error) {
    return sendError(res, 'Failed to get meal logs', 500);
  }
}

export async function toggleLog(req: AuthenticatedRequest, res: Response) {
  try {
    const { date, isEaten } = req.body;
    const mealTemplateId = req.params.id;
    if (!date || typeof isEaten !== 'boolean') {
      return sendError(res, 'date and isEaten are required');
    }
    const log = await mealsService.toggleLog(req.userId!, mealTemplateId, date, isEaten);
    return sendSuccess(res, log);
  } catch (error) {
    return sendError(res, 'Failed to toggle meal log');
  }
}
