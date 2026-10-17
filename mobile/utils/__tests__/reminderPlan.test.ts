import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECK_IN_MINUTES,
  CHECK_IN_TIME,
  FEATURE_FLAGS,
  checkInDoneFor,
  localDateKey,
  morningDoneFor,
  planReminders,
  type ReminderPlanInput,
} from "../reminderPlan";
import type { SupplementItem } from "../../types/appTypes";

// Fake clock: Monday 2026-10-19, 07:00 local.
const MONDAY_7AM = new Date(2026, 9, 19, 7, 0, 0, 0);
const TODAY = "2026-10-19";

const supp = (id: string, item: string, timeAt: string): SupplementItem => ({
  id,
  item,
  goal: "",
  dose: "1 cap",
  timeAt,
});
const AM = [
  supp("c", "Creatine", "08:00"),
  supp("d", "Vitamin D", "08:00"),
  supp("o", "Omega-3", "08:00"),
];
const PM = [supp("m", "Magnesium", "22:00")];

function input(over: Partial<ReminderPlanInput> = {}): ReminderPlanInput {
  return Object.assign(
    {
      now: new Date(),
      prefs: { supplements: true, checkIn: true, training: true },
      supplements: AM.concat(PM),
      supplementChecksByDate: {},
      checkInDoneDates: [],
      workoutDoneDates: [],
      intention: { weekdays: [1, 3, 5], time: "17:30", place: "Gym" },
      days: 1,
    },
    over
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(MONDAY_7AM);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("planReminders (fake clock)", () => {
  it("one banner per supplement time slot, not one per supplement", () => {
    const plan = planReminders(input());
    const supps = plan.filter((r) => r.type === "supplement");
    expect(supps).toHaveLength(2); // 08:00 (3 items) + 22:00 (1 item)
    expect(supps[0].title).toBe("3 supplements · 08:00");
    expect(supps[0].body).toBe("Creatine, Vitamin D, Omega-3");
    expect(supps[0].data.supplementIds).toEqual(["c", "d", "o"]);
    expect(supps[0].fireAt).toEqual(new Date(2026, 9, 19, 8, 0));
    expect(supps[1].title).toBe("Magnesium");
  });

  it("no notification for completed items", () => {
    const plan = planReminders(
      input({
        supplementChecksByDate: { [TODAY]: { c: true, d: true, o: true } },
        checkInDoneDates: [TODAY],
        workoutDoneDates: [TODAY],
      })
    );
    expect(plan.map((r) => r.key)).toEqual([`supplement:${TODAY}:22:00`]);
  });

  it("a partly taken slot only lists what is still pending", () => {
    const plan = planReminders(
      input({ supplementChecksByDate: { [TODAY]: { c: true } }, prefs: prefsOnly() })
    );
    expect(plan[0].title).toBe("2 supplements · 08:00");
    expect(plan[0].data.supplementIds).toEqual(["d", "o"]);
  });

  it("nothing in the past: at 08:30 the 08:00 slot is gone", () => {
    vi.setSystemTime(new Date(2026, 9, 19, 8, 30));
    const plan = planReminders(input({ now: new Date(), prefs: prefsOnly() }));
    expect(plan.map((r) => r.key)).toEqual([`supplement:${TODAY}:22:00`]);
  });

  it("check-in fires at the same minute the check-in card appears", () => {
    const plan = planReminders(input({ prefs: onlyPref("checkIn") }));
    expect(plan).toHaveLength(1);
    expect(CHECK_IN_TIME).toBe("20:00");
    const at = plan[0].fireAt;
    expect(at.getHours() * 60 + at.getMinutes()).toBe(CHECK_IN_MINUTES);
  });

  it("training reminder follows the implementation intention: days, time − 15 min, place", () => {
    const week = planReminders(input({ prefs: onlyPref("training"), days: 7 }));
    expect(week.map((r) => localDateKey(r.fireAt))).toEqual([
      "2026-10-19",
      "2026-10-21",
      "2026-10-23",
    ]);
    expect(week[0].fireAt).toEqual(new Date(2026, 9, 19, 17, 15));
    expect(week[0].title).toBe("Training at 17:30 · Gym");
    expect(
      planReminders(input({ prefs: onlyPref("training"), intention: null }))
    ).toEqual([]);
  });

  it("schedules a week ahead with one entry per slot per day; prefs off → nothing", () => {
    const week = planReminders(input({ days: 7 }));
    const perDay = new Map<string, number>();
    for (const r of week.filter((x) => x.type === "supplement")) {
      const d = localDateKey(r.fireAt);
      perDay.set(d, (perDay.get(d) ?? 0) + 1);
    }
    expect(Array.from(perDay.values())).toEqual([2, 2, 2, 2, 2, 2, 2]);
    expect(
      planReminders(
        input({ days: 7, prefs: { supplements: false, checkIn: false, training: false } })
      )
    ).toEqual([]);
  });

  it("early-warning nudge stays off behind its flag", () => {
    expect(FEATURE_FLAGS.earlyWarningNudge).toBe(false);
    const plan = planReminders(input({ loggingDropDetected: true }));
    expect(plan.some((r) => r.type === "nudge")).toBe(false);
  });

  it("sorted by fire time", () => {
    const plan = planReminders(input({ days: 2 }));
    const times = plan.map((r) => r.fireAt.getTime());
    expect(times).toEqual(times.slice().sort((a, b) => a - b));
  });
});

describe("check-in / morning completion", () => {
  it("evening is done once steps or a note exist; morning once weight + sleep exist", () => {
    expect(checkInDoneFor(undefined)).toBe(false);
    expect(checkInDoneFor({ steps: "", notes: "" })).toBe(false);
    expect(checkInDoneFor({ steps: "9000" })).toBe(true);
    expect(morningDoneFor({ bw: "80.1", sleep: "" })).toBe(false);
    expect(morningDoneFor({ bw: "80.1", sleep: "7.5" })).toBe(true);
  });
});

function onlyPref(key: "supplements" | "checkIn" | "training") {
  return {
    supplements: key === "supplements",
    checkIn: key === "checkIn",
    training: key === "training",
  };
}
function prefsOnly() {
  return onlyPref("supplements");
}
