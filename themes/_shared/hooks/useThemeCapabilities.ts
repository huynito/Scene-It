"use client";

import { useThemeId } from "./useThemeId";
import { THEME_CAPABILITIES } from "../capabilities";
import type { ThemeCapabilities } from "../capabilities";

export function useThemeCapabilities(): ThemeCapabilities {
  const themeId = useThemeId();
  return THEME_CAPABILITIES[themeId] ?? THEME_CAPABILITIES.default;
}
