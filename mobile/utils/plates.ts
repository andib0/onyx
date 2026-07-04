// Barbell plate math for the active-set card.

export const BAR_KG = 20;
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

// "100" -> "25 + 12.5 + 2.5 per side". Null when below bar weight or the
// remainder can't be built from standard plates (dumbbell/machine numbers).
export function plateBreakdown(totalKg: number, barKg = BAR_KG): string | null {
  if (!isFinite(totalKg) || totalKg <= barKg) return null;
  let perSide = (totalKg - barKg) / 2;
  const used: number[] = [];
  for (const plate of PLATES_KG) {
    while (perSide >= plate - 1e-9) {
      used.push(plate);
      perSide -= plate;
    }
  }
  if (perSide > 1e-9 || used.length === 0) return null;
  return `${used.join(" + ")} per side`;
}

// Warm-up ramp toward the first working set: ~40/60/80% of the working
// weight, rounded down to 2.5 kg steps, empty-bar start when light.
export function warmupRamp(
  workingKg: number,
  barKg = BAR_KG
): Array<{ weightKg: number; reps: number }> {
  if (!isFinite(workingKg) || workingKg < barKg + 10) return [];
  const round = (kg: number) => Math.max(barKg, Math.floor(kg / 2.5) * 2.5);
  const ramp = [
    { weightKg: round(workingKg * 0.4), reps: 8 },
    { weightKg: round(workingKg * 0.6), reps: 5 },
    { weightKg: round(workingKg * 0.8), reps: 3 },
  ];
  // Drop duplicate steps (light working weights collapse the ramp)
  return ramp.filter(
    (step, i) =>
      step.weightKg < workingKg && (i === 0 || step.weightKg > ramp[i - 1].weightKg)
  );
}
