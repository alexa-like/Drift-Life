import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { api } from "../lib/api";

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
  /** Pull scale/theme saved on the account, once per login (userId),
   *  so a second device picks up what was set elsewhere. Safe to call
   *  on every user refresh — it no-ops once already hydrated for that id. */
  hydrateFromAccount: (userId: string, scale?: number, theme?: Theme) => void;
}

const Ctx = createContext<PreferencesCtx>({
  scale: DEFAULT_SCALE,
  setScale: () => {},
  theme: "dark",
  setTheme: () => {},
  hydrateFromAccount: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<number>(readScale);
  const [theme, setThemeState] = useState<Theme>(readTheme);
  // Tracks which account we've already pulled server-saved prefs for, and
  // (once set) also gates pushToAccount so we never save before we know
  // who's logged in (e.g. before the very first hydration on app load).
  const hydratedForUser = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Best-effort push to the account so preferences travel with the player,
  // not just this device. Debounced since the scale slider fires rapidly.
  function pushToAccount(next: { scale?: number; theme?: Theme }) {
    if (!hydratedForUser.current) return; // no logged-in user yet
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.patch("/settings", {
        ...(next.scale !== undefined ? { uiScale: next.scale } : {}),
        ...(next.theme !== undefined ? { uiTheme: next.theme } : {}),
      }).catch(() => {});
    }, 500);
  }

  function setScale(v: number) {
    const c = clampScale(v);
    localStorage.setItem(SCALE_KEY, String(c));
    setScaleState(c);
    pushToAccount({ scale: c });
  }

  function setTheme(t: Theme) {
    localStorage.setItem(THEME_KEY, t);
    setThemeState(t);
    pushToAccount({ theme: t });
  }

  // Called once per login (see App.tsx) with the values saved on the
  // account. Only applies the very first time for a given user id so it
  // never fights with a change the player makes mid-session.
  function hydrateFromAccount(userId: string, accountScale?: number, accountTheme?: Theme) {
    if (hydratedForUser.current === userId) return;
    hydratedForUser.current = userId;
    if (accountScale !== undefined) {
      const c = clampScale(accountScale);
      localStorage.setItem(SCALE_KEY, String(c));
      setScaleState(c);
    }
    if (accountTheme === "dark" || accountTheme === "light") {
      localStorage.setItem(THEME_KEY, accountTheme);
      setThemeState(accountTheme);
    }
  }

  // Apply theme class to <html> so CSS can target [data-theme="light"]
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Apply zoom to <html> — NOT to a child div — so that position:fixed elements
  // (the NavBar) scale correctly relative to the viewport on mobile Chrome.
  //
  // `zoom` visually shrinks/grows the rendered page but does NOT change how
  // much layout space the page occupies (window.innerHeight is unaffected).
  // At scale < 1 that leaves a dead strip below the shrunk page showing raw
  // browser canvas (black) instead of the app background. Fix: also publish
  // the inverse scale as --dl-scale so min-height:calc(100dvh/var(--dl-scale))
  // rules (see index.css) inflate the pre-zoom box just enough that, once
  // zoomed, it exactly fills the real viewport again.
  useEffect(() => {
    document.documentElement.style.zoom = String(scale);
    document.documentElement.style.setProperty("--dl-scale", String(scale));
    return () => {
      document.documentElement.style.removeProperty("zoom");
      document.documentElement.style.removeProperty("--dl-scale");
    };
  }, [scale]);

  return (
    <Ctx.Provider value={{ scale, setScale, theme, setTheme, hydrateFromAccount }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePreferences() {
  return useContext(Ctx);
}
