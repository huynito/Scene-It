"use client";

import { useSyncExternalStore } from "react";
import type { ThemeId } from "../tokens";

function subscribeToTheme(cb: () => void) {
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === "data-theme") {
        cb();
        break;
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true });
  return () => observer.disconnect();
}

function getThemeSnapshot(): ThemeId {
  return (document.documentElement.getAttribute("data-theme") || "default") as ThemeId;
}

function getServerSnapshot(): ThemeId {
  return "default";
}

export function useThemeId(): ThemeId {
  return useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);
}
