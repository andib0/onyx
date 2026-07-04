export const formatSeconds = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const formatLastSession = (
  sets: Array<{ weightKg: number | null; reps: number | null }>
) => {
  if (!sets.length) return "";
  const weights = sets.map((s) => s.weightKg).filter((w) => w !== null);
  const sameWeight = weights.length > 0 && weights.every((w) => w === weights[0]);
  const repsPart = sets.map((s) => (s.reps !== null ? String(s.reps) : "-")).join("/");
  if (sameWeight) return `${weights[0]}kg — ${repsPart}`;
  return sets
    .map(
      (s) =>
        `${s.weightKg !== null ? `${s.weightKg}kg` : "-"}×${s.reps !== null ? s.reps : "-"}`
    )
    .join(", ");
};
