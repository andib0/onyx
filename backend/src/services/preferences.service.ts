import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import type { UpdatePreferencesInput } from '../validators/preferences.schema.js';
import { scoreService } from './score/score.service.js';

export class PreferencesService {
  async getPreferences(userId: string) {
    return prisma.userPreferences.findUnique({ where: { userId } });
  }

  /** `data` is the Zod-parsed allowlist; program references must be visible to the user. */
  async updatePreferences(userId: string, data: UpdatePreferencesInput) {
    if (data.selectedProgramId) {
      const program = await prisma.gymProgram.findFirst({
        where: { id: data.selectedProgramId, OR: [{ isSystem: true }, { userId }] },
        select: { id: true },
      });
      if (!program) throw new AppError('Program not found', 404, 'NOT_FOUND');
    }
    if (data.selectedProgramDayId) {
      const day = await prisma.programDay.findFirst({
        where: {
          id: data.selectedProgramDayId,
          program: { OR: [{ isSystem: true }, { userId }] },
        },
        select: { id: true },
      });
      if (!day) throw new AppError('Program day not found', 404, 'NOT_FOUND');
    }
    const fields = {
      timezone: data.timezone,
      caffeineCutoff: data.caffeineCutoff,
      sleepTarget: data.sleepTarget,
      proteinTarget: data.proteinTarget,
      hydrationTarget: data.hydrationTarget,
      selectedProgramId: data.selectedProgramId,
      selectedProgramDayId: data.selectedProgramDayId,
      // Numeric targets for the server-computed Outcome Score (Bet 5).
      proteinTargetG: data.proteinTargetG,
      calorieTargetKcal: data.calorieTargetKcal,
      goalRateKgPerWeek: data.goalRateKgPerWeek,
    };
    const prefs = await prisma.userPreferences.upsert({
      where: { userId },
      update: fields,
      create: Object.assign({ userId }, fields),
    });
    // Targets, timezone and the selected program all feed today's score.
    await scoreService.afterCatalogChange(userId);
    return prefs;
  }
}

export const preferencesService = new PreferencesService();
