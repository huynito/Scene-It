"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Crosshair,
  Plus,
  Diamond,
  X,
} from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import { MarqueeName } from "./AssetBrowser";
import CycleSelect from "@/components/ui/CycleSelect";
import { useScene } from "@/lib/scene-context";
import type { SceneAnchor } from "@/lib/scene-context";
import type { AnchorAnimation, AnchorKeyframe } from "@/lib/anchor-animation";
import { evaluateAnchorAnimation } from "@/lib/anchor-animation";
import { anchorColor } from "@/themes/_shared/anchor-colors";
import type { EasingType } from "@/lib/camera-path";
import { EASING_LABELS } from "@/lib/camera-path";
import Button from "@/components/ui/Button";
import Slider from "@/components/ui/Slider";
import ScrubInput from "../ScrubInput";

function EasingDropdown({ value, onChange }: { value: EasingType; onChange: (v: EasingType) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  return (
    <div className="relative ml-auto">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="easing-dropdown-trigger win95-dropdown-trigger flex items-center gap-1 rounded-md border border-surface-border-secondary px-2 py-0.5 text-[10px] text-content-primary outline-none"
      >
        <span>{EASING_LABELS[value]}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="easing-dropdown-menu tone-mapping-menu fixed rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg z-[9999]"
          style={(() => {
            const r = btnRef.current?.getBoundingClientRect();
            if (!r) return {};
            const opts = Object.keys(EASING_LABELS);
            const menuH = opts.length * 28 + 8;
            const spaceBelow = window.innerHeight - r.bottom;
            const openUp = spaceBelow < menuH && r.top > menuH;
            return openUp
              ? { left: r.left, bottom: window.innerHeight - r.top + 4, minWidth: r.width }
              : { left: r.left, top: r.bottom + 4, minWidth: r.width };
          })()}
        >
          {(Object.keys(EASING_LABELS) as EasingType[]).map((key) => (
            <button
              key={key}
              onClick={() => { onChange(key); close(); }}
              className={`block w-full px-3 py-1 text-left text-[11px] hover:bg-surface-border-secondary ${
                value === key ? "text-accent-400 font-semibold" : "text-content-primary"
              }`}
            >
              {EASING_LABELS[key]}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default function AnchorPanel() {
  const {
    anchors,
    selectedAnchorId,
    anchorAnimations,
    cameraTargetAnchorId,
    playbackState,
    sceneOrigin,
    actions,
    refs,
  } = useScene();

  const anchorToRel = (world: { x: number; y: number; z: number }) => {
    const dx = world.x - sceneOrigin.position.x;
    const dz = world.z - sceneOrigin.position.z;
    const cos = Math.cos(-sceneOrigin.yaw);
    const sin = Math.sin(-sceneOrigin.yaw);
    return {
      x: dx * cos - dz * sin,
      y: world.y - sceneOrigin.eyeHeight,
      z: dx * sin + dz * cos,
    };
  };

  const anchorToWorld = (rel: { x: number; y: number; z: number }) => {
    const cos = Math.cos(sceneOrigin.yaw);
    const sin = Math.sin(sceneOrigin.yaw);
    return {
      x: rel.x * cos - rel.z * sin + sceneOrigin.position.x,
      y: rel.y + sceneOrigin.eyeHeight,
      z: rel.x * sin + rel.z * cos + sceneOrigin.position.z,
    };
  };
  const cap = useThemeCapabilities();
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isWin95 = cap.iconStyle === "win95-pixel";
  const [showAnimSection, setShowAnimSection] = useState<string | null>(null);
  const [easingMenuAnchor, setEasingMenuAnchor] = useState<{ anchorId: string; kfIdx: number } | null>(null);
  const easingBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const easingMenuRef = useRef<HTMLDivElement>(null);
  const isSciin = cap.usesTextControls;

  useEffect(() => {
    if (!easingMenuAnchor) return;
    const handleClick = (e: MouseEvent) => {
      if (easingMenuRef.current && !easingMenuRef.current.contains(e.target as Node)) {
        setEasingMenuAnchor(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [easingMenuAnchor]);

  const getAnimForAnchor = (anchorId: string): AnchorAnimation | undefined =>
    anchorAnimations.find(a => a.anchorId === anchorId);

  const handleAddAnchorKeyframe = (anchor: SceneAnchor) => {
 actions.pushUndo();
    const time = playbackState.currentTime;
    const kf: AnchorKeyframe = {
      time,
      position: { ...anchor.position },
      rotation: { ...anchor.rotation },
      easing: "linear" as EasingType,
    };

    const existing = getAnimForAnchor(anchor.id);
    if (existing) {
      const updated: AnchorAnimation = {
        ...existing,
        keyframes: [...existing.keyframes, kf].sort((a, b) => a.time - b.time),
      };
      actions.setAnchorAnimations(prev =>
        prev.map(a => a.anchorId === anchor.id ? updated : a),
      );
    } else {
      actions.setAnchorAnimations(prev => [
        ...prev,
        { anchorId: anchor.id, keyframes: [kf] },
      ]);
    }
  };

  const TIME_EPSILON = 0.001;

  const upsertAnchorKeyframe = (
    anchorId: string,
    time: number,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
  ) => {
    const existing = getAnimForAnchor(anchorId);
    if (!existing) return;

    const matchIdx = existing.keyframes.findIndex(
      (kf) => Math.abs(kf.time - time) < TIME_EPSILON,
    );

    let newKeyframes: AnchorKeyframe[];
    if (matchIdx >= 0) {
      newKeyframes = existing.keyframes.map((kf, i) =>
        i === matchIdx ? { ...kf, position: { ...position }, rotation: { ...rotation } } : kf,
      );
    } else {
      const kf: AnchorKeyframe = {
        time,
        position: { ...position },
        rotation: { ...rotation },
        easing: "linear" as EasingType,
      };
      newKeyframes = [...existing.keyframes, kf].sort((a, b) => a.time - b.time);
    }

    actions.setAnchorAnimations((prev) =>
      prev.map((a) =>
        a.anchorId === anchorId ? { ...a, keyframes: newKeyframes } : a,
      ),
    );
  };

  const handleDeleteAnchorKeyframe = (anchorId: string, kfIndex: number) => {
    actions.pushUndo();
    actions.setAnchorAnimations(prev =>
      prev
        .map(a => {
          if (a.anchorId !== anchorId) return a;
          const kfs = a.keyframes.filter((_, i) => i !== kfIndex);
          return { ...a, keyframes: kfs };
        })
        .filter(a => a.keyframes.length > 0),
    );
  };

  const handleAnchorKfEasing = (anchorId: string, kfIndex: number, easing: EasingType) => {
    actions.pushUndo();
    actions.setAnchorAnimations(prev =>
      prev.map(a => {
        if (a.anchorId !== anchorId) return a;
        return {
          ...a,
          keyframes: a.keyframes.map((kf, i) =>
            i === kfIndex ? { ...kf, easing } : kf,
          ),
        };
      }),
    );
  };

  if (isWinamp) {
    return (
      <div className="flex flex-col gap-2">
        <div className="winamp-playlist" style={{ minHeight: 80 }}>
          {anchors.length === 0 ? (
            <div className="winamp-playlist-empty">
              <span>No anchors yet</span>
              <span className="empty-sub">Place an anchor to start attaching UI</span>
            </div>
          ) : (
            anchors.map((anchor, idx) => {
              const isSelected = selectedAnchorId === anchor.id;
              const isTargeted = cameraTargetAnchorId === anchor.id;
              return (
                <div key={anchor.id}>
                  <div
                    className={`winamp-playlist-row${isSelected ? " selected" : ""}`}
                    onClick={() => actions.setSelectedAnchorId(isSelected ? null : anchor.id)}
                  >
                    <span className="playlist-num">{idx + 1}.</span>
                    <MarqueeName name={anchor.label} />
                    {isTargeted && <span className="playlist-info">target</span>}
                    {anchor.mediaType && !isTargeted && (
                      <span className="playlist-info">{anchor.mediaType}</span>
                    )}
                    <span className="playlist-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.setCameraTargetAnchorId(isTargeted ? null : anchor.id);
                        }}
                        title={isTargeted ? "Clear camera target" : "Target camera"}
                      >
                        <Crosshair className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.pushUndo();
                          if (anchor.mediaUrl) URL.revokeObjectURL(anchor.mediaUrl);
                          refs.removeAnchor.current?.(anchor);
                          if (isSelected) actions.setSelectedAnchorId(null);
                          if (isTargeted) actions.setCameraTargetAnchorId(null);
                          actions.setAnchors((prev) =>
                            prev.filter((a) => a.id !== anchor.id),
                          );
                          actions.setAnchorAnimations(prev =>
                            prev.filter(a => a.anchorId !== anchor.id),
                          );
                        }}
                        title="Delete"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {isSciin ? (
        <button
          type="button"
          className="sciin-toolbar-btn font-bold text-[11px] w-full py-1"
          onClick={() => {
            actions.pushUndo();
            const result = refs.createAnchor.current?.();
            if (result) {
              actions.setAnchors((prev) => [...prev, result]);
            }
          }}
        >
          [+ Place Anchor]
        </button>
      ) : (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            actions.pushUndo();
            const result = refs.createAnchor.current?.();
            if (result) {
              actions.setAnchors((prev) => [...prev, result]);
            }
          }}
        >
          + Place Anchor
        </Button>
      )}

      {anchors.length === 0 && (
        isSciin ? (
          <div className="mt-4" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
            No anchors yet
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-surface-border-secondary px-4 py-10 text-center">
            <p className="text-[11px] text-content-muted">No anchors yet</p>
            <p className="mt-1 text-[10px] text-content-faint">
              Place an anchor to start attaching UI
            </p>
          </div>
        )
      )}

      {anchors.map((anchor) => {
        const isSelected = selectedAnchorId === anchor.id;
        const isTargeted = cameraTargetAnchorId === anchor.id;
        const isAnimOpen = showAnimSection === anchor.id;
        const anim = getAnimForAnchor(anchor.id);

        return (
          <div
            key={anchor.id}
            className={isSciin
              ? "mt-4"
              : `win95-group-box rounded-lg border transition-colors ${
                  isSelected
                    ? "border-accent-500/60 bg-accent-500/10"
                    : "border-surface-border bg-surface-raised/40 hover:border-surface-border-secondary"
                }`
            }
          >
            {/* Anchor row header */}
            <div
              className={`flex cursor-pointer items-center ${isSciin ? "" : "gap-2 p-2"}`}
              onClick={() => {
                actions.setSelectedAnchorId(isSelected ? null : anchor.id);
              }}
            >
              {isSciin ? (
                <span className="shrink-0 font-bold text-[10px]" style={{ color: anchorColor(anchor.id) }}>[#]</span>
              ) : (
                <>
                  <div
                    className="win95-color-swatch h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: anchorColor(anchor.id) }}
                  />
                  {anchor.mediaUrl ? (
                    <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded">
                      <img
                        src={anchor.mediaThumbnailUrl ?? anchor.mediaUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-surface-border-secondary bg-surface-raised">
                      <ThemeIcon icon={ImageIcon} className="h-3 w-3 text-content-faint" />
                    </div>
                  )}
                </>
              )}
              <span className={`flex-1 truncate text-xs font-medium text-content-primary ${isSciin ? "ml-2" : ""}`}>
                {anchor.label}
              </span>
              {isTargeted && (
                <span className="text-[10px] text-accent-400">target</span>
              )}
              {isSelected && !isTargeted && (
                <span className="text-[10px] text-accent-400">selected</span>
              )}
              {isSciin ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.setCameraTargetAnchorId(isTargeted ? null : anchor.id);
                    }}
                    className="sciin-toolbar-btn font-bold text-[10px]"
                    title={isTargeted ? "Clear camera target" : "Target camera at this anchor"}
                  >
                    [{isTargeted ? "TGT" : "+"}]
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.pushUndo();
                      if (anchor.mediaUrl) URL.revokeObjectURL(anchor.mediaUrl);
                      refs.removeAnchor.current?.(anchor);
                      if (isSelected) actions.setSelectedAnchorId(null);
                      if (isTargeted) actions.setCameraTargetAnchorId(null);
                      actions.setAnchors((prev) =>
                        prev.filter((a) => a.id !== anchor.id),
                      );
                      actions.setAnchorAnimations(prev =>
                        prev.filter(a => a.anchorId !== anchor.id),
                      );
                    }}
                    className="sciin-toolbar-btn font-bold text-[10px]"
                  >
                    [X]
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.setCameraTargetAnchorId(isTargeted ? null : anchor.id);
                    }}
                    className={`win95-icon-btn-sm rounded p-1 transition-colors ${
                      isTargeted
                        ? "bg-accent-500/20 text-accent-400"
                        : "text-content-faint hover:text-content-primary"
                    }`}
                    title={isTargeted ? "Clear camera target" : "Target camera at this anchor"}
                  >
                    <ThemeIcon icon={Crosshair} className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.pushUndo();
                      if (anchor.mediaUrl) URL.revokeObjectURL(anchor.mediaUrl);
                      refs.removeAnchor.current?.(anchor);
                      if (isSelected) actions.setSelectedAnchorId(null);
                      if (isTargeted) actions.setCameraTargetAnchorId(null);
                      actions.setAnchors((prev) =>
                        prev.filter((a) => a.id !== anchor.id),
                      );
                      actions.setAnchorAnimations(prev =>
                        prev.filter(a => a.anchorId !== anchor.id),
                      );
                    }}
                    className="win95-icon-btn-sm rounded p-1 text-content-faint hover:text-content-primary"
                  >
                    <ThemeIcon icon={X} className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Expanded properties */}
            {isSelected && (
              <div className="border-t border-surface-border px-2 pb-3 pt-2">
                {/* Billboard (hidden when leashed — leash uses full camera-facing internally) */}
                {!anchor.leashed && (
                  <>
                    <div className="mb-1 text-[10px] text-content-muted">Billboard</div>
                    <div className="mb-3 flex gap-1">
                      {(["none", "y-axis"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            actions.pushUndo();
                            refs.setAnchorBillboard.current?.(anchor, mode);
                            actions.setAnchors((prev) =>
                              prev.map((a) =>
                                a.id === anchor.id
                                  ? { ...a, billboardMode: mode }
                                  : a,
                              ),
                            );
                          }}
                          className={isSciin
                            ? `sciin-toolbar-btn font-bold text-[10px] ${anchor.billboardMode === mode ? "text-accent-400" : ""}`
                            : `rounded px-2 py-0.5 text-[10px] transition-colors ${
                                anchor.billboardMode === mode
                                  ? "bg-accent-500 text-white"
                                  : "bg-surface-border-secondary text-content-secondary hover:bg-content-faint"
                              }`
                          }
                        >
                          {isSciin ? `[${mode === "none" ? "Off" : "Face"}]` : (mode === "none" ? "Off" : "Face Camera")}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Leash to Camera */}
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-[11px] text-content-primary">
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
                          a.id === anchor.id ? { ...a, leashed, leashDistance: dist, leashOffset: off, scale: newScale } : a,
                        ),
                      );
                    }}
                    className="accent-accent-500"
                  />
                  Leash to Camera
                </label>

                {anchor.leashed && (
                  <>
                    <div className="mb-1 text-[10px] text-content-muted">Distance</div>
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

                    <div className="mb-1 mt-2 text-[10px] text-content-muted">Offset</div>
                    {(["x", "y", "z"] as const).map((axis) => (
                      <div key={`lo-${anchor.id}-${axis}`} className="mt-1">
                        <ScrubInput
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
                      </div>
                    ))}
                  </>
                )}

                {/* Position */}
                {!anchor.leashed && (
                  <>
                    <div className="mb-1 text-[10px] text-content-muted">Position</div>
                    {(["x", "y", "z"] as const).map((axis) => {
                      const anim = getAnimForAnchor(anchor.id);
                      const animResult = anim && anim.keyframes.length > 0
                        ? evaluateAnchorAnimation(anim, playbackState.currentTime)
                        : null;
                      const displayPos = animResult ? animResult.position : anchor.position;
                      const relPos = anchorToRel(displayPos);
                      return (
                        <div key={`ap-${anchor.id}-${axis}`} className="mt-1">
                          <ScrubInput
                            label={axis.toUpperCase()}
                            value={relPos[axis]}
                            step={0.01}
                            decimals={3}
                            onChangeStart={actions.pushUndo}
                            onChange={(v) => {
                              const basePos = animResult ? animResult.position : anchor.position;
                              const newRel = { ...anchorToRel(basePos), [axis]: v };
                              const newWorld = anchorToWorld(newRel);
                              refs.setAnchorPosition.current?.(anchor, newWorld);
                              actions.setAnchors((prev) =>
                                prev.map((a) =>
                                  a.id === anchor.id
                                    ? { ...a, position: newWorld }
                                    : a,
                                ),
                              );
                              if (anim && anim.keyframes.length > 0) {
                                upsertAnchorKeyframe(anchor.id, playbackState.currentTime, newWorld, anchor.rotation);
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Rotation */}
                {anchor.leashed ? (
                  <>
                    <div className="mb-1 mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-content-muted">Rotation Offset</span>
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
                          className="text-[9px] text-content-faint hover:text-content-primary"
                        >
                          Reset
                        </button>
                      ) : null}
                    </div>
                    {(["x", "y", "z"] as const).map((axis) => (
                      <div key={`lr-${anchor.id}-${axis}`} className="mt-1">
                        <ScrubInput
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
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="mb-1 mt-2 text-[10px] text-content-muted">
                      Rotation
                    </div>
                    {(["x", "y", "z"] as const).map((axis) => {
                      const originYawDeg = sceneOrigin.yaw * (180 / Math.PI);
                      const displayVal = axis === "y"
                        ? anchor.rotation.y - originYawDeg
                        : anchor.rotation[axis];
                      return (
                      <div key={`ar-${anchor.id}-${axis}`} className="mt-1">
                        <ScrubInput
                          label={axis.toUpperCase()}
                          value={displayVal}
                          step={1}
                          min={-360}
                          max={360}
                          decimals={1}
                          onChangeStart={actions.pushUndo}
                          onChange={(v) => {
                            const worldVal = axis === "y" ? v + originYawDeg : v;
                            const newRot = { ...anchor.rotation, [axis]: worldVal };
                            refs.setAnchorRotation.current?.(anchor, newRot);
                            actions.setAnchors((prev) =>
                              prev.map((a) =>
                                a.id === anchor.id
                                  ? { ...a, rotation: newRot }
                                  : a,
                              ),
                            );
                          }}
                        />
                      </div>
                      );
                    })}
                  </>
                )}

                {/* Opacity */}
                <div className="mt-2">
                  <Slider
                    label="Opacity"
                    value={anchor.opacity}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(v) => `${Math.round(v * 100)}%`}
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

                {/* Scale */}
                <div className="mt-2">
                  <Slider
                    label="Scale"
                    value={anchor.leashed ? anchor.scale : anchor.scale / 0.25}
                    min={0.01}
                    max={2}
                    step={0.01}
                    format={(v) => `${v.toFixed(2)}x`}
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

                {/* Animation keyframes */}
                <div className={`mt-3 border-t border-surface-border pt-2 ${isWin95 ? "pb-3" : ""}`}>
                  <button
                    onClick={() => setShowAnimSection(isAnimOpen ? null : anchor.id)}
                    className={`mb-1 flex w-full items-center ${
                      isWin95
                        ? "win95-subsection-btn justify-center text-[11px]"
                        : "justify-between text-[10px] font-semibold uppercase tracking-wider text-content-muted"
                    }`}
                  >
                    <span>Animation {anim ? `(${anim.keyframes.length} kf)` : ""}</span>
                    {!isWin95 && (isAnimOpen ? <ThemeIcon icon={ChevronUp} className="h-3 w-3" /> : <ThemeIcon icon={ChevronDown} className="h-3 w-3" />)}
                  </button>

                  {isAnimOpen && (
                    <div className="flex flex-col gap-1.5">
                      {isSciin ? (
                        <button
                          onClick={() => handleAddAnchorKeyframe(anchor)}
                          className="sciin-toolbar-btn font-bold text-[10px] text-left"
                        >
                          [+ KF at {playbackState.currentTime.toFixed(2)}s]
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddAnchorKeyframe(anchor)}
                          className="flex items-center gap-1 rounded bg-surface-raised px-2 py-1 text-[10px] text-content-secondary transition-colors hover:bg-surface-border-secondary hover:text-content-primary"
                        >
                          <ThemeIcon icon={Plus} className="h-3 w-3" />
                          Add keyframe at {playbackState.currentTime.toFixed(2)}s
                        </button>
                      )}

                      {anim && anim.keyframes.length > 0 ? (
                        <div className="max-h-36 space-y-1 overflow-y-auto scrollbar-thin">
                          {anim.keyframes.map((kf, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-1 px-1.5 py-1 text-[10px] ${isSciin ? "" : "rounded bg-surface-raised/60"}`}
                            >
                              {!isSciin && (
                                <ThemeIcon icon={Diamond} className="h-2.5 w-2.5 flex-shrink-0 fill-accent-400 text-accent-400" />
                              )}
                              <span className="tabular-nums text-content-secondary">
                                {kf.time.toFixed(2)}s
                              </span>
                              <EasingDropdown
                                value={kf.easing}
                                onChange={(v) => handleAnchorKfEasing(anchor.id, idx, v)}
                              />
                              <button
                                onClick={() => handleDeleteAnchorKeyframe(anchor.id, idx)}
                                className="text-content-faint hover:text-red-400"
                              >
                                <ThemeIcon icon={Trash2} className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-1 text-center text-[10px] text-content-faint">
                          No keyframes yet
                        </p>
                      )}

                      {anim && anim.keyframes.length > 0 && (
                        <button
                          onClick={() => {
                            actions.pushUndo();
                            actions.setAnchorAnimations(prev =>
                              prev.filter(a => a.anchorId !== anchor.id),
                            );
                          }}
                          className="text-[10px] text-content-faint hover:text-red-400"
                        >
                          Clear animation
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Media */}
                {isWin95 ? (
                  <fieldset className="win95-fieldset mt-8">
                    <legend className="win95-legend">Media</legend>
                    {anchor.mediaUrl ? (
                      <div className="flex items-start gap-2">
                        <div className="h-14 w-20 flex-shrink-0 overflow-hidden border border-surface-border-secondary">
                          <img
                            src={anchor.mediaThumbnailUrl ?? anchor.mediaUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col items-start gap-1 pt-0.5">
                          <span className="text-[10px] capitalize text-content-muted">
                            {anchor.mediaType}
                          </span>
                          <button
                            onClick={() => {
                              actions.pushUndo();
                              if (anchor.mediaUrl)
                                URL.revokeObjectURL(anchor.mediaUrl);
                              refs.rebuildAnchor.current?.(anchor, anchor.width, anchor.height, anchor.cornerRadius ?? 0, true);
                              actions.setAnchors((prev) =>
                                prev.map((a) =>
                                  a.id === anchor.id
                                    ? {
                                        ...a,
                                        mediaUrl: undefined,
                                        mediaThumbnailUrl: undefined,
                                        mediaType: undefined,
                                        mediaAspectRatio: undefined,
                                      }
                                    : a,
                                ),
                              );
                            }}
                            className="win95-icon-btn-sm"
                            title="Remove media"
                          >
                            <ThemeIcon icon={Trash2} className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="px-3 py-2 text-center text-[10px] text-content-faint">
                        Select media in the library below to assign
                      </p>
                    )}
                  </fieldset>
                ) : (
                  <div className="mt-3 border-t border-surface-border pt-2">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-content-muted">
                      Media
                    </div>

                    {anchor.mediaUrl ? (
                      <div className="flex items-start gap-2">
                        <div className="h-14 w-20 flex-shrink-0 overflow-hidden rounded border border-surface-border-secondary">
                          <img
                            src={anchor.mediaThumbnailUrl ?? anchor.mediaUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col gap-1 pt-0.5">
                          <span className="text-[10px] capitalize text-content-muted">
                            {anchor.mediaType}
                          </span>
                          <button
                            onClick={() => {
                              actions.pushUndo();
                              if (anchor.mediaUrl)
                                URL.revokeObjectURL(anchor.mediaUrl);
                              refs.rebuildAnchor.current?.(anchor, anchor.width, anchor.height, anchor.cornerRadius ?? 0, true);
                              actions.setAnchors((prev) =>
                                prev.map((a) =>
                                  a.id === anchor.id
                                    ? {
                                        ...a,
                                        mediaUrl: undefined,
                                        mediaThumbnailUrl: undefined,
                                        mediaType: undefined,
                                        mediaAspectRatio: undefined,
                                      }
                                    : a,
                                ),
                              );
                            }}
                            className="text-left text-[10px] text-content-faint hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-[10px] text-content-faint ${isSciin ? "py-1" : "rounded border border-dashed border-surface-border-secondary px-3 py-2 text-center"}`}>
                        {isSciin ? "No media assigned" : "Select media in the library below to assign"}
                      </p>
                    )}
                  </div>
                )}

                {/* Visibility */}
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-content-primary">
                  <input
                    type="checkbox"
                    checked={anchor.visible}
                    onChange={(e) => {
                      actions.pushUndo();
                      refs.setAnchorVisible.current?.(anchor, e.target.checked);
                      actions.setAnchors((prev) =>
                        prev.map((a) =>
                          a.id === anchor.id
                            ? { ...a, visible: e.target.checked }
                            : a,
                        ),
                      );
                    }}
                    className="accent-accent-500"
                  />
                  Visible
                </label>
              </div>
            )}
          </div>
        );
      })}

      {anchors.length > 1 && (
        isSciin ? (
          <button
            type="button"
            className="sciin-toolbar-btn font-bold text-[11px] w-full py-1 mt-[16px]"
            onClick={() => {
              actions.pushUndo();
              anchors.forEach((a) => {
                if (a.mediaUrl) URL.revokeObjectURL(a.mediaUrl);
                refs.removeAnchor.current?.(a);
              });
              actions.setAnchors([]);
              actions.setSelectedAnchorId(null);
              actions.setCameraTargetAnchorId(null);
              actions.setAnchorAnimations([]);
            }}
          >
            [Clear All ({anchors.length})]
          </button>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              actions.pushUndo();
              anchors.forEach((a) => {
                if (a.mediaUrl) URL.revokeObjectURL(a.mediaUrl);
                refs.removeAnchor.current?.(a);
              });
              actions.setAnchors([]);
              actions.setSelectedAnchorId(null);
              actions.setCameraTargetAnchorId(null);
              actions.setAnchorAnimations([]);
            }}
          >
            Clear All ({anchors.length})
          </Button>
        )
      )}
    </div>
  );
}
