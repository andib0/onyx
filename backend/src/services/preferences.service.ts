import { prisma } from '../config/database.js';

export class PreferencesService {
  async getPreferences(userId: string) {
    return prisma.userPreferences.findUnique({ where: { userId } });
  }

  async updatePreferences(userId: string, data: {
    timezone?: string;
    caffeineCutoff?: string;
    sleepTarget?: string;
    proteinTarget?: string;
    hydrationTarget?: string;
    selectedProgramId?: string | null;
    selectedProgramDayId?: string | null;
  }) {
    return prisma.userPreferences.update({
      where: { userId },
      data,
    });
  }
}

export const preferencesService = new PreferencesService();
