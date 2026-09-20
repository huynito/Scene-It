"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Film,
  Image,
} from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { createPath, addKeyframe, DEFAULT_KEYFRAME_GAP } from "@/lib/camera-path";
import IconButton from "@/components/ui/IconButton";
import ThemeIcon from "@/components/ui/ThemeIcon";
import ThemeEditor from "@/components/ui/ThemeEditor";
import { W95HeaderViewport, W95TbReset, W95TbTheme, W95TbClear, W95TbClose, W95CloseGlyph } from "@/themes/win95/icons";
import { useFrameExport } from "@/lib/use-frame-export";
import FrameSizePopover from "@/components/viewer/FrameSizePopover";

export default function Win95ViewportChrome({ children }: { children: React.ReactNode }) {
  const {
    paths,
    activePathId,
    playbackState,
    isExporting,
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

  return (
    <div className="flex min-h-0 flex-1 flex-col win95-window win95-viewport-chrome">
      {/* Title bar */}
      <div className="win95-viewport-titlebar flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
        <W95HeaderViewport size={16} className="win95-icon-multi" />
        <span className="flex-1 text-left">Viewport</span>
        <span className="flex win95-titlebar-btns">
          <button className="win95-titlebar-btn" title="Minimize">
            <svg width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges" fill="none">
              <rect x="1" y="8" width="6" height="3" fill="#000" />
            </svg>
          </button>
          <button className="win95-titlebar-btn" title="Maximize">
            <svg width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges" fill="none">
              <rect x="1" y="1" width="9" height="2" fill="#000" />
              <rect x="1" y="3" width="1" height="6" fill="#000" />
              <rect x="9" y="3" width="1" height="6" fill="#000" />
              <rect x="1" y="8" width="9" height="1" fill="#000" />
            </svg>
          </button>
          <button className="win95-titlebar-btn" title="Close" onClick={actions.closeScene}>
            <W95CloseGlyph />
          </button>
        </span>
      </div>

      {/* Menu bar + toolbar icons */}
      <div className="win95-menu-bar flex items-center gap-0 px-1 py-0.5 bg-[#c0c0c0]">
        <button
          onClick={handleAddKeyframe}
          className="win95-menu-item px-2 py-0.5 text-[12px] text-black"
          title="Add keyframe (K)"
        >
          <span className="underline">K</span>eyframe
          {kfCount > 0 && (
            <span className="ml-1 text-[10px] tabular-nums">({kfCount})</span>
          )}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu((v) => !v)}
            disabled={isExporting}
            className="win95-menu-item px-2 py-0.5 text-[12px] text-black disabled:text-[#808080]"
            title="Export options"
          >
            <span className="underline">E</span>xport
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

        <div className="flex-1" />

        <div className="win95-viewport-toolbar flex items-center gap-0">
          <IconButton onClick={() => refs.reset.current?.()} title="Reset camera">
            <W95TbReset size={16} />
          </IconButton>
          <IconButton onClick={actions.clearAll} title="Clear all (anchors, paths, media)">
            <W95TbClear size={16} />
          </IconButton>
          <div className="relative flex items-center">
            <IconButton ref={themeBtnRef} active={showThemeEditor} onClick={() => setShowThemeEditor((s) => !s)} title="Theme editor">
              <W95TbTheme size={16} />
            </IconButton>
            {showThemeEditor && createPortal(
              <div className="fixed" style={(() => { const r = themeBtnRef.current?.getBoundingClientRect(); return r ? { zIndex: 9999, right: window.innerWidth - r.right, top: r.bottom + 8 } : { zIndex: 9999 }; })()}>
                <ThemeEditor onClose={() => setShowThemeEditor(false)} />
              </div>,
              document.body,
            )}
          </div>
          <IconButton danger onClick={actions.closeScene} title="Close scene">
            <W95TbClose size={16} />
          </IconButton>
        </div>
      </div>

      {/* Viewport content */}
      <div className="win95-canvas-border flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
