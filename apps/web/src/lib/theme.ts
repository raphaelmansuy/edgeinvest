export type Theme = "system" | "light" | "dark";
const KEY = "edge.theme";

export function applyTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export const storedTheme = (): Theme => (localStorage.getItem(KEY) as Theme | null) ?? "system";
