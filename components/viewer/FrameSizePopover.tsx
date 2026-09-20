"use client";

interface FrameSizePopoverProps {
  format: "png" | "jpeg";
  width: number;
  height: number;
  onWidthChange: (w: number) => void;
  onExport: () => void;
  variant?: "dropdown" | "inline";
}

export default function FrameSizePopover({
  format,
  width,
  height,
  onWidthChange,
  onExport,
  variant = "dropdown",
}: FrameSizePopoverProps) {
  const label = format === "png" ? "PNG" : "JPG";

  if (variant === "inline") {
    return (
      <span className="flex items-center gap-1 ml-1">
        <input
          type="number"
          value={width}
          min={1}
          max={7680}
          onChange={(e) => onWidthChange(Math.max(1, Math.min(7680, Number(e.target.value) || 1920)))}
          className="w-14 bg-transparent border-b border-content-faint px-0.5 text-[11px] text-content-primary outline-none font-bold tabular-nums"
          onClick={(e) => e.stopPropagation()}
        />
        <span className="text-[11px] font-bold" style={{ color: "#00FF00" }}>x{height}</span>
        <button
          onClick={onExport}
          className="sciin-toolbar-btn px-1 py-0.5 text-[11px] font-bold"
          style={{ color: "#FFFF00" }}
        >[GO]</button>
      </span>
    );
  }

  return (
    <div className="border-t border-surface-border-secondary px-3 py-2">
      <div className="flex items-center gap-2 text-[11px]">
        <label className="text-content-secondary">W</label>
        <input
          type="number"
          value={width}
          min={1}
          max={7680}
          onChange={(e) => onWidthChange(Math.max(1, Math.min(7680, Number(e.target.value) || 1920)))}
          className="w-16 rounded border border-surface-border-secondary bg-surface-primary px-1.5 py-0.5 text-[11px] text-content-primary outline-none focus:border-accent-500"
          onClick={(e) => e.stopPropagation()}
        />
        <span className="text-content-faint">x</span>
        <span className="text-content-secondary tabular-nums">{height}</span>
      </div>
      <button
        onClick={onExport}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-accent-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-accent-600"
      >
        Export {label}
      </button>
    </div>
  );
}
