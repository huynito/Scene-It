"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useScene } from "@/lib/scene-context";
import Slider from "@/components/ui/Slider";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import CycleSelect from "@/components/ui/CycleSelect";

const COLOR_FILTER_OPTIONS = [
  { value: "none",         label: "None",         color: "var(--rl-white)" },
  { value: "grayscale",    label: "Grayscale",    color: "var(--rl-cyan)" },
  { value: "protanopia",   label: "Protanopia",   color: "var(--rl-green)" },
  { value: "deuteranopia", label: "Deuteranopia", color: "var(--rl-yellow)" },
  { value: "tritanopia",   label: "Tritanopia",   color: "var(--rl-magenta)" },
];

export default function PostProcessingPanel() {
  const { exposure, colorFilter, contrast, saturation, actions } = useScene();
  const cap = useThemeCapabilities();
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isScenit = cap.layoutShell === "scenit-grid";
  const isSciin = cap.usesTextControls;

  const selectedLabel = COLOR_FILTER_OPTIONS.find((o) => o.value === colorFilter)?.label ?? "None";
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  if (isWinamp) {
    return (
      <div className="winamp-postproc-layout">
        <div className="winamp-postproc-eq">
          <Slider
            label="EXP"
            value={exposure}
            min={0.1}
            max={4}
            step={0.1}
            onChange={actions.setExposure}
            onChangeStart={actions.pushUndo}
            vertical
          />
          <Slider
            label="CON"
            value={contrast}
            min={-100}
            max={100}
            step={1}
            onChange={actions.setContrast}
            onChangeStart={actions.pushUndo}
            vertical
          />
          <Slider
            label="SAT"
            value={saturation}
            min={-100}
            max={100}
            step={1}
            onChange={actions.setSaturation}
            onChangeStart={actions.pushUndo}
            vertical
          />
        </div>
        <div className="winamp-ax-stack">
          <div className="winamp-ax-grid">
            {COLOR_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`winamp-eq-pl-btn${colorFilter === opt.value ? " active" : ""}`}
                onClick={() => {
                  actions.pushUndo();
                  actions.setColorFilter(opt.value);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="winamp-ax-label">Accessibility</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isSciin ? "gap-4" : "gap-2"}`}>
      <Slider
        label="Exposure"
        value={exposure}
        min={0.1}
        max={4}
        step={0.1}
        onChange={actions.setExposure}
        onChangeStart={actions.pushUndo}
        thumbClass="sciin-thumb-magenta"
      />

      <Slider
        label="Contrast"
        value={contrast}
        min={-100}
        max={100}
        step={1}
        onChange={actions.setContrast}
        onChangeStart={actions.pushUndo}
        thumbClass="sciin-thumb-magenta"
      />

      <Slider
        label="Saturation"
        value={saturation}
        min={-100}
        max={100}
        step={1}
        onChange={actions.setSaturation}
        onChangeStart={actions.pushUndo}
        thumbClass="sciin-thumb-magenta"
      />

      <div>
        <div className={`mb-1 ${isWinamp ? "winamp-label" : "text-[10px] text-content-muted"}`}>Accessibility</div>
        {isSciin ? (
          <CycleSelect
            options={COLOR_FILTER_OPTIONS}
            value={colorFilter}
            onChange={(v) => actions.setColorFilter(v)}
            onChangeStart={actions.pushUndo}
          />
        ) : (
        <div className="relative">
          <button
            ref={btnRef}
            onClick={() => setMenuOpen((v) => !v)}
            className={`${isScenit ? "walk-dropdown-trigger" : "win95-dropdown-trigger"} flex w-full items-center justify-between rounded-md border border-surface-border-secondary px-2 py-1.5 text-sm text-content-primary outline-none hover:border-accent-500/50`}
          >
            <span>{selectedLabel}</span>
            <ThemeIcon icon={ChevronDown} className="h-3.5 w-3.5 text-content-muted" />
          </button>
          {menuOpen && createPortal(
            <div
              ref={menuRef}
              className={`fixed rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg z-[9999]${isScenit ? " walk-dropdown-menu" : ""}`}
              style={(() => {
                const r = btnRef.current?.getBoundingClientRect();
                if (!r) return {};
                const menuH = COLOR_FILTER_OPTIONS.length * 26 + 8;
                const fitsBelow = r.bottom + 2 + menuH < window.innerHeight;
                return {
                  left: r.left,
                  minWidth: r.width,
                  ...(fitsBelow
                    ? { top: r.bottom + 2 }
                    : { top: r.top - menuH - 2 }),
                };
              })()}
            >
              {COLOR_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    actions.pushUndo();
                    actions.setColorFilter(opt.value);
                    setMenuOpen(false);
                  }}
                  className={`block w-full px-3 py-1 text-left text-sm hover:bg-surface-border-secondary ${
                    colorFilter === opt.value ? "text-accent-400" : "text-content-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>
        )}
      </div>
    </div>
  );
}
