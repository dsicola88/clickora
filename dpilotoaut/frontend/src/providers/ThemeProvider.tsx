import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "paid-autopilot-theme";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default to dark per spec.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme = stored === "light" || stored === "dark" ? stored : "dark";
    setThemeState(initial);
    applyThemeClass(initial);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, t);
    }
    applyThemeClass(t);
  };

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
