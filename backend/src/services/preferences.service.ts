import { prisma } from '../config/database.js';
import type { UpdatePreferencesInput } from '../validators/preferences.schema.js';
import { scoreService } from './score/score.service.js';

export class PreferencesService {
  async getPreferences(userId: string) {
    return prisma.userPreferences.findUnique({ where: { userId } });
  }

  async updatePreferences(userId: string, data: UpdatePreferencesInput) {
    const prefs = await prisma.userPreferences.upsert({
      where: { userId },
      update: data,
      create: Object.assign({ userId }, data),
    });
    // Targets, timezone and the selected program all feed today's score.
    await scoreService.afterCatalogChange(userId);
    return prefs;
  }
}

export const preferencesService = new PreferencesService();
