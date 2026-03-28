import { create } from "zustand";
import { THEME_STORAGE_KEY } from "@/utils/constants";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleDarkMode: () => void;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(resolved: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

const stored = (
  typeof localStorage !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null
) as Theme | null;
const initial: Theme = stored ?? "system";
const initialResolved = resolve(initial);
applyTheme(initialResolved);

// Listen for system theme changes when in "system" mode
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const state = useThemeStore.getState();
    if (state.theme === "system") {
      const resolved = getSystemTheme();
      applyTheme(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  });
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  resolvedTheme: initialResolved,

  setTheme: (theme) => {
    const resolved = resolve(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });
  },

  toggleDarkMode: () => {
    set((state) => {
      const next: Theme = state.resolvedTheme === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);
      applyTheme(next);
      return { theme: next, resolvedTheme: next };
    });
  },
}));
