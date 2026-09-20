"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Trash2,
  Download,
  Upload,
  Copy,
  Check,
  Circle,
  Shield,
  ChevronDown,
} from "lucide-react";
import { useScene } from "@/lib/scene-context";
import {
  serializePath,
  deserializePath,
  deserializeBakedPath,
  deserializeExchangeFormat,
  pathDuration,
  bakedPathDuration,
  formatDuration,
} from "@/lib/camera-path";
import type { CameraPath, BakedCameraPath } from "@/lib/camera-path";
import type { CameraPathPreset } from "@/lib/scene-preset";
import type { WalkSpeedPreset } from "@/lib/walk-style";
import {
  WALK_STYLES,
  WALK_STYLE_IDS,
  WALK_SPEED_IDS,
  WALK_SPEED_LABELS,
} from "@/lib/walk-style";
import Panel from "@/components/ui/Panel";
import IconButton from "@/components/ui/IconButton";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import CycleSelect from "@/components/ui/CycleSelect";


export default function PathPanel() {
  const {
    paths,
    activePathId,
    bakedPaths,
    activeBakedPathId,
    collisionEnabled,
    activePreset,
    walkStylePreset,
    walkSpeedPreset,
    walkIntensity,
    actions,
    refs,
  } = useScene();

  const fileRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingPresetId, setSavingPresetId] = useState<string | null>(null);
  const [savePresetName, setSavePresetName] = useState("");
  const [retimeValue, setRetimeValue] = useState("");
  const [retimeWarning, setRetimeWarning] = useState<string | null>(null);

  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const styleBtnRef = useRef<HTMLButtonElement>(null);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  const cap = useThemeCapabilities();
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isAim = cap.layoutShell === "xp-desktop";
  const isSkeuomorphic = isWin95 || isAim;
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isSciin = cap.usesTextControls;
  const isScenit = cap.layoutShell === "scenit-grid";
  const intensityFill = walkIntensity * 100;

  useEffect(() => {
    if (!styleMenuOpen && !speedMenuOpen) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (styleMenuOpen && styleMenuRef.current && !styleMenuRef.current.contains(t) && styleBtnRef.current && !styleBtnRef.current.contains(t))
        setStyleMenuOpen(false);
      if (speedMenuOpen && speedMenuRef.current && !speedMenuRef.current.contains(t) && speedBtnRef.current && !speedBtnRef.current.contains(t))
        setSpeedMenuOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setStyleMenuOpen(false); setSpeedMenuOpen(false); }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [styleMenuOpen, speedMenuOpen]);

  const presetPaths = activePreset?.cameraPathPresets ?? [];

  const hasCollisionPolygons =
    !!activePreset && activePreset.collisionPolygons.length > 0;

  const handleDelete = (id: string) => {
    actions.pushUndo();
    if (refs.liveWalkPathId.current === id) {
      actions.finalizeWalkWaypoints();
    }
    actions.setPaths((prev) => prev.filter((p) => p.id !== id));
    if (activePathId === id) {
      actions.setActivePathId(null);
    }
  };

  const handleDuplicate = (path: CameraPath) => {
    actions.pushUndo();
    const dup: CameraPath = {
      ...path,
      id: `path-${Date.now()}`,
      name: `${path.name} (copy)`,
      keyframes: path.keyframes.map((k) => ({
        ...k,
        id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    };
    actions.setPaths((prev) => [...prev, dup]);
    actions.setActivePathId(dup.id);
  };

  const handleExport = (path: CameraPath) => {
    const json = serializePath(path);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${path.name.replace(/[^a-z0-9]/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      actions.pushUndo();

      const exchange = deserializeExchangeFormat(text);
      if (exchange) {
        if ("keyframes" in exchange) {
          actions.setPaths((prev) => [...prev, exchange as CameraPath]);
          actions.setActivePathId(exchange.id);
          actions.setActiveBakedPathId(null);
        } else {
          actions.setBakedPaths((prev) => [...prev, exchange as BakedCameraPath]);
          actions.setActiveBakedPathId(exchange.id);
          actions.setActivePathId(null);
        }
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const baked = deserializeBakedPath(text);
      if (baked) {
        baked.id = `baked-${Date.now()}`;
        actions.setBakedPaths((prev) => [...prev, baked]);
        actions.setActiveBakedPathId(baked.id);
        actions.setActivePathId(null);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const path = deserializePath(text);
      if (path) {
        path.id = `path-${Date.now()}`;
        actions.setPaths((prev) => [...prev, path]);
        actions.setActivePathId(path.id);
        actions.setActiveBakedPathId(null);
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleLoadPreset = (preset: CameraPathPreset) => {
    actions.pushUndo();
    const p: CameraPath = {
      id: `path-${Date.now()}`,
      name: preset.name,
      keyframes: preset.positions.map((kf) => ({ ...kf })),
      loop: false,
      splineMode: "catmullRom",
    };
    actions.setPaths((prev) => [...prev, p]);
    actions.setActivePathId(p.id);
  };

  const handleStartRename = (path: CameraPath) => {
    setEditingId(path.id);
    setEditName(path.name);
  };

  const handleCommitRename = () => {
    if (!editingId) return;
    actions.pushUndo();
    actions.setPaths((prev) =>
      prev.map((p) =>
        p.id === editingId
          ? { ...p, name: editName.trim() || p.name }
          : p
      )
    );
    setEditingId(null);
  };

  const walkGenContent = (
    <div className={`flex flex-col ${isSciin ? "gap-4" : "gap-1.5"}`}>
      <p className={`text-[10px] leading-relaxed ${isWinamp ? "winamp-chrome-text" : "text-content-muted"}`}>
        {WALK_STYLES[walkStylePreset]?.description ?? ""}
      </p>
      <div className="flex items-center gap-2">
        <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
          <label className={`text-[10px] ${isWinamp ? "winamp-label" : "text-content-muted"}`}>Style</label>
          {isSciin ? (
            <CycleSelect
              options={[
                { value: "casual", label: "CSL", color: "#00FFFF" },
                { value: "steadicam", label: "STD", color: "#FFFF00" },
                { value: "architectural", label: "ARC", color: "#00FF00" },
              ]}
              value={walkStylePreset}
              onChange={(v) => actions.setWalkStylePreset(v)}
            />
          ) : isWinamp || isWin95 || isScenit ? (
            <>
              {isWinamp ? (
                <div className="winamp-btn-tray w-full">
                  <button
                    ref={styleBtnRef}
                    onClick={() => { setStyleMenuOpen((v) => !v); setSpeedMenuOpen(false); }}
                    className="winamp-btn-label-blue flex w-full items-center justify-between text-[10px]"
                  >
                    <span>{WALK_STYLES[walkStylePreset]?.name ?? walkStylePreset}</span>
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  ref={styleBtnRef}
                  onClick={() => { setStyleMenuOpen((v) => !v); setSpeedMenuOpen(false); }}
                  className={`${isScenit ? "walk-dropdown-trigger" : "win95-dropdown-trigger"} flex w-full items-center justify-between text-[11px]`}
                >
                  <span>{WALK_STYLES[walkStylePreset]?.name ?? walkStylePreset}</span>
                </button>
              )}
              {styleMenuOpen && createPortal(
                <div
                  ref={styleMenuRef}
                  className={`fixed rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg z-[9999]${isScenit ? " walk-dropdown-menu" : ""}`}
                  style={(() => {
                    const r = styleBtnRef.current?.getBoundingClientRect();
                    if (!r) return {};
                    const menuH = WALK_STYLE_IDS.length * 26 + 8;
                    const fitsBelow = r.bottom + 2 + menuH < window.innerHeight;
                    return { left: r.left, minWidth: r.width, ...(fitsBelow ? { top: r.bottom + 2 } : { top: r.top - menuH - 2 }) };
                  })()}
                >
                  {WALK_STYLE_IDS.map((id) => (
                    <button
                      key={id}
                      onClick={() => { actions.setWalkStylePreset(id); setStyleMenuOpen(false); }}
                      className={`block w-full px-3 py-1 text-left text-[11px] ${walkStylePreset === id ? "font-bold" : ""}`}
                    >
                      {WALK_STYLES[id].name}
                    </button>
                  ))}
                </div>,
                document.body,
              )}
            </>
          ) : (
            <select
              value={walkStylePreset}
              onChange={(e) => actions.setWalkStylePreset(e.target.value)}
              className="w-full rounded border border-surface-border-secondary bg-surface-raised px-1.5 py-1 text-[11px] text-content-primary outline-none"
            >
              {WALK_STYLE_IDS.map((id) => (
                <option key={id} value={id}>
                  {WALK_STYLES[id].name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
          <label className={`text-[10px] ${isWinamp ? "winamp-label" : "text-content-muted"}`}>Speed</label>
          {isSciin ? (
            <CycleSelect
              options={[
                { value: "slow" as WalkSpeedPreset, label: "SLW", color: "#2A2AFF" },
                { value: "medium" as WalkSpeedPreset, label: "MED", color: "#FFFF00" },
                { value: "fast" as WalkSpeedPreset, label: "FST", color: "#FF0000" },
              ]}
              value={walkSpeedPreset}
              onChange={(v) => actions.setWalkSpeedPreset(v)}
            />
          ) : isWinamp || isWin95 || isScenit ? (
            <>
              {isWinamp ? (
                <div className="winamp-btn-tray w-full">
                  <button
                    ref={speedBtnRef}
                    onClick={() => { setSpeedMenuOpen((v) => !v); setStyleMenuOpen(false); }}
                    className="winamp-btn-label-blue flex w-full items-center justify-between text-[10px]"
                  >
                    <span>{WALK_SPEED_LABELS[walkSpeedPreset] ?? walkSpeedPreset}</span>
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  ref={speedBtnRef}
                  onClick={() => { setSpeedMenuOpen((v) => !v); setStyleMenuOpen(false); }}
                  className={`${isScenit ? "walk-dropdown-trigger" : "win95-dropdown-trigger"} flex w-full items-center justify-between text-[11px]`}
                >
                  <span>{WALK_SPEED_LABELS[walkSpeedPreset] ?? walkSpeedPreset}</span>
                </button>
              )}
              {speedMenuOpen && createPortal(
                <div
                  ref={speedMenuRef}
                  className={`fixed rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg z-[9999]${isScenit ? " walk-dropdown-menu" : ""}`}
                  style={(() => {
                    const r = speedBtnRef.current?.getBoundingClientRect();
                    if (!r) return {};
                    const menuH = WALK_SPEED_IDS.length * 26 + 8;
                    const fitsBelow = r.bottom + 2 + menuH < window.innerHeight;
                    return { left: r.left, minWidth: r.width, ...(fitsBelow ? { top: r.bottom + 2 } : { top: r.top - menuH - 2 }) };
                  })()}
                >
                  {WALK_SPEED_IDS.map((id) => (
                    <button
                      key={id}
                      onClick={() => { actions.setWalkSpeedPreset(id as WalkSpeedPreset); setSpeedMenuOpen(false); }}
                      className={`block w-full px-3 py-1 text-left text-[11px] ${walkSpeedPreset === id ? "font-bold" : ""}`}
                    >
                      {WALK_SPEED_LABELS[id]}
                    </button>
                  ))}
                </div>,
                document.body,
              )}
            </>
          ) : (
            <select
              value={walkSpeedPreset}
              onChange={(e) => actions.setWalkSpeedPreset(e.target.value as WalkSpeedPreset)}
              className="w-full rounded border border-surface-border-secondary bg-surface-raised px-1.5 py-1 text-[11px] text-content-primary outline-none"
            >
              {WALK_SPEED_IDS.map((id) => (
                <option key={id} value={id}>
                  {WALK_SPEED_LABELS[id]}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {isSciin ? (
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-content-muted">Intensity</label>
            <span className="text-[10px] tabular-nums text-content-secondary">
              {Math.round(walkIntensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step="any"
            value={Math.round(walkIntensity * 100)}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const t = raw / 100;
              const idx = Math.round(t * 24);
              const snapped = Math.max(0, Math.min(24, idx)) / 24 * 100;
              actions.setWalkIntensity(snapped / 100);
            }}
            className="h-1 min-w-0 w-full appearance-none rounded-full bg-surface-border-secondary accent-accent-500 sciin-thumb-yellow"
            style={{ "--sciin-dots": Array.from({ length: 25 }, (_, i) => {
              const t = i / 24;
              const pos = `calc(7px + (100% - 14px) * ${t.toFixed(4)})`;
              return `radial-gradient(circle at ${pos} 50%, #c8c8dc 1.5px, transparent 1.5px)`;
            }).join(", ") } as React.CSSProperties}
          />
        </div>
      ) : isWinamp ? (
        <div className="flex items-center gap-1.5">
          <label className="flex-shrink-0 text-[10px] winamp-label winamp-label-dark">Intensity</label>
          <div className="slider-track-wrapper relative flex min-w-0 flex-1 items-center">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(walkIntensity * 100)}
              onChange={(e) => actions.setWalkIntensity(Number(e.target.value) / 100)}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-border-secondary accent-accent-500"
              style={{ "--fill": `${intensityFill}%` } as React.CSSProperties}
            />
          </div>
          <span className="flex-shrink-0 min-w-[36px] text-right text-[10px] tabular-nums winamp-label winamp-label-dark">
            {Math.round(walkIntensity * 100)}%
          </span>
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 7 }}>
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-content-muted">Intensity</label>
            <span className="text-[10px] tabular-nums text-content-secondary">
              {Math.round(walkIntensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(walkIntensity * 100)}
            onChange={(e) => actions.setWalkIntensity(Number(e.target.value) / 100)}
            className="h-1 min-w-0 w-full appearance-none rounded-full bg-surface-border-secondary accent-accent-500"
            style={{ "--fill": `${intensityFill}%` } as React.CSSProperties}
          />
        </div>
      )}
    </div>
  );

  const presetsContent = presetPaths.length > 0 ? (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-content-faint">Presets</span>
      {presetPaths.map((preset) => (
        <button
          key={preset.id}
          onClick={() => handleLoadPreset(preset)}
          className="flex items-center justify-between rounded-md bg-surface-raised/50 px-2 py-1.5 text-[11px] text-content-secondary transition-colors hover:bg-surface-border-secondary hover:text-content-primary"
        >
          <span>{preset.name}</span>
          <span className="text-[10px] text-content-faint">
            {formatDuration(preset.defaultDuration)}
          </span>
        </button>
      ))}
    </div>
  ) : null;

  const pathsList = (
    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto scrollbar-thin">
      {paths.length === 0 && isSciin && (
        <p className="text-[11px] text-content-faint">No paths yet.</p>
      )}
      {paths.length === 0 && !isSciin && (
        <p className="py-2 text-center text-[11px] text-content-faint">
          No paths yet.
        </p>
      )}
      {paths.map((p) => {
        const isActive = p.id === activePathId;
        const canGenerate = isActive && !p.walkMeta && p.keyframes.filter(
          (kf) => !kf.keyedChannels || kf.keyedChannels.includes("position"),
        ).length >= 2;
        return (
          <React.Fragment key={p.id}>
          {isSciin ? (
          <div
            className="flex items-center cursor-pointer"
            onClick={() => actions.setActivePathId(p.id)}
          >
            <span className="shrink-0" style={{ color: isActive ? "#FFFF00" : "rgba(255,255,255,0.5)" }}>
              {isActive ? ">" : " "}
            </span>
            {editingId === p.id ? (
              <span className="ml-2 flex items-center">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleCommitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-24 text-xs text-content-primary outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </span>
            ) : (
              <span
                className="ml-2 truncate"
                style={{ color: isActive ? "#FFFF00" : undefined }}
                onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(p); }}
              >
                {p.name}
              </span>
            )}
            <span className="ml-auto flex items-center">
              {canGenerate && (
                <button
                  className="sciin-toolbar-btn font-bold text-[11px] ml-2"
                  onClick={(e) => { e.stopPropagation(); actions.convertActivePathToWalk(); }}
                  title="Generate walk"
                >[GEN]</button>
              )}
              <button
                className="sciin-toolbar-btn font-bold text-[11px] ml-1"
                onClick={(e) => { e.stopPropagation(); handleDuplicate(p); }}
                title="Duplicate"
              >[DUP]</button>
              <button
                className="sciin-toolbar-btn font-bold text-[11px] ml-1"
                onClick={(e) => { e.stopPropagation(); handleExport(p); }}
                title="Export"
              >[EXP]</button>
              <button
                className="sciin-toolbar-btn font-bold text-[11px] ml-1"
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                title="Delete"
                style={{ color: "#FF0000" }}
              >[DEL]</button>
            </span>
          </div>
          ) : (
          <div
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer ${
              isSkeuomorphic
                ? isActive
                  ? "text-content-primary"
                  : "text-content-primary hover:bg-surface-raised"
                : isActive
                  ? "bg-accent-500/15 text-accent-300"
                  : "text-content-secondary hover:bg-surface-raised"
            }`}
            style={isSkeuomorphic && isActive ? { outline: isWin95 ? "1px dotted #000" : "1px solid #0055CC", outlineOffset: "-1px", borderRadius: isWin95 ? 0 : 3 } : undefined}
            onClick={() => actions.setActivePathId(p.id)}
          >
            {!isSkeuomorphic && (
              <ThemeIcon
                icon={Circle}
                className={`h-2 w-2 flex-shrink-0 ${
                  isActive
                    ? "fill-accent-400 text-accent-400"
                    : "text-content-faint"
                }`}
              />
            )}
            {editingId === p.id ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleCommitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-24 rounded border border-surface-border-secondary bg-surface-raised px-1 py-0.5 text-xs text-content-primary outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCommitRename();
                  }}
                  className="text-accent-400"
                >
                  <ThemeIcon icon={Check} className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <span
                className="truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleStartRename(p);
                }}
              >
                {p.name}
              </span>
            )}

            <div className={`ml-auto flex items-center ${isSkeuomorphic ? 'gap-0' : 'gap-1'}`}>
              {canGenerate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.convertActivePathToWalk();
                  }}
                  className={isSkeuomorphic
                    ? "win95-btn mr-1 px-1.5 py-0.5 text-[9px] font-medium"
                    : "mr-1 rounded bg-accent-500/80 px-1.5 py-0.5 text-[9px] font-medium text-white transition-colors hover:bg-accent-400"
                  }
                  title="Apply walk generation settings to this path"
                >
                  Generate
                </button>
              )}
              {isSkeuomorphic ? (
                <>
                  <button
                    className="win95-path-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(p); }}
                    title="Duplicate"
                  >
                    <ThemeIcon icon={Copy} className="h-3 w-3" />
                  </button>
                  <button
                    className="win95-path-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleExport(p); }}
                    title="Export JSON"
                  >
                    <ThemeIcon icon={Download} className="h-3 w-3" />
                  </button>
                  <button
                    className="win95-path-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                    title="Delete"
                  >
                    <ThemeIcon icon={Trash2} className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <>
                  <IconButton
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(p);
                    }}
                    title="Duplicate"
                  >
                    <ThemeIcon icon={Copy} className="h-3 w-3" />
                  </IconButton>
                  <IconButton
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(p);
                    }}
                    title="Export JSON"
                  >
                    <ThemeIcon icon={Download} className="h-3 w-3" />
                  </IconButton>
                  <IconButton
                    size="xs"
                    danger
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.id);
                    }}
                    title="Delete"
                  >
                    <ThemeIcon icon={Trash2} className="h-3 w-3" />
                  </IconButton>
                </>
              )}
            </div>
          </div>
          )}
          {isActive && p.walkMeta && (
            <div className="ml-4 flex items-center gap-2 rounded-md bg-surface-raised/50 px-2 py-1">
              <span className="text-[10px] text-content-muted">Duration</span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={retimeValue || pathDuration(p).toFixed(1)}
                onFocus={() => setRetimeValue(pathDuration(p).toFixed(1))}
                onChange={(e) => {
                  setRetimeValue(e.target.value);
                  setRetimeWarning(null);
                }}
                onBlur={() => {
                  const newDur = parseFloat(retimeValue);
                  const curDur = pathDuration(p);
                  if (isFinite(newDur) && newDur >= 0.5 && Math.abs(newDur - curDur) > 0.05) {
                    const result = actions.retimeActiveWalkPath(newDur);
                    setRetimeWarning(result?.warning ?? null);
                  }
                  setRetimeValue("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") { setRetimeValue(""); (e.target as HTMLInputElement).blur(); }
                }}
                className="w-16 rounded border border-surface-border-secondary bg-surface-primary px-1.5 py-0.5 text-[11px] tabular-nums text-content-primary outline-none"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-[10px] text-content-faint">sec</span>
              {retimeWarning && (
                <span className="text-[10px] text-amber-500">{retimeWarning}</span>
              )}
            </div>
          )}
        </React.Fragment>
        );
      })}
    </div>
  );

  const bakedPathsContent = bakedPaths.length > 0 ? (
    <div className="flex flex-col gap-1">
      {!isSkeuomorphic && (
        <span className="text-[10px] uppercase tracking-wider text-content-faint">
          Baked Imports
        </span>
      )}
      {bakedPaths.map((bp) => {
        const isActive = bp.id === activeBakedPathId;
        const dur = bakedPathDuration(bp);
        return (
          <div
            key={bp.id}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer ${
              isActive
                ? "bg-accent-500/15 text-accent-300"
                : "text-content-secondary hover:bg-surface-raised"
            }`}
            onClick={() => {
              actions.setActiveBakedPathId(bp.id);
              actions.setActivePathId(null);
            }}
          >
            {!isSkeuomorphic && (
              <ThemeIcon
                icon={Circle}
                className={`h-2 w-2 flex-shrink-0 ${
                  isActive ? "fill-accent-400 text-accent-400" : "text-content-faint"
                }`}
              />
            )}
            <span className="truncate">{bp.name}</span>
            <span className="ml-auto flex-shrink-0 text-[10px] tabular-nums text-content-faint">
              {bp.frames.length} fr &middot; {formatDuration(dur)}
            </span>
            {isSkeuomorphic ? (
              <button
                className="win95-path-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.setBakedPaths((prev) => prev.filter((p) => p.id !== bp.id));
                  if (activeBakedPathId === bp.id) actions.setActiveBakedPathId(null);
                }}
                title="Delete"
              >
                <ThemeIcon icon={Trash2} className="h-3 w-3" />
              </button>
            ) : (
              <IconButton
                size="xs"
                danger
                onClick={(e) => {
                  e.stopPropagation();
                  actions.setBakedPaths((prev) => prev.filter((p) => p.id !== bp.id));
                  if (activeBakedPathId === bp.id) actions.setActiveBakedPathId(null);
                }}
                title="Delete"
              >
                <ThemeIcon icon={Trash2} className="h-3 w-3" />
              </IconButton>
            )}
          </div>
        );
      })}
    </div>
  ) : null;

  const collisionContent = hasCollisionPolygons ? (
    <div className={isSkeuomorphic ? "" : "border-t border-surface-border pt-2"}>
      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-content-secondary">
        <ThemeIcon icon={Shield} className="h-3.5 w-3.5" />
        <span>Collision guardrails</span>
        <input
          type="checkbox"
          checked={collisionEnabled}
          onChange={(e) => actions.setCollisionEnabled(e.target.checked)}
          className="ml-auto accent-accent-500"
        />
      </label>
      {activePreset && (
        <p className="mt-1 text-[10px] text-content-faint">
          Height: {activePreset.cameraHeightRange.min.toFixed(2)} &ndash;{" "}
          {activePreset.cameraHeightRange.max.toFixed(2)}
        </p>
      )}
    </div>
  ) : null;

  if (isWinamp) {
    const winampPathsList = (
      <div className="winamp-playlist relative" style={{ minHeight: 40 }}>
        {paths.length === 0 && bakedPaths.length === 0 ? (
          <div className="winamp-playlist-empty">
            <span>No paths yet</span>
            <span className="empty-sub">Press K to add a keyframe</span>
          </div>
        ) : (
          <>
            {paths.map((p, idx) => {
              const isActive = p.id === activePathId;
              const dur = pathDuration(p);
              const canGen = isActive && !p.walkMeta && p.keyframes.filter(
                (kf) => !kf.keyedChannels || kf.keyedChannels.includes("position"),
              ).length >= 2;
              return (
                <div
                  key={p.id}
                  className={`winamp-playlist-row${isActive ? " selected" : ""}`}
                  onClick={() => actions.setActivePathId(p.id)}
                >
                  <span className="playlist-num">{idx + 1}.</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="playlist-info">
                    {p.keyframes.length} kf &middot; {formatDuration(dur)}
                  </span>
                  <span className="playlist-actions">
                    {canGen && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.convertActivePathToWalk();
                        }}
                        title="Generate walk from path"
                      >
                        G
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(p); }}
                      title="Duplicate"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(p); }}
                      title="Export JSON"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              );
            })}
            {bakedPaths.map((bp, idx) => {
              const isActive = bp.id === activeBakedPathId;
              const dur = bakedPathDuration(bp);
              return (
                <div
                  key={bp.id}
                  className={`winamp-playlist-row${isActive ? " selected" : ""}`}
                  onClick={() => { actions.setActiveBakedPathId(bp.id); actions.setActivePathId(null); }}
                >
                  <span className="playlist-num">{paths.length + idx + 1}.</span>
                  <span className="flex-1 truncate">{bp.name}</span>
                  <span className="playlist-info">
                    {bp.frames.length} fr &middot; {formatDuration(dur)}
                  </span>
                  <span className="playlist-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.setBakedPaths((prev) => prev.filter((p) => p.id !== bp.id));
                        if (activeBakedPathId === bp.id) actions.setActiveBakedPathId(null);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    );

    return (
      <div className="winamp-paths-panel flex flex-col gap-2">
        {walkGenContent}

        {presetsContent && (
          <div className="win95-panel-section border-b border-surface-border">
            <div className="flex w-full items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
              <span className="flex-1 text-left">Presets</span>
            </div>
            <div className="px-3 py-3">{presetsContent}</div>
          </div>
        )}

        {winampPathsList}
      </div>
    );
  }

  if (isWin95) {
    return (
      <div className="flex flex-col gap-2">
        {/* Walk Generation */}
        <div className="win95-group-box p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-content-primary">Walk Generation</span>
          </div>
          <div className="mt-2">{walkGenContent}</div>
        </div>

        {/* Presets */}
        {presetsContent && (
          <div className="win95-group-box p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-primary">Presets</span>
            </div>
            <div className="mt-2">{presetsContent}</div>
          </div>
        )}

        {/* Paths */}
        <div className="win95-group-box p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-content-primary">Paths</span>
            <label
              className="cursor-pointer text-content-muted"
              title="Import path JSON"
            >
              <ThemeIcon icon={Upload} className="h-6 w-6" />
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
          <div className="mt-2">{pathsList}</div>
        </div>

        {/* Baked Imports */}
        {bakedPathsContent && (
          <div className="win95-group-box p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-primary">Baked Imports</span>
            </div>
            <div className="mt-2">{bakedPathsContent}</div>
          </div>
        )}

      </div>
    );
  }

  if (isAim) {
    return (
      <div className="flex flex-col gap-2">
        <div className="win95-group-box p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-content-primary">Walk Generation</span>
          </div>
          <div className="mt-2">{walkGenContent}</div>
        </div>

        {presetsContent && (
          <div className="win95-group-box p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-primary">Presets</span>
            </div>
            <div className="mt-2">{presetsContent}</div>
          </div>
        )}

        <div className="win95-panel-section border-b border-surface-border last:border-b-0">
          <div className="flex w-full items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
            <span className="flex-1 text-left">Paths</span>
            <span className="ml-auto flex aim-titlebar-btns">
              <label
                className="aim-titlebar-btn aim-titlebar-btn-blue flex cursor-pointer items-center justify-center"
                title="Import path JSON"
              >
                <ThemeIcon icon={Upload} className="h-3 w-3" />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </span>
          </div>
          <div className="mt-2">{pathsList}</div>
        </div>

        {bakedPathsContent && (
          <div className="win95-group-box p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-primary">Baked Imports</span>
            </div>
            <div className="mt-2">{bakedPathsContent}</div>
          </div>
        )}

      </div>
    );
  }

  return (
    <Panel className={`flex flex-col ${isSciin ? "gap-1" : "gap-3"} p-3`}>
      <div className={`flex flex-col gap-1.5 ${isSciin ? "mt-2" : ""}`}>
        <span className="text-[10px] uppercase tracking-wider text-content-faint">
          Walk Generation
        </span>
        {walkGenContent}
      </div>

      {presetsContent}

      <div className={`flex items-center justify-between ${isSciin ? "mt-2" : ""}`}>
        <span className="text-[9px] uppercase tracking-wider text-content-faint">Paths</span>
        <label
          className={isSciin
            ? "cursor-pointer sciin-toolbar-btn font-bold text-[11px]"
            : "cursor-pointer rounded-md p-1 text-content-muted transition-colors hover:bg-surface-raised hover:text-content-primary"
          }
          title="Import path JSON"
        >
          {isSciin ? "[IMP]" : <ThemeIcon icon={Upload} className="h-3 w-3" />}
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>

      {pathsList}

      {bakedPathsContent}
    </Panel>
  );
}
