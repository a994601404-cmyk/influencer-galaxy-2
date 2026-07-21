// Dual theme (light default / dark) with localStorage persistence.
// The <html> element carries the "dark" class when dark theme is active;
// CSS variables in index.css switch on that class.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ig-theme";

export type Theme = "light" | "dark";

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* ignore */ }
  return "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
