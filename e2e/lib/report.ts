import fs from "node:fs";
import path from "node:path";
import { E2E_DIR } from "../scripts/env.mjs";

export interface FlowResult {
  id: string;
  n: string; // audit 06 §1 row
  action: string;
  status: "measured" | "n/a" | "blocked";
  taps: number;
  inputs: number;
  transitions: number;
  scrolls: number;
  ms: number;
  budget: { taps: number; ms: number };
  withinBudget: boolean | null;
  steps: string[];
  note?: string;
  at: string;
}

export const FLOW_DIR = path.join(E2E_DIR, "results", "flows");

export function writeFlowResult(r: FlowResult) {
  fs.mkdirSync(FLOW_DIR, { recursive: true });
  fs.writeFileSync(path.join(FLOW_DIR, `${r.id}.json`), JSON.stringify(r, null, 2));
}

const order = (n: string) => {
  const m = n.match(/^(\d+)([a-z]?)/);
  return m ? Number(m[1]) * 100 + (m[2] ? m[2].charCodeAt(0) : 0) : 9999;
};

export function renderMarkdown(rows: FlowResult[]): string {
  const head =
    "| # | Action | Taps | Text inputs | Screens/sheets | Scrolls | Wall time | ≤2 taps & ≤5 s |\n" +
    "|---|---|---|---|---|---|---|---|\n";
  const body = rows
    .map((r) => {
      if (r.status === "blocked") {
        return `| ${r.n} | ${r.action} | ≥${r.taps} | ≥${r.inputs} | ≥${r.transitions} | ${r.scrolls} | – | BLOCKED: ${r.note ?? ""} |`;
      }
      if (r.status !== "measured") {
        return `| ${r.n} | ${r.action} | – | – | – | – | – | ${r.status.toUpperCase()}: ${r.note ?? ""} |`;
      }
      const ok = r.withinBudget ? "yes" : "**no**";
      return `| ${r.n} | ${r.action} | ${r.taps} | ${r.inputs} | ${r.transitions} | ${r.scrolls} | ${(r.ms / 1000).toFixed(2)} s | ${ok} |`;
    })
    .join("\n");
  return head + body + "\n";
}

export function aggregateFlowResults() {
  if (!fs.existsSync(FLOW_DIR)) return;
  const rows: FlowResult[] = fs
    .readdirSync(FLOW_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(FLOW_DIR, f), "utf8")));
  if (!rows.length) return;
  rows.sort((a, b) => order(a.n) - order(b.n));
  const outDir = path.join(E2E_DIR, "results");
  fs.writeFileSync(
    path.join(outDir, "flows.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), flows: rows }, null, 2)
  );
  const md =
    `# Core-action flows (${new Date().toISOString()})\n\n` +
    "Measured by e2e/lib/flow.ts on the Expo web build (Pixel 7 viewport). Taps = clicks, " +
    "Text inputs = fields typed, Screens/sheets = route changes + sheets/modals opened, " +
    "Scrolls = taps whose target was outside the viewport first. Wall time = first action → " +
    "confirmation visible.\n\n" +
    renderMarkdown(rows);
  fs.writeFileSync(path.join(outDir, "flows.md"), md);
  console.log("\n" + renderMarkdown(rows));
}
