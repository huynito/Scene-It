"use client";

import { useEffect, useState, useCallback } from "react";
import { useThemeCapabilities } from "@/themes";
import { useScene } from "@/lib/scene-context";

const KEY_BASE =
  "win95-key-cap flex items-center justify-center rounded border text-[10px] font-bold select-none backdrop-blur-md shadow-[0_0_1px_rgba(0,0,0,0.06)]";
const KEY_SIZE = "h-7 w-7";
const KEY_IDLE = "bg-surface-primary/70 text-content-secondary border-content-faint/50";
const KEY_ACTIVE = "win95-key-cap-active bg-accent-500/40 text-accent-200 border-accent-400/70";
const KEY_DISABLED = "bg-surface-primary/30 text-content-faint/40 border-content-faint/20";
const FADE_IN = "transition-all duration-75 ease-in";
const FADE_OUT = "transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]";
const LABEL = "text-[10px] text-content-primary";
const LABEL_SHADOW = { textShadow: "0 0 1px rgba(0,0,0,0.2)" } as const;

const KEY_COLORS: Record<string, string> = {
  KeyQ: "#FF006E",
  KeyW: "#00CC66",
  KeyE: "#C77DFF",
  KeyA: "#FFE227",
  KeyS: "#FF6B35",
  KeyD: "#00E5FF",
  KeyK: "#FF006E",
  ArrowUp: "#FF006E",
  ArrowDown: "#00CC66",
  ArrowLeft: "#FFE227",
  ArrowRight: "#FF6B35",
};

export default function KeyHints() {
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const { lockY } = useScene();
  const cap = useThemeCapabilities();
  const usesText = cap.usesTextControls;

  const onDown = useCallback((e: KeyboardEvent) => {
    setPressed((prev) => {
      if (prev.has(e.code)) return prev;
      const next = new Set(prev);
      next.add(e.code);
      return next;
    });
  }, []);

  const onUp = useCallback((e: KeyboardEvent) => {
    setPressed((prev) => {
      if (!prev.has(e.code)) return prev;
      const next = new Set(prev);
      next.delete(e.code);
      return next;
    });
  }, []);

  useEffect(() => {
    const blur = () => setPressed(new Set());
    document.addEventListener("keydown", onDown);
    document.addEventListener("keyup", onUp);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("keydown", onDown);
      document.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", blur);
    };
  }, [onDown, onUp]);

  const disabledKeys = lockY ? new Set(["KeyQ", "KeyE"]) : null;

  const k = (code: string, label: string, _color?: string) => {
    const disabled = disabledKeys?.has(code);
    return (
      <span
        data-key={code}
        className={`${KEY_BASE} ${KEY_SIZE} ${disabled ? KEY_DISABLED : pressed.has(code) ? `${KEY_ACTIVE} ${FADE_IN}` : `${KEY_IDLE} ${FADE_OUT}`}`}
        style={!disabled && pressed.has(code) && KEY_COLORS[code] ? { '--key-hl': KEY_COLORS[code] } as React.CSSProperties : undefined}
      >
        {label}
      </span>
    );
  };

  const lbl = (text: string, _color?: string) => (
    <span className={LABEL} style={LABEL_SHADOW}>{text}</span>
  );

  return (
    <>
      <div className={`absolute z-10 flex gap-3 ${usesText ? "bottom-[32px] left-[30px]" : "bottom-4 left-4"}`}>
        <div className="flex flex-col">
          <div className="flex">
            {k("KeyQ", "Q", "var(--rl-cyan)")}
            {k("KeyW", "W", "var(--rl-cyan)")}
            {k("KeyE", "E", "var(--rl-cyan)")}
          </div>
          <div className="flex">
            {k("KeyA", "A", "var(--rl-cyan)")}
            {k("KeyS", "S", "var(--rl-cyan)")}
            {k("KeyD", "D", "var(--rl-cyan)")}
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className={`flex ${usesText ? "" : "h-7"} items-center`}>
            {lbl("WASD: Move", "var(--rl-cyan)")}
          </div>
          <div className={`flex ${usesText ? "" : "h-7"} items-center ${lockY ? "opacity-30" : ""}`}>
            {lbl(lockY ? "Q/E: Locked" : "Q/E: Up/Down", "var(--rl-cyan)")}
          </div>
        </div>
      </div>

      <div className={`absolute left-1/2 z-10 flex -translate-x-1/2 flex-col gap-0.5 ${usesText ? "bottom-[32px]" : "bottom-4"}`}>
        <div className={`flex ${usesText ? "" : "h-7"} items-center justify-center`}>
          {k("KeyK", "K", "var(--rl-magenta)")}
        </div>
        <div className={`flex ${usesText ? "" : "h-7"} items-center justify-center`}>
          {lbl("Keyframe", "var(--rl-magenta)")}
        </div>
      </div>

      <div className={`absolute z-10 flex gap-3 ${usesText ? "bottom-[32px] right-[30px]" : "bottom-4 right-4"}`}>
        <div className="flex flex-col justify-end">
          <div className={`flex ${usesText ? "" : "h-7"} items-center`}>
            {lbl("Rotate", "var(--rl-red)")}
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-center">
            {k("ArrowUp", usesText ? "^" : "▲", "var(--rl-red)")}
          </div>
          <div className="flex">
            {k("ArrowLeft", usesText ? "<" : "◀", "var(--rl-red)")}
            {k("ArrowDown", usesText ? "v" : "▼", "var(--rl-red)")}
            {k("ArrowRight", usesText ? ">" : "▶", "var(--rl-red)")}
          </div>
        </div>
      </div>
    </>
  );
}
