// The user's implementation intention ("I will train on [days] at [time] at
// [place]", utils/trainingIntention) persisted on the device.
//
// For the integrator: useProgram().planFor() still derives training days from the
// program's sessions/week. Today and the reminder planner already read the
// intention through this hook; the data layer should make planFor honour
// `intention.weekdays` (or persist them as program `days[].weekdays` server-side)
// so the Train tab and the score agree.
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  normalizeIntention,
  type TrainingIntention,
} from "../../utils/trainingIntention";

export const INTENTION_KEY = "onyx_training_intention_v1";

let cache: TrainingIntention | null | undefined;
const listeners = new Set<(v: TrainingIntention | null) => void>();

async function load(): Promise<TrainingIntention | null> {
  if (cache !== undefined) return cache;
  try {
    const raw = await AsyncStorage.getItem(INTENTION_KEY);
    cache = raw ? normalizeIntention(JSON.parse(raw)) : null;
  } catch {
    cache = null;
  }
  return cache;
}

export async function saveTrainingIntention(value: TrainingIntention | null) {
  cache = value ? normalizeIntention(value) : null;
  try {
    if (cache) await AsyncStorage.setItem(INTENTION_KEY, JSON.stringify(cache));
    else await AsyncStorage.removeItem(INTENTION_KEY);
  } catch {
    // device storage unavailable — keep the in-memory value for this session
  }
  listeners.forEach((l) => l(cache ?? null));
}

export default function useTrainingIntention(): TrainingIntention | null {
  const [value, setValue] = useState<TrainingIntention | null>(cache ?? null);
  useEffect(() => {
    let alive = true;
    load().then((v) => {
      if (alive) setValue(v);
    });
    listeners.add(setValue);
    return () => {
      alive = false;
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
