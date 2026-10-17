// Undo bar for 1-tap actions (Bet 8): log first, offer "Undo" for a few seconds,
// instead of a confirm dialog before the action. Two modes:
//  - immediate: the action already happened; onUndo reverts it.
//  - deferred (onCommit): the action is applied when the bar times out or is
//    replaced, so undo costs nothing (used by workout Finish).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";
import UndoBar from "../../components/shared/UndoBar";

const styles = StyleSheet.create({ root: { flex: 1 } });

export const UNDO_MS = 5000;

type UndoRequest = {
  key: string;
  message: string;
  onUndo: () => unknown;
  onCommit?: () => void;
  ms?: number;
};

type UndoApi = {
  showUndo: (req: UndoRequest) => void;
  /** Key of the deferred action waiting to commit (null when none). */
  pendingKey: string | null;
};

const UndoContext = createContext<UndoApi | null>(null);

export function UndoProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<UndoRequest | null>(null);
  const currentRef = useRef<UndoRequest | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settle = useCallback((commit: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const req = currentRef.current;
    currentRef.current = null;
    setCurrent(null);
    if (req && commit && req.onCommit) req.onCommit();
  }, []);

  const showUndo = useCallback(
    (req: UndoRequest) => {
      settle(true); // a new action commits the previous one
      currentRef.current = req;
      setCurrent(req);
      timer.current = setTimeout(() => settle(true), req.ms ?? UNDO_MS);
    },
    [settle]
  );

  const undo = useCallback(() => {
    const req = currentRef.current;
    settle(false);
    if (req) Promise.resolve(req.onUndo()).catch(() => {});
  }, [settle]);

  // Leaving the tabs (logout, onboarding) commits whatever is pending.
  useEffect(() => () => settle(true), [settle]);

  const value = useMemo<UndoApi>(
    () => ({ showUndo, pendingKey: current?.onCommit ? current.key : null }),
    [showUndo, current]
  );

  return (
    <UndoContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {current ? (
          <UndoBar
            message={current.message}
            onUndo={undo}
            onDismiss={() => settle(true)}
          />
        ) : null}
      </View>
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoApi {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error("useUndo must be used within an UndoProvider");
  return ctx;
}
