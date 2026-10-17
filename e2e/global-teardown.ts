import { aggregateFlowResults } from "./lib/report";

// Collects per-flow measurements (results/flows/*.json) into results/flows.json and
// results/flows.md. No-op when no flow ran (e.g. smoke only).
export default async function globalTeardown() {
  aggregateFlowResults();
}
