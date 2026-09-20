export type ThemeId =
  | "default"
  | "sc3ne_it"
  | "winamp"
  | "win95"
  | "scenit"
  | "sciin_it"
  | "xX_sCeNeIt_Xx";

export interface UITheme {
  id: ThemeId;
  name: string;

  /** Surfaces */
  sfBase: string;
  sfPrimary: string;
  sfRaised: string;
  sfBorder: string;
  sfBorderSecondary: string;

  /** Text */
  txPrimary: string;
  txSecondary: string;
  txMuted: string;
  txFaint: string;

  /** Accent (replaces old brand colors) */
  ac300: string;
  ac400: string;
  ac500: string;
  ac600: string;

  /** Geometry & effects */
  borderRadius: string;
  panelShadow: string;
  glow: string;

  /** Fonts */
  fontUI: string;
  fontMono: string;

  /** Scrollbar */
  scrollThumb: string;
  scrollThumbHover: string;
}

const STORAGE_KEY = "gsv-ui-theme";

export function hexToRgbTriple(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

export function rgbTripleToHex(triple: string): string {
  const [r, g, b] = triple.trim().split(/\s+/).map(Number);
  return "#" + [r, g, b]
    .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
    .join("");
}

const RGB_VARS: (keyof UITheme)[] = [
  "sfBase",
  "sfPrimary",
  "sfRaised",
  "sfBorder",
  "sfBorderSecondary",
  "txPrimary",
  "txSecondary",
  "txMuted",
  "txFaint",
  "ac300",
  "ac400",
  "ac500",
  "ac600",
  "scrollThumb",
  "scrollThumbHover",
];

const RAW_VARS: (keyof UITheme)[] = [
  "borderRadius",
  "panelShadow",
  "glow",
  "fontUI",
  "fontMono",
];

function varName(key: string): string {
  return "--" + key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();
}

export function applyUITheme(theme: UITheme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.id);

  for (const key of RGB_VARS) {
    root.style.setProperty(varName(key), hexToRgbTriple(theme[key] as string));
  }
  for (const key of RAW_VARS) {
    root.style.setProperty(varName(key), theme[key] as string);
  }

  let styleEl = document.getElementById("gsv-theme-vars") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "gsv-theme-vars";
    document.head.appendChild(styleEl);
  }
  const decls: string[] = [];
  for (const key of RGB_VARS) {
    decls.push(`${varName(key)}: ${hexToRgbTriple(theme[key] as string)} !important`);
  }
  for (const key of RAW_VARS) {
    decls.push(`${varName(key)}: ${theme[key] as string} !important`);
  }
  styleEl.textContent = `html { ${decls.join("; ")}; }`;
}

export function saveUITheme(themeId: ThemeId): void {
  localStorage.setItem(STORAGE_KEY, themeId);
}

export function getAccentHex(shade: "300" | "400" | "500" | "600"): string {
  const key = `ac${shade}` as const;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName(key))
    .trim();
  if (!raw) {
    // Fallback: return the default theme value (imported at registry level)
    return "";
  }
  return rgbTripleToHex(raw);
}

export function getThemeVar(key: keyof UITheme): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName(key))
    .trim();
}

export function getCurrentThemeId(): ThemeId {
  return (document.documentElement.getAttribute("data-theme") ?? "default") as ThemeId;
}
