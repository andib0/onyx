import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DailyScore } from "../api/scores";
import type { LogEntry } from "../types/appTypes";

export type AchievementCtx = {
  daysTracked: number;
  currentStreak: number;
  bestStreak: number;
  perfectDays: number;
  daysTrained: number;
  weightLogs: number;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: string; // ionicon name
  target: number;
  progress: number;
  unlocked: boolean;
};

type Def = {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  value: (c: AchievementCtx) => number;
};

const DEFS: Def[] = [
  { id: "first_day", title: "First steps", description: "Track your first day", icon: "footsteps", target: 1, value: (c) => c.daysTracked },
  { id: "week_tracked", title: "Warming up", description: "Track 7 days", icon: "calendar", target: 7, value: (c) => c.daysTracked },
  { id: "month_tracked", title: "Committed", description: "Track 30 days", icon: "ribbon", target: 30, value: (c) => c.daysTracked },
  { id: "streak_3", title: "Rolling", description: "3-day streak at 80%+", icon: "flame", target: 3, value: (c) => c.bestStreak },
  { id: "streak_7", title: "On fire", description: "7-day streak at 80%+", icon: "flame", target: 7, value: (c) => c.bestStreak },
  { id: "streak_30", title: "Unbreakable", description: "30-day streak at 80%+", icon: "flame", target: 30, value: (c) => c.bestStreak },
  { id: "perfect_day", title: "Perfect day", description: "Hit 100% in a day", icon: "sparkles", target: 1, value: (c) => c.perfectDays },
  { id: "perfect_5", title: "Flawless five", description: "5 perfect days", icon: "sparkles", target: 5, value: (c) => c.perfectDays },
  { id: "gym_10", title: "Gym rat", description: "Train 10 days", icon: "barbell", target: 10, value: (c) => c.daysTrained },
  { id: "gym_30", title: "Iron habit", description: "Train 30 days", icon: "barbell", target: 30, value: (c) => c.daysTrained },
  { id: "weight_10", title: "Scale watcher", description: "Log bodyweight 10 times", icon: "trending-up", target: 10, value: (c) => c.weightLogs },
];

function longestRun(scores: DailyScore[], threshold = 80): number {
  // scoreHistory comes ordered asc by date; count longest consecutive-calendar run >= threshold
  const byDate: Record<string, number> = {};
  for (const s of scores) byDate[s.date] = s.score;
  const dates = Object.keys(byDate).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of dates) {
    if (byDate[d] < threshold) {
      run = 0;
      prev = new Date(d + "T00:00:00");
      continue;
    }
    const cur = new Date(d + "T00:00:00");
    if (prev && (cur.getTime() - prev.getTime()) / 86400000 === 1) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

export function buildAchievementCtx(
  scoreHistory: DailyScore[],
  logEntries: LogEntry[],
  currentStreak: number
): AchievementCtx {
  return {
    daysTracked: scoreHistory.length,
    currentStreak,
    bestStreak: Math.max(longestRun(scoreHistory), currentStreak),
    perfectDays: scoreHistory.filter((s) => s.score >= 100).length,
    daysTrained: scoreHistory.filter((s) => s.workoutDone).length,
    weightLogs: logEntries.filter((l) => l.bw && l.bw.trim()).length,
  };
}

export function evaluateAchievements(ctx: AchievementCtx): Achievement[] {
  return DEFS.map((d) => {
    const progress = d.value(ctx);
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      icon: d.icon,
      target: d.target,
      progress: Math.min(progress, d.target),
      unlocked: progress >= d.target,
    };
  });
}

const SEEN_KEY = "onyx_achievements_seen";

// Returns achievements newly unlocked since last seen, and persists the union.
export async function detectNewUnlocks(unlockedIds: string[]): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    const seenSet = new Set(seen);
    const fresh = unlockedIds.filter((id) => !seenSet.has(id));
    if (fresh.length) {
      await AsyncStorage.setItem(
        SEEN_KEY,
        JSON.stringify(seen.concat(fresh))
      );
    }
    return fresh;
  } catch {
    return [];
  }
}
