export function parseRangeValue(value: string): number {
  const matches = String(value || '').match(/\d+(\.\d+)?/g);
  if (!matches || !matches.length) return 0;
  const nums = matches
    .map((num) => Number(num))
    .filter((num) => Number.isFinite(num));
  if (!nums.length) return 0;
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  return nums[0];
}

export function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function parseRestSeconds(value: string): number {
  const match = String(value || '').match(/\d+/);
  if (!match) return 0;
  const seconds = Number(match[0]);
  return Number.isFinite(seconds) ? seconds : 0;
}
