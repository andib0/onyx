// Turns an implementation intention into the plan: saved on the device, the
// schedule's training block moved to the chosen time (created if missing) and the
// training reminder switched on. Schedule writes go through the outbox
// (offline-safe, applied to the cached day at once).
import { Platform } from "react-native";
import { getScheduleBlocks } from "../../api/schedule";
import { enqueueWrite, syncContextReady } from "../../sync/runtime";
import { qk } from "../../sync/queryKeys";
import { uuidv4 } from "../../sync/uuid";
import type { AppState } from "../../types/appTypes";
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
  // The device's copy of the schedule (server list as a fallback before the first sync).
  const ctx = await syncContextReady();
  const cached = ctx ? ctx.qc.getQueryData<AppState>(qk.appState(ctx.userId)) : undefined;
  let list: Array<{ id?: string; title?: string | null; tag?: string | null }> = cached
    ? cached.schedule
    : [];
  if (!cached) {
    const blocks = await getScheduleBlocks();
    list = blocks.success && blocks.data ? blocks.data : [];
  }
  const existing = list.find(isTraining);
  if (existing && existing.id) {
    await enqueueWrite({ t: "update", entity: "block", id: existing.id, data: patch });
  } else {
    await enqueueWrite({
      t: "create",
      entity: "block",
      id: uuidv4(),
      data: Object.assign({ title: "Train", tag: "Training", good: "" }, patch),
    });
  }

  if (opts.enableReminder && Platform.OS !== "web") {
    const granted = await ensurePermission().catch(() => false);
    if (granted) {
      const prefs = await loadNotificationPrefs();
      await saveNotificationPrefs(Object.assign({}, prefs, { training: true }));
    }
  }
}
