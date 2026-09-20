import type { UITheme } from "../_shared/tokens";

export const THEME_CYBERPUNK: UITheme = {
  id: "sc3ne_it",
  name: "sc3ne_it",
  sfBase: "#050403",
  sfPrimary: "#080604",
  sfRaised: "#241b12",
  sfBorder: "#d26414",
  sfBorderSecondary: "#aa4b0a",
  txPrimary: "#fff5d2",
  txSecondary: "#ffc850",
  txMuted: "#c8a028",
  txFaint: "#8c6e1e",
  ac300: "#ffc867",
  ac400: "#ff9500",
  ac500: "#cc7700",
  ac600: "#995900",
  borderRadius: "2px",
  panelShadow: "0 0 20px rgba(255,149,0,.08), 0 0 2px rgba(255,149,0,.15)",
  glow: "rgba(255,149,0,.6)",
  fontUI: "'Share Tech Mono', 'JetBrains Mono', 'Fira Code', monospace",
  fontMono: "'Share Tech Mono', 'JetBrains Mono', 'Fira Code', monospace",
  scrollThumb: "#4a3a0e",
  scrollThumbHover: "#cc7700",
};

export interface CyberpunkFont {
  id: string;
  name: string;
  stack: string;
  display?: string;
  pixel?: boolean;
}

export const CYBERPUNK_FONTS: CyberpunkFont[] = [
  { id: "share-tech-mono", name: "Share Tech Mono", stack: "'Share Tech Mono', 'JetBrains Mono', 'Fira Code', monospace" },
  { id: "orbitron", name: "Orbitron", stack: "'Orbitron', 'Share Tech Mono', sans-serif" },
  { id: "vt323", name: "VT323", stack: "'VT323', 'Share Tech Mono', monospace", pixel: true },
  { id: "space-mono", name: "Space Mono", stack: "'Space Mono', 'JetBrains Mono', monospace" },
  { id: "silkscreen", name: "Silkscreen", stack: "'Silkscreen', 'VT323', monospace", pixel: true },
  { id: "pixelify-sans", name: "Pixelify Sans", stack: "'Pixelify Sans', 'VT323', sans-serif", pixel: true },
  { id: "vt323-space", name: "VT323 + Space", stack: "'Space Mono', 'JetBrains Mono', monospace", display: "'VT323', monospace", pixel: true },
  { id: "orbitron-space", name: "Orbitron + Space", stack: "'Space Mono', 'JetBrains Mono', monospace", display: "'Orbitron', sans-serif" },
];
