import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Theme = "dark" | "light";

const SCALE_KEY = "dl_ui_scale";
const THEME_KEY = "dl_theme";
export const DEFAULT_SCALE = 0.85;
export const MIN_SCALE = 0.6;
export const MAX_SCALE = 1.2;

function clampScale(v: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
}
function readScale(): number {
  const v = parseFloat(localStorage.getItem(SCALE_KEY) ?? "");
  return isNaN(v) ? DEFAULT_SCALE : clampScale(v);
}
function readTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

interface PreferencesCtx {
  scale: number;
  setScale: (v: number) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<PreferencesCtx>({
  scale: DEFAULT_SCALE,
  setScale: () => {},
  theme: "dark",
  setTheme: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<number>(readScale);
  const [theme, setThemeState] = useState<Theme>(readTheme);

  function setScale(v: number) {
    const c = clampScale(v);
    localStorage.setItem(SCALE_KEY, String(c));
    setScaleState(c);
  }

  function setTheme(t: Theme) {
    localStorage.setItem(THEME_KEY, t);
    setThemeState(t);
  }

  // Apply theme class to <html> so CSS can target [data-theme="light"]
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <Ctx.Provider value={{ scale, setScale, theme, setTheme }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePreferences() {
  return useContext(Ctx);
}
