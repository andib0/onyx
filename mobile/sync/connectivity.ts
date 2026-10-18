// focusManager + onlineManager wiring (Bet 1). No NetInfo in the deps, so
// "online" means "the last request reached the API": a failure flips the app
// offline (queries pause, cached data stays) and a cheap /health probe flips it
// back; browser online/offline events and app foregrounding also count.
import { AppState as RNAppState } from "react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";

import { API_BASE, onNetworkResult, REQUEST_TIMEOUT_MS } from "../api/client";

const PROBE_INTERVAL_MS = 15_000;
let installed = false;

async function probe(): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function setupConnectivity() {
  if (installed) return;
  installed = true;

  focusManager.setEventListener((handleFocus) => {
    const sub = RNAppState.addEventListener("change", (s) => handleFocus(s === "active"));
    return () => sub.remove();
  });

  onlineManager.setEventListener((setOnline) => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const stopProbe = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const tryProbe = async () => {
      if (await probe()) {
        stopProbe();
        setOnline(true);
      }
    };
    const startProbe = () => {
      if (!timer) timer = setInterval(tryProbe, PROBE_INTERVAL_MS);
    };
    const unsubNet = onNetworkResult((reachable) => {
      if (reachable) {
        stopProbe();
        if (!onlineManager.isOnline()) setOnline(true);
      } else if (onlineManager.isOnline()) {
        setOnline(false);
        startProbe();
      }
    });
    const appSub = RNAppState.addEventListener("change", (s) => {
      if (s === "active" && !onlineManager.isOnline()) tryProbe();
    });
    const w = globalThis as {
      addEventListener?: (e: string, cb: () => void) => void;
      removeEventListener?: (e: string, cb: () => void) => void;
    };
    const onOnline = () => tryProbe();
    const onOffline = () => {
      setOnline(false);
      startProbe();
    };
    if (w.addEventListener) {
      w.addEventListener("online", onOnline);
      w.addEventListener("offline", onOffline);
    }
    return () => {
      stopProbe();
      unsubNet();
      appSub.remove();
      if (w.removeEventListener) {
        w.removeEventListener("online", onOnline);
        w.removeEventListener("offline", onOffline);
      }
    };
  });
}
