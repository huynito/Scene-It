interface CycleSelectProps<T extends string | number> {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
  onChangeStart?: () => void;
  className?: string;
}

export default function CycleSelect<T extends string | number>({
  options,
  value,
  onChange,
  onChangeStart,
  className = "",
}: CycleSelectProps<T>) {
  const idx = options.findIndex((o) => o.value === value);
  const opt = idx >= 0 ? options[idx] : null;
  const label = opt?.label ?? String(value);
  const color = opt?.color;

  const cycle = () => {
    onChangeStart?.();
    const next = (idx + 1) % options.length;
    onChange(options[next].value);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      className={`sciin-toolbar-btn font-bold text-[11px] px-1.5 py-0.5 ${className}`}
      style={color ? { color } : undefined}
    >
      [{label}]
    </button>
  );
}
