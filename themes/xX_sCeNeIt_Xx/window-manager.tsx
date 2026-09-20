"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { publicUrl } from "@/lib/utils";

export interface WindowState {
  id: string;
  title: string;
  icon?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: number;
  preMaximize?: { x: number; y: number; width: number; height: number };
}

interface WindowManagerContextValue {
  windows: WindowState[];
  focusedId: string | null;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number, x?: number, y?: number) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  taskbarHeight: number;
}

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error("useWindowManager must be used within WindowManagerProvider");
  return ctx;
}

export function useWindow(id: string) {
  const ctx = useWindowManager();
  const win = ctx.windows.find((w) => w.id === id);
  return { win, ...ctx };
}

const TASKBAR_HEIGHT = 36;
const STORAGE_KEY = "xp-window-positions-v20";

export interface WindowDefinition {
  id: string;
  title: string;
  icon?: string;
  defaultX: (sw: number, sh: number) => number;
  defaultY: (sw: number, sh: number) => number;
  defaultWidth: (sw: number, sh: number) => number;
  defaultHeight: (sw: number, sh: number) => number;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: number;
}

function computeDefaults(defs: WindowDefinition[], sw: number, sh: number): WindowState[] {
  return defs.map((d, i) => ({
    id: d.id,
    title: d.title,
    icon: d.icon,
    x: Math.round(d.defaultX(sw, sh)),
    y: Math.round(d.defaultY(sw, sh)),
    width: Math.round(d.defaultWidth(sw, sh)),
    height: Math.round(d.defaultHeight(sw, sh)),
    zIndex: 10 + i,
    minimized: false,
    maximized: false,
    minWidth: d.minWidth ?? 200,
    minHeight: d.minHeight ?? 100,
    aspectRatio: d.aspectRatio,
  }));
}

function loadSaved(): Record<string, Partial<WindowState>> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSerialized(windows: WindowState[]) {
  try {
    const data: Record<string, Partial<WindowState>> = {};
    for (const w of windows) {
      data[w.id] = { x: w.x, y: w.y, width: w.width, height: w.height, minimized: w.minimized, maximized: w.maximized };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

const LEFT_W = 240;
const RIGHT_W = 320;
const GAP = 6;

const VP_CHROME_H = 160;
const TIMELINE_H = 160;

function viewportSize(sw: number, sh: number): { w: number; h: number } {
  const maxW = sw - LEFT_W - RIGHT_W - GAP * 4;
  const maxH = sh - TASKBAR_HEIGHT - TIMELINE_H - GAP * 4;
  const contentFromW = maxW;
  const hFromW = Math.round(contentFromW * 9 / 16) + VP_CHROME_H;
  if (hFromW <= maxH) return { w: maxW, h: hFromW };
  const contentH = maxH - VP_CHROME_H;
  const wFromH = Math.round(contentH * 16 / 9);
  return { w: Math.min(wFromH, maxW), h: maxH };
}

export const WINDOW_DEFS: WindowDefinition[] = [
  {
    id: "viewport",
    title: "Viewport",
    icon: publicUrl("/icons/aim/xp-camera.png"),
    defaultX: () => LEFT_W + GAP * 2,
    defaultY: () => GAP,
    defaultWidth: (sw, sh) => viewportSize(sw, sh).w,
    defaultHeight: (sw, sh) => viewportSize(sw, sh).h,
    minWidth: 400,
    minHeight: 200,
    aspectRatio: 16 / 9,
  },
  {
    id: "buddy-list",
    title: "Buddy List",
    icon: publicUrl("/icons/aim/running-man-16.png"),
    defaultX: () => GAP,
    defaultY: () => GAP,
    defaultWidth: () => LEFT_W,
    defaultHeight: (_sw, sh) => Math.round((sh - TASKBAR_HEIGHT - GAP * 2) * 0.78),
    minWidth: 220,
    minHeight: 200,
  },
  {
    id: "timeline",
    title: "Windows Movie Maker",
    icon: publicUrl("/icons/aim/xp-movie-reel.png"),
    defaultX: () => LEFT_W + GAP * 2,
    defaultY: (sw, sh) => GAP + viewportSize(sw, sh).h + GAP,
    defaultWidth: (sw, sh) => viewportSize(sw, sh).w,
    defaultHeight: () => TIMELINE_H,
    minWidth: 400,
    minHeight: TIMELINE_H,
  },
  {
    id: "settings",
    title: "My Preferences",
    icon: publicUrl("/icons/aim/xp-control-panel.png"),
    defaultX: (sw) => sw - RIGHT_W - GAP,
    defaultY: () => GAP,
    defaultWidth: () => RIGHT_W,
    defaultHeight: (_sw, sh) => Math.round((sh - TASKBAR_HEIGHT - GAP * 3) * 0.55),
    minWidth: 240,
    minHeight: 300,
  },
  {
    id: "floorplan",
    title: "MapQuest\u00AE",
    icon: publicUrl("/icons/aim/xp-globe.png"),
    defaultX: (sw) => sw - RIGHT_W - GAP,
    defaultY: (_sw, sh) => {
      const prefsH = Math.round((sh - TASKBAR_HEIGHT - GAP * 3) * 0.55);
      return GAP + prefsH + GAP;
    },
    defaultWidth: () => RIGHT_W,
    defaultHeight: (_sw, sh) => {
      const prefsH = Math.round((sh - TASKBAR_HEIGHT - GAP * 3) * 0.55);
      return sh - TASKBAR_HEIGHT - GAP * 3 - prefsH;
    },
    minWidth: 200,
    minHeight: 120,
  },
];

interface WindowManagerProviderProps {
  children: React.ReactNode;
  definitions?: WindowDefinition[];
}

export function WindowManagerProvider({ children, definitions = WINDOW_DEFS }: WindowManagerProviderProps) {
  const zCounterRef = useRef(100);
  const lastViewportRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    lastViewportRef.current = { w: sw, h: sh };
    const defaults = computeDefaults(definitions, sw, sh);
    const saved = loadSaved();

    if (saved) {
      for (const w of defaults) {
        const s = saved[w.id];
        if (s) {
          if (s.x !== undefined) w.x = s.x;
          if (s.y !== undefined) w.y = s.y;
          if (s.width !== undefined) w.width = s.width;
          if (s.height !== undefined) w.height = s.height;
          if (s.minimized !== undefined) w.minimized = s.minimized;
          if (s.maximized !== undefined) w.maximized = s.maximized;

          w.y = Math.max(0, Math.min(w.y, sh - 40));
          w.x = Math.max(-(w.width - 80), Math.min(w.x, sw - 80));
        }
      }
    }

    let maxZ = 10;
    for (const w of defaults) if (w.zIndex > maxZ) maxZ = w.zIndex;
    zCounterRef.current = maxZ + 1;
    setWindows(defaults);
    setInitialized(true);
  }, [definitions]);

  useEffect(() => {
    if (!initialized) return;
    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const prev = lastViewportRef.current;
        const newW = window.innerWidth;
        const newH = window.innerHeight;
        if (prev.w === 0 || prev.h === 0 || (newW === prev.w && newH === prev.h)) return;
        const scaleX = newW / prev.w;
        const scaleY = newH / prev.h;
        lastViewportRef.current = { w: newW, h: newH };
        setWindows((ws) =>
          ws.map((w) => {
            if (w.maximized) {
              return { ...w, width: newW, height: newH - TASKBAR_HEIGHT };
            }
            const scaledW = Math.max(w.minWidth ?? 200, Math.round(w.width * scaleX));
            const scaledH = Math.max(w.minHeight ?? 100, Math.round(w.height * scaleY));
            const scaledX = Math.round(w.x * scaleX);
            const scaledY = Math.max(0, Math.round(w.y * scaleY));
            return {
              ...w,
              x: Math.max(-(scaledW - 80), Math.min(scaledX, newW - 80)),
              y: Math.min(scaledY, newH - TASKBAR_HEIGHT - 40),
              width: scaledW,
              height: scaledH,
            };
          })
        );
      }, 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [initialized]);

  useEffect(() => {
    if (initialized && windows.length > 0) saveSerialized(windows);
  }, [windows, initialized]);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    const clampedY = Math.max(0, y);
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y: clampedY } : w)));
  }, []);

  const resizeWindow = useCallback((id: string, width: number, height: number, x?: number, y?: number) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const nw = Math.max(w.minWidth ?? 200, width);
        const nh = Math.max(w.minHeight ?? 100, height);
        return { ...w, width: nw, height: nh, ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) };
      }),
    );
  }, []);

  const focusWindow = useCallback((id: string) => {
    setFocusedId(id);
    setWindows((prev) => {
      const z = zCounterRef.current++;
      return prev.map((w) => (w.id === id ? { ...w, zIndex: z } : w));
    });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  const restoreWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const z = zCounterRef.current++;
      return prev.map((w) => (w.id === id ? { ...w, minimized: false, zIndex: z } : w));
    });
    setFocusedId(id);
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized) {
          const prev = w.preMaximize;
          const sw = window.innerWidth;
          const sh = window.innerHeight;
          const def = definitions.find((d) => d.id === id);
          return {
            ...w,
            maximized: false,
            preMaximize: undefined,
            x: prev?.x ?? (def ? Math.round(def.defaultX(sw, sh)) : 50),
            y: prev?.y ?? (def ? Math.round(def.defaultY(sw, sh)) : 50),
            width: prev?.width ?? (def ? Math.round(def.defaultWidth(sw, sh)) : 400),
            height: prev?.height ?? (def ? Math.round(def.defaultHeight(sw, sh)) : 300),
          };
        }
        return {
          ...w,
          maximized: true,
          preMaximize: { x: w.x, y: w.y, width: w.width, height: w.height },
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: window.innerHeight - TASKBAR_HEIGHT,
        };
      }),
    );
  }, [definitions]);

  const value: WindowManagerContextValue = {
    windows,
    focusedId,
    moveWindow,
    resizeWindow,
    focusWindow,
    minimizeWindow,
    restoreWindow,
    maximizeWindow,
    taskbarHeight: TASKBAR_HEIGHT,
  };

  if (!initialized) return null;

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
}
