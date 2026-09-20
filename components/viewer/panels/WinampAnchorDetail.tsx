"use client";

import { useCallback } from "react";

import { useScene } from "@/lib/scene-context";
import type { SceneAnchor } from "@/lib/scene-context";
import type { AnchorAnimation, AnchorKeyframe } from "@/lib/anchor-animation";
import type { EasingType } from "@/lib/camera-path";
import Slider from "@/components/ui/Slider";
import ScrubInput from "../ScrubInput";

export default function WinampAnchorDetail({ anchor }: { anchor: SceneAnchor }) {
  const {
    anchorAnimations,
    playbackState,
    sceneOrigin,
    actions,
    refs,
  } = useScene();

  const anchorToRel = useCallback(
    (world: { x: number; y: number; z: number }) => {
      const dx = world.x - sceneOrigin.position.x;
      const dz = world.z - sceneOrigin.position.z;
      const cos = Math.cos(-sceneOrigin.yaw);
      const sin = Math.sin(-sceneOrigin.yaw);
      return {
        x: dx * cos - dz * sin,
        y: world.y - sceneOrigin.eyeHeight,
        z: dx * sin + dz * cos,
      };
    },
    [sceneOrigin],
  );

  const anchorToWorld = useCallback(
    (rel: { x: number; y: number; z: number }) => {
      const cos = Math.cos(sceneOrigin.yaw);
      const sin = Math.sin(sceneOrigin.yaw);
      return {
        x: rel.x * cos - rel.z * sin + sceneOrigin.position.x,
        y: rel.y + sceneOrigin.eyeHeight,
        z: rel.x * sin + rel.z * cos + sceneOrigin.position.z,
      };
    },
    [sceneOrigin],
  );

  const getAnim = (): AnchorAnimation | undefined =>
    anchorAnimations.find((a) => a.anchorId === anchor.id);

  const handleAddKeyframe = () => {
    actions.pushUndo();
    const time = playbackState.currentTime;
    const kf: AnchorKeyframe = {
      time,
      position: { ...anchor.position },
      rotation: { ...anchor.rotation },
      easing: "linear" as EasingType,
    };
    const existing = getAnim();
    if (existing) {
      const updated: AnchorAnimation = {
        ...existing,
        keyframes: [...existing.keyframes, kf].sort((a, b) => a.time - b.time),
      };
      actions.setAnchorAnimations((prev) =>
        prev.map((a) => (a.anchorId === anchor.id ? updated : a)),
      );
    } else {
      actions.setAnchorAnimations((prev) => [
        ...prev,
        { anchorId: anchor.id, keyframes: [kf] },
      ]);
    }
  };

  const anim = getAnim();
  const relPos = anchorToRel(anchor.position);

  return (
    <div className="winamp-anchor-detail">
      {/* Billboard: label + Off/On inline (same treatment as FOV toggles) */}
      {!anchor.leashed && (
        <div className="mb-2 flex items-center gap-2">
          <span className="winamp-label">Billboard</span>
          <div className="winamp-eq-pl-tray">
            <button
              className={`winamp-eq-pl-btn${anchor.billboardMode === "none" ? " active" : ""}`}
              onClick={() => {
                actions.pushUndo();
                refs.setAnchorBillboard.current?.(anchor, "none");
                actions.setAnchors((prev) =>
                  prev.map((a) =>
                    a.id === anchor.id ? { ...a, billboardMode: "none" } : a,
                  ),
                );
              }}
            >
              OFF
            </button>
            <button
              className={`winamp-eq-pl-btn${anchor.billboardMode === "y-axis" ? " active" : ""}`}
              onClick={() => {
                actions.pushUndo();
                refs.setAnchorBillboard.current?.(anchor, "y-axis");
                actions.setAnchors((prev) =>
                  prev.map((a) =>
                    a.id === anchor.id ? { ...a, billboardMode: "y-axis" } : a,
                  ),
                );
              }}
            >
              ON
            </button>
          </div>
        </div>
      )}

      {/* Leash to Camera + UI Visible on same row */}
      <div className="winamp-anchor-option-row">
        <label className="flex cursor-pointer items-center gap-2.5 winamp-label">
          <input
            type="checkbox"
            checked={!!anchor.leashed}
            onChange={(e) => {
              actions.pushUndo();
              const leashed = e.target.checked;
              const dist = anchor.leashDistance ?? 2;
              const off = anchor.leashOffset ?? { x: 0, y: 0, z: 0 };
              const newScale = leashed ? 0.85 : 0.25;
              refs.setAnchorLeash.current?.(anchor, leashed, dist, off);
              refs.setAnchorScale.current?.(anchor, newScale);
              actions.setAnchors((prev) =>
                prev.map((a) =>
                  a.id === anchor.id
                    ? { ...a, leashed, leashDistance: dist, leashOffset: off, scale: newScale }
                    : a,
                ),
              );
            }}
          />
          Leash to Camera
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 winamp-label" style={{ paddingRight: 24 }}>
          <input
            type="checkbox"
            checked={anchor.visible}
            onChange={(e) => {
              actions.pushUndo();
              refs.setAnchorVisible.current?.(anchor, e.target.checked);
              actions.setAnchors((prev) =>
                prev.map((a) =>
                  a.id === anchor.id ? { ...a, visible: e.target.checked } : a,
                ),
              );
            }}
          />
          UI Visible
        </label>
      </div>

      {/* Leash controls */}
      {anchor.leashed && (
        <>
          <span className="winamp-label">Distance</span>
          <div className="mt-2">
            <ScrubInput
              value={anchor.leashDistance ?? 2}
              step={0.1}
              min={0.5}
              max={20}
              decimals={2}
              onChangeStart={actions.pushUndo}
              onChange={(v) => {
                const off = anchor.leashOffset ?? { x: 0, y: 0, z: 0 };
                refs.setAnchorLeash.current?.(anchor, true, v, off);
                actions.setAnchors((prev) =>
                  prev.map((a) =>
                    a.id === anchor.id ? { ...a, leashDistance: v } : a,
                  ),
                );
              }}
            />
          </div>

          <span className="mt-2 winamp-label">Offset</span>
          <div className="mt-2 flex flex-col gap-3">
            {(["x", "y", "z"] as const).map((axis) => (
              <ScrubInput
                key={`lo-${axis}`}
                label={axis.toUpperCase()}
                value={(anchor.leashOffset ?? { x: 0, y: 0, z: 0 })[axis]}
                step={0.01}
                decimals={3}
                onChangeStart={actions.pushUndo}
                onChange={(v) => {
                  const off = { ...(anchor.leashOffset ?? { x: 0, y: 0, z: 0 }), [axis]: v };
                  const dist = anchor.leashDistance ?? 2;
                  refs.setAnchorLeash.current?.(anchor, true, dist, off);
                  actions.setAnchors((prev) =>
                    prev.map((a) =>
                      a.id === anchor.id ? { ...a, leashOffset: off } : a,
                    ),
                  );
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Position (non-leashed) */}
      {!anchor.leashed && (
        <>
          <span className="mt-0 block winamp-label">Position</span>
          <div className="mt-2 flex flex-col gap-3">
            {(["x", "y", "z"] as const).map((axis) => (
              <ScrubInput
                key={`ap-${axis}`}
                label={axis.toUpperCase()}
                value={relPos[axis]}
                step={0.01}
                decimals={3}
                onChangeStart={actions.pushUndo}
                onChange={(v) => {
                  const newRel = { ...relPos, [axis]: v };
                  const newWorld = anchorToWorld(newRel);
                  refs.setAnchorPosition.current?.(anchor, newWorld);
                  actions.setAnchors((prev) =>
                    prev.map((a) =>
                      a.id === anchor.id ? { ...a, position: newWorld } : a,
                    ),
                  );
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Rotation */}
      {anchor.leashed ? (
        <>
          <div className="mt-2 mb-1 flex items-center justify-between">
            <span className="winamp-label">Rotation Offset</span>
            {(anchor.leashRotation?.x || anchor.leashRotation?.y || anchor.leashRotation?.z) ? (
              <button
                onClick={() => {
                  actions.pushUndo();
                  const zero = { x: 0, y: 0, z: 0 };
                  refs.setAnchorLeashRotation.current?.(anchor, zero);
                  actions.setAnchors((prev) =>
                    prev.map((a) =>
                      a.id === anchor.id ? { ...a, leashRotation: zero } : a,
                    ),
                  );
                }}
                className="winamp-btn-label text-[9px]"
              >
                Reset
              </button>
            ) : null}
          </div>
          <div className="winamp-rotation-fields flex flex-col gap-3">
            {(["x", "y", "z"] as const).map((axis) => (
              <ScrubInput
                key={`lr-${axis}`}
                label={axis.toUpperCase()}
                value={(anchor.leashRotation ?? { x: 0, y: 0, z: 0 })[axis]}
                step={1}
                min={-360}
                max={360}
                decimals={1}
                onChangeStart={actions.pushUndo}
                onChange={(v) => {
                  const newRot = { ...(anchor.leashRotation ?? { x: 0, y: 0, z: 0 }), [axis]: v };
                  refs.setAnchorLeashRotation.current?.(anchor, newRot);
                  actions.setAnchors((prev) =>
                    prev.map((a) =>
                      a.id === anchor.id ? { ...a, leashRotation: newRot } : a,
                    ),
                  );
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <span className="mt-2 winamp-label">Rotation</span>
          <div className="mt-2 winamp-rotation-fields flex flex-col gap-3">
            {(["x", "y", "z"] as const).map((axis) => (
              <ScrubInput
                key={`ar-${axis}`}
                label={axis.toUpperCase()}
                value={anchor.rotation[axis]}
                step={1}
                min={-360}
                max={360}
                decimals={1}
                onChangeStart={actions.pushUndo}
                onChange={(v) => {
                  const newRot = { ...anchor.rotation, [axis]: v };
                  refs.setAnchorRotation.current?.(anchor, newRot);
                  actions.setAnchors((prev) =>
                    prev.map((a) =>
                      a.id === anchor.id ? { ...a, rotation: newRot } : a,
                    ),
                  );
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Opacity + Scale sliders */}
      <div className="mt-2 winamp-anchor-sliders">
        <div className="flex-1 min-w-0">
          <Slider
            label="Opacity"
            value={anchor.opacity}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => {
              refs.setAnchorOpacity.current?.(anchor, v);
              actions.setAnchors((prev) =>
                prev.map((a) =>
                  a.id === anchor.id ? { ...a, opacity: v } : a,
                ),
              );
            }}
            onChangeStart={actions.pushUndo}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Slider
            label="Scale"
            value={anchor.leashed ? anchor.scale : anchor.scale / 0.25}
            min={0.01}
            max={2}
            step={0.01}
            onChange={(v) => {
              const raw = anchor.leashed ? v : v * 0.25;
              refs.setAnchorScale.current?.(anchor, raw);
              actions.setAnchors((prev) =>
                prev.map((a) =>
                  a.id === anchor.id ? { ...a, scale: raw } : a,
                ),
              );
            }}
            onChangeStart={actions.pushUndo}
          />
        </div>
      </div>

      {/* Animation */}
      <div className="mt-2">
        <span className="block winamp-label">
          Animation{anim ? ` (${anim.keyframes.length} kf)` : ""}
        </span>
        <div className="mt-1 flex gap-2">
          <button
            onClick={handleAddKeyframe}
            className="winamp-btn-label flex flex-1 items-center justify-center gap-1 text-[9px]"
          >
            + KF at {playbackState.currentTime.toFixed(2)}s
          </button>
          <button
            onClick={() => {
              if (!anim || anim.keyframes.length === 0) return;
              actions.pushUndo();
              actions.setAnchorAnimations((prev) =>
                prev.filter((a) => a.anchorId !== anchor.id),
              );
            }}
            className={`winamp-btn-label flex-1 text-[9px] ${!anim || anim.keyframes.length === 0 ? "pointer-events-none opacity-40" : ""}`}
          >
            Clear{anim && anim.keyframes.length > 0 ? ` (${anim.keyframes.length})` : ""}
          </button>
        </div>
      </div>

    </div>
  );
}
