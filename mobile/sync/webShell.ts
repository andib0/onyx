// Web build only: register public/sw.js so a reload without network still
// boots the app, which then renders from the persisted cache (Bet 1).
import { Platform } from "react-native";

type SWContainer = {
  register: (url: string) => Promise<unknown>;
  ready: Promise<{ active?: { postMessage: (m: unknown) => void } | null }>;
};

export function registerWebShell() {
  if (Platform.OS !== "web") return;
  const nav = (globalThis as { navigator?: { serviceWorker?: SWContainer } }).navigator;
  const sw = nav && nav.serviceWorker;
  if (!sw) return;
  const loc = (globalThis as { location?: { origin: string; href: string } }).location;
  sw.register("/sw.js")
    .then(() => sw.ready)
    .then((reg) => {
      const perf = (
        globalThis as {
          performance?: { getEntriesByType?: (t: string) => Array<{ name: string }> };
        }
      ).performance;
      const resources =
        perf && perf.getEntriesByType ? perf.getEntriesByType("resource") : [];
      const urls = [loc ? loc.href : "/", loc ? `${loc.origin}/` : "/"].concat(
        resources.map((r) => r.name).filter((u) => !!loc && u.startsWith(loc.origin))
      );
      if (reg.active) reg.active.postMessage({ type: "precache", urls });
    })
    .catch(() => {});
}
