"use client";

import { useState } from "react";
import { Info, Undo2, Redo2, Copy, Eye, RotateCcw, Crosshair } from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import { useScene } from "@/lib/scene-context";
import ScrubInput from "../ScrubInput";

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function DepthMeshPanel() {
  const {
    depthMeshLoaded, depthMeshVisible, meshPos, meshRot, meshScale,
    sceneOrigin, actions, refs,
  } = useScene();
  const cap = useThemeCapabilities();
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isSciin = cap.usesTextControls;
  const [debugView, setDebugView] = useState(false);
  const [depthBias, setDepthBias] = useState(5);
  const [orthoView, setOrthoView] = useState<string | null>(null);

  const enterOrtho = (axis: "top" | "front" | "right" | "left") => {
    setOrthoView(axis);
    refs.setOrthoView.current?.(axis);
  };

  const exitOrtho = () => {
    setOrthoView(null);
    refs.setOrthoView.current?.(null);
  };

  const meshToRel = (world: { x: number; y: number; z: number }) => {
    const dx = world.x - sceneOrigin.position.x;
    const dz = world.z - sceneOrigin.position.z;
    const cos = Math.cos(-sceneOrigin.yaw);
    const sin = Math.sin(-sceneOrigin.yaw);
    return { x: dx * cos - dz * sin, y: world.y - sceneOrigin.eyeHeight, z: dx * sin + dz * cos };
  };

  const meshToWorld = (rel: { x: number; y: number; z: number }) => {
    const cos = Math.cos(sceneOrigin.yaw);
    const sin = Math.sin(sceneOrigin.yaw);
    return {
      x: rel.x * cos - rel.z * sin + sceneOrigin.position.x,
      y: rel.y + sceneOrigin.eyeHeight,
      z: rel.x * sin + rel.z * cos + sceneOrigin.position.z,
    };
  };

  const updateMeshPos = (axis: "x" | "y" | "z", v: number) => {
    const rel = meshToRel(meshPos);
    const newRel = { ...rel, [axis]: v };
    const newWorld = meshToWorld(newRel);
    actions.setMeshPos(newWorld);
    refs.setDepthMeshTransform.current?.(newWorld, meshRot, meshScale);
  };

  const updateMeshRot = (axis: "x" | "y" | "z", v: number) => {
    const next = { ...meshRot, [axis]: v };
    actions.setMeshRot(next);
    refs.setDepthMeshTransform.current?.(meshPos, next, meshScale);
  };

  if (!depthMeshLoaded && !IS_DEV) return null;

  return (
    <div className="flex flex-col gap-2">
      {depthMeshLoaded && (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-content-primary">
          <input
            type="checkbox"
            checked={depthMeshVisible}
            onChange={(e) => {
              actions.setDepthMeshVisible(e.target.checked);
              refs.setDepthMeshVisible.current?.(e.target.checked);
            }}
            className="accent-accent-500"
          />
          Occlude UI
        </label>
      )}

      {IS_DEV && (
        <>
          {!isSciin && (
            <span
              className="mb-1 inline-flex items-center gap-1 text-[10px] text-content-faint cursor-help"
              title="Load a .glb mesh that acts as an invisible occluder for depth-correct compositing of AR elements."
            >
              <ThemeIcon icon={Info} className="h-6 w-6 flex-shrink-0" />
              Depth mesh info
            </span>
          )}

          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-500">
            {depthMeshLoaded ? "Replace Room Mesh" : "Load Room Mesh (.glb)"}
            <input
              type="file"
              accept=".glb"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const buf = await file.arrayBuffer();
                try {
                  await refs.loadDepthMesh.current?.(buf, file.name);
                  refs.setDepthMeshTransform.current?.(meshPos, meshRot, meshScale);
                  actions.setDepthMeshLoaded(true);
                  actions.setDepthMeshVisible(true);
                } catch (err) {
                  console.error("Depth mesh load error:", err);
                }
              }}
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-content-primary">
            <input
              type="checkbox"
              checked={depthMeshVisible}
              onChange={(e) => {
                actions.setDepthMeshVisible(e.target.checked);
                refs.setDepthMeshVisible.current?.(e.target.checked);
              }}
              className="accent-accent-500"
            />
            Show room mesh
          </label>

          <div className="flex gap-1.5">
            <button
              onClick={() => {
                const next = !debugView;
                setDebugView(next);
                refs.setDepthMeshDebugView.current?.(next);
              }}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] ${
                debugView
                  ? "border-accent-500 bg-accent-600/20 text-accent-400"
                  : "border-surface-border-secondary text-content-muted hover:border-content-faint hover:text-content-primary"
              }`}
              title="Show mesh as translucent overlay for alignment"
            >
              <Eye className="h-3 w-3" />
              X-Ray
            </button>
            <button
              onClick={() => {
                actions.pushUndo();
                const align = refs.getDepthMeshAutoAlign.current?.();
                if (align) {
                  actions.setMeshPos(align.position);
                  actions.setMeshRot(align.rotation);
                  actions.setMeshScale(align.scale);
                  refs.setDepthMeshTransform.current?.(align.position, align.rotation, align.scale);
                }
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-surface-border-secondary px-2 py-1 text-[10px] text-content-muted hover:border-content-faint hover:text-content-primary"
              title="Auto-align mesh to splat scene using bounding box matching"
            >
              <Crosshair className="h-3 w-3" />
              Align
            </button>
            <button
              onClick={() => {
                actions.pushUndo();
                const zero = { x: 0, y: 0, z: 0 };
                actions.setMeshPos(zero);
                actions.setMeshRot(zero);
                actions.setMeshScale(1);
                refs.setDepthMeshTransform.current?.(zero, zero, 1);
              }}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-surface-border-secondary px-2 py-1 text-[10px] text-content-muted hover:border-content-faint hover:text-content-primary"
              title="Reset position, rotation and scale to identity"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>

          <div className="flex items-center justify-between mt-1">
            <div className={isWinamp ? "winamp-label" : "text-[10px] text-content-muted"}>Position</div>
            <div className="flex gap-1">
              <button
                onClick={actions.undo}
                className="rounded p-0.5 text-content-muted hover:text-content-primary hover:bg-surface-border-secondary"
                title="Undo (⌘Z)"
              >
                <Undo2 className="h-3 w-3" />
              </button>
              <button
                onClick={actions.redo}
                className="rounded p-0.5 text-content-muted hover:text-content-primary hover:bg-surface-border-secondary"
                title="Redo (⌘⇧Z)"
              >
                <Redo2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          {(["x", "y", "z"] as const).map((axis) => {
            const relPos = meshToRel(meshPos);
            const posStep = Math.max(0.0001, meshScale * 0.5);
            const posDec = meshScale < 0.05 ? 4 : 3;
            return (
              <ScrubInput
                key={`mp-${axis}`}
                label={axis.toUpperCase()}
                value={relPos[axis]}
                step={posStep}
                decimals={posDec}
                onChangeStart={actions.pushUndo}
                onChange={(v) => updateMeshPos(axis, v)}
              />
            );
          })}

          <div className="mt-1 text-[10px] text-content-muted">Rotation</div>
          {(["x", "y", "z"] as const).map((axis) => (
            <ScrubInput
              key={`mr-${axis}`}
              label={axis.toUpperCase()}
              value={meshRot[axis]}
              step={0.5}
              decimals={1}
              onChangeStart={actions.pushUndo}
              onChange={(v) => updateMeshRot(axis, v)}
            />
          ))}

          <div className="mt-1 text-[10px] text-content-muted">Scale</div>
          <ScrubInput
            value={meshScale}
            step={Math.max(0.0001, meshScale * 0.05)}
            min={0.0001}
            decimals={meshScale < 0.05 ? 4 : 3}
            onChangeStart={actions.pushUndo}
            onChange={(v) => {
              actions.setMeshScale(v);
              refs.setDepthMeshTransform.current?.(meshPos, meshRot, v);
            }}
          />

          <div className={`mt-1 ${isWinamp ? "winamp-label" : "text-[10px] text-content-muted"}`}>
            Depth Bias
            <span className="ml-1 text-content-faint">({depthBias})</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={depthBias}
            onChange={(e) => {
              const v = Number(e.target.value);
              setDepthBias(v);
              refs.setDepthMeshBias.current?.(v);
            }}
            className="w-full accent-accent-500"
            title="Lower = tighter occlusion edges, higher = more z-fighting safety margin"
          />

          <div className={`mt-2 ${isWinamp ? "winamp-label" : "text-[10px] text-content-muted"}`}>Camera View</div>
          <div className="grid grid-cols-4 gap-1">
            {(["top", "front", "right", "left"] as const).map((axis) => (
              <button
                key={axis}
                onClick={() => {
                  if (orthoView === axis) exitOrtho();
                  else enterOrtho(axis);
                }}
                className={`rounded px-1 py-0.5 text-[9px] capitalize ${
                  orthoView === axis
                    ? "bg-accent-600 text-white"
                    : "border border-surface-border-secondary text-content-muted hover:border-content-faint hover:text-content-primary"
                }`}
              >
                {axis}
              </button>
            ))}
          </div>
          {orthoView && (
            <button
              onClick={exitOrtho}
              className="flex w-full items-center justify-center rounded-md border border-surface-border-secondary px-2 py-0.5 text-[10px] text-content-muted hover:border-content-faint hover:text-content-primary"
            >
              Back to Perspective
            </button>
          )}

          <button
            onClick={() => {
              const config = JSON.stringify({
                position: { x: +meshPos.x.toFixed(4), y: +meshPos.y.toFixed(4), z: +meshPos.z.toFixed(4) },
                rotation: { x: +meshRot.x.toFixed(2), y: +meshRot.y.toFixed(2), z: +meshRot.z.toFixed(2) },
                scale: +meshScale.toFixed(4),
              }, null, 2);
              navigator.clipboard.writeText(`meshTransform: ${config},`);
            }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-surface-border-secondary px-3 py-1 text-[10px] text-content-muted hover:border-content-faint hover:text-content-primary"
            title="Copy current mesh transform as a ScenePreset config snippet"
          >
            <Copy className="h-3 w-3" />
            Copy transform config
          </button>
        </>
      )}
    </div>
  );
}
