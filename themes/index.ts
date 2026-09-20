export type { ThemeId, UITheme } from "./_shared/tokens";
export {
  applyUITheme,
  saveUITheme,
  hexToRgbTriple,
  rgbTripleToHex,
  getAccentHex,
  getThemeVar,
  getCurrentThemeId,
} from "./_shared/tokens";

export { useThemeId } from "./_shared/hooks/useThemeId";
export { useThemeCapabilities } from "./_shared/hooks/useThemeCapabilities";
export { THEME_CAPABILITIES } from "./_shared/capabilities";
export type { ThemeCapabilities, CanvasColorMap, GraphColorMap } from "./_shared/capabilities";

export { THEME_DEFAULT } from "./default/tokens";
export { THEME_CYBERPUNK, CYBERPUNK_FONTS } from "./sc3ne_it/tokens";
export type { CyberpunkFont } from "./sc3ne_it/tokens";
export { THEME_WINAMP } from "./winamp/tokens";
export { THEME_WIN95 } from "./win95/tokens";
export { THEME_SCENIT, SCENIT_FONTS, SCENIT_MONO_FONTS, applyScenitFont, loadSavedScenitFont, applyScenitHlMode, loadSavedScenitHlMode } from "./scenit/tokens";
export type { ScenitFont, ScenitHlMode } from "./scenit/tokens";
export { THEME_SCIIN_IT } from "./sciin_it/tokens";
export { THEME_AIM } from "./xX_sCeNeIt_Xx/tokens";

import { THEME_DEFAULT } from "./default/tokens";
import { THEME_SCIIN_IT } from "./sciin_it/tokens";
import { THEME_WIN95 } from "./win95/tokens";
import { THEME_WINAMP } from "./winamp/tokens";
import { THEME_SCENIT } from "./scenit/tokens";
import { THEME_AIM } from "./xX_sCeNeIt_Xx/tokens";
import type { UITheme } from "./_shared/tokens";

export const UI_THEMES: UITheme[] = [
  THEME_DEFAULT,
  THEME_SCIIN_IT,
  THEME_WIN95,
  THEME_WINAMP,
  THEME_SCENIT,
  THEME_AIM,
];

export function loadSavedUITheme(): UITheme | null {
  try {
    const id = localStorage.getItem("gsv-ui-theme");
    if (!id) return null;
    return UI_THEMES.find((t) => t.id === id) ?? null;
  } catch {
    return null;
  }
}
