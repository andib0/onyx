import { createContext, useContext, useMemo, type ReactNode } from "react";
import useToast, { type ToastType } from "../hooks/useToast";
import Toast from "../components/ui/Toast";

// Two contexts: the dispatcher (stable for the app's lifetime) and the visible
// toast state. Everything that only *shows* toasts subscribes to the dispatcher,
// so a toast appearing/hiding re-renders nothing but the Toast itself.
interface ToastApi {
  showToast: (message: string, type?: ToastType) => void;
}
interface ToastState {
  toastMessage: string;
  toastVisible: boolean;
}

const ToastApiContext = createContext<ToastApi | null>(null);
const ToastStateContext = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toastMessage, toastType, toastVisible, showToast } = useToast();
  const apiValue = useMemo(() => ({ showToast }), [showToast]);
  const stateValue = useMemo(
    () => ({ toastMessage, toastVisible }),
    [toastMessage, toastVisible]
  );

  return (
    <ToastApiContext.Provider value={apiValue}>
      <ToastStateContext.Provider value={stateValue}>
        {children}
        <Toast message={toastMessage} type={toastType} visible={toastVisible} />
      </ToastStateContext.Provider>
    </ToastApiContext.Provider>
  );
}

/** `{ showToast }` — stable; never re-renders the caller. */
export function useToastContext(): ToastApi {
  const context = useContext(ToastApiContext);
  if (!context) {
    throw new Error("useToastContext must be used within a ToastProvider");
  }
  return context;
}

/** The current toast (re-renders on every show/hide). */
export function useToastState(): ToastState {
  const context = useContext(ToastStateContext);
  if (!context) {
    throw new Error("useToastState must be used within a ToastProvider");
  }
  return context;
}
