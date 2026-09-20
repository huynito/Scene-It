"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useScene } from "@/lib/scene-context";
import {
  pathDuration,
  cubicBezier,
  getChannelValue,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  EASING_TO_BEZIER,
  EASING_LABELS,
} from "@/lib/camera-path";
import { useThemeCapabilities } from "@/themes";
import CycleSelect from "@/components/ui/CycleSelect";
import type {
  ChannelName,
  CameraKeyframe,
  EasingType,
  BezierTangent,
  ChannelCurve,
  TangentMode,
} from "@/lib/camera-path";

const ALL_CHANNELS: ChannelName[] = ["posX", "posY", "posZ", "pitch", "yaw", "fov"];
const WIN95_CHANNEL_COLORS: Partial<Record<ChannelName, string>> = { fov: "#996600" };
const CGA_CHANNEL_COLORS: Record<ChannelName, string> = {
  posX: "#FF0000",
  posY: "#00FF00",
  posZ: "#00FFFF",
  pitch: "#FFFF00",
  yaw: "#FF00FF",
  fov: "#FFFFFF",
};
const PADDING = { top: 20, right: 20, bottom: 28, left: 52 };
const HANDLE_RADIUS = 5;
const KF_SIZE = 5;
const GRID_LINES_Y = 6;
const CURVE_SAMPLES = 80;

function formatVal(v: number): string {
  return Math.abs(v) < 10 ? v.toFixed(3) : v.toFixed(1);
}

interface DragState {
  kfIndex: number;
  channel: ChannelName;
  handle: "in" | "out";
}

export default function GraphEditor() {
  const { paths, activePathId, compFps, compDuration, actions, refs } = useScene();
  const cap = useThemeCapabilities();
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isAim = cap.layoutShell === "xp-desktop";
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isSciin = cap.usesTextControls;
  const isSkeuomorphic = isWin95 || isAim;
  const gc = cap.graphColors;

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spaceHeldRef = useRef(false);
  const [spaceDown, setSpaceDown] = useState(false);

  const [enabledChannels, setEnabledChannels] = useState<Set<ChannelName>>(
    () => new Set<ChannelName>(["posX", "posY", "posZ"])
  );
  const { selectedKfIds } = useScene();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [viewRange, setViewRange] = useState({ timeMin: 0, timeMax: 10, valMin: -2, valMax: 2 });
  const [panStart, setPanStart] = useState<{ x: number; y: number; range: typeof viewRange } | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; time: number; values: Record<string, number> } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kfIndex: number } | null>(null);
  const [size, setSize] = useState({ width: 600, height: 200 });

  const activePath = paths.find((p) => p.id === activePathId);
  const kfs = activePath?.keyframes ?? [];
  const duration = activePath ? pathDuration(activePath) : 0;

  const primarySelectedId = selectedKfIds.length > 0 ? selectedKfIds[selectedKfIds.length - 1] : null;
  const selectedKfIndex = primarySelectedId != null ? kfs.findIndex((k) => k.id === primarySelectedId) : -1;
  const hasSelection = selectedKfIndex >= 0;

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.max(width, 200), height: Math.max(height, 100) });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const fitToKeyframes = useCallback(() => {
    if (kfs.length === 0) return;
    const chArr = Array.from(enabledChannels);
    const vals = kfs.flatMap((kf) => chArr.map((ch) => getChannelValue(kf, ch)));
    const times = kfs.map((kf) => kf.time);
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const minV = vals.length > 0 ? Math.min(...vals) : -1;
    const maxV = vals.length > 0 ? Math.max(...vals) : 1;
    const tPad = Math.max((maxT - minT) * 0.1, 0.5);
    const vPad = Math.max((maxV - minV) * 0.15, 0.5);
    setViewRange({
      timeMin: minT - tPad,
      timeMax: maxT + tPad,
      valMin: minV - vPad,
      valMax: maxV + vPad,
    });
  }, [kfs, enabledChannels]);

  useEffect(() => {
    if (compDuration > 0) fitToKeyframes();
  }, [compDuration, kfs.length, enabledChannels.size]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        spaceHeldRef.current = true; setSpaceDown(true);
      } else if (e.code === "KeyH") {
        e.preventDefault();
        fitToKeyframes();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const el = e.target as HTMLElement;
        if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && !el.isContentEditable) e.preventDefault();
        spaceHeldRef.current = false; setSpaceDown(false);
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [fitToKeyframes]);

  const plotW = size.width - PADDING.left - PADDING.right;
  const plotH = size.height - PADDING.top - PADDING.bottom;

  const timeToX = useCallback(
    (t: number) => PADDING.left + ((t - viewRange.timeMin) / (viewRange.timeMax - viewRange.timeMin)) * plotW,
    [viewRange, plotW]
  );
  const valToY = useCallback(
    (v: number) => PADDING.top + (1 - (v - viewRange.valMin) / (viewRange.valMax - viewRange.valMin)) * plotH,
    [viewRange, plotH]
  );
  const xToTime = useCallback(
    (x: number) => viewRange.timeMin + ((x - PADDING.left) / plotW) * (viewRange.timeMax - viewRange.timeMin),
    [viewRange, plotW]
  );
  const yToVal = useCallback(
    (y: number) => viewRange.valMax - ((y - PADDING.top) / plotH) * (viewRange.valMax - viewRange.valMin),
    [viewRange, plotH]
  );

  const toggleChannel = (ch: ChannelName) => {
    setEnabledChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  const buildCurvePath = useCallback(
    (ch: ChannelName): string => {
      if (kfs.length < 2) return "";
      const parts: string[] = [];

      for (let seg = 0; seg < kfs.length - 1; seg++) {
        const k1 = kfs[seg];
        const k2 = kfs[seg + 1];

        for (let s = 0; s <= CURVE_SAMPLES; s++) {
          const rawT = s / CURVE_SAMPLES;
          const time = k1.time + rawT * (k2.time - k1.time);
          const val = evaluateSegment(k1, k2, rawT, ch);

          const x = timeToX(time);
          const y = valToY(val);
          parts.push(parts.length === 0 && seg === 0 ? `M${x},${y}` : `L${x},${y}`);
        }
      }

      return parts.join(" ");
    },
    [kfs, timeToX, valToY]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const timeFrac = (mouseX - PADDING.left) / plotW;
      const valFrac = (mouseY - PADDING.top) / plotH;

      const zoomFactor = e.deltaY > 0 ? 1.015 : 1 / 1.015;

      const tRange = viewRange.timeMax - viewRange.timeMin;
      const vRange = viewRange.valMax - viewRange.valMin;
      const pivot_t = viewRange.timeMin + timeFrac * tRange;
      const pivot_v = viewRange.valMax - valFrac * vRange;

      const newTRange = tRange * zoomFactor;
      const newVRange = vRange * zoomFactor;

      setViewRange({
        timeMin: pivot_t - timeFrac * newTRange,
        timeMax: pivot_t + (1 - timeFrac) * newTRange,
        valMin: pivot_v - (1 - valFrac) * newVRange,
        valMax: pivot_v + valFrac * newVRange,
      });
    },
    [viewRange, plotW, plotH]
  );

  const handleMiddleDown = useCallback(
    (e: React.PointerEvent) => {
      const isMiddle = e.button === 1;
      const isSpacePan = e.button === 0 && spaceHeldRef.current;
      if (!isMiddle && !isSpacePan) return;
      e.preventDefault();
      if (isSpacePan) refs.spaceDraggedRef.current = true;
      setPanStart({ x: e.clientX, y: e.clientY, range: { ...viewRange } });
    },
    [viewRange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (panStart) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        const tShift = (-dx / plotW) * (panStart.range.timeMax - panStart.range.timeMin);
        const vShift = (dy / plotH) * (panStart.range.valMax - panStart.range.valMin);
        setViewRange({
          timeMin: panStart.range.timeMin + tShift,
          timeMax: panStart.range.timeMax + tShift,
          valMin: panStart.range.valMin + vShift,
          valMax: panStart.range.valMax + vShift,
        });
        return;
      }

      if (dragState && activePath) {
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { kfIndex, channel, handle } = dragState;

        const kf = kfs[kfIndex];
        const nextKf = kfs[kfIndex + 1];
        const prevKf = kfs[kfIndex - 1];

        const targetKf = handle === "out" ? nextKf : prevKf;
        if (!targetKf) return;

        const segDuration = handle === "out"
          ? (nextKf.time - kf.time)
          : (kf.time - prevKf.time);
        const v0 = handle === "out" ? getChannelValue(kf, channel) : getChannelValue(prevKf, channel);
        const v1 = handle === "out" ? getChannelValue(nextKf, channel) : getChannelValue(kf, channel);
        const valueRange = v1 - v0;

        const handleTime = xToTime(mx);
        const handleVal = yToVal(my);

        let normX: number;
        let normY: number;

        if (handle === "out") {
          normX = segDuration > 0 ? Math.max(0, Math.min(1, (handleTime - kf.time) / segDuration)) : 1 / 3;
          normY = valueRange !== 0 ? (handleVal - v0) / valueRange : 1 / 3;
        } else {
          normX = segDuration > 0 ? Math.max(0, Math.min(1, (handleTime - prevKf.time) / segDuration)) : 2 / 3;
          normY = valueRange !== 0 ? (handleVal - v0) / valueRange : 2 / 3;
        }

        const tangent: BezierTangent = { x: normX, y: normY };

        // Unified mode: mirror the dragged handle to its pair on the same kf
        const isUnified = kf.tangentMode === "unified";
        const mirroredHandle: BezierTangent | null = isUnified
          ? computeUnifiedMirror(handle, normX, normY, kfIndex, channel, kfs)
          : null;

        actions.setPaths((prev) =>
          prev.map((p) => {
            if (p.id !== activePathId) return p;
            return {
              ...p,
              keyframes: p.keyframes.map((k, ki) => {
                if (ki !== kfIndex) return k;
                const existing = k.curves?.[channel] ?? {
                  outTangent: { x: 1 / 3, y: 1 / 3 },
                  inTangent: { x: 2 / 3, y: 2 / 3 },
                };
                const updated: ChannelCurve = handle === "out"
                  ? { outTangent: tangent, inTangent: mirroredHandle ?? existing.inTangent }
                  : { outTangent: mirroredHandle ?? existing.outTangent, inTangent: tangent };

                return {
                  ...k,
                  curves: { ...k.curves, [channel]: updated },
                };
              }),
            };
          })
        );
        return;
      }

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (mx >= PADDING.left && mx <= size.width - PADDING.right &&
          my >= PADDING.top && my <= size.height - PADDING.bottom) {
        const time = xToTime(mx);
        const values: Record<string, number> = {};
        const chArr = Array.from(enabledChannels);
        for (const ch of chArr) {
          for (let i = 0; i < kfs.length - 1; i++) {
            if (time >= kfs[i].time && time <= kfs[i + 1].time) {
              const rawT = (time - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
              values[ch] = evaluateSegment(kfs[i], kfs[i + 1], rawT, ch as ChannelName);
              break;
            }
          }
        }
        setHoverInfo({ x: mx, y: my, time, values });
      } else {
        setHoverInfo(null);
      }
    },
    [panStart, dragState, activePath, activePathId, kfs, plotW, plotH, xToTime, yToVal, size, enabledChannels, actions]
  );

  const handlePointerUp = useCallback(() => {
    if (dragState) {
      setDragState(null);
    }
    setPanStart(null);
  }, [dragState]);

  const handleTangentDown = useCallback(
    (kfIndex: number, channel: ChannelName, handle: "in" | "out", e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      actions.pushUndo();
      setDragState({ kfIndex, channel, handle });
    },
    [actions]
  );

  const setTangentMode = useCallback(
    (kfIndex: number, mode: TangentMode) => {
      actions.pushUndo();
      actions.setPaths((prev) =>
        prev.map((p) => {
          if (p.id !== activePathId) return p;
          return {
            ...p,
            keyframes: p.keyframes.map((k, ki) => {
              if (ki !== kfIndex) return k;

              if (mode === "linear") {
                const curves: Partial<Record<ChannelName, ChannelCurve>> = {};
                for (const ch of ALL_CHANNELS) {
                  curves[ch] = {
                    outTangent: { x: 1 / 3, y: 1 / 3 },
                    inTangent: { x: 2 / 3, y: 2 / 3 },
                  };
                }
                return { ...k, curves, tangentMode: mode };
              }

              if (mode === "stepped") {
                return { ...k, tangentMode: mode };
              }

              if (mode === "auto") {
                const curves: Partial<Record<ChannelName, ChannelCurve>> = {};
                for (const ch of ALL_CHANNELS) {
                  const prevKf = ki > 0 ? p.keyframes[ki - 1] : null;
                  const nextKf = ki < p.keyframes.length - 1 ? p.keyframes[ki + 1] : null;
                  const vPrev = prevKf ? getChannelValue(prevKf, ch) : getChannelValue(k, ch);
                  const vCurr = getChannelValue(k, ch);
                  const vNext = nextKf ? getChannelValue(nextKf, ch) : vCurr;
                  const tPrev = prevKf?.time ?? k.time;
                  const tNext = nextKf?.time ?? k.time;
                  const dtTotal = tNext - tPrev;

                  if (dtTotal === 0) {
                    curves[ch] = {
                      outTangent: { x: 1 / 3, y: 1 / 3 },
                      inTangent: { x: 2 / 3, y: 2 / 3 },
                    };
                  } else {
                    const slope = (vNext - vPrev) / dtTotal;
                    const dtOut = tNext - k.time;
                    const dtIn = k.time - tPrev;
                    const rangeOut = vNext - vCurr;
                    const rangeIn = vCurr - vPrev;

                    const outY = rangeOut !== 0 ? Math.max(0, Math.min(1, (slope * dtOut / 3) / rangeOut)) : 1 / 3;
                    const inY = rangeIn !== 0 ? Math.max(0, Math.min(1, 1 - (slope * dtIn / 3) / rangeIn)) : 2 / 3;

                    curves[ch] = {
                      outTangent: { x: 1 / 3, y: isFinite(outY) ? outY : 1 / 3 },
                      inTangent: { x: 2 / 3, y: isFinite(inY) ? inY : 2 / 3 },
                    };
                  }
                }
                return { ...k, curves, tangentMode: mode };
              }

              return { ...k, tangentMode: mode };
            }),
          };
        })
      );
      setContextMenu(null);
    },
    [actions, activePathId]
  );

  const applyEasingPreset = useCallback(
    (kfIndex: number, easing: EasingType) => {
      const bezier = EASING_TO_BEZIER[easing];
      actions.pushUndo();
      actions.setPaths((prev) =>
        prev.map((p) => {
          if (p.id !== activePathId) return p;
          return {
            ...p,
            keyframes: p.keyframes.map((k, ki) => {
              if (ki !== kfIndex) return k;
              const curves: Partial<Record<ChannelName, ChannelCurve>> = {};
              for (const ch of ALL_CHANNELS) {
                curves[ch] = {
                  outTangent: { ...bezier.out },
                  inTangent: { ...bezier.in },
                };
              }
              return { ...k, easing, curves, tangentMode: undefined };
            }),
          };
        })
      );
    },
    [actions, activePathId]
  );

  const gridLinesTime = useMemo(() => {
    const range = viewRange.timeMax - viewRange.timeMin;
    const rawStep = range / 8;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? mag * 10;
    const lines: number[] = [];
    const start = Math.ceil(viewRange.timeMin / step) * step;
    for (let t = start; t <= viewRange.timeMax; t += step) {
      lines.push(t);
    }
    return { lines, step };
  }, [viewRange]);

  const gridLinesVal = useMemo(() => {
    const range = viewRange.valMax - viewRange.valMin;
    const rawStep = range / GRID_LINES_Y;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? mag * 10;
    const lines: number[] = [];
    const start = Math.ceil(viewRange.valMin / step) * step;
    for (let v = start; v <= viewRange.valMax; v += step) {
      lines.push(v);
    }
    return { lines, step };
  }, [viewRange]);

  if (!activePath || kfs.length < 2) {
    return (
      <div className="flex items-center justify-center p-6 text-[11px] text-content-faint">
        Add at least 2 keyframes to use the graph editor
      </div>
    );
  }

  const tangentHandles: JSX.Element[] = [];
  if (hasSelection && selectedKfIndex < kfs.length) {
    const kf = kfs[selectedKfIndex];
    for (const ch of Array.from(enabledChannels)) {
      const color = isSciin ? CGA_CHANNEL_COLORS[ch] : CHANNEL_COLORS[ch];
      const curve = kf.curves?.[ch];

      if (selectedKfIndex < kfs.length - 1) {
        const nextKf = kfs[selectedKfIndex + 1];
        const out = curve?.outTangent ?? { x: 1 / 3, y: 1 / 3 };
        const v0 = getChannelValue(kf, ch);
        const v1 = getChannelValue(nextKf, ch);
        const handleTime = kf.time + out.x * (nextKf.time - kf.time);
        const handleVal = v0 + out.y * (v1 - v0);
        const hx = timeToX(handleTime);
        const hy = valToY(handleVal);
        const kx = timeToX(kf.time);
        const ky = valToY(v0);

        tangentHandles.push(
          <g key={`out-${ch}-${selectedKfIndex}`}>
            <line x1={kx} y1={ky} x2={hx} y2={hy} stroke={color} strokeWidth={1} opacity={0.5} />
            <circle
              cx={hx} cy={hy} r={HANDLE_RADIUS}
              fill={color} stroke={isSciin ? color : isSkeuomorphic ? "#000" : "white"} strokeWidth={1}
              className="cursor-grab"
              onPointerDown={(e) => handleTangentDown(selectedKfIndex, ch, "out", e)}
            />
          </g>
        );
      }

      if (selectedKfIndex > 0) {
        const prevKf = kfs[selectedKfIndex - 1];
        const inp = curve?.inTangent ?? { x: 2 / 3, y: 2 / 3 };
        const v0 = getChannelValue(prevKf, ch);
        const v1 = getChannelValue(kf, ch);
        const handleTime = prevKf.time + inp.x * (kf.time - prevKf.time);
        const handleVal = v0 + inp.y * (v1 - v0);
        const hx = timeToX(handleTime);
        const hy = valToY(handleVal);
        const kx = timeToX(kf.time);
        const ky = valToY(v1);

        tangentHandles.push(
          <g key={`in-${ch}-${selectedKfIndex}`}>
            <line x1={kx} y1={ky} x2={hx} y2={hy} stroke={color} strokeWidth={1} opacity={0.5} />
            <circle
              cx={hx} cy={hy} r={HANDLE_RADIUS}
              fill="transparent" stroke={color} strokeWidth={1.5}
              className="cursor-grab"
              onPointerDown={(e) => handleTangentDown(selectedKfIndex, ch, "in", e)}
            />
          </g>
        );
      }
    }
  }

  return (
    <div className={`flex select-none${isWin95 ? " px-2 py-2 gap-2" : isAim ? " pl-3" : ""}${isWinamp ? " winamp-graph-editor-row" : ""}`}>
      {/* Channel selector */}
      <div className={`graph-editor-channels flex shrink-0 flex-col${isWin95 ? " win95-group-box p-2" : isWinamp ? " w-32" : isSciin ? " border-r border-[#FF00FF]/30" : " border-r border-surface-border"}`} style={isWin95 ? { width: 96 } : { width: isAim ? 107 : 128 }}>
        {isWin95 ? (
          <span className="text-[11px] font-medium text-content-primary">Channels</span>
        ) : isAim ? (
          <span className="text-[11px] text-content-primary" style={{ padding: "4px" }}>Channels</span>
        ) : isWinamp ? (
          <div className="flex w-full items-center px-2 py-1">
            <span className="winamp-label">Channels</span>
          </div>
        ) : (
          <div className={`flex w-full items-center px-3 py-1 text-[9px] font-bold uppercase tracking-wider ${isSciin ? "text-[#FF00FF]" : "text-content-faint"}`}>
            Channels
          </div>
        )}
        <div className={`flex flex-col gap-0.5 ${isWin95 ? "mt-1" : "px-2 py-2"} ${isSkeuomorphic ? "win95-channel-list" : ""}`}>
        {ALL_CHANNELS.map((ch) => {
          const chColor = isSciin ? CGA_CHANNEL_COLORS[ch] : CHANNEL_COLORS[ch];
          const enabled = enabledChannels.has(ch);
          return (
            <label
              key={ch}
              className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[10px] transition-colors hover:bg-surface-raised${isWinamp ? " winamp-channel-label" : ""}`}
            >
              {isSciin ? (
                <span
                  className="font-bold leading-none"
                  style={{ color: enabled ? chColor : "#52525b", fontFamily: "monospace", fontSize: "10px" }}
                >
                  {enabled ? "[#]" : "[ ]"}
                </span>
              ) : !isSkeuomorphic && !isWinamp ? (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: enabled ? CHANNEL_COLORS[ch] : "transparent",
                    border: `1.5px solid ${CHANNEL_COLORS[ch]}`,
                  }}
                />
              ) : null}
              <input
                type="checkbox"
                checked={enabled}
                onChange={() => toggleChannel(ch)}
                className={isWinamp ? "" : "hidden"}
              />
              <span
                className={enabled ? "text-content-primary" : "text-content-faint"}
                style={isSciin ? { color: enabled ? chColor : undefined } : isSkeuomorphic ? { color: WIN95_CHANNEL_COLORS[ch] ?? CHANNEL_COLORS[ch] } : undefined}
              >
                {CHANNEL_LABELS[ch]}
              </span>
            </label>
          );
        })}
        </div>

        {hasSelection && (
          <div className="flex flex-col gap-1 px-2 py-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] font-medium uppercase tracking-wide text-content-faint">Tangent</span>
              {isSciin ? (
                <CycleSelect
                  options={(["auto", "unified", "broken", "linear", "stepped"] as TangentMode[]).map((mode) => ({
                    value: mode,
                    label: mode.charAt(0).toUpperCase() + mode.slice(1),
                  }))}
                  value={kfs[selectedKfIndex]?.tangentMode ?? "auto"}
                  onChange={(v) => setTangentMode(selectedKfIndex, v)}
                />
              ) : (
                <select
                  value={kfs[selectedKfIndex]?.tangentMode ?? "auto"}
                  onChange={(e) => setTangentMode(selectedKfIndex, e.target.value as TangentMode)}
                  className="w-full rounded border border-surface-border-secondary bg-surface-raised px-1.5 py-1 text-[11px] text-content-primary outline-none"
                >
                  {(["auto", "unified", "broken", "linear", "stepped"] as TangentMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] font-medium uppercase tracking-wide text-content-faint">Preset</span>
              {isSciin ? (
                <CycleSelect
                  options={(Object.keys(EASING_LABELS) as EasingType[]).map((key) => ({ value: key, label: EASING_LABELS[key] }))}
                  value={kfs[selectedKfIndex]?.easing ?? "linear"}
                  onChange={(v) => applyEasingPreset(selectedKfIndex, v)}
                />
              ) : (
                <select
                  value={kfs[selectedKfIndex]?.easing ?? "linear"}
                  onChange={(e) => applyEasingPreset(selectedKfIndex, e.target.value as EasingType)}
                  className="w-full rounded border border-surface-border-secondary bg-surface-raised px-1.5 py-1 text-[11px] text-content-primary outline-none"
                >
                  {(Object.keys(EASING_LABELS) as EasingType[]).map((key) => (
                    <option key={key} value={key}>
                      {EASING_LABELS[key]}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
        )}
      </div>

      {/* SVG canvas */}
      <div
        ref={containerRef}
        className={`relative min-w-0 flex-1${isWin95 ? " win95-inset mr-3" : isAim ? " win95-inset mr-3" : ""}${isWinamp ? " winamp-graph-inset" : ""}`}
        style={isWinamp ? undefined : { height: 240 }}
      >
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          className={`w-full ${panStart ? "cursor-grabbing" : spaceDown ? "cursor-grab" : ""}`}
          onWheel={handleWheel}
          onPointerDown={handleMiddleDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => { setHoverInfo(null); handlePointerUp(); }}
          onClick={() => {
            if (!dragState && !panStart && !spaceHeldRef.current) {
              actions.setSelectedKfIds([]);
              setContextMenu(null);
            }
          }}
        >
          {/* Clip area */}
          <defs>
            <clipPath id="plotClip">
              <rect x={PADDING.left} y={PADDING.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* Background */}
          <rect
            x={PADDING.left} y={PADDING.top}
            width={plotW} height={plotH}
            fill={gc.bg} rx={isSciin ? 0 : 2}
          />

          {/* Grid lines - time */}
          {gridLinesTime.lines.map((t) => {
            const x = timeToX(t);
            if (x < PADDING.left || x > size.width - PADDING.right) return null;
            return (
              <g key={`gt-${t}`}>
                <line x1={x} y1={PADDING.top} x2={x} y2={PADDING.top + plotH}
                  stroke={gc.grid} strokeWidth={1}
                  {...(isSciin ? { strokeDasharray: "3,4", opacity: 0.6 } : {})} />
                <text x={x} y={size.height - 4} textAnchor="middle"
                  fill={gc.label} fontSize={9} fontFamily="monospace">
                  f{Math.round(t * compFps)}
                </text>
              </g>
            );
          })}

          {/* Grid lines - value */}
          {gridLinesVal.lines.map((v) => {
            const y = valToY(v);
            if (y < PADDING.top || y > PADDING.top + plotH) return null;
            return (
              <g key={`gv-${v}`}>
                <line x1={PADDING.left} y1={y} x2={PADDING.left + plotW} y2={y}
                  stroke={gc.grid} strokeWidth={1}
                  {...(isSciin ? { strokeDasharray: "3,4", opacity: 0.6 } : {})} />
                <text x={PADDING.left - 4} y={y + 3} textAnchor="end"
                  fill={gc.label} fontSize={9} fontFamily="monospace">
                  {formatVal(v)}
                </text>
              </g>
            );
          })}

          {/* Zero line */}
          {viewRange.valMin <= 0 && viewRange.valMax >= 0 && (
            <line
              x1={PADDING.left} y1={valToY(0)}
              x2={PADDING.left + plotW} y2={valToY(0)}
              stroke={gc.zero} strokeWidth={1}
              {...(isSciin ? { strokeDasharray: "6,3" } : {})}
            />
          )}

          {/* Curves */}
          <g clipPath="url(#plotClip)">
            {Array.from(enabledChannels).map((ch) => {
              const cColor = isSciin ? CGA_CHANNEL_COLORS[ch] : CHANNEL_COLORS[ch];
              return (
                <path
                  key={ch}
                  d={buildCurvePath(ch)}
                  fill="none"
                  stroke={cColor}
                  strokeWidth={1.5}
                  opacity={0.85}
                />
              );
            })}
          </g>

          {/* Keyframe diamonds */}
          <g clipPath="url(#plotClip)">
          {kfs.map((kf, idx) =>
            Array.from(enabledChannels).map((ch) => {
              const x = timeToX(kf.time);
              const y = valToY(getChannelValue(kf, ch));
              const isSelected = selectedKfIds.includes(kf.id);
              const cColor = isSciin ? CGA_CHANNEL_COLORS[ch] : CHANNEL_COLORS[ch];
              return (
                <g key={`kf-${idx}-${ch}`}>
                  <rect
                    x={x - KF_SIZE} y={y - KF_SIZE}
                    width={KF_SIZE * 2} height={KF_SIZE * 2}
                    fill={isSelected ? cColor : gc.kfEmpty}
                    stroke={isSelected ? (isSciin ? cColor : isSkeuomorphic ? "#000" : "white") : cColor}
                    strokeWidth={1}
                    transform={`rotate(45,${x},${y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.metaKey || e.ctrlKey) {
                        actions.setSelectedKfIds((prev) =>
                          prev.includes(kf.id) ? prev.filter((id) => id !== kf.id) : [...prev, kf.id]
                        );
                      } else {
                        actions.setSelectedKfIds([kf.id]);
                      }
                      setContextMenu(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      actions.setSelectedKfIds([kf.id]);
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        kfIndex: idx,
                      });
                    }}
                  />
                </g>
              );
            })
          )}
          </g>

          {/* Tangent handles */}
          <g clipPath="url(#plotClip)">
            {tangentHandles}
          </g>

          {/* Hover crosshair */}
          {hoverInfo && !dragState && !panStart && (
            <g>
              <line
                x1={hoverInfo.x} y1={PADDING.top}
                x2={hoverInfo.x} y2={PADDING.top + plotH}
                stroke={gc.crosshair} strokeWidth={0.5} strokeDasharray="2,2"
              />
            </g>
          )}
        </svg>

        {/* Hover tooltip */}
        {hoverInfo && !dragState && !panStart && (
          <div
            className={`pointer-events-none absolute z-10 px-2 py-1 text-[10px] ${
              isSciin
                ? "border border-dashed border-[#00FFFF]/40 bg-[#050403]"
                : "rounded bg-surface-raised shadow-lg"
            }`}
            style={{
              left: Math.min(hoverInfo.x + 12, size.width - 100),
              top: hoverInfo.y - 8,
            }}
          >
            <div className={isSciin ? "text-[#00FFFF]" : "text-content-muted"}>f{Math.round(hoverInfo.time * compFps)} ({hoverInfo.time.toFixed(2)}s)</div>
            {(Object.entries(hoverInfo.values) as [ChannelName, number][]).map(([ch, val]) => (
              <div key={ch} style={{ color: isSciin ? CGA_CHANNEL_COLORS[ch] : CHANNEL_COLORS[ch] }}>
                {CHANNEL_LABELS[ch]}: {formatVal(val)}
              </div>
            ))}
          </div>
        )}

        {/* Context menu */}
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setContextMenu(null)}
            />
            <div
              className={`absolute z-30 py-1 ${
                isSciin
                  ? "border border-dashed border-[#FF00FF]/40 bg-[#050403]"
                  : "rounded-md border border-surface-border-secondary bg-surface-raised shadow-xl"
              }`}
              style={{
                left: contextMenu.x - (containerRef.current?.getBoundingClientRect().left ?? 0),
                top: contextMenu.y - (containerRef.current?.getBoundingClientRect().top ?? 0),
              }}
            >
              <div className={`px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${isSciin ? "text-[#FF00FF]" : "text-content-faint"}`}>
                Tangent Mode
              </div>
              {(["auto", "unified", "broken", "linear", "stepped"] as TangentMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTangentMode(contextMenu.kfIndex, mode)}
                  className={`block w-full px-3 py-1 text-left text-[11px] transition-colors ${
                    isSciin
                      ? "text-[#00FFFF] hover:text-[#FFFF00]"
                      : "text-content-primary hover:bg-surface-border-secondary"
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function evaluateSegment(
  k1: CameraKeyframe, k2: CameraKeyframe, rawT: number, ch: ChannelName,
): number {
  const v0 = getChannelValue(k1, ch);
  const v1 = getChannelValue(k2, ch);
  const c1 = k1.curves?.[ch];
  const c2 = k2.curves?.[ch];

  if (c1 || c2) {
    const outT = c1?.outTangent ?? { x: 1 / 3, y: 1 / 3 };
    const inT = c2?.inTangent ?? { x: 2 / 3, y: 2 / 3 };
    if (k1.tangentMode === "stepped") return v0;
    const bezParam = solveBezierT(outT.x, inT.x, rawT);
    return cubicBezier(v0, v0 + (v1 - v0) * outT.y, v0 + (v1 - v0) * inT.y, v1, bezParam);
  }
  return v0 + (v1 - v0) * rawT;
}

function solveBezierT(cp1x: number, cp2x: number, targetX: number, iterations = 8): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const x = cubicBezier(0, cp1x, cp2x, 1, mid);
    if (x < targetX) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * For "unified" tangent mode: given the normalized coords of the dragged
 * handle, compute the mirrored coords for the paired handle on the same
 * keyframe (reflecting through the keyframe point in absolute time/value
 * space, then re-normalising into the opposite segment's space).
 *
 * Returns null when no paired segment exists (e.g. first kf out-handle has
 * no in-segment to mirror into).
 */
function computeUnifiedMirror(
  handle: "in" | "out",
  normX: number,
  normY: number,
  kfIndex: number,
  channel: ChannelName,
  keyframes: CameraKeyframe[]
): BezierTangent | null {
  const kf = keyframes[kfIndex];
  const prevKf = keyframes[kfIndex - 1] ?? null;
  const nextKf = keyframes[kfIndex + 1] ?? null;

  if (handle === "out" && prevKf) {
    // out-handle lives in [kf → nextKf]; mirror into [prevKf → kf]
    const segDurOut = nextKf!.time - kf.time;
    const segDurIn  = kf.time   - prevKf.time;
    const vCurr     = getChannelValue(kf,     channel);
    const vNext     = getChannelValue(nextKf!, channel);
    const vPrev     = getChannelValue(prevKf,  channel);
    const rangeOut  = vNext - vCurr;
    const rangeIn   = vCurr - vPrev;

    // inp_x = 1 − normX·(segDurOut / segDurIn)
    const inp_x = segDurIn > 0
      ? Math.max(0, Math.min(1, 1 - normX * (segDurOut / segDurIn)))
      : 2 / 3;
    // inp_y = 1 − normY·(rangeOut / rangeIn)  (unclamped — allows overshoot)
    const inp_y = rangeIn !== 0 ? 1 - normY * (rangeOut / rangeIn) : 2 / 3;

    return { x: inp_x, y: inp_y };
  }

  if (handle === "in" && nextKf) {
    // in-handle lives in [prevKf → kf]; mirror into [kf → nextKf]
    const segDurIn  = kf.time    - prevKf!.time;
    const segDurOut = nextKf.time - kf.time;
    const vPrev     = getChannelValue(prevKf!, channel);
    const vCurr     = getChannelValue(kf,      channel);
    const vNext     = getChannelValue(nextKf,   channel);
    const rangeIn   = vCurr - vPrev;
    const rangeOut  = vNext - vCurr;

    // out_x = (1 − normX)·(segDurIn / segDurOut)
    const out_x = segDurOut > 0
      ? Math.max(0, Math.min(1, (1 - normX) * (segDurIn / segDurOut)))
      : 1 / 3;
    // out_y = (1 − normY)·(rangeIn / rangeOut)
    const out_y = rangeOut !== 0 ? (1 - normY) * (rangeIn / rangeOut) : 1 / 3;

    return { x: out_x, y: out_y };
  }

  return null;
}
