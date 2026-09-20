"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackThemeSwitch } from "@/lib/analytics";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import { W95CloseGlyph } from "@/themes/win95/icons";
import {
  type UITheme,
  UI_THEMES,
  THEME_DEFAULT,
  applyUITheme,
  saveUITheme,
  loadSavedUITheme,
  SCENIT_FONTS,
  applyScenitFont,
  loadSavedScenitFont,
  type ScenitHlMode,
  applyScenitHlMode,
  loadSavedScenitHlMode,
} from "@/themes";
import IconButton from "./IconButton";

interface ThemeEditorProps {
  onClose: () => void;
}

function ThemePreviewCard({
  theme,
  active,
  onSelect,
  boxStyle,
}: {
  theme: UITheme;
  active: boolean;
  onSelect: () => void;
  boxStyle?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group flex flex-col overflow-hidden border-2 transition-all",
        boxStyle ? "rounded-sm" : "rounded-md",
        active
          ? "border-accent-500 shadow-lg"
          : "border-surface-border hover:border-surface-border-secondary"
      )}
      title={theme.name}
    >
      {/* Mini preview */}
      <div
        className="relative h-16 w-full"
        style={{ backgroundColor: theme.sfBase }}
      >
        {/* Simulated toolbar */}
        <div
          className="flex items-center gap-1 px-1.5 py-1"
          style={{
            backgroundColor: theme.sfPrimary,
            borderBottom: `1px solid ${theme.sfBorder}`,
          }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: theme.ac400 }}
          />
          <div
            className="h-1 w-8 rounded-sm opacity-60"
            style={{ backgroundColor: theme.txSecondary }}
          />
          <div className="flex-1" />
          <div
            className="h-1 w-4 rounded-sm opacity-40"
            style={{ backgroundColor: theme.txMuted }}
          />
        </div>
        {/* Simulated panels */}
        <div className="flex h-full gap-px p-1">
          <div
            className="w-6 rounded-sm"
            style={{ backgroundColor: theme.sfPrimary }}
          />
          <div className="flex-1" />
          <div
            className="w-5 rounded-sm"
            style={{ backgroundColor: theme.sfPrimary }}
          />
        </div>
        {/* Accent color bar */}
        <div
          className="absolute bottom-0 left-0 h-0.5 w-full"
          style={{ backgroundColor: theme.ac500 }}
        />
      </div>
      {/* Label */}
      <div
        className="flex items-center justify-center py-1.5"
        style={{ backgroundColor: theme.sfPrimary }}
      >
        <span
          className="text-[10px] font-medium"
          style={{ color: active ? theme.ac400 : theme.txSecondary }}
        >
          {theme.name}
        </span>
      </div>
    </button>
  );
}

export default function ThemeEditor({ onClose }: ThemeEditorProps) {
  const cap = useThemeCapabilities();
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isAim = cap.layoutShell === "xp-desktop";
  const [activeId, setActiveId] = useState("default");
  const [scenitFontId, setScenitFontId] = useState("space-grotesk");
  const [scenitHlMode, setScenitHlMode] = useState<ScenitHlMode>("cross");

  useEffect(() => {
    const saved = loadSavedUITheme();
    if (saved) {
      setActiveId(saved.id);
    }
    setScenitFontId(loadSavedScenitFont());
    setScenitHlMode(loadSavedScenitHlMode());
  }, []);

  const handleSelect = useCallback((theme: UITheme) => {
    setActiveId(theme.id);
    applyUITheme(theme);
    saveUITheme(theme.id);
    trackThemeSwitch(theme.id);
    if (theme.id === "scenit") {
      const savedFont = loadSavedScenitFont();
      applyScenitFont(savedFont);
      setScenitFontId(savedFont);
      const savedHl = loadSavedScenitHlMode();
      applyScenitHlMode(savedHl);
      setScenitHlMode(savedHl);
    }
    const root = document.documentElement;
    root.removeAttribute("data-cp-pixel");
    root.removeAttribute("data-cp-display");
    root.style.removeProperty("--font-display");
  }, []);

  const handleFontChange = useCallback((fontId: string) => {
    setScenitFontId(fontId);
    applyScenitFont(fontId);
  }, []);

  const handleHlModeChange = useCallback((mode: ScenitHlMode) => {
    setScenitHlMode(mode);
    applyScenitHlMode(mode);
  }, []);

  return (
    <div className={cn(
      "scenit-theme-editor w-72 flex flex-col animate-slide-down",
      isWin95 ? "win95-window"
        : isAim || isWinamp ? ""
        : "rounded-theme backdrop-blur-md border border-surface-border bg-surface-primary/95 shadow-panel gap-3 p-3"
    )} style={isAim ? {
      background: "linear-gradient(180deg, #0077DE 0%, #005BD8 30px, #0831D9 60px, #0831D9 calc(100% - 30px), #021E80 100%)",
      borderRadius: "8px 8px 4px 4px",
      boxShadow: "0 0 0 1px rgba(2,48,144,.35), 0 3px 12px rgba(0,0,0,.35)",
      overflow: "hidden",
    } : isWinamp ? {
      background: "linear-gradient(180deg, #BFC6D2 0%, #C5CAD5 14%, #CFD1DB 75%, #D0D2DB 88%, #D0D2DB 94%, #CED0DA 100%)",
      border: "1.5px solid #000000",
      borderRadius: "4px",
      boxShadow: "0 2px 0 rgba(255,255,255,0.75) inset, 0 3px 0 rgba(255,255,255,0.45) inset, 2px 0 0 rgba(255,255,255,0.55) inset, -2px 0 0 rgba(255,255,255,0.40) inset, 0 -1px 0 rgba(0,0,0,0.48) inset, 0 -2px 0 rgba(0,0,0,0.15) inset, 0 3px 10px rgba(0,0,0,0.5)",
      overflow: "hidden",
    } : undefined}>
      {isAim ? (
        <div className="flex w-full items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted" style={{
          background: "radial-gradient(ellipse 55% 2px at 50% 2px, rgba(30,150,255,.55) 0%, transparent 100%), radial-gradient(ellipse 60% 7px at 50% 0%, #0098EA 0%, #0088E6 60%, transparent 100%), linear-gradient(180deg, #0A6DD8 0%, #0553B2 40%, #0440A0 60%, #063EA0 80%, #0831A0 100%)",
          borderRadius: "8px 8px 0 0",
          color: "#fff",
          textShadow: "1px 1px 2px rgba(0,0,0,.5)",
        }}>
          <span className="flex-1 text-left" style={{ color: "#fff", fontWeight: "bold", fontSize: "13px" }}>Theme</span>
          <span className="ml-auto flex aim-titlebar-btns">
            <button onClick={onClose} className="aim-titlebar-btn aim-titlebar-btn-blue" title="Minimize">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="8" width="6" height="2" rx="0.5" fill="#fff" />
              </svg>
            </button>
            <button onClick={onClose} className="aim-titlebar-btn aim-titlebar-btn-blue" title="Maximize">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="2" width="8" height="2" rx="0.5" fill="#fff" />
                <rect x="2" y="2" width="8" height="8" rx="0.5" stroke="#fff" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            <button onClick={onClose} className="aim-titlebar-btn aim-titlebar-btn-red" title="Close">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3l6 6M9 3l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        </div>
      ) : isWinamp ? (
        <div className="flex w-full items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
          <span className="winamp-header-groove flex-1" />
          <span className="shrink-0">Theme</span>
          <span className="winamp-header-groove flex-1" />
          <span className="ml-1 flex winamp-titlebar-btns">
            <button onClick={onClose} className="winamp-titlebar-btn" title="Close">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" /></svg>
            </button>
          </span>
        </div>
      ) : isWin95 ? (
        <div className="flex w-full items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted" data-section="theme">
          <span className="flex-1 text-left">Theme</span>
          <span className="ml-auto flex win95-titlebar-btns">
            <button onClick={onClose} className="win95-titlebar-btn" title="Close">
              <W95CloseGlyph />
            </button>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between" data-section="theme">
          <span className="text-[11px] font-medium uppercase tracking-wider text-content-muted">
            Theme
          </span>
          <IconButton size="xs" onClick={onClose}>
            <ThemeIcon icon={X} className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      )}

      <div className={isWin95 || isAim || isWinamp ? "flex flex-col gap-3 p-3" : "contents"} style={isAim ? {
        margin: "0 3px 3px 3px",
        backgroundColor: "#ECE9D8",
        borderRadius: "0 0 2px 2px",
      } : isWinamp ? {
        borderTop: "1px solid rgba(255,255,255,0.90)",
        padding: "6px 8px 8px",
      } : undefined}>
        <div className="grid grid-cols-2 gap-2">
          {UI_THEMES.map((theme) => (
            <ThemePreviewCard
              key={theme.id}
              theme={theme}
              active={activeId === theme.id}
              onSelect={() => handleSelect(theme)}
              boxStyle={isWinamp || isWin95}
            />
          ))}
        </div>

        <p className="text-center text-[9px] text-content-faint">
          Themes change all UI colors, borders, and effects
        </p>
      </div>
    </div>
  );
}
