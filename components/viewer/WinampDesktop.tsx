"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Box, Upload, Plus, Film, RotateCcw, Palette, Trash2, X,
  ChevronDown, Crosshair, Image,
} from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import ThemeEditor from "@/components/ui/ThemeEditor";
import { useScene } from "@/lib/scene-context";
import { CanvasHost } from "@/lib/canvas-portal";
import { WinampWindowManagerProvider, useWinampWindowManager } from "@/themes/winamp/window-manager";
import WinampFloatingWindow from "./panels/WinampFloatingWindow";
import MilkdropBackground from "./MilkdropBackground";
import GizmoOverlay from "./GizmoOverlay";
import KeyHints from "./KeyHints";
import CollapsibleSection from "./panels/CollapsibleSection";
import MediaLibraryWindow from "./panels/MediaLibraryWindow";
import WinampPlayerPanel from "./panels/WinampPlayerPanel";
import WinampPlaylistWindow from "./panels/WinampPlaylistWindow";
import PathPanel from "../viewer/PathPanel";
import CameraPanel from "./panels/CameraPanel";
import AROverlayPanel from "./panels/AROverlayPanel";
import PostProcessingPanel from "./panels/PostProcessingPanel";
import BottomPanel from "./panels/BottomPanel";
import ExportModal from "./ExportModal";
import { useFrameExport } from "@/lib/use-frame-export";
import FrameSizePopover from "@/components/viewer/FrameSizePopover";
import {
  deserializePath,
  deserializeBakedPath,
  deserializeExchangeFormat,
  createPath,
  addKeyframe,
  DEFAULT_KEYFRAME_GAP,
} from "@/lib/camera-path";
import type { CameraPath, BakedCameraPath, ChannelGroup } from "@/lib/camera-path";

function MinimizedTray() {
  return null;
}

function WinampViewportToolbar() {
  const {
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

  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const fe = useFrameExport();

  const activePath = paths.find((p) => p.id === activePathId);
  const kfCount = activePath?.keyframes.length ?? 0;

  const targetAnchor = cameraTargetAnchorId
    ? anchors.find(a => a.id === cameraTargetAnchorId)
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
  }, [handleAddKeyframe, refs.addChannelKeyframe, actions, playbackState.isPlaying, playbackState.currentTime, refs]);

  return (
    <>
      <div className="winamp-viewport-menubar">
        <button className="winamp-viewport-menu-item">File</button>
        <button className="winamp-viewport-menu-item">Play</button>
        <button className="winamp-viewport-menu-item">Options</button>
        <button className="winamp-viewport-menu-item">View</button>
        <button className="winamp-viewport-menu-item">Help</button>
      </div>

      <div className="winamp-viewport-toolbar-row">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAddKeyframe}
            className="winamp-btn-label flex items-center gap-1.5 text-[10px]"
            title="Add keyframe (K)"
          >
            <ThemeIcon icon={Plus} className="h-3 w-3" />
            Keyframe
            {kfCount > 0 && (
              <span className="text-[9px] tabular-nums">{kfCount}</span>
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={isExporting}
              className="winamp-btn-label flex items-center gap-1.5 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export options"
            >
              <ThemeIcon icon={Film} className="h-3 w-3" />
              Export
              <ThemeIcon icon={ChevronDown} className="h-2.5 w-2.5" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-[998]" onClick={() => { setShowExportMenu(false); fe.resetFrameExport(); }} />
                <div className="absolute left-0 top-full z-[999] mt-1 min-w-[160px] rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg">
                  <button
                    onClick={() => { actions.setShowExportModal(true); setShowExportMenu(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-content-primary hover:bg-surface-border-secondary"
                  >
                    <ThemeIcon icon={Film} className="h-3.5 w-3.5 text-content-secondary" />
                    Export Video
                  </button>
                  <div className="my-1 border-t border-surface-border-secondary" />
                  <button
                    onClick={() => fe.setFrameExportFormat((v) => v === "png" ? null : "png")}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-content-primary hover:bg-surface-border-secondary ${fe.frameExportFormat === "png" ? "bg-surface-border-secondary" : ""}`}
                  >
                    <ThemeIcon icon={Image} className="h-3.5 w-3.5 text-content-secondary" />
                    Save Frame as PNG
                  </button>
                  <button
                    onClick={() => fe.setFrameExportFormat((v) => v === "jpeg" ? null : "jpeg")}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-content-primary hover:bg-surface-border-secondary ${fe.frameExportFormat === "jpeg" ? "bg-surface-border-secondary" : ""}`}
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

          {targetAnchor && (
            <button
              onClick={() => actions.setCameraTargetAnchorId(null)}
              className="winamp-btn-label flex items-center gap-1 text-[10px]"
              title="Click to clear camera target"
            >
              <ThemeIcon icon={Crosshair} className="h-3 w-3" />
              <span className="max-w-[80px] truncate">{targetAnchor.label}</span>
              <ThemeIcon icon={X} className="h-3 w-3 text-accent-400/60" />
            </button>
          )}
        </div>

        <div className="relative flex items-center gap-1.5">
          <button onClick={() => refs.reset.current?.()} title="Reset camera" className="winamp-btn-label flex items-center justify-center p-1">
            <ThemeIcon icon={RotateCcw} className="h-3.5 w-3.5" />
          </button>
          <button onClick={actions.clearAll} title="Clear all (anchors, paths, media)" className="winamp-btn-label flex items-center justify-center p-1">
            <ThemeIcon icon={Trash2} className="h-3.5 w-3.5" />
          </button>
          <button
            ref={themeBtnRef}
            onClick={() => setShowThemeEditor((s) => !s)}
            title="Theme editor"
            className={`winamp-btn-label flex items-center justify-center p-1${showThemeEditor ? " winamp-tool-active" : ""}`}
          >
            <ThemeIcon icon={Palette} className="h-3.5 w-3.5" />
          </button>
          <button onClick={actions.closeScene} title="Close scene" className="winamp-btn-label flex items-center justify-center p-1">
            <ThemeIcon icon={X} className="h-3.5 w-3.5" />
          </button>

          {showThemeEditor && createPortal(
            <div className="fixed" style={(() => { const r = themeBtnRef.current?.getBoundingClientRect(); return r ? { zIndex: 9999, right: window.innerWidth - r.right, top: r.bottom + 8 } : { zIndex: 9999 }; })()}>
              <ThemeEditor onClose={() => setShowThemeEditor(false)} />
            </div>,
            document.body,
          )}
        </div>
      </div>
    </>
  );
}

function WinampDesktopInner() {
  const {
    plyBuffer,
    loadingState,
    contrast,
    saturation,
    showExportModal,
    showPathPanel,
    showGraphEditor,
    actions,
  } = useScene();

  const isReady = plyBuffer && loadingState === "ready";
  useEffect(() => { actions.setShowPathPanel(true); }, [actions]);

  const importFileRef = useRef<HTMLInputElement>(null);
  const handleImportPath = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        if (importFileRef.current) importFileRef.current.value = "";
        return;
      }
      const baked = deserializeBakedPath(text);
      if (baked) {
        baked.id = `baked-${Date.now()}`;
        actions.setBakedPaths((prev) => [...prev, baked]);
        actions.setActiveBakedPathId(baked.id);
        actions.setActivePathId(null);
        if (importFileRef.current) importFileRef.current.value = "";
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
    if (importFileRef.current) importFileRef.current.value = "";
  };

  return (
    <div className="winamp-desktop h-screen w-screen overflow-hidden">
      <MilkdropBackground />

      {plyBuffer && (
        <WinampFloatingWindow
          id="viewport"
          title="VIEWPORT"
          defaultX={371}
          defaultY={13}
          width={681}
          height={455}
          resizable
          minWidth={320}
          minHeight={240}
          aspectRatio={16/9}
          onClose={actions.closeScene}
          contentClassName="winamp-viewport-content"
        >
          <div className="winamp-viewport-content-wrapper">
            <div className="winamp-viewport-header-chrome"><WinampViewportToolbar /></div>
            <div className="winamp-viewport-inner">
              <CanvasHost
                className="h-full w-full"
                style={{
                  filter:
                    contrast === 0 && saturation === 0
                      ? undefined
                      : `contrast(${contrast + 100}%) saturate(${saturation + 100}%)`,
                }}
              />
              {isReady && (
                <div className="absolute inset-0 pointer-events-none">
                  <GizmoOverlay />
                </div>
              )}
              {isReady && <KeyHints />}
            </div>
          </div>
        </WinampFloatingWindow>
      )}

      {isReady && (
        <>
          <WinampFloatingWindow id="media-library" title="Media Library" defaultX={92} defaultY={175} width={280}>
            <MediaLibraryWindow />
          </WinampFloatingWindow>

          <WinampFloatingWindow id="player" title="Winamp" defaultX={92} defaultY={13} width={280}>
            <WinampPlayerPanel />
          </WinampFloatingWindow>

          <WinampFloatingWindow id="playlist-list" title="Playlist" defaultX={371} defaultY={658} width={274} height={118} resizable minWidth={240} minHeight={116}>
            <WinampPlaylistWindow />
          </WinampFloatingWindow>

          <WinampFloatingWindow id="paths" title="Paths" defaultX={92} defaultY={371} width={280} bare>
            <CollapsibleSection
              title="Paths"
              tabStyle
              open={showPathPanel}
              onToggle={(v) => actions.setShowPathPanel(v)}
              contentClassName="px-1.5 py-1.5"
              actionButtons={
                <label className="winamp-playlist-import-btn cursor-pointer" title="Import path JSON">
                  <ThemeIcon icon={Upload} className="h-3 w-3" />
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportPath}
                    className="hidden"
                  />
                </label>
              }
            >
              <PathPanel />
            </CollapsibleSection>
          </WinampFloatingWindow>

          <WinampFloatingWindow id="camera" title="Camera" defaultX={1051} defaultY={13} width={280}>
            <CameraPanel />
          </WinampFloatingWindow>

          <WinampFloatingWindow id="ar-overlay" title="AR Settings" defaultX={1051} defaultY={324} width={280}>
            <AROverlayPanel />
          </WinampFloatingWindow>

          <WinampFloatingWindow id="post-proc" title="Post Processing" defaultX={1051} defaultY={519} width={280} bare>
            <CollapsibleSection
              title="Post Processing"
              tabStyle
              collapsible={false}
              contentClassName="px-3 pt-0.5 pb-2"
              actionButtons={undefined}
            >
              <PostProcessingPanel />
            </CollapsibleSection>
          </WinampFloatingWindow>

          <WinampFloatingWindow
            id="timeline"
            title="Timeline"
            defaultX={371}
            defaultY={493}
            width={680}
            height={140}
            resizable
            minWidth={680}
            minHeight={140}
            titlebarButtons={
              <button
                onClick={() => actions.setShowGraphEditor((v) => !v)}
                className={`winamp-titlebar-btn winamp-titlebar-text-btn${showGraphEditor ? " winamp-tool-active" : ""}`}
              >
                <span className="winamp-titlebar-text-label">CURVES</span>
              </button>
            }
          >
            <BottomPanel />
          </WinampFloatingWindow>

          <MinimizedTray />
        </>
      )}

      {showExportModal && <ExportModal />}
    </div>
  );
}

export default function WinampDesktop() {
  return (
    <WinampWindowManagerProvider>
      <WinampDesktopInner />
    </WinampWindowManagerProvider>
  );
}
