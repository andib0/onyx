// Every write the app makes, as data (Bet 2). An Intent says *what* changed;
// `describeIntent` derives how the outbox coalesces it and `requestsFor` how it
// is sent (docs/log/backend-sync-api.md is the contract).

export const LOG_FIELDS = ["day", "bw", "sleep", "steps", "top", "notes"] as const;
export type LogField = (typeof LOG_FIELDS)[number];

export type ToggleKind = "completion" | "supplement" | "meal";
export type Entity =
  | "block"
  | "supplement"
  | "meal"
  | "program"
  | "session"
  | "set"
  | "userFood"
  /** an ad-hoc food eaten once (POST /meals/one-off: dated template + eaten log) */
  | "oneOffMeal";

export type Intent =
  | { t: "toggle"; kind: ToggleKind; targetId: string; date: string; value: boolean }
  | {
      t: "logFields";
      date: string;
      logId: string;
      /** true when the row did not exist locally before this write */
      creates: boolean;
      fields: Partial<Record<LogField, string>>;
    }
  | { t: "logDelete"; date: string; logId: string }
  | { t: "create"; entity: Entity; id: string; data: Record<string, unknown> }
  | { t: "update"; entity: Entity; id: string; data: Record<string, unknown> }
  | { t: "delete"; entity: Entity; id: string; data?: Record<string, unknown> }
  | { t: "prefs"; data: Record<string, unknown> }
  | { t: "profile"; data: Record<string, unknown> }
  | {
      t: "finishSession";
      id: string;
      /** markedDone: "trained but didn't log" — counts as the planned sets */
      data: { durationSeconds?: number; endedAt?: string; markedDone?: boolean };
    }
  | { t: "scoreTrigger"; date: string; data: Record<string, unknown> };

export type Coalesce = "replace" | "merge" | "fields" | "append";
export type Domain = "day" | "programs" | "user" | "workout" | "foods" | "score";

export type IntentMeta = {
  key: string;
  coalesce: Coalesce;
  /** entity this op belongs to (create/update/delete of it) */
  entity?: string;
  /** entities that must still exist for this op to make sense */
  refs: string[];
  creates: boolean;
  deletes: boolean;
  /** what a 404 means: target gone → drop it, already deleted → done, else dead-letter */
  notFound: "drop" | "ok" | "dead";
  domain: Domain;
  label: string;
};

const TOGGLE_ENTITY: Record<ToggleKind, Entity> = {
  completion: "block",
  supplement: "supplement",
  meal: "meal",
};

const ENTITY_LABEL: Record<Entity, string> = {
  block: "Schedule block",
  supplement: "Supplement",
  meal: "Meal",
  program: "Program",
  session: "Workout session",
  set: "Workout set",
  userFood: "Saved food",
  oneOffMeal: "Logged food",
};

const ENTITY_DOMAIN: Record<Entity, Domain> = {
  block: "day",
  supplement: "day",
  meal: "day",
  program: "programs",
  session: "workout",
  set: "workout",
  userFood: "foods",
  oneOffMeal: "day",
};

export const entityKey = (entity: Entity, id: string) => `${entity}:${id}`;

export function describeIntent(intent: Intent): IntentMeta {
  switch (intent.t) {
    case "toggle":
      return {
        key: `toggle:${intent.kind}:${intent.targetId}:${intent.date}`,
        coalesce: "replace",
        refs: [entityKey(TOGGLE_ENTITY[intent.kind], intent.targetId)],
        creates: false,
        deletes: false,
        notFound: "drop",
        domain: "day",
        label: `${intent.kind === "completion" ? "Schedule" : intent.kind === "meal" ? "Meal" : "Supplement"} check (${intent.date})`,
      };
    case "logFields":
      return {
        key: `log:${intent.date}`,
        coalesce: "fields",
        entity: `log:${intent.date}`,
        refs: [],
        creates: intent.creates,
        deletes: false,
        notFound: "dead",
        domain: "day",
        label: `Daily log (${intent.date})`,
      };
    case "logDelete":
      return {
        key: `logDelete:${intent.date}`,
        coalesce: "append",
        entity: `log:${intent.date}`,
        refs: [],
        creates: false,
        deletes: true,
        notFound: "ok",
        domain: "day",
        label: `Delete daily log (${intent.date})`,
      };
    case "create":
      return {
        key: `create:${intent.entity}:${intent.id}`,
        coalesce: "append",
        entity: entityKey(intent.entity, intent.id),
        refs:
          intent.entity === "set" && typeof intent.data.sessionId === "string"
            ? [entityKey("session", intent.data.sessionId)]
            : [],
        creates: true,
        deletes: false,
        notFound: "dead",
        domain: ENTITY_DOMAIN[intent.entity],
        label: `Add ${ENTITY_LABEL[intent.entity].toLowerCase()}`,
      };
    case "update":
      return {
        key: `update:${intent.entity}:${intent.id}`,
        // Programs are PUT as whole documents; the others are partial patches.
        coalesce: intent.entity === "program" ? "replace" : "merge",
        entity: entityKey(intent.entity, intent.id),
        refs: [],
        creates: false,
        deletes: false,
        notFound: "dead",
        domain: ENTITY_DOMAIN[intent.entity],
        label: `Edit ${ENTITY_LABEL[intent.entity].toLowerCase()}`,
      };
    case "delete":
      return {
        key: `delete:${intent.entity}:${intent.id}`,
        coalesce: "append",
        entity: entityKey(intent.entity, intent.id),
        refs: [],
        creates: false,
        deletes: true,
        notFound: "ok",
        domain: ENTITY_DOMAIN[intent.entity],
        label: `Remove ${ENTITY_LABEL[intent.entity].toLowerCase()}`,
      };
    case "prefs":
      return {
        key: "prefs",
        coalesce: "merge",
        refs: [],
        creates: false,
        deletes: false,
        notFound: "dead",
        domain: "user",
        label: "Preferences",
      };
    case "profile":
      return {
        key: "profile",
        coalesce: "merge",
        refs: [],
        creates: false,
        deletes: false,
        notFound: "dead",
        domain: "user",
        label: "Profile",
      };
    case "finishSession":
      return {
        key: `finish:${intent.id}`,
        coalesce: "replace",
        refs: [entityKey("session", intent.id)],
        creates: false,
        deletes: false,
        notFound: "drop",
        domain: "workout",
        label: "Finish workout",
      };
    case "scoreTrigger":
      return {
        key: `score:${intent.date}`,
        coalesce: "replace",
        refs: [],
        creates: false,
        deletes: false,
        notFound: "drop",
        domain: "score",
        label: `Day score (${intent.date})`,
      };
  }
}

export type HttpRequest = {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
};

const ENTITY_PATH: Record<Entity, string> = {
  block: "/schedule",
  supplement: "/supplements",
  meal: "/meals/templates",
  program: "/programs",
  session: "/workouts/sessions",
  set: "/workouts/sets",
  userFood: "/user-foods",
  // create goes to /meals/one-off; the entry is a template, so it is deleted there
  oneOffMeal: "/meals/templates",
};

/** Splits fields into one group per distinct stamp (oldest stamp first). */
function groupByStamp(
  fields: Record<string, unknown>,
  hlc: string,
  fieldHlc?: Record<string, string>
): Array<{ stamp: string; fields: Record<string, unknown> }> {
  const groups = new Map<string, Record<string, unknown>>();
  for (const field of Object.keys(fields)) {
    const stamp = (fieldHlc && fieldHlc[field]) || hlc;
    const group = groups.get(stamp) || {};
    group[field] = fields[field];
    groups.set(stamp, group);
  }
  if (groups.size === 0) groups.set(hlc, {});
  return Array.from(groups.keys())
    .sort()
    .map((stamp) => ({ stamp, fields: groups.get(stamp)! }));
}

/**
 * HTTP request(s) for an op. Daily-log fields and partial entity edits
 * coalesced from different writes keep their own HLC, so they are sent as one
 * PATCH/PUT per distinct stamp (sending an older field under a newer stamp
 * would let it beat a newer remote edit — the server is per-field LWW).
 */
export function requestsFor(
  intent: Intent,
  hlc: string,
  fieldHlc?: Record<string, string>
): HttpRequest[] {
  switch (intent.t) {
    case "toggle":
      if (intent.kind === "completion") {
        return [
          {
            method: "POST",
            path: "/schedule/completions",
            body: {
              blockId: intent.targetId,
              date: intent.date,
              isComplete: intent.value,
              hlc,
            },
          },
        ];
      }
      if (intent.kind === "supplement") {
        return [
          {
            method: "POST",
            path: `/supplements/${intent.targetId}/log`,
            body: { date: intent.date, isTaken: intent.value, hlc },
          },
        ];
      }
      return [
        {
          method: "POST",
          path: `/meals/${intent.targetId}/log`,
          body: { date: intent.date, isEaten: intent.value, hlc },
        },
      ];
    case "logFields":
      return groupByStamp(intent.fields, hlc, fieldHlc).map((g) => ({
        method: "PATCH" as const,
        path: `/logs/${intent.date}`,
        body: Object.assign({}, g.fields, { hlc: g.stamp, id: intent.logId }),
      }));
    case "logDelete":
      return [{ method: "DELETE", path: `/logs/${intent.logId}` }];
    case "create": {
      if (intent.entity === "oneOffMeal") {
        return [
          {
            method: "POST",
            path: "/meals/one-off",
            body: Object.assign({}, intent.data, { id: intent.id, hlc }),
          },
        ];
      }
      if (intent.entity === "set") {
        const sessionId = String(intent.data.sessionId);
        const body = Object.assign({}, intent.data, { id: intent.id, hlc });
        delete (body as Record<string, unknown>).sessionId;
        return [{ method: "POST", path: `/workouts/sessions/${sessionId}/sets`, body }];
      }
      return [
        {
          method: "POST",
          path: ENTITY_PATH[intent.entity],
          body: Object.assign({}, intent.data, { id: intent.id, hlc }),
        },
      ];
    }
    case "update":
      // Programs are whole documents (fieldHlc unset): one PUT, one stamp.
      return groupByStamp(intent.data, hlc, fieldHlc).map((g) => ({
        method: "PUT" as const,
        path: `${ENTITY_PATH[intent.entity]}/${intent.id}`,
        body: Object.assign({}, g.fields, { hlc: g.stamp }),
      }));
    case "delete":
      // The stamp is recorded on the server's tombstone.
      return [
        {
          method: "DELETE",
          path: `${ENTITY_PATH[intent.entity]}/${intent.id}`,
          body: { hlc },
        },
      ];
    case "prefs":
      return [{ method: "PUT", path: "/preferences", body: intent.data }];
    case "profile":
      return [{ method: "PUT", path: "/auth/profile", body: intent.data }];
    case "finishSession":
      return [
        {
          method: "PATCH",
          path: `/workouts/sessions/${intent.id}/finish`,
          body: Object.assign({}, intent.data),
        },
      ];
    case "scoreTrigger":
      return [{ method: "POST", path: "/scores", body: Object.assign({}, intent.data) }];
  }
}

/** Merge a newer intent into a queued one with the same coalescing key. */
export function mergeIntents(older: Intent, newer: Intent, coalesce: Coalesce): Intent {
  if (coalesce === "replace") return newer;
  if (coalesce === "merge" && "data" in older && "data" in newer) {
    return Object.assign({}, newer, {
      data: Object.assign({}, older.data, newer.data),
    }) as Intent;
  }
  if (coalesce === "fields" && older.t === "logFields" && newer.t === "logFields") {
    return Object.assign({}, newer, {
      // A row this device created stays "created here" for cancellation.
      creates: older.creates,
      logId: older.logId,
      fields: Object.assign({}, older.fields, newer.fields),
    });
  }
  return newer;
}
