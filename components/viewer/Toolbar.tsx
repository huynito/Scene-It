"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  RotateCcw,
  X,
  Plus,
  Palette,
  Film,
  Crosshair,
  Trash2,
  ChevronDown,
  Image,
  Route,
  HelpCircle,
} from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { USER_MODES, USER_MODE_IDS } from "@/lib/user-mode";
import { resetTutorialCompleted } from "@/lib/tutorial";
import { createPath, addKeyframe, DEFAULT_KEYFRAME_GAP } from "@/lib/camera-path";
import type { ChannelGroup } from "@/lib/camera-path";
import IconButton from "@/components/ui/IconButton";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import ThemeEditor from "@/components/ui/ThemeEditor";
import { Win95Taskbar } from "@/themes/win95/shells";
import { useFrameExport } from "@/lib/use-frame-export";
import FrameSizePopover from "@/components/viewer/FrameSizePopover";

export default function Toolbar() {
  const {
    paths,
    activePathId,
    playbackState,
    isExporting,
    anchors,
    cameraTargetAnchorId,
    showPathPanel,
    userModeId,
    compDuration,
    actions,
    refs,
  } = useScene();

  const cap = useThemeCapabilities();
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isSciin = cap.usesTextControls;
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const fe = useFrameExport();
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const activePath = paths.find((p) => p.id === activePathId);
  const kfCount = activePath?.keyframes.length ?? 0;
  const canPlay = kfCount >= 2;

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
  }, [handleAddKeyframe, refs.addChannelKeyframe, actions, playbackState.isPlaying, refs]);

  if (isWin95) {
    return <Win95Taskbar />;
  }

  return (
    <div
      className={`win95-toolbar flex shrink-0 items-center justify-between border-x border-y border-surface-border bg-surface-primary/95 ${isSciin ? "px-[10px]" : isWinamp ? "winamp-toolbar-shell gap-3 px-2.5 py-2 mt-px" : "px-3 py-1 mt-px"}`}
    >
      {/* Left: mode indicator */}
      <div className="min-w-0 flex-1 flex items-center">
        {!isSciin && !isWinamp && (
          <div className="relative">
            <button
              ref={modeBtnRef}
              onClick={() => setShowModeMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-content-secondary transition-colors hover:bg-surface-raised hover:text-content-primary"
              title="Switch mode"
            >
              {USER_MODES[userModeId]?.label ?? "Explore"}
              <ThemeIcon icon={ChevronDown} className="h-3 w-3 text-content-faint" />
            </button>
            {showModeMenu && createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowModeMenu(false)} />
                <div
                  className="fixed z-[9999] min-w-[180px] rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg"
                  style={(() => { const r = modeBtnRef.current?.getBoundingClientRect(); return r ? { left: r.left, top: r.bottom + 4 } : {}; })()}
                >
                  {USER_MODE_IDS.map((id) => {
                    const mode = USER_MODES[id];
                    return (
                      <button
                        key={id}
                        onClick={() => { actions.setUserModeId(id); setShowModeMenu(false); }}
                        className={`flex w-full flex-col gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-surface-border-secondary ${
                          id === userModeId ? "bg-accent-500/10" : ""
                        }`}
                      >
                        <span className={`text-[11px] font-medium ${id === userModeId ? "text-accent-300" : "text-content-primary"}`}>
                          {mode.label}
                        </span>
                        <span className="text-[10px] text-content-faint">{mode.description}</span>
                      </button>
                    );
                  })}
                </div>
              </>,
              document.body,
            )}
          </div>
        )}
      </div>

      {/* Center: keyframe + playback controls */}
      <div className={`flex items-center gap-2 ${isWinamp ? "winamp-toolbar-center" : ""}`}>
        {isSciin ? (
          <button
            onClick={handleAddKeyframe}
            className="sciin-toolbar-btn flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold"
            style={{ color: "#FF00FF" }}
            title="Add keyframe (K) / Position only (P) / Rotation only (R)"
          >
            [Keyframe{kfCount > 0 ? ` ${kfCount}` : ""}]
          </button>
        ) : isWinamp ? (
          <div className="winamp-btn-tray">
            <button
              onClick={handleAddKeyframe}
              className="winamp-btn-label flex items-center gap-1.5 text-[10px]"
              title="Add keyframe (K) / Position only (P) / Rotation only (R)"
            >
              <ThemeIcon icon={Plus} className="h-3 w-3" />
              Keyframe
              {kfCount > 0 && (
                <span className="text-[9px] tabular-nums">
                  {kfCount}
                </span>
              )}
            </button>
          </div>
        ) : (
          <button
            data-tutorial="keyframe"
            onClick={handleAddKeyframe}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-content-primary transition-colors hover:bg-surface-raised"
            title="Add keyframe (K) / Position only (P) / Rotation only (R)"
          >
            <ThemeIcon icon={Plus} className="h-3.5 w-3.5" />
            Keyframe
            {kfCount > 0 && (
              <span className="rounded bg-surface-border-secondary px-1.5 py-0.5 text-[10px] tabular-nums text-content-secondary">
                {kfCount}
              </span>
            )}
          </button>
        )}

        {targetAnchor && (
          <>
            {!isSciin && !isWinamp && <div className="h-5 w-px bg-surface-border-secondary" />}
            <button
              onClick={() => actions.setCameraTargetAnchorId(null)}
              className={isSciin
                ? "sciin-toolbar-btn flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold text-accent-300 hover:text-accent-400"
                : isWinamp
                  ? "winamp-btn-label flex items-center gap-1 text-[10px]"
                  : "flex items-center gap-1 rounded-md bg-accent-500/20 px-2 py-0.5 text-[11px] text-accent-300 transition-colors hover:bg-accent-500/30"
              }
              title="Click to clear camera target"
            >
              {isSciin ? (
                <>[{targetAnchor.label} x]</>
              ) : (
                <>
                  <ThemeIcon icon={Crosshair} className="h-3 w-3" />
                  <span className="max-w-[80px] truncate">{targetAnchor.label}</span>
                  <ThemeIcon icon={X} className="h-3 w-3 text-accent-400/60" />
                </>
              )}
            </button>
          </>
        )}

        {!isSciin && !isWinamp && <div className="h-5 w-px bg-surface-border-secondary" />}

        {isSciin ? (
          <button
            onClick={() => actions.setShowPathPanel(!showPathPanel)}
            className="sciin-toolbar-btn flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold"
            style={{ color: showPathPanel ? "#FFFFFF" : "var(--rl-blue)" }}
            title="Camera paths"
          >
            [Paths]
          </button>
        ) : isWinamp ? (
          <div className="winamp-btn-tray">
            <button
              onClick={() => actions.setShowPathPanel(!showPathPanel)}
              className={`winamp-btn-label flex items-center gap-1.5 text-[10px]${showPathPanel ? " winamp-tool-active" : ""}`}
              title="Camera paths"
            >
              <ThemeIcon icon={Route} className="h-3 w-3" />
              Paths
            </button>
          </div>
        ) : (
          <button
            data-tutorial="paths"
            onClick={() => actions.setShowPathPanel(!showPathPanel)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              showPathPanel
                ? "bg-accent-500/20 text-accent-300"
                : "text-content-primary hover:bg-surface-raised"
            }`}
            title="Camera paths"
          >
            <ThemeIcon icon={Route} className="h-3.5 w-3.5" />
            Paths
          </button>
        )}

        {!isSciin && !isWinamp && <div className="h-5 w-px bg-surface-border-secondary" />}
        <div className="relative">
          {isSciin ? (
            <>
              <span className="flex items-center gap-1">
                <button
                  ref={exportBtnRef}
                  onClick={() => setShowExportMenu((v) => !v)}
                  disabled={isExporting}
                  className="sciin-toolbar-btn px-1.5 py-0.5 text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: "#00FF00" }}
                  title="Export options"
                >[{showExportMenu ? "-" : "+"} Export]</button>
                {showExportMenu && (
                  <>
                    <button
                      onClick={() => { actions.setExportFormat("mp4"); actions.setShowExportModal(true); }}
                      className="sciin-toolbar-btn px-1 py-0.5 text-[11px] font-bold"
                      style={{ color: "#00FF00" }}
                      title="Export Video"
                    >[VID]</button>
                    <button
                      onClick={() => { actions.setExportFormat("gif"); actions.setShowExportModal(true); }}
                      className="sciin-toolbar-btn px-1 py-0.5 text-[11px] font-bold"
                      style={{ color: "#00FF00" }}
                      title="Export GIF"
                    >[GIF]</button>
                    <button
                      onClick={() => fe.setFrameExportFormat((v) => v === "png" ? null : "png")}
                      className="sciin-toolbar-btn px-1 py-0.5 text-[11px] font-bold"
                      style={{ color: fe.frameExportFormat === "png" ? "#FFFFFF" : "#00FF00" }}
                      title="Save Frame as PNG"
                    >[PNG]</button>
                    <button
                      onClick={() => fe.setFrameExportFormat((v) => v === "jpeg" ? null : "jpeg")}
                      className="sciin-toolbar-btn px-1 py-0.5 text-[11px] font-bold"
                      style={{ color: fe.frameExportFormat === "jpeg" ? "#FFFFFF" : "#00FF00" }}
                      title="Save Frame as JPG"
                    >[JPG]</button>
                  </>
                )}
              </span>
              {showExportMenu && fe.frameExportFormat && createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => { setShowExportMenu(false); fe.resetFrameExport(); }} />
                  <div className="fixed z-[9999] min-w-[160px] rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg" style={(() => { const r = exportBtnRef.current?.getBoundingClientRect(); return r ? { left: r.left, top: r.bottom + 4 } : {}; })()}>
                    <FrameSizePopover
                      format={fe.frameExportFormat}
                      width={fe.frameExportWidth}
                      height={fe.computedHeight}
                      onWidthChange={fe.setFrameExportWidth}
                      onExport={() => { fe.captureFrameAtSize(fe.frameExportFormat!, fe.frameExportWidth, fe.computedHeight); fe.resetFrameExport(); setShowExportMenu(false); }}
                    />
                  </div>
                </>,
                document.body,
              )}
            </>
          ) : isWinamp ? (
            <div className="winamp-btn-tray">
            <button
              ref={exportBtnRef}
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={isExporting}
              className="winamp-btn-label flex items-center gap-1.5 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export options"
            >
              <ThemeIcon icon={Film} className="h-3 w-3" />
              Export
              <ThemeIcon icon={ChevronDown} className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <button
            data-tutorial="export"
            ref={exportBtnRef}
            onClick={() => setShowExportMenu((v) => !v)}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-content-primary transition-colors hover:bg-surface-raised disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export options"
            >
              <ThemeIcon icon={Film} className="h-3.5 w-3.5" />
              Export
              <ThemeIcon icon={ChevronDown} className="h-3 w-3 text-content-muted" />
            </button>
          )}
          {showExportMenu && !isSciin && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => { setShowExportMenu(false); fe.resetFrameExport(); }} />
              <div className="fixed z-[9999] min-w-[160px] rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg" style={(() => { const r = exportBtnRef.current?.getBoundingClientRect(); return r ? { left: r.left, top: r.bottom + 4 } : {}; })()}>
                <button
                  onClick={() => { actions.setExportFormat("mp4"); actions.setShowExportModal(true); setShowExportMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-content-primary hover:bg-surface-border-secondary"
                >
                  <ThemeIcon icon={Film} className="h-3.5 w-3.5 text-content-secondary" />
                  Export Video
                </button>
                <button
                  onClick={() => { actions.setExportFormat("gif"); actions.setShowExportModal(true); setShowExportMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-content-primary hover:bg-surface-border-secondary"
                >
                  <ThemeIcon icon={Image} className="h-3.5 w-3.5 text-content-secondary" />
                  Export GIF
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
            </>,
            document.body,
          )}
        </div>
      </div>

      {/* Right: tool buttons */}
      <div className={`relative flex min-w-0 flex-1 items-center justify-end ${isSciin ? "gap-2" : isWinamp ? "winamp-btn-tray winamp-toolbar-utils" : "transport-group gap-1"}`}>
        {isSciin ? (
          <>
            <button className="sciin-toolbar-btn px-1 py-0.5 text-[11px] font-bold" style={{ color: "var(--rl-blue)" }} onClick={() => refs.reset.current?.()} title="Reset camera">[RST]</button>
            <button className="sciin-toolbar-btn px-1 py-0.5 text-[11px] font-bold" style={{ color: "var(--rl-cyan)" }} onClick={actions.clearAll} title="Clear all (anchors, paths, media)">[CLR]</button>
            <button ref={themeBtnRef} className="sciin-toolbar-btn px-1 py-0.5 text-[11px] font-bold" style={{ color: showThemeEditor ? "#FFFFFF" : "var(--rl-yellow)" }} onClick={() => setShowThemeEditor((s) => !s)} title="Theme editor">[THM]</button>
            <button className="sciin-toolbar-btn px-1 py-0.5 text-[11px] font-bold text-red-400 hover:text-red-300" onClick={actions.closeScene} title="Close scene">[X]</button>
          </>
        ) : isWinamp ? (
          <>
            <button onClick={() => refs.reset.current?.()} title="Reset camera" className="winamp-btn-label flex items-center justify-center p-1">
              <ThemeIcon icon={RotateCcw} className="h-3.5 w-3.5" />
            </button>
            <button onClick={actions.clearAll} title="Clear all (anchors, paths, media)" className="winamp-btn-label flex items-center justify-center p-1">
              <ThemeIcon icon={Trash2} className="h-3.5 w-3.5" />
            </button>
            <button ref={themeBtnRef} onClick={() => setShowThemeEditor((s) => !s)} title="Theme editor" className={`winamp-btn-label flex items-center justify-center p-1${showThemeEditor ? " winamp-tool-active" : ""}`}>
              <ThemeIcon icon={Palette} className="h-3.5 w-3.5" />
            </button>
            <button onClick={actions.closeScene} title="Close scene" className="winamp-btn-label flex items-center justify-center p-1">
              <ThemeIcon icon={X} className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <span data-tutorial="reset-camera">
              <IconButton onClick={() => refs.reset.current?.()} title="Reset camera">
                <ThemeIcon icon={RotateCcw} className="h-4 w-4" />
              </IconButton>
            </span>
            <span data-tutorial="clear-all">
              <IconButton onClick={actions.clearAll} title="Clear all (anchors, paths, media)">
                <ThemeIcon icon={Trash2} className="h-4 w-4" />
              </IconButton>
            </span>
            <IconButton
              onClick={() => { resetTutorialCompleted(); actions.setShowTutorial(true); }}
              title="Tutorial"
            >
              <ThemeIcon icon={HelpCircle} className="h-4 w-4" />
            </IconButton>
            <span data-tutorial="themes">
              <IconButton ref={themeBtnRef} active={showThemeEditor} onClick={() => setShowThemeEditor((s) => !s)} title="Theme editor">
                <ThemeIcon icon={Palette} className="h-4 w-4" />
              </IconButton>
            </span>
            <IconButton danger onClick={actions.closeScene} title="Close scene">
              <ThemeIcon icon={X} className="h-4 w-4" />
            </IconButton>
          </>
        )}

        {showThemeEditor && createPortal(
          <div className="fixed" style={(() => { const r = themeBtnRef.current?.getBoundingClientRect(); return r ? { zIndex: 9999, right: window.innerWidth - r.right, top: r.bottom + 8 } : { zIndex: 9999 }; })()}>
            <ThemeEditor onClose={() => setShowThemeEditor(false)} />
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}
