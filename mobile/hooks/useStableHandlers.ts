import { useInsertionEffect, useMemo, useRef } from "react";

type AnyFn = (...args: any[]) => any;

/**
 * Returns wrappers with a permanent identity that always call the latest
 * implementation. Lets a provider expose mutators (which close over fresh state
 * every render) without changing its context value on every render.
 *
 * Handlers must not be called during render (they are event/effect callbacks).
 * The set of keys must stay the same for the life of the component.
 */
export default function useStableHandlers<T extends Record<string, AnyFn>>(
  handlers: T
): T {
  const latest = useRef(handlers);
  useInsertionEffect(() => {
    latest.current = handlers;
  });
  return useMemo(() => {
    const stable = {} as Record<string, AnyFn>;
    for (const key of Object.keys(latest.current)) {
      stable[key] = (...args: unknown[]) => latest.current[key](...args);
    }
    return stable as T;
  }, []);
}
