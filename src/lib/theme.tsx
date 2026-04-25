import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PaperTheme = "paper" | "sepia" | "ink";
export type Density = "compact" | "regular" | "comfy";

const THEME_KEY = "pb.theme";
const DENSITY_KEY = "pb.density";
const SERIF_KEY = "pb.serifAll";

const DEFAULT_THEME: PaperTheme = "paper";
const DEFAULT_DENSITY: Density = "regular";
const DEFAULT_SERIF = false;

const THEMES: PaperTheme[] = ["paper", "sepia", "ink"];
const DENSITIES: Density[] = ["compact", "regular", "comfy"];

function safeRead<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / disabled storage
  }
}

interface ThemeContextValue {
  theme: PaperTheme;
  density: Density;
  serifEverywhere: boolean;
  setTheme: (t: PaperTheme) => void;
  setDensity: (d: Density) => void;
  setSerifEverywhere: (on: boolean) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<PaperTheme>(() =>
    safeRead<PaperTheme>(
      THEME_KEY,
      DEFAULT_THEME,
      (v): v is PaperTheme => typeof v === "string" && (THEMES as string[]).includes(v),
    ),
  );
  const [density, setDensityState] = useState<Density>(() =>
    safeRead<Density>(
      DENSITY_KEY,
      DEFAULT_DENSITY,
      (v): v is Density => typeof v === "string" && (DENSITIES as string[]).includes(v),
    ),
  );
  const [serifEverywhere, setSerifEverywhereState] = useState<boolean>(() =>
    safeRead<boolean>(SERIF_KEY, DEFAULT_SERIF, (v): v is boolean => typeof v === "boolean"),
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("serif-everywhere", serifEverywhere);
  }, [serifEverywhere]);

  const setTheme = useCallback((t: PaperTheme) => {
    setThemeState(t);
    safeWrite(THEME_KEY, t);
  }, []);
  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    safeWrite(DENSITY_KEY, d);
  }, []);
  const setSerifEverywhere = useCallback((on: boolean) => {
    setSerifEverywhereState(on);
    safeWrite(SERIF_KEY, on);
  }, []);
  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const idx = THEMES.indexOf(prev);
      const next = THEMES[(idx + 1) % THEMES.length];
      safeWrite(THEME_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      density,
      serifEverywhere,
      setTheme,
      setDensity,
      setSerifEverywhere,
      cycleTheme,
    }),
    [theme, density, serifEverywhere, setTheme, setDensity, setSerifEverywhere, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
