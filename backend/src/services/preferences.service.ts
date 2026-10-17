import { prisma } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import type { UpdatePreferencesInput } from '../validators/preferences.schema.js';

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
    return prisma.userPreferences.update({
      where: { userId },
      data: {
        timezone: data.timezone,
        caffeineCutoff: data.caffeineCutoff,
        sleepTarget: data.sleepTarget,
        proteinTarget: data.proteinTarget,
        hydrationTarget: data.hydrationTarget,
        selectedProgramId: data.selectedProgramId,
        selectedProgramDayId: data.selectedProgramDayId,
      },
    });
  }
}

export const preferencesService = new PreferencesService();
