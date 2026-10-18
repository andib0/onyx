import { useEffect, useState } from "react";

// False on the first render, true once that render has been painted (next frame
// + a macrotask). Cold start: Today mounts what is above the fold first and the
// rest right after the first frame (docs/log/cold-start.md).
export default function useAfterFirstPaint(): boolean {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const raf = requestAnimationFrame(() => {
      timer = setTimeout(() => setPainted(true), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return painted;
}
