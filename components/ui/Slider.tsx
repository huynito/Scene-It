import { useThemeCapabilities } from "@/themes";

interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onChangeStart?: () => void;
  vertical?: boolean;
  thumbClass?: string;
  valueColor?: string;
}

const SCIIN_DOT_COUNT = 25;

const SCIIN_DOT_BG = Array.from({ length: SCIIN_DOT_COUNT }, (_, i) => {
  const t = i / (SCIIN_DOT_COUNT - 1);
  const pos = `calc(7px + (100% - 14px) * ${t.toFixed(4)})`;
  return `radial-gradient(circle at ${pos} 50%, #c8c8dc 1.5px, transparent 1.5px)`;
}).join(", ");

export default function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  onChangeStart,
  vertical = false,
  thumbClass,
  valueColor,
}: SliderProps) {
  const cap = useThemeCapabilities();
  const isWinamp = cap.id === "winamp";
  const isSciin = cap.sliderStyle === "sciin-snap";
  const fillPercent = max > min ? ((value - min) / (max - min)) * 100 : 0;

  if (vertical && isWinamp) {
    return (
      <div className="slider-vertical-column">
        <div className="slider-vertical">
          <div className="slider-track-wrapper relative flex items-center">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onPointerDown={() => onChangeStart?.()}
              onChange={(e) => onChange(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-border-secondary accent-accent-500"
              style={{ "--fill": `${fillPercent}%` } as React.CSSProperties}
            />
          </div>
        </div>
        {label && (
          <span className="winamp-label slider-vertical-label">{label}</span>
        )}
      </div>
    );
  }

  const sciinSnap = (raw: number) => {
    const t = (raw - min) / (max - min);
    const idx = Math.round(t * (SCIIN_DOT_COUNT - 1));
    const clamped = Math.max(0, Math.min(SCIIN_DOT_COUNT - 1, idx));
    return min + (max - min) * clamped / (SCIIN_DOT_COUNT - 1);
  };

  return (
    <div className={`flex flex-col ${format ? "gap-2" : "gap-2.5"}`}>
      {(label || format) && (
        <div className="flex items-center justify-between">
          {label && <label className={isWinamp ? "winamp-label" : "text-sm text-content-primary"}>{label}</label>}
          {format && (
            <span
              className={isWinamp
                ? "winamp-label"
                : `text-xs tabular-nums text-content-muted ${!label ? "ml-auto" : ""}`
              }
              style={valueColor ? { color: valueColor } : undefined}
            >
              {format(value)}
            </span>
          )}
        </div>
      )}
      <div className="slider-track-wrapper relative flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={isSciin ? "any" : step}
          value={value}
          onPointerDown={() => onChangeStart?.()}
          onChange={(e) => onChange(isSciin ? sciinSnap(Number(e.target.value)) : Number(e.target.value))}
          className={`h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-border-secondary accent-accent-500 ${thumbClass || ""}`}
          style={{
            "--fill": `${fillPercent}%`,
            ...(isSciin ? { "--sciin-dots": SCIIN_DOT_BG } : {}),
          } as React.CSSProperties}
        />
      </div>
      {format && !isWinamp && (
        <div className="flex justify-between text-[10px] text-content-faint">
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </div>
      )}
    </div>
  );
}
