"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useThemeCapabilities } from "@/themes";

interface ScrubInputProps {
  value: number;
  step: number;
  min?: number;
  max?: number;
  decimals?: number;
  label?: string;
  color?: string;
  onChange: (value: number) => void;
  onChangeStart?: () => void;
}

export default function ScrubInput({
  value,
  step,
  min,
  max,
  decimals = 3,
  label,
  color,
  onChange,
  onChangeStart,
}: ScrubInputProps) {
  const cap = useThemeCapabilities();
  const isWinamp = cap.id === "winamp";
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startValue = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const clamp = useCallback(
    (v: number) => {
      if (min != null) v = Math.max(min, v);
      if (max != null) v = Math.min(max, v);
      return v;
    },
    [min, max]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) return;
      e.preventDefault();
      onChangeStart?.();
      isDragging.current = true;
      startX.current = e.clientX;
      startValue.current = value;
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [value, isEditing, onChangeStart]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - startX.current;
      const steps = Math.round(dx / 3);
      const newVal = clamp(
        Math.round((startValue.current + steps * step) / step) * step
      );
      onChange(newVal);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [step, clamp, onChange]);

  const handleDoubleClick = useCallback(() => {
    setEditValue(value.toFixed(decimals));
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [value, decimals]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const v = parseFloat(editValue);
    if (!isNaN(v)) {
      onChangeStart?.();
      onChange(clamp(v));
    }
  }, [editValue, onChange, clamp, onChangeStart]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        {label && (
          <span className="w-10 text-[10px] text-content-muted">{label}</span>
        )}
        <input
          ref={inputRef}
          type="number"
          step={step}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setIsEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded border border-accent-500/50 bg-surface-raised px-2 py-0.5 text-[11px] tabular-nums text-content-primary outline-none"
          style={color ? { color } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className={`text-[10px] ${isWinamp ? "w-6 font-bold text-content-primary" : "w-10 text-content-muted"}`}>{label}</span>
      )}
      <div
        data-scrub-input
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onClick={(e) => e.stopPropagation()}
        className={`w-full cursor-ew-resize select-none tabular-nums ${
          isWinamp
            ? "winamp-scrub-field rounded px-2 py-0.5 text-[11px]"
            : "rounded border border-surface-border-secondary bg-surface-raised px-2 py-0.5 text-[11px] text-content-primary hover:border-content-faint"
        }`}
        title="Drag left/right to adjust, double-click to type"
        style={color ? { color } : undefined}
      >
        {value.toFixed(decimals)}
      </div>
    </div>
  );
}
