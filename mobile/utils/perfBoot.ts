// First module the bundle evaluates (see mobile/index.ts): marks the moment JS
// starts running, before expo-router and the app's module graph are initialised
// (scripts/measure-tti.sh, docs/log/cold-start.md).
import { perfMark } from "./perfMarks";

perfMark("bundle_start");
