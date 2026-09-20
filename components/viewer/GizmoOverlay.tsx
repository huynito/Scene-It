"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useScene, type SceneAnchor } from "@/lib/scene-context";
import type { AnchorKeyframe, AnchorAnimation } from "@/lib/anchor-animation";
import type { PlaybackState } from "@/lib/playback-controller";
import type { EasingType } from "@/lib/camera-path";
import type { Vec3 } from "@/lib/renderers/types";

const SCREEN_HANDLE_PX = 80;

const AXIS_META: { key: string; axisField: "right" | "up" | "forward"; color: string }[] = [
  { key: "x", axisField: "right", color: "#ff4444" },
  { key: "y", axisField: "up", color: "#44ff44" },
  { key: "z", axisField: "forward", color: "#4488ff" },
];

interface ScreenAxis {
  key: string;
  color: string;
  dir: Vec3;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
}

export default function GizmoOverlay() {
  const { selectedAnchorId, anchors, anchorAnimations, playbackState, actions, refs } = useScene();
  const [screenAxes, setScreenAxes] = useState<ScreenAxis[]>([]);
  const rafRef = useRef<number>(0);

  const dragAxisRef = useRef<string | null>(null);
  const dragDirRef = useRef<Vec3 | null>(null);
  const dragStartMouseRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartPosRef = useRef<Vec3 | null>(null);
  const dragAnchorRef = useRef<SceneAnchor | null>(null);
  const anchorAnimationsRef = useRef<AnchorAnimation[]>(anchorAnimations);
  anchorAnimationsRef.current = anchorAnimations;
  const playbackStateRef = useRef<PlaybackState>(playbackState);
  playbackStateRef.current = playbackState;

  const anchor = selectedAnchorId
    ? anchors.find((a) => a.id === selectedAnchorId) ?? null
    : null;

  const updateProjections = useCallback(() => {
    const wts = refs.worldToScreen.current;
    const getAxes = refs.getAnchorAxes.current;
    if (!anchor || !wts || !getAxes) {
      setScreenAxes([]);
      return;
    }

    const axes = getAxes(anchor.id);
    if (!axes) {
      setScreenAxes([]);
      return;
    }

    const center = wts(axes.center);
    if (!center) {
      setScreenAxes([]);
      return;
    }

    const result: ScreenAxis[] = [];
    for (const { key, axisField, color } of AXIS_META) {
      const dir = axes[axisField];
      const probe: Vec3 = {
        x: axes.center.x + dir.x,
        y: axes.center.y + dir.y,
        z: axes.center.z + dir.z,
      };
      const probeScreen = wts(probe);
      if (!probeScreen) continue;

      const sdx = probeScreen.x - center.x;
      const sdy = probeScreen.y - center.y;
      const screenLen = Math.sqrt(sdx * sdx + sdy * sdy);
      if (screenLen < 0.5) continue;

      const scale = SCREEN_HANDLE_PX / screenLen;
      result.push({
        key,
        color,
        dir,
        cx: center.x,
        cy: center.y,
        tx: center.x + sdx * scale,
        ty: center.y + sdy * scale,
      });
    }
    setScreenAxes(result);
  }, [anchor, refs.worldToScreen, refs.getAnchorAxes]);

  useEffect(() => {
    if (!anchor) {
      setScreenAxes([]);
      return;
    }

    let running = true;
    const loop = () => {
      if (!running) return;
      updateProjections();
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [anchor, updateProjections]);

  const handleTipDown = useCallback(
    (axisKey: string, dir: Vec3, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!anchor) return;

      actions.pushUndo();
      dragAxisRef.current = axisKey;
      dragDirRef.current = dir;
      dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
      dragStartPosRef.current = { ...anchor.position };
      dragAnchorRef.current = anchor;
    },
    [anchor, actions]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const startMouse = dragStartMouseRef.current;
      const startPos = dragStartPosRef.current;
      const dir = dragDirRef.current;
      const da = dragAnchorRef.current;
      const wts = refs.worldToScreen.current;
      if (!startMouse || !startPos || !dir || !da || !wts) return;

      const originScreen = wts(startPos);
      const tipScreen = wts({
        x: startPos.x + dir.x,
        y: startPos.y + dir.y,
        z: startPos.z + dir.z,
      });
      if (!originScreen || !tipScreen) return;

      const axisDx = tipScreen.x - originScreen.x;
      const axisDy = tipScreen.y - originScreen.y;
      const axisLen = Math.sqrt(axisDx * axisDx + axisDy * axisDy);
      if (axisLen < 1) return;

      const mouseDx = e.clientX - startMouse.x;
      const mouseDy = e.clientY - startMouse.y;
      const projection =
        (mouseDx * axisDx + mouseDy * axisDy) / (axisLen * axisLen);

      const newPos: Vec3 = {
        x: startPos.x + dir.x * projection,
        y: startPos.y + dir.y * projection,
        z: startPos.z + dir.z * projection,
      };

      refs.setAnchorPosition.current?.(da, newPos);

      actions.setAnchors((prev) =>
        prev.map((a) =>
          a.id === da.id
            ? { ...a, position: newPos }
            : a
        )
      );

      const anim = anchorAnimationsRef.current.find((a) => a.anchorId === da.id);
      if (anim && anim.keyframes.length > 0) {
        const time = playbackStateRef.current.currentTime;
        const TIME_EPSILON = 0.001;
        const matchIdx = anim.keyframes.findIndex((kf) => Math.abs(kf.time - time) < TIME_EPSILON);
        let newKeyframes: AnchorKeyframe[];
        if (matchIdx >= 0) {
          newKeyframes = anim.keyframes.map((kf, i) =>
            i === matchIdx ? { ...kf, position: { ...newPos }, rotation: { ...da.rotation } } : kf,
          );
        } else {
          const kf: AnchorKeyframe = { time, position: { ...newPos }, rotation: { ...da.rotation }, easing: "linear" as EasingType };
          newKeyframes = [...anim.keyframes, kf].sort((a, b) => a.time - b.time);
        }
        actions.setAnchorAnimations((prev) =>
          prev.map((a) => a.anchorId === da.id ? { ...a, keyframes: newKeyframes } : a),
        );
      }
    };

    const handleMouseUp = () => {
      dragAxisRef.current = null;
      dragDirRef.current = null;
      dragStartMouseRef.current = null;
      dragStartPosRef.current = null;
      dragAnchorRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [refs, actions]);

  if (!anchor || screenAxes.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 20, overflow: "visible" }}
    >
      {screenAxes.map((a) => (
        <g key={a.key}>
          <line
            x1={a.cx}
            y1={a.cy}
            x2={a.tx}
            y2={a.ty}
            stroke={a.color}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle
            cx={a.tx}
            cy={a.ty}
            r={8}
            fill={a.color}
            stroke="white"
            strokeWidth={1.5}
            className="pointer-events-auto cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => handleTipDown(a.key, a.dir, e)}
          />
          <text
            x={a.tx + 12}
            y={a.ty + 4}
            fill={a.color}
            fontSize={11}
            fontWeight="bold"
            fontFamily="monospace"
          >
            {a.key.toUpperCase()}
          </text>
        </g>
      ))}
      <circle
        cx={screenAxes[0].cx}
        cy={screenAxes[0].cy}
        r={5}
        fill="white"
        stroke="black"
        strokeWidth={1}
      />
    </svg>
  );
}
