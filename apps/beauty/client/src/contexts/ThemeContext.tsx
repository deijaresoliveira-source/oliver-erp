import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";
export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  switchable?: boolean;
}

const STORAGE_KEY = "theme";

function resolverTemaAutomatico(): Theme {
  if (typeof window === "undefined") return "dark";

  // Automático por horário:
  // 06:00 às 17:59 = claro
  // 18:00 às 05:59 = escuro
  const hora = new Date().getHours();
  return hora >= 6 && hora < 18 ? "light" : "dark";
}

function aplicarTema(theme: Theme) {
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  switchable = true,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return defaultTheme;

    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }

    return defaultTheme;
  });

  const [theme, setTheme] = useState<Theme>(() => {
    if (mode === "system") return resolverTemaAutomatico();
    return mode;
  });

  const setMode = (novoModo: ThemeMode) => {
    setModeState(novoModo);
    localStorage.setItem(STORAGE_KEY, novoModo);
  };

  useEffect(() => {
    const atualizarTema = () => {
      const temaResolvido: Theme = mode === "system" ? resolverTemaAutomatico() : mode;
      setTheme(temaResolvido);
      aplicarTema(temaResolvido);
      document.documentElement.setAttribute("data-theme-mode", mode);
    };

    atualizarTema();

    if (mode !== "system") return;

    const timer = window.setInterval(atualizarTema, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [mode]);

  const toggleTheme = switchable
    ? () => {
        setMode(mode === "dark" ? "light" : "dark");
      }
    : undefined;

  const value = useMemo(
    () => ({
      theme,
      mode,
      setMode,
      toggleTheme,
      switchable,
    }),
    [theme, mode, switchable]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
