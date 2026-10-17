// In-memory server implementing the sync contract (docs/log/backend-sync-api.md)
// for the routes the outbox convergence test exercises: LWW toggles by HLC,
// field-level daily logs, idempotent creates by client id, deletes without
// tombstones (cascading to toggles), idempotent workout sessions and sets.
import type { HttpRequest } from "../intents";
import { LOG_FIELDS } from "../intents";
import type { TransportResult } from "../outbox";
import type { AppState } from "../../types/appTypes";

type Toggle = { value: boolean; hlc: string };
type LogRow = { id: string; values: Record<string, string>; clock: Record<string, string> };
type SetRow = {
  id: string;
  sessionId: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number | null;
  hlc: string | null;
};

export class FakeServer {
  blocks = new Map<string, { id: string; title: string }>();
  supplements = new Map<string, { id: string; item: string; dose: string }>();
  completions = new Map<string, Toggle>(); // `${blockId}|${date}`
  suppLogs = new Map<string, Toggle>();
  logs = new Map<string, LogRow>(); // by date
  sessions = new Map<string, { id: string; date: string }>();
  sets = new Map<string, SetRow>();
  requests = 0;

  handle(req: HttpRequest): TransportResult {
    this.requests += 1;
    const body = (req.body || {}) as Record<string, unknown>;
    const p = req.path;
    let m: RegExpMatchArray | null;

    const toggle = (
      store: Map<string, Toggle>,
      exists: boolean,
      key: string,
      value: boolean
    ): TransportResult => {
      if (!exists) return { ok: false, status: 404, error: "not found" };
      const hlc = String(body.hlc);
      const stored = store.get(key);
      const applied = !stored || hlc > stored.hlc;
      if (applied) store.set(key, { value, hlc });
      const row = store.get(key)!;
      return { ok: true, status: 200, data: { hlc: row.hlc, applied, value: row.value } };
    };

    if (req.method === "POST" && p === "/schedule/completions") {
      const blockId = String(body.blockId);
      return toggle(
        this.completions,
        this.blocks.has(blockId),
        `${blockId}|${body.date}`,
        Boolean(body.isComplete)
      );
    }
    if (req.method === "POST" && (m = p.match(/^\/supplements\/([^/]+)\/log$/))) {
      return toggle(
        this.suppLogs,
        this.supplements.has(m[1]),
        `${m[1]}|${body.date}`,
        Boolean(body.isTaken)
      );
    }
    if (req.method === "PATCH" && (m = p.match(/^\/logs\/(\d{4}-\d{2}-\d{2})$/))) {
      const date = m[1];
      const hlc = String(body.hlc);
      const created = !this.logs.has(date);
      const row = this.logs.get(date) || { id: String(body.id), values: {}, clock: {} };
      for (const f of LOG_FIELDS) {
        if (!(f in body)) continue;
        if (!row.clock[f] || hlc > row.clock[f]) {
          row.values[f] = String(body[f]);
          row.clock[f] = hlc;
        }
      }
      this.logs.set(date, row);
      return {
        ok: true,
        status: created ? 201 : 200,
        data: { id: row.id, date, fieldClock: Object.assign({}, row.clock) },
      };
    }
    if (req.method === "POST" && p === "/schedule") {
      const id = String(body.id);
      const replay = this.blocks.has(id);
      if (!replay) this.blocks.set(id, { id, title: String(body.title) });
      return { ok: true, status: replay ? 200 : 201, data: this.blocks.get(id) };
    }
    if (req.method === "DELETE" && (m = p.match(/^\/schedule\/([^/]+)$/))) {
      if (!this.blocks.delete(m[1])) return { ok: false, status: 404 };
      for (const k of Array.from(this.completions.keys()))
        if (k.startsWith(`${m[1]}|`)) this.completions.delete(k);
      return { ok: true, status: 200, data: null };
    }
    if (req.method === "POST" && p === "/supplements") {
      const id = String(body.id);
      const replay = this.supplements.has(id);
      if (!replay)
        this.supplements.set(id, { id, item: String(body.item), dose: String(body.dose) });
      return { ok: true, status: replay ? 200 : 201, data: this.supplements.get(id) };
    }
    if (req.method === "PUT" && (m = p.match(/^\/supplements\/([^/]+)$/))) {
      const row = this.supplements.get(m[1]);
      if (!row) return { ok: false, status: 404 };
      if (typeof body.dose === "string") row.dose = body.dose;
      return { ok: true, status: 200, data: row };
    }
    if (req.method === "DELETE" && (m = p.match(/^\/supplements\/([^/]+)$/))) {
      if (!this.supplements.delete(m[1])) return { ok: false, status: 404 };
      for (const k of Array.from(this.suppLogs.keys()))
        if (k.startsWith(`${m[1]}|`)) this.suppLogs.delete(k);
      return { ok: true, status: 200, data: null };
    }
    if (req.method === "POST" && p === "/workouts/sessions") {
      const id = String(body.id);
      const replay = this.sessions.has(id);
      if (!replay) this.sessions.set(id, { id, date: String(body.date) });
      return { ok: true, status: replay ? 200 : 201, data: this.sessions.get(id) };
    }
    if (req.method === "POST" && (m = p.match(/^\/workouts\/sessions\/([^/]+)\/sets$/))) {
      if (!this.sessions.has(m[1])) return { ok: false, status: 404 };
      const id = String(body.id);
      const hlc = (body.hlc as string) || null;
      const prev = this.sets.get(id);
      if (!prev || (hlc && (!prev.hlc || hlc > prev.hlc))) {
        this.sets.set(id, {
          id,
          sessionId: m[1],
          exerciseName: String(body.exerciseName),
          setNumber: Number(body.setNumber),
          weightKg: (body.weightKg as number | null) ?? null,
          hlc,
        });
      }
      return { ok: true, status: prev ? 200 : 201, data: this.sets.get(id) };
    }
    if (req.method === "DELETE" && (m = p.match(/^\/workouts\/sets\/([^/]+)$/))) {
      if (!this.sets.delete(m[1])) return { ok: false, status: 404 };
      return { ok: true, status: 200, data: null };
    }
    return { ok: false, status: 400, error: `unhandled ${req.method} ${p}` };
  }

  /** What a device reads back (the /today + export equivalent). */
  toAppState(): AppState {
    const completion: AppState["completion"] = {};
    for (const [k, v] of this.completions) {
      const [blockId, date] = k.split("|");
      completion[date] = Object.assign({}, completion[date] || {}, { [blockId]: v.value });
    }
    const suppLog: AppState["suppLog"] = {};
    for (const [k, v] of this.suppLogs) {
      const [id, date] = k.split("|");
      suppLog[date] = Object.assign({}, suppLog[date] || {}, { [id]: v.value });
    }
    return {
      completion,
      top3: {},
      mechanism: {},
      schedule: Array.from(this.blocks.values()).map((b) => ({
        id: b.id,
        start: "08:00",
        end: "09:00",
        title: b.title,
        purpose: "",
        good: "",
        tag: "",
      })),
      supp: {},
      suppLog,
      mealTemplatesByDay: {},
      mealLog: {},
      supplementsList: Array.from(this.supplements.values()).map((s) => ({
        id: s.id,
        item: s.item,
        goal: "",
        dose: s.dose,
        timeAt: "08:00",
      })),
      log: Array.from(this.logs.entries()).map(([date, row]) => ({
        id: row.id,
        date,
        day: row.values.day ?? "",
        bw: row.values.bw ?? "",
        sleep: row.values.sleep ?? "",
        steps: row.values.steps ?? "",
        top: row.values.top ?? "",
        notes: row.values.notes ?? "",
      })),
    };
  }

  allStamps(): string[] {
    const out: string[] = [];
    for (const v of this.completions.values()) out.push(v.hlc);
    for (const v of this.suppLogs.values()) out.push(v.hlc);
    for (const row of this.logs.values()) out.push(...Object.values(row.clock));
    return out;
  }
}
