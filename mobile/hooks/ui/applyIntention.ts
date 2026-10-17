// Turns an implementation intention into the plan: saved on the device, the
// schedule's training block moved to the chosen time (created if missing) and the
// training reminder switched on. Uses the existing api wrappers; callers reload
// state afterwards (useData().reloadState).
import { Platform } from "react-native";
import {
  createScheduleBlock,
  getScheduleBlocks,
  updateScheduleBlock,
} from "../../api/schedule";
import {
  ensurePermission,
  loadNotificationPrefs,
  saveNotificationPrefs,
} from "../../utils/notifications";
import { addMinutesToTime } from "../../utils/normalize";
import type { TrainingIntention } from "../../utils/trainingIntention";
import { saveTrainingIntention } from "./useTrainingIntention";

const SESSION_MINUTES = 75;

const isTraining = (b: { title?: string | null; tag?: string | null }) =>
  b.tag === "Training" || /\b(gym|train|training|workout)\b/i.test(b.title || "");

export async function applyTrainingIntention(
  intention: TrainingIntention,
  opts: { enableReminder?: boolean } = {}
): Promise<void> {
  await saveTrainingIntention(intention);

  const purpose = intention.place ? `At ${intention.place}` : "Planned session";
  const patch = {
    start: intention.time,
    end: addMinutesToTime(intention.time, SESSION_MINUTES),
    purpose,
  };
  const blocks = await getScheduleBlocks();
  const existing = blocks.success && blocks.data ? blocks.data.find(isTraining) : null;
  if (existing) {
    await updateScheduleBlock(existing.id, patch);
  } else {
    await createScheduleBlock(
      Object.assign({ title: "Train", tag: "Training", good: "" }, patch)
    );
  }

  if (opts.enableReminder && Platform.OS !== "web") {
    const granted = await ensurePermission().catch(() => false);
    if (granted) {
      const prefs = await loadNotificationPrefs();
      await saveNotificationPrefs(Object.assign({}, prefs, { training: true }));
    }
  }
}
