"use client";

import { useState, useRef, useCallback } from "react";

function starburstPoints(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  numPoints: number,
  altRatio = 1,
): string {
  const pts: string[] = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = (Math.PI * i) / numPoints - Math.PI / 2;
    let r: number;
    if (i % 2 !== 0) {
      r = innerR;
    } else {
      const pointIdx = i / 2;
      r = pointIdx % 2 === 0 ? outerR : outerR * altRatio;
    }
    pts.push(
      `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return pts.join(" ");
}

function swimmingPath(
  width: number,
  height: number,
  phase: number,
  waves: number,
  samples: number,
): string {
  const amp = height * 0.35;
  const mid = height / 2;
  let d = "";
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = t * width;
    const y = mid + amp * Math.sin(t * waves * 2 * Math.PI + phase);
    d += i === 0
      ? `M ${x.toFixed(1)} ${y.toFixed(1)}`
      : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/* ── Shape primitives ── */


function starburstPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  numPoints: number,
  altRatio: number,
  blend: number,
  tipRound = 0.015,
): string {
  const f = (v: number) => v.toFixed(2);
  let d = "";
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = (Math.PI * i) / numPoints - Math.PI / 2;
    const isOuter = i % 2 === 0;
    let r: number;
    if (!isOuter) {
      r = innerR;
    } else {
      const pointIdx = i / 2;
      if (pointIdx % 2 === 0) {
        r = outerR * (1 + (altRatio - 1) * blend);
      } else {
        r = outerR * (altRatio + (1 - altRatio) * blend);
      }
    }
    if (isOuter) {
      const lx = cx + r * Math.cos(angle - tipRound);
      const ly = cy + r * Math.sin(angle - tipRound);
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      const rx = cx + r * Math.cos(angle + tipRound);
      const ry = cy + r * Math.sin(angle + tipRound);
      if (i === 0) {
        d = `M ${f(lx)} ${f(ly)} A ${f(r)} ${f(r)} 0 0 1 ${f(rx)} ${f(ry)}`;
      } else {
        d += ` L ${f(lx)} ${f(ly)} A ${f(r)} ${f(r)} 0 0 1 ${f(rx)} ${f(ry)}`;
      }
    } else {
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      d += ` L ${f(x)} ${f(y)}`;
    }
  }
  return d + " Z";
}

function Starburst({
  size,
  points,
  fill,
  innerRatio = 0.28,
  altRatio = 1,
  rotDeg,
  dur = 4,
  sw = 2.5,
  style,
}: {
  size: number;
  points: number;
  fill: string;
  innerRatio?: number;
  altRatio?: number;
  rotDeg?: number;
  dur?: number;
  sw?: number;
  style?: React.CSSProperties;
}) {
  const half = size / 2;
  const outerR = half - 1;
  const innerR = outerR * innerRatio;

  const steps = 96;
  const paths: string[] = [];
  const speeds: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const phase = t * Math.PI * 2;
    const blend = 0.5 - 0.5 * Math.cos(phase);
    paths.push(starburstPath(half, half, outerR, innerR, points, altRatio, blend));
    const v = Math.abs(Math.sin(phase));
    speeds.push(0.85 + v * v * 1.5);
  }
  paths.push(paths[0]);

  const symPeriod = (720 / points);
  const totalDeg = rotDeg ?? (Math.floor(270 / symPeriod) * symPeriod || symPeriod);
  const totalSpeed = speeds.reduce((a, b) => a + b, 0);
  const rotations: number[] = [];
  let cum = 0;
  for (let i = 0; i < steps; i++) {
    rotations.push(cum);
    cum += (speeds[i] / totalSpeed) * totalDeg;
  }
  rotations.push(totalDeg);

  const keyTimes = paths.map((_, i) => (i / steps).toFixed(4)).join(";");
  const rotValues = rotations.map((r) => `${r.toFixed(2)} ${half} ${half}`).join(";");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      overflow="visible"
      style={style}
    >
      <path
        d={paths[0]}
        fill={fill}
        stroke="#222"
        strokeWidth={sw}
        strokeLinejoin="round"
      >
        <animate
          attributeName="d"
          values={paths.join(";")}
          keyTimes={keyTimes}
          calcMode="linear"
          dur={`${dur}s`}
          repeatCount="indefinite"
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={rotValues}
          keyTimes={keyTimes}
          calcMode="linear"
          dur={`${dur}s`}
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}


function lightenHex(hex: string, amount = 0.45): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr},${lg},${lb})`;
}

function Squiggle({
  width,
  height,
  stroke,
  sw = 3,
  waves = 3,
  dur = 3,
  style,
}: {
  width: number;
  height: number;
  stroke: string;
  sw?: number;
  waves?: number;
  dur?: number;
  style?: React.CSSProperties;
}) {
  const capFill = "#fff";
  const samples = 48;
  const steps = 10;
  const amp = height * 0.35;
  const mid = height / 2;
  const circleR = sw / 2 + 1.25;
  const pad = sw + 6;

  const paths: string[] = [];
  const endYs: number[] = [];

  for (let s = 0; s <= steps; s++) {
    const phase = (s / steps) * 2 * Math.PI;
    paths.push(swimmingPath(width, height, phase, waves, samples));
    endYs.push(mid + amp * Math.sin(waves * 2 * Math.PI + phase));
  }

  const valuesD = paths.join(";");
  const valuesCY = endYs.map((y) => y.toFixed(1)).join(";");
  const spline = "0.4 0 0.6 1";
  const keySplines = Array(steps).fill(spline).join(";");
  const keyTimes = Array.from({ length: steps + 1 }, (_, i) => (i / steps).toFixed(2)).join(";");

  return (
    <svg
      width={width + 2 * pad}
      height={height + 2 * pad}
      viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}
      fill="none"
      style={{ ...style, margin: -pad }}
    >
      <path
        d={paths[0]}
        stroke="#222"
        strokeWidth={sw + 5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <animate attributeName="d" values={valuesD} dur={`${dur}s`} repeatCount="indefinite" calcMode="spline" keyTimes={keyTimes} keySplines={keySplines} />
      </path>
      <path
        d={paths[0]}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <animate attributeName="d" values={valuesD} dur={`${dur}s`} repeatCount="indefinite" calcMode="spline" keyTimes={keyTimes} keySplines={keySplines} />
      </path>
      <circle
        cx={width}
        cy={endYs[0]}
        r={circleR}
        fill={capFill}
        stroke="#222"
        strokeWidth={2.5}
      >
        <animate attributeName="cy" values={valuesCY} dur={`${dur}s`} repeatCount="indefinite" calcMode="spline" keyTimes={keyTimes} keySplines={keySplines} />
      </circle>
    </svg>
  );
}

function Dot({
  size,
  color,
  filled = false,
  style,
}: {
  size: number;
  color: string;
  filled?: boolean;
  style?: React.CSSProperties;
}) {
  const half = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={style}
    >
      <circle
        cx={half}
        cy={half}
        r={half - 2}
        fill={filled ? color : "none"}
        stroke={filled ? "#222" : color}
        strokeWidth={2.5}
      />
    </svg>
  );
}

const DECO_SHADOW = "drop-shadow(6px 6px 0 rgba(0,0,0,0.28))";

function Deco({
  pos,
  spin,
  reverse,
  children,
}: {
  pos: React.CSSProperties;
  spin?: number;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  const inner = spin ? (
    <div
      style={{
        animation: `scenit-spin ${spin}s ease-in-out infinite${reverse ? " reverse" : ""}`,
      }}
    >
      {children}
    </div>
  ) : (
    children
  );

  return (
    <div
      style={{
        position: "absolute",
        filter: DECO_SHADOW,
        ...pos,
      }}
    >
      {inner}
    </div>
  );
}

interface DecoItem {
  id: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  layer: "bg" | "fg";
  shape: "starburst" | "squiggle";
  points?: number;
  fill?: string;
  stroke?: string;
  altRatio?: number;
  rotDeg?: number;
  dur: number;
  sw: number;
  squiggleW?: number;
  squiggleH?: number;
  waves?: number;
  fromRight?: number;
  fromBottom?: number;
  pctX?: number;
  pctY?: number;
}

const REF_W = 1888;
const REF_H = 868;

const INITIAL_ITEMS: DecoItem[] = [
  { id: "C", x: -112, y: 374, size: 185, rotation: 0, layer: "fg", shape: "starburst", points: 8, fill: "#FF006E", altRatio: 0.6, dur: 4.63, sw: 3, pctX: -112 / REF_W * 100, pctY: 374 / REF_H * 100 },
  { id: "D", x: 755, y: 579, size: 100, rotation: 0, layer: "fg", shape: "starburst", points: 6, fill: "#FF6B35", altRatio: 0.6, rotDeg: 360, dur: 3.1, sw: 2.5, pctX: 755 / REF_W * 100, pctY: 579 / REF_H * 100 },
  { id: "E", x: 1293, y: 802, size: 100, rotation: -360, layer: "fg", shape: "squiggle", stroke: "#fff", dur: 3.09, sw: 10, squiggleW: 180, squiggleH: 32, waves: 1.5, pctX: 1293 / REF_W * 100, pctY: 802 / REF_H * 100 },
  { id: "F", x: 1638, y: 580, size: 75, rotation: 0, layer: "fg", shape: "starburst", points: 4, fill: "#DEFF2A", dur: 2.05, sw: 3, pctX: 1638 / REF_W * 100, pctY: 580 / REF_H * 100 },
  { id: "H", x: 1420, y: 55, size: 101, rotation: 0, layer: "fg", shape: "starburst", points: 4, fill: "#FFE227", dur: 3.83, sw: 3, pctX: 1420 / REF_W * 100, pctY: 55 / REF_H * 100 },
  { id: "G", x: 462, y: 15, size: 100, rotation: -360, layer: "fg", shape: "squiggle", stroke: "#DEFF2A", dur: 1.37, sw: 10, squiggleW: 120, squiggleH: 32, waves: 0.5, pctX: 462 / REF_W * 100, pctY: 15 / REF_H * 100 },
];

function DraggableItem({
  item,
  onUpdate,
}: {
  item: DecoItem;
  onUpdate: (patch: Partial<DecoItem>) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origPctX: number; origPctY: number; containerW: number; containerH: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = elRef.current?.offsetParent as HTMLElement | null;
    const cw = container?.clientWidth ?? REF_W;
    const ch = container?.clientHeight ?? REF_H;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origPctX: item.pctX ?? (item.x / REF_W * 100), origPctY: item.pctY ?? (item.y / REF_H * 100), containerW: cw, containerH: ch };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onUpdate({
        pctX: dragRef.current.origPctX + (dx / dragRef.current.containerW) * 100,
        pctY: dragRef.current.origPctY + (dy / dragRef.current.containerH) * 100,
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [item.x, item.y, item.pctX, item.pctY, onUpdate]);

  const linearSpin = item.shape === "starburst" && (!item.altRatio || item.altRatio === 1);

  const content = item.shape === "starburst" ? (
    <Starburst
      size={item.size}
      points={item.points!}
      fill={item.fill!}
      altRatio={item.altRatio}
      rotDeg={linearSpin ? 0 : item.rotDeg}
      dur={item.dur}
      sw={item.sw}
    />
  ) : (
    <div style={{ filter: DECO_SHADOW }}>
      <Squiggle
        width={item.squiggleW ?? item.size}
        height={item.squiggleH ?? 32}
        stroke={item.stroke ?? "#fff"}
        sw={item.sw}
        waves={item.waves ?? 1.5}
        dur={item.dur}
        style={{
          transform: `rotate(${item.rotation}deg)`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );

  return (
    <div
      ref={elRef}
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        left: item.pctX != null ? `${item.pctX}%` : item.x,
        top: item.pctY != null ? `${item.pctY}%` : item.y,
        cursor: "grab",
        pointerEvents: "auto",
      }}
    >
      {item.shape === "starburst" ? (
        linearSpin ? (
          <div style={{ filter: DECO_SHADOW }}>
            <div style={{ animation: `scenit-spin-linear ${item.dur}s linear infinite` }}>
              {content}
            </div>
          </div>
        ) : (
          <Deco pos={{}}>{content}</Deco>
        )
      ) : (
        content
      )}
    </div>
  );
}

export default function ScenitDecorations() {
  const [items, setItems] = useState(INITIAL_ITEMS);

  const updateItem = useCallback((id: string, patch: Partial<DecoItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const bgItems = items.filter((it) => it.layer === "bg");
  const fgItems = items.filter((it) => it.layer === "fg");

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {bgItems.map((item) => (
          <DraggableItem
            key={item.id}
            item={item}
            onUpdate={(patch) => updateItem(item.id, patch)}
          />
        ))}
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2 }}
      >
        {fgItems.map((item) => (
          <DraggableItem
            key={item.id}
            item={item}
            onUpdate={(patch) => updateItem(item.id, patch)}
          />
        ))}
      </div>
    </>
  );
}
