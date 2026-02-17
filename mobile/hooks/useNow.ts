import { useEffect, useState } from "react";
import { getNowMinutes } from "../utils/time";
import { TIMELINE_POLL_INTERVAL_MS } from "../constants";

export default function useNow(): number {
  const [nowMinutes, setNowMinutes] = useState(() => getNowMinutes());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMinutes(getNowMinutes());
    }, TIMELINE_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  return nowMinutes;
}
