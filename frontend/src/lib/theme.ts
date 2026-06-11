export type Theme = "dark" | "light";

const KEY = "bonner-theme";

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(KEY);
  return v === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}
