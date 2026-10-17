import { describe, expect, it } from "vitest";
import {
  buildDayPlan,
  formatIn,
  groupSupplementSlots,
  pickNextAction,
  type DayPlanInput,
} from "../dayPlan";
import {
  defaultWeekdays,
  describeIntention,
  isTrainingDate,
  isoWeekdayOfKey,
  normalizeIntention,
} from "../trainingIntention";

const m = (h: number, min = 0) => h * 60 + min;

function day(over: Partial<DayPlanInput> = {}): DayPlanInput {
  return Object.assign(
    {
      scheduleBlocks: [
        {
          id: "dw",
          start: "09:00",
          end: "12:00",
          title: "Deep work",
          purpose: "",
          good: "",
          tag: "work",
        },
        {
          id: "gym",
          start: "17:30",
          end: "19:00",
          title: "Train",
          purpose: "",
          good: "",
          tag: "Training",
        },
        {
          id: "walk",
          start: "12:00",
          end: "12:30",
          title: "Lunch walk",
          purpose: "",
          good: "",
          tag: "",
        },
      ],
      completionByBlockId: {},
      supplements: [
        { id: "c", item: "Creatine", goal: "", dose: "5 g", timeAt: "08:00" },
        { id: "d", item: "Vitamin D", goal: "", dose: "1", timeAt: "08:00" },
        { id: "m", item: "Magnesium", goal: "", dose: "1", timeAt: "22:00" },
      ],
      supplementChecks: {},
      meals: [
        { id: "b", name: "Breakfast oats", examples: "", tags: [] },
        { id: "l", name: "Lunch", examples: "", tags: [] },
      ],
      mealChecks: {},
      workout: {
        trainingDay: true,
        done: false,
        active: false,
        title: "Full Body A",
        exerciseCount: 5,
      },
    },
    over
  );
}

describe("buildDayPlan", () => {
  it("is one time-ordered list: supplements per slot, meals at default times, training at its block", () => {
    const plan = buildDayPlan(day());
    expect(plan.map((i) => `${i.kind}@${i.start}`)).toEqual([
      `supplements@${m(8)}`,
      `meal@${m(8)}`,
      `block@${m(9)}`,
      `block@${m(12)}`,
      `meal@${m(12, 30)}`,
      `workout@${m(17, 30)}`,
      `supplements@${m(22)}`,
    ]);
    expect(plan[0]).toMatchObject({ title: "2 supplements", ids: ["c", "d"] });
  });

  it("rest day: no workout item and the training block is not a chore", () => {
    const plan = buildDayPlan(
      day({
        workout: {
          trainingDay: false,
          done: false,
          active: false,
          title: "",
          exerciseCount: 0,
        },
      })
    );
    expect(plan.some((i) => i.kind === "workout")).toBe(false);
    expect(plan.some((i) => i.title === "Train")).toBe(false);
  });

  it("intention time overrides the block time", () => {
    const plan = buildDayPlan(
      day({
        workout: {
          trainingDay: true,
          done: false,
          active: false,
          title: "A",
          exerciseCount: 3,
          time: "06:30",
        },
      })
    );
    expect(plan[0]).toMatchObject({ kind: "workout", start: m(6, 30) });
  });
});

describe("pickNextAction", () => {
  it("08:05 → the open supplement slot (priority over the 08:00 meal)", () => {
    const next = pickNextAction(buildDayPlan(day()), m(8, 5));
    expect(next.state).toBe("now");
    expect(next.item).toMatchObject({ kind: "supplements" });
  });

  it("after taking them → breakfast; a missed block drops out after its window", () => {
    const plan = buildDayPlan(day({ supplementChecks: { c: true, d: true } }));
    expect(pickNextAction(plan, m(8, 10)).item).toMatchObject({
      title: "Breakfast oats",
    });
    const later = buildDayPlan(
      day({ supplementChecks: { c: true, d: true }, mealChecks: { b: true, l: true } })
    );
    // 12:40: deep work (09–12) and the walk (12–12:30) are over → next is training
    const next = pickNextAction(later, m(12, 40));
    expect(next).toMatchObject({ state: "next", minutesUntil: m(17, 30) - m(12, 40) });
    expect(next.item).toMatchObject({ kind: "workout" });
  });

  it("an active workout is always the next action", () => {
    const next = pickNextAction(buildDayPlan(day()), m(8, 5), { workoutActive: true });
    expect(next.item).toMatchObject({ kind: "workout" });
  });

  it("a missed workout stays actionable (overdue) the rest of the day", () => {
    const plan = buildDayPlan(
      day({
        supplementChecks: { c: true, d: true, m: true },
        mealChecks: { b: true, l: true },
      })
    );
    const next = pickNextAction(plan, m(19, 30));
    expect(next).toMatchObject({ state: "overdue" });
    expect(next.item).toMatchObject({ kind: "workout" });
  });

  it("everything done → done", () => {
    const plan = buildDayPlan(
      day({
        supplementChecks: { c: true, d: true, m: true },
        mealChecks: { b: true, l: true },
        completionByBlockId: { dw: true, walk: true },
        workout: {
          trainingDay: true,
          done: true,
          active: false,
          title: "",
          exerciseCount: 0,
        },
      })
    );
    expect(pickNextAction(plan, m(9)).state).toBe("done");
  });

  it("formats the wait", () => {
    expect(formatIn(25)).toBe("in 25 min");
    expect(formatIn(125)).toBe("in 2 h 5 min");
    expect(formatIn(120)).toBe("in 2 h");
  });
});

describe("groupSupplementSlots", () => {
  it("normalises H:MM and sorts slots", () => {
    const slots = groupSupplementSlots(
      [
        { id: "a", item: "A", goal: "", dose: "", timeAt: "22:00" },
        { id: "b", item: "B", goal: "", dose: "", timeAt: "8:00" },
        { id: "c", item: "C", goal: "", dose: "", timeAt: "08:00" },
      ],
      { b: true }
    );
    expect(slots.map((s) => s.time)).toEqual(["08:00", "22:00"]);
    expect(slots[0].pending.map((s) => s.id)).toEqual(["c"]);
  });
});

describe("training intention", () => {
  it("weekday maths and validation", () => {
    expect(isoWeekdayOfKey("2026-10-19")).toBe(1);
    expect(isoWeekdayOfKey("2026-10-25")).toBe(7);
    expect(defaultWeekdays(3)).toEqual([1, 3, 5]);
    const i = normalizeIntention({
      weekdays: [5, 1, 3, 3, 9],
      time: "17:30",
      place: " Gym ",
    });
    expect(i).toEqual({ weekdays: [1, 3, 5], time: "17:30", place: "Gym" });
    expect(isTrainingDate(i!, "2026-10-21")).toBe(true);
    expect(isTrainingDate(i!, "2026-10-20")).toBe(false);
    expect(describeIntention(i!)).toBe("Mon, Wed, Fri at 17:30 · Gym");
    expect(normalizeIntention({ weekdays: [], time: "17:30" })).toBeNull();
    expect(normalizeIntention({ weekdays: [1], time: "5pm" })).toBeNull();
  });
});
