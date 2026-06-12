import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

// Local-only water counter, keyed per date
export default function useWater(todayKeyValue: string) {
  const [waterMl, setWaterMl] = useState(0);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(`onyx_water_${todayKeyValue}`)
      .then((value) => {
        if (!cancelled) setWaterMl(Number(value) || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [todayKeyValue]);

  const addWater = useCallback(
    (amountMl: number) => {
      Haptics.selectionAsync().catch(() => {});
      setWaterMl((prev) => {
        const next = Math.max(prev + amountMl, 0);
        AsyncStorage.setItem(`onyx_water_${todayKeyValue}`, String(next)).catch(
          () => {}
        );
        return next;
      });
    },
    [todayKeyValue]
  );

  return { waterMl, addWater };
}
