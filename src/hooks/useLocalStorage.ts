import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { loadState, saveState } from '../utils/storage';
import type { AppState } from '../types/appTypes';

function useLocalStorageState(
  normalizeState: (state: Partial<AppState>) => AppState
): [AppState, Dispatch<SetStateAction<AppState>>] {
  const [state, setState] = useState<AppState>(() => {
    const raw = loadState();
    return normalizeState(raw);
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  return [state, setState];
}

export default useLocalStorageState;
