"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "actis-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemPreference, setSystemPreference] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // 1. Initial mount: Read stored preference & system media query
  useEffect(() => {
    setMounted(true);

    // Deteksi media query OS
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPreference(mediaQuery.matches ? "dark" : "light");

    const handleSystemChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleSystemChange);

    // Baca localStorage jika ada
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, []);

  // 2. Hitung resolvedTheme
  const resolvedTheme: "light" | "dark" = useMemo(() => {
    if (theme === "system") {
      return systemPreference;
    }
    return theme;
  }, [theme, systemPreference]);

  // 3. Terapkan kelas 'dark' ke <html> dan sinkronkan color-scheme
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }

    // Perbarui meta tag color-scheme untuk browser UI
    let metaTheme = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    if (!metaTheme) {
      metaTheme = document.createElement("meta");
      metaTheme.name = "color-scheme";
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = theme === "system" ? "light dark" : resolvedTheme;
  }, [resolvedTheme, theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (newTheme === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }
  };

  const toggleTheme = () => {
    // Jika saat ini dark, ganti ke light. Jika light, ganti ke dark.
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

