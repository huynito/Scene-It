declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag(...args);
  }
}

export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  gtag("event", name, params);
}

export function trackSceneLoad(sceneName: string) {
  trackEvent("scene_load", { scene_name: sceneName });
}

export function trackExport(
  format: "mp4" | "gif" | "png" | "jpg",
  resolution?: string,
  durationSec?: number
) {
  trackEvent("export", {
    export_format: format,
    ...(resolution && { resolution }),
    ...(durationSec != null && { duration_sec: Math.round(durationSec) }),
  });
}

export function trackThemeSwitch(themeId: string) {
  trackEvent("theme_switch", { theme_id: themeId });
}

export function trackAnchorCreate(mediaType: string) {
  trackEvent("anchor_create", { media_type: mediaType });
}

export function trackPathPlay() {
  trackEvent("path_play");
}
