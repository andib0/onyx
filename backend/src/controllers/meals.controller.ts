import type { Response } from 'express';
import { mealsService } from '../services/meals.service.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import { handleServiceError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function getTemplates(req: AuthenticatedRequest, res: Response) {
  try {
    const dayOfWeek = req.query.day as string | undefined;
    const templates = await mealsService.getTemplates(req.userId!, dayOfWeek);
    return sendSuccess(res, templates);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function createTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    const template = await mealsService.createTemplate(req.userId!, req.body);
    return sendCreated(res, template);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function updateTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    const template = await mealsService.updateTemplate(req.userId!, req.params.id, req.body);
    return sendSuccess(res, template);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function deleteTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    await mealsService.deleteTemplate(req.userId!, req.params.id);
    return sendSuccess(res, null, 'Meal template deleted');
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function updateGrams(req: AuthenticatedRequest, res: Response) {
  try {
    const { grams } = req.body;
    const templateId = req.params.id;
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
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function getLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const date = req.query.date as string | undefined;
    const logs = await mealsService.getLogs(req.userId!, date);
    return sendSuccess(res, logs);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}

export async function toggleLog(req: AuthenticatedRequest, res: Response) {
  try {
    const { date, isEaten } = req.body;
    const mealTemplateId = req.params.id;
    const log = await mealsService.toggleLog(req.userId!, mealTemplateId, date, isEaten);
    return sendSuccess(res, log);
  } catch (error) {
    const appError = handleServiceError(error);
    return sendError(res, appError.message, appError.statusCode);
  }
}
