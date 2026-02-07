import { useEffect, useRef, useState } from 'react';
import { TOAST_DURATION_MS } from '../constants';

function useToast() {
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, TOAST_DURATION_MS);
  };

  return {
    toastMessage,
    toastVisible,
    showToast,
  };
}

export default useToast;
