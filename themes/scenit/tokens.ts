import type { UITheme } from "../_shared/tokens";

export const THEME_SCENIT: UITheme = {
  id: "scenit",
  name: "scēnit",
  sfBase: "#00E5CC",
  sfPrimary: "#FFFFFF",
  sfRaised: "#E0FAF6",
  sfBorder: "#222222",
  sfBorderSecondary: "#FF006E",
  txPrimary: "#1A3038",
  txSecondary: "#2D5058",
  txMuted: "#6B9098",
  txFaint: "#A0BCC4",
  ac300: "#FF5C9E",
  ac400: "#FF006E",
  ac500: "#D4005C",
  ac600: "#AA004A",
  borderRadius: "0px",
  panelShadow: "4px 0 0 #222222, 0 4px 0 #222222, 4px 4px 0 #222222",
  glow: "transparent",
  fontUI: "'Space Grotesk', system-ui, -apple-system, sans-serif",
  fontMono: "'Space Mono', 'JetBrains Mono', monospace",
  scrollThumb: "#00E5CC",
  scrollThumbHover: "#00CCBB",
};

export interface ScenitFont {
  id: string;
  name: string;
  family: string;
}

export const SCENIT_FONTS: ScenitFont[] = [
  { id: "space-grotesk", name: "Space Grotesk", family: "'Space Grotesk', system-ui, sans-serif" },
  { id: "syne", name: "Syne", family: "'Syne', system-ui, sans-serif" },
  { id: "outfit", name: "Outfit", family: "'Outfit', system-ui, sans-serif" },
  { id: "bricolage", name: "Bricolage Grotesque", family: "'Bricolage Grotesque', system-ui, sans-serif" },
  { id: "archivo-black", name: "Archivo Black", family: "'Archivo Black', system-ui, sans-serif" },
  { id: "bebas-neue", name: "Bebas Neue", family: "'Bebas Neue', system-ui, sans-serif" },
];

export const SCENIT_MONO_FONTS: ScenitFont[] = [
  { id: "space-mono", name: "Space Mono", family: "'Space Mono', monospace" },
  { id: "azeret-mono", name: "Azeret Mono", family: "'Azeret Mono', monospace" },
  { id: "jetbrains-mono", name: "JetBrains Mono", family: "'JetBrains Mono', monospace" },
];

const SCENIT_FONT_KEY = "gsv-scenit-font";

export function applyScenitFont(fontId: string): void {
  const font = SCENIT_FONTS.find((f) => f.id === fontId);
  if (!font) return;
  const root = document.documentElement;
  root.style.setProperty("--font-ui", font.family);
  localStorage.setItem(SCENIT_FONT_KEY, fontId);

  const styleEl = document.getElementById("gsv-theme-vars") as HTMLStyleElement | null;
  if (styleEl) {
    const current = styleEl.textContent ?? "";
    const updated = current.replace(/--font-ui:\s*[^;]+/, `--font-ui: ${font.family}`);
    styleEl.textContent = updated;
  }
}

export function loadSavedScenitFont(): string {
  try {
    return localStorage.getItem(SCENIT_FONT_KEY) ?? "outfit";
  } catch {
    return "outfit";
  }
}

export type ScenitHlMode = "cross" | "tonal";

const SCENIT_HL_MODE_KEY = "scenit-hl-mode";

export function applyScenitHlMode(mode: ScenitHlMode): void {
  document.documentElement.dataset.hlMode = mode;
  try {
    localStorage.setItem(SCENIT_HL_MODE_KEY, mode);
  } catch {}
}

export function loadSavedScenitHlMode(): ScenitHlMode {
  try {
    const saved = localStorage.getItem(SCENIT_HL_MODE_KEY);
    if (saved === "cross" || saved === "tonal") return saved;
  } catch {}
  return "cross";
}
