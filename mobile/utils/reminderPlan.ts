// Which reminders to schedule, computed from the plan and what is already done.
// Pure (no expo-notifications import) so it is unit-tested with a fake clock;
// utils/notifications.ts turns the result into one-shot scheduled notifications.
//
// Evidence (audit 06 §3):
// - JITAI framework, Nahum-Shani et al. 2018 (Ann Behav Med 52:446): support only at
//   moments of need/opportunity — never for something already done.
// - Mehrotra et al. 2016 (CHI): receptivity depends on relevance and timing → one
//   banner per supplement time slot instead of three simultaneous 08:00 pings.
// - Gollwitzer & Sheeran 2006: the training reminder is anchored to the user's own
//   implementation intention (days/time/place), not a hard-coded 17:30.
import { groupSupplementSlots } from "./dayPlan";
import { isTrainingDate, type TrainingIntention } from "./trainingIntention";
import type { SupplementItem } from "../types/appTypes";

/** The evening check-in card appears at the same minute its notification fires. */
export const CHECK_IN_TIME = "20:00";
export const CHECK_IN_MINUTES = 20 * 60;
/** Morning weigh-in + sleep card shows until this time (or until both are logged). */
export const MORNING_CARD_UNTIL_MINUTES = 11 * 60;
/** Training reminder lead time before the intended start. */
export const TRAINING_LEAD_MINUTES = 15;
/** How many days ahead one-shots are scheduled (rescheduled on every app open/change). */
export const PLAN_DAYS = 7;

export const FEATURE_FLAGS = {
  // Early-warning nudge on a 3-day logging drop (plan §2a). OFF until the
  // real-data rerun (audit 04 §B6) confirms it on held-out weeks — the signal was
  // only validated on simulated data, partly built into the generator.
  earlyWarningNudge: false,
};

export type ReminderPrefs = {
  supplements: boolean;
  checkIn: boolean;
  training: boolean;
};

export type ReminderType = "supplement" | "checkin" | "training" | "nudge";

export type PlannedReminder = {
  /** Stable per (type, date, slot): lets the scheduler diff instead of churn. */
  key: string;
  type: ReminderType;
  fireAt: Date;
  title: string;
  body: string;
  data: Record<string, unknown>;
  categoryIdentifier?: string;
};

export type ReminderPlanInput = {
  now: Date;
  prefs: ReminderPrefs;
  supplements: SupplementItem[];
  /** date → supplementId → taken */
  supplementChecksByDate: Record<string, Record<string, boolean>>;
  /** Dates whose evening check-in is done. */
  checkInDoneDates: string[];
  /** Dates whose workout is done. */
  workoutDoneDates: string[];
  intention: TrainingIntention | null;
  days?: number;
  /** Only read when FEATURE_FLAGS.earlyWarningNudge is on. */
  loggingDropDetected?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function at(day: Date, time: string, offsetMinutes = 0): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m + offsetMinutes, 0, 0);
  return d;
}

export function planReminders(input: ReminderPlanInput): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const days = input.days ?? PLAN_DAYS;
  const nowMs = input.now.getTime();
  const checkInDone = new Set(input.checkInDoneDates);
  const workoutDone = new Set(input.workoutDoneDates);

  for (let offset = 0; offset < days; offset++) {
    const day = new Date(input.now);
    day.setHours(12, 0, 0, 0); // DST-safe anchor
    day.setDate(day.getDate() + offset);
    const date = localDateKey(day);

    if (input.prefs.supplements) {
      const checks = input.supplementChecksByDate[date] || {};
      for (const slot of groupSupplementSlots(input.supplements, checks)) {
        if (!slot.pending.length) continue; // whole slot already taken
        const fireAt = at(day, slot.time);
        if (fireAt.getTime() <= nowMs) continue;
        const names = slot.pending.map((s) => s.item);
        out.push({
          key: `supplement:${date}:${slot.time}`,
          type: "supplement",
          fireAt,
          title:
            names.length === 1 ? names[0] : `${names.length} supplements · ${slot.time}`,
          body: names.length === 1 ? slot.pending[0].dose || "" : names.join(", "),
          data: {
            type: "supplement",
            date,
            supplementIds: slot.pending.map((s) => s.id || ""),
          },
          categoryIdentifier: "supplement",
        });
      }
    }

    if (input.prefs.checkIn && !checkInDone.has(date)) {
      const fireAt = at(day, CHECK_IN_TIME);
      if (fireAt.getTime() > nowMs) {
        out.push({
          key: `checkin:${date}`,
          type: "checkin",
          fireAt,
          title: "Evening check-in",
          body: "Steps and a note — 20 seconds.",
          data: { type: "checkin", date },
          categoryIdentifier: "checkin",
        });
      }
    }

    if (
      input.prefs.training &&
      input.intention &&
      isTrainingDate(input.intention, date) &&
      !workoutDone.has(date)
    ) {
      const fireAt = at(day, input.intention.time, -TRAINING_LEAD_MINUTES);
      if (fireAt.getTime() > nowMs) {
        const where = input.intention.place ? ` · ${input.intention.place}` : "";
        out.push({
          key: `training:${date}`,
          type: "training",
          fireAt,
          title: `Training at ${input.intention.time}${where}`,
          body: "Your plan for today. Open Onyx to start the session.",
          data: { type: "training", date },
        });
      }
    }
  }

  if (FEATURE_FLAGS.earlyWarningNudge && input.loggingDropDetected) {
    const fireAt = at(input.now, "18:00");
    if (fireAt.getTime() > nowMs) {
      out.push({
        key: `nudge:${localDateKey(input.now)}`,
        type: "nudge",
        fireAt,
        title: "Quiet few days",
        body: "Log one meal today — keeping the chain small keeps it alive.",
        data: { type: "nudge" },
      });
    }
  }

  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** Evening check-in counts as done when the evening fields were saved. */
export function checkInDoneFor(entry: { steps?: string; notes?: string } | undefined) {
  return Boolean(entry && ((entry.steps || "").trim() || (entry.notes || "").trim()));
}

/** Morning card is done once both weight and sleep exist for the day. */
export function morningDoneFor(entry: { bw?: string; sleep?: string } | undefined) {
  return Boolean(entry && (entry.bw || "").trim() && (entry.sleep || "").trim());
}
