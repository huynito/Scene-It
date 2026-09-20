"use client";

import type { ReactNode, RefObject } from "react";
import { AimMapQuestLogo } from "@/themes/xX_sCeNeIt_Xx/icons";

type Tool = "edit" | "pen" | "walk";

interface MapQuestMinimapShellProps {
  tool: Tool;
  setTool: (t: Tool) => void;
  zoom: number;
  setZoom: (updater: (z: number) => number) => void;
  /** Per-pixel world-space pan increment, derived from zoom by the parent. */
  panStep: number;
  setPan: (updater: (p: { x: number; y: number }) => { x: number; y: number }) => void;
  /** Resets the pan to (0, 0). */
  recenter: () => void;
  /** Max-zoom ceiling (a ref the parent owns; we just clamp against current value). */
  maxZoom: number;
  containerRef: RefObject<HTMLDivElement>;
  canvasEl: ReactNode;
}

export default function MapQuestMinimapShell({
  tool,
  setTool,
  zoom,
  setZoom,
  panStep,
  setPan,
  recenter,
  maxZoom,
  containerRef,
  canvasEl,
}: MapQuestMinimapShellProps) {
  return (
    <div ref={containerRef} className="mq-container flex h-full w-full flex-col min-h-0">
      {/* MapQuest header bar */}
      <div className="mq-header">
        <AimMapQuestLogo />
        <div className="mq-header-tools">
          <button className={`aim-prefs-btn mq-tool-btn${tool === "edit" ? " mq-tool-btn-active" : ""}`} title="Edit mode" onClick={() => setTool("edit")}>Edit</button>
          <button className={`aim-prefs-btn mq-tool-btn${tool === "pen" ? " mq-tool-btn-active" : ""}`} title="Pen tool" onClick={() => setTool("pen")}>Pen</button>
          <button className={`aim-prefs-btn mq-tool-btn${tool === "walk" ? " mq-tool-btn-active" : ""}`} title="Walk tool" onClick={() => setTool("walk")}>Walk</button>
        </div>
      </div>

      {/* Map canvas with navigation overlays */}
      <div className="mq-canvas relative min-h-0 flex-1">
        {canvasEl}

        {/* Directional pad overlay */}
        <div className="mq-nav-pad">
          <button
            className="mq-nav-btn mq-nav-n"
            title="Pan North"
            onClick={() => setPan(p => ({ ...p, y: p.y + panStep }))}
          >
            <svg width="10" height="6" viewBox="0 0 10 6"><path d="M5 0L10 6H0z" fill="currentColor"/></svg>
          </button>
          <button
            className="mq-nav-btn mq-nav-w"
            title="Pan West"
            onClick={() => setPan(p => ({ ...p, x: p.x - panStep }))}
          >
            <svg width="6" height="10" viewBox="0 0 6 10"><path d="M0 5L6 0v10z" fill="currentColor"/></svg>
          </button>
          <button
            className="mq-nav-btn mq-nav-center"
            title="Recenter"
            onClick={recenter}
          />
          <button
            className="mq-nav-btn mq-nav-e"
            title="Pan East"
            onClick={() => setPan(p => ({ ...p, x: p.x + panStep }))}
          >
            <svg width="6" height="10" viewBox="0 0 6 10"><path d="M6 5L0 10V0z" fill="currentColor"/></svg>
          </button>
          <button
            className="mq-nav-btn mq-nav-s"
            title="Pan South"
            onClick={() => setPan(p => ({ ...p, y: p.y - panStep }))}
          >
            <svg width="10" height="6" viewBox="0 0 10 6"><path d="M5 6L0 0h10z" fill="currentColor"/></svg>
          </button>
        </div>

        {/* Zoom controls overlay */}
        <div className="mq-zoom-control">
          <button
            className="mq-zoom-btn"
            title="Zoom In"
            onClick={() => setZoom(z => Math.min(maxZoom, z + 1))}
          >+</button>
          <div className="mq-zoom-level">{Math.round(zoom)}%</div>
          <button
            className="mq-zoom-btn"
            title="Zoom Out"
            onClick={() => setZoom(z => Math.max(5, z - 1))}
          >&minus;</button>
        </div>
      </div>

      {/* MapQuest status bar */}
      <div className="mq-status">
        <span>{tool === "edit" ? "Select Tool" : tool === "pen" ? "Pen Tool" : "Walk Tool"}</span>
        <span className="mq-status-sep" />
        <span>Zoom: {Math.round(zoom)}%</span>
        <span className="mq-status-copyright">Map data &copy; 2005 MapQuest, Inc.</span>
      </div>
    </div>
  );
}
