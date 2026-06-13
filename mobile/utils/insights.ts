import type { DailyScore } from "../api/scores";
import type { LogEntry } from "../types/appTypes";

export const INSIGHTS_MIN_DAYS = 14;

export type Insight = {
  id: string;
  title: string;
  text: string;
  aLabel: string;
  aValue: number;
  bLabel: string;
  bValue: number;
  unit: string;
  sampleSize: number;
  effect: number; // magnitude used for ranking
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const avg = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

const MIN_PER_GROUP = 3;
const MIN_EFFECT = 10; // percentage points

// How many more tracked days until insights unlock
export function daysUntilInsights(scoreHistory: DailyScore[]): number {
  return Math.max(INSIGHTS_MIN_DAYS - scoreHistory.length, 0);
}

export function buildInsights(
  scoreHistory: DailyScore[],
  logEntries: LogEntry[]
): Insight[] {
  if (scoreHistory.length < INSIGHTS_MIN_DAYS) return [];

  const scoreByDate: Record<string, number> = {};
  for (const s of scoreHistory) scoreByDate[s.date] = s.score;

  const out: Insight[] = [];

  // 1. Sleep → adherence
  {
    const good: number[] = [];
    const poor: number[] = [];
    for (const log of logEntries) {
      const score = scoreByDate[log.date];
      const sleep = parseFloat(String(log.sleep).replace(",", "."));
      if (score === undefined || isNaN(sleep)) continue;
      if (sleep >= 7) good.push(score);
      else poor.push(score);
    }
    if (good.length >= MIN_PER_GROUP && poor.length >= MIN_PER_GROUP) {
      const a = avg(good);
      const b = avg(poor);
      if (Math.abs(a - b) >= MIN_EFFECT) {
        out.push({
          id: "sleep_score",
          title: "Sleep drives your day",
          text:
            a > b
              ? `You complete more on 7h+ sleep nights — ${a}% vs ${b}%.`
              : `Oddly, you complete less after 7h+ sleep — ${a}% vs ${b}%.`,
          aLabel: "7h+",
          aValue: a,
          bLabel: "<7h",
          bValue: b,
          unit: "%",
          sampleSize: good.length + poor.length,
          effect: Math.abs(a - b),
        });
      }
    }
  }

  // 2. Training days → adherence
  {
    const trained: number[] = [];
    const rest: number[] = [];
    for (const s of scoreHistory) {
      if (s.workoutDone) trained.push(s.score);
      else rest.push(s.score);
    }
    if (trained.length >= MIN_PER_GROUP && rest.length >= MIN_PER_GROUP) {
      const a = avg(trained);
      const b = avg(rest);
      if (Math.abs(a - b) >= MIN_EFFECT) {
        out.push({
          id: "training_score",
          title: "Training lifts everything",
          text:
            a > b
              ? `On days you train, your whole day scores higher — ${a}% vs ${b}%.`
              : `Your non-training days actually score higher — ${a}% vs ${b}%.`,
          aLabel: "Train",
          aValue: a,
          bLabel: "Rest",
          bValue: b,
          unit: "%",
          sampleSize: trained.length + rest.length,
          effect: Math.abs(a - b),
        });
      }
    }
  }

  // 3. Strongest weekday
  {
    const byDay: Record<number, number[]> = {};
    for (const s of scoreHistory) {
      const wd = new Date(s.date + "T00:00:00").getDay();
      (byDay[wd] = byDay[wd] || []).push(s.score);
    }
    const overall = avg(scoreHistory.map((s) => s.score));
    let bestDay = -1;
    let bestAvg = -1;
    for (const [wd, scores] of Object.entries(byDay)) {
      if (scores.length < 2) continue;
      const m = avg(scores);
      if (m > bestAvg) {
        bestAvg = m;
        bestDay = Number(wd);
      }
    }
    if (bestDay >= 0 && bestAvg - overall >= MIN_EFFECT) {
      out.push({
        id: "best_weekday",
        title: "Your peak day",
        text: `${WEEKDAYS[bestDay]} is your strongest day — ${bestAvg}% vs ${overall}% average.`,
        aLabel: WEEKDAYS[bestDay].slice(0, 3),
        aValue: bestAvg,
        bLabel: "Avg",
        bValue: overall,
        unit: "%",
        sampleSize: scoreHistory.length,
        effect: bestAvg - overall,
      });
    }
  }

  return out.sort((a, b) => b.effect - a.effect);
}
