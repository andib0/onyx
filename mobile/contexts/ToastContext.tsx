import { createContext, useContext, type ReactNode } from "react";
import useToast, { type ToastType } from "../hooks/useToast";
import Toast from "../components/ui/Toast";

interface ToastContextType {
  toastMessage: string;
  toastVisible: boolean;
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toastMessage, toastType, toastVisible, showToast } = useToast();

  return (
    <ToastContext.Provider value={{ toastMessage, toastVisible, showToast }}>
      {children}
      <Toast message={toastMessage} type={toastType} visible={toastVisible} />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastContext must be used within a ToastProvider");
  }
  return context;
}
