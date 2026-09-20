"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  RotateCcw,
  Grid3x3,
  X,
  Plus,
  Palette,
  Film,
  Crosshair,
  Trash2,
  ChevronDown,
  Image,
} from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { createPath, addKeyframe, DEFAULT_KEYFRAME_GAP } from "@/lib/camera-path";
import type { ChannelGroup } from "@/lib/camera-path";
import IconButton from "@/components/ui/IconButton";
import ThemeIcon from "@/components/ui/ThemeIcon";
import ThemeEditor from "@/components/ui/ThemeEditor";
import { useFrameExport } from "@/lib/use-frame-export";
import FrameSizePopover from "@/components/viewer/FrameSizePopover";

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === "true";

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default function ScenItViewportHeader() {
  const {
    fileName,
    vertexCount,
    showGrid,
    fileInputKey,
    paths,
    activePathId,
    playbackState,
    isExporting,
    anchors,
    cameraTargetAnchorId,
    compDuration,
    actions,
    refs,
  } = useScene();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const paletteBtnRef = useRef<HTMLButtonElement>(null);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const fe = useFrameExport();
  const activePath = paths.find((p) => p.id === activePathId);
  const kfCount = activePath?.keyframes.length ?? 0;

  const targetAnchor = cameraTargetAnchorId
    ? anchors.find((a) => a.id === cameraTargetAnchorId)
    : null;

  const handleAddKeyframe = useCallback(() => {
    const camData = refs.addKeyframeAtCamera.current?.();
    if (!camData) return;
    actions.pushUndo();
    if (!activePath) {
      const p = createPath();
      const updated = addKeyframe(p, camData.position, camData.pitch, camData.yaw);
      actions.setPaths((prev) => [...prev, updated]);
      actions.setActivePathId(updated.id);
      const kfTime = updated.keyframes[updated.keyframes.length - 1].time;
      refs.seekPathSilent.current?.(kfTime);
    } else {
      const updated = addKeyframe(activePath, camData.position, camData.pitch, camData.yaw);
      actions.setPaths((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      const kfTime = updated.keyframes[updated.keyframes.length - 1].time;
      refs.seekPathSilent.current?.(kfTime);
      if (kfTime > compDuration) {
        actions.setCompDuration(Math.ceil(kfTime + DEFAULT_KEYFRAME_GAP));
      }
    }
  }, [activePath, actions, refs, compDuration]);

  useEffect(() => {
    refs.triggerAddKeyframe.current = handleAddKeyframe;
  }, [handleAddKeyframe, refs.triggerAddKeyframe]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;

      if (e.code === "KeyK") {
        e.preventDefault();
        handleAddKeyframe();
      } else if (e.code === "KeyP" || e.code === "KeyR") {
        if (document.pointerLockElement) return;
        e.preventDefault();
        const groups: ChannelGroup[] = e.code === "KeyP" ? ["position"] : ["rotation"];
        refs.addChannelKeyframe.current?.(groups);
      } else if (e.code === "KeyG" && e.shiftKey) {
        e.preventDefault();
        actions.finalizeBoundary();
      } else if (e.code === "KeyG" && !e.shiftKey) {
        e.preventDefault();
        actions.addBoundaryPoint();
      } else if (e.code === "KeyB") {
        e.preventDefault();
        actions.pushUndo();
        actions.setWorkAreaIn(playbackState.currentTime);
      } else if (e.code === "KeyN") {
        e.preventDefault();
        actions.pushUndo();
        actions.setWorkAreaOut(playbackState.currentTime);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      e.preventDefault();
      if (refs.spaceDraggedRef.current) {
        refs.spaceDraggedRef.current = false;
        return;
      }
      if (playbackState.isPlaying) refs.pausePath.current?.();
      else refs.playPath.current?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleAddKeyframe, refs.addChannelKeyframe, actions, playbackState.isPlaying, refs]);

  return (
    <div className="scenit-viewport-header">
      {/* Left: traffic lights (via ::before) + label */}
      <span className="text-[11px] font-bold">Viewport</span>

      <span className="scenit-vh-spacer" />

      {/* Center: keyframe + export */}
      <span className="flex items-center gap-1">
        <button
          onClick={handleAddKeyframe}
          className="scenit-vh-btn"
          data-toolbar-btn="keyframe"
          title="Add keyframe (K) / Position only (P) / Rotation only (R)"
        >
          <ThemeIcon icon={Plus} className="h-3 w-3" />
          <span>Keyframe</span>
          {kfCount > 0 && <span className="scenit-vh-badge">{kfCount}</span>}
        </button>

        {targetAnchor && (
          <button
            onClick={() => actions.setCameraTargetAnchorId(null)}
            className="scenit-vh-btn scenit-vh-btn--accent"
            title="Clear camera target"
          >
            <ThemeIcon icon={Crosshair} className="h-3 w-3" />
            <span className="max-w-[60px] truncate">{targetAnchor.label}</span>
            <ThemeIcon icon={X} className="h-2.5 w-2.5 opacity-60" />
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowExportMenu((v) => !v)}
            disabled={isExporting}
            className="scenit-vh-btn"
            data-toolbar-btn="export"
            title="Export options"
          >
            <ThemeIcon icon={Film} className="h-3 w-3" />
            <span>Export</span>
            <ThemeIcon icon={ChevronDown} className="h-2.5 w-2.5 text-content-muted" />
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-[998]" onClick={() => { setShowExportMenu(false); fe.resetFrameExport(); }} />
              <div className="scenit-vh-dropdown">
                <button
                  onClick={() => {
                    actions.setShowExportModal(true);
                    setShowExportMenu(false);
                  }}
                >
                  <ThemeIcon icon={Film} className="h-3.5 w-3.5 text-content-secondary" />
                  Export Video
                </button>
                <button
                  onClick={() => fe.setFrameExportFormat((v) => v === "png" ? null : "png")}
                  className={fe.frameExportFormat === "png" ? "bg-surface-border-secondary" : ""}
                >
                  <ThemeIcon icon={Image} className="h-3.5 w-3.5 text-content-secondary" />
                  Save Frame as PNG
                </button>
                <button
                  onClick={() => fe.setFrameExportFormat((v) => v === "jpeg" ? null : "jpeg")}
                  className={fe.frameExportFormat === "jpeg" ? "bg-surface-border-secondary" : ""}
                >
                  <ThemeIcon icon={Image} className="h-3.5 w-3.5 text-content-secondary" />
                  Save Frame as JPG
                </button>
                {fe.frameExportFormat && (
                  <FrameSizePopover
                    format={fe.frameExportFormat}
                    width={fe.frameExportWidth}
                    height={fe.computedHeight}
                    onWidthChange={fe.setFrameExportWidth}
                    onExport={() => { fe.captureFrameAtSize(fe.frameExportFormat!, fe.frameExportWidth, fe.computedHeight); fe.resetFrameExport(); setShowExportMenu(false); }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </span>

      <span className="scenit-vh-spacer" />

      {/* Right: tool icons */}
      <span className="relative flex items-center gap-1">
        <IconButton
          onClick={() => refs.reset.current?.()}
          title="Reset camera"
          size="sm"
          data-toolbar-icon="reset"
        >
          <ThemeIcon icon={RotateCcw} className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          onClick={actions.clearAll}
          title="Clear all (anchors, paths, media)"
          size="sm"
          data-toolbar-icon="trash"
        >
          <ThemeIcon icon={Trash2} className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          ref={paletteBtnRef}
          active={showThemeEditor}
          onClick={() => setShowThemeEditor((s) => !s)}
          title="Theme editor"
          size="sm"
          data-toolbar-icon="palette"
        >
          <ThemeIcon icon={Palette} className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          danger
          onClick={actions.closeScene}
          title="Close scene"
          size="sm"
          data-toolbar-icon="close"
        >
          <ThemeIcon icon={X} className="h-3.5 w-3.5" />
        </IconButton>

        {showThemeEditor && createPortal(
          <div
            className="fixed"
            style={(() => {
              const r = paletteBtnRef.current?.getBoundingClientRect();
              if (!r) return { zIndex: 9999 } as React.CSSProperties;
              return { zIndex: 9999, top: r.bottom + 8, right: window.innerWidth - r.right };
            })()}
          >
            <ThemeEditor onClose={() => setShowThemeEditor(false)} />
          </div>,
          document.body,
        )}
      </span>
    </div>
  );
}
