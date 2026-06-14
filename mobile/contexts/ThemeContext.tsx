import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  colorScheme as initialOsScheme,
  getPalette,
  getTints,
  type Scheme,
  type Palette,
  type TintSet,
} from "../theme";

export type ThemeMode = "system" | "light" | "dark";

const MODE_KEY = "onyx_theme_mode";

interface ThemeValue {
  colors: Palette;
  tints: TintSet;
  scheme: Scheme;
  isLight: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [osScheme, setOsScheme] = useState<Scheme>(initialOsScheme);

  // Load persisted mode once
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(MODE_KEY)
      .then((value) => {
        if (
          !cancelled &&
          (value === "system" || value === "light" || value === "dark")
        ) {
          setModeState(value);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Track OS appearance changes (only matters while mode === "system")
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setOsScheme(colorScheme === "light" ? "light" : "dark");
    });
    return () => sub.remove();
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  };

  const scheme: Scheme = mode === "system" ? osScheme : mode;

  const value = useMemo<ThemeValue>(
    () => ({
      colors: getPalette(scheme),
      tints: getTints(scheme),
      scheme,
      isLight: scheme === "light",
      mode,
      setMode,
    }),
    [scheme, mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
