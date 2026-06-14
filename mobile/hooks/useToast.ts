import { useEffect, useRef, useState } from "react";
import { TOAST_DURATION_MS } from "../constants";

export type ToastType = "success" | "error";

// Classify a toast from its copy so call sites stay simple; callers can still
// pass an explicit type to override.
function classify(message: string): ToastType {
  return /couldn'?t|can'?t|cannot|failed|try again|needs a|at least|enable .* first|invalid|no /i.test(
    message
  )
    ? "error"
    : "success";
}

function useToast() {
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("success");
  const [toastVisible, setToastVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const showToast = (message: string, type?: ToastType) => {
    setToastMessage(message);
    setToastType(type ?? classify(message));
    setToastVisible(true);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, TOAST_DURATION_MS);
  };

  return {
    toastMessage,
    toastType,
    toastVisible,
    showToast,
  };
}

export default useToast;
