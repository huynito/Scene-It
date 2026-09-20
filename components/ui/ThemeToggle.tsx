"use client";

import React from "react";
import { useThemeCapabilities } from "@/themes";

interface ThemeToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
}

export default function ThemeToggle({ checked, onChange, size = "md" }: ThemeToggleProps) {
  const cap = useThemeCapabilities();

  if (cap.checkboxStyle === "sciin-bracket") {
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="sciin-bracket-toggle flex-shrink-0"
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 13,
          fontWeight: "bold",
          color: checked ? "var(--rl-cyan)" : "rgb(var(--tx-muted))",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
        }}
        aria-checked={checked}
        role="checkbox"
      >
        {checked ? "[X]" : "[ ]"}
      </button>
    );
  }

  if (cap.checkboxStyle === "win95-button") {
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="win95-checkbox"
        aria-checked={checked}
        role="checkbox"
      >
        {checked && (
          <svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
            <rect x="8" y="1" width="2" height="1" fill="black" />
            <rect x="7" y="2" width="2" height="1" fill="black" />
            <rect x="6" y="3" width="2" height="1" fill="black" />
            <rect x="5" y="4" width="2" height="1" fill="black" />
            <rect x="0" y="5" width="2" height="1" fill="black" />
            <rect x="4" y="5" width="2" height="1" fill="black" />
            <rect x="1" y="6" width="4" height="1" fill="black" />
            <rect x="2" y="7" width="2" height="1" fill="black" />
          </svg>
        )}
      </button>
    );
  }

  if (cap.checkboxStyle === "aim-toggle") {
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="aim-checkbox"
        aria-checked={checked}
        role="checkbox"
      >
        {checked && (
          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 6l3 3 5-6" stroke="#0055CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    );
  }

  const isSm = size === "sm";
  const isWinampToggle = cap.checkboxStyle === "winamp-toggle";

  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 rounded-full transition-colors ${
        checked ? "bg-accent-500" : "bg-surface-border-secondary"
      } ${isSm ? "h-4 w-7" : "h-5 w-9"} ${isWinampToggle ? "winamp-toggle" : ""}`}
      aria-checked={checked}
      role="checkbox"
    >
      <span
        className={`absolute left-0 top-0.5 rounded-full bg-white transition-transform ${
          isSm
            ? `h-3 w-3 ${checked ? "translate-x-[14px]" : "translate-x-[2px]"}`
            : `h-4 w-4 ${checked ? "translate-x-[18px]" : "translate-x-[2px]"}`
        } ${isWinampToggle ? "winamp-toggle-knob" : ""}`}
      />
    </button>
  );
}
