"use client";

import type { CSSProperties, ComponentType, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  W95HeaderMap,
  W95CloseGlyph,
  W95PaintSelect,
  W95PaintLine,
  W95PaintCurve,
  W95PaintBucket,
  W95PaintEraser,
} from "@/themes/win95/icons";

type PaintTool = "edit" | "pen" | "walk" | "bucket" | "eraser";

const TOOLS: {
  id: PaintTool;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  title: string;
}[] = [
  { id: "edit", icon: W95PaintSelect, title: "Select" },
  { id: "pen", icon: W95PaintLine, title: "Line tool" },
  { id: "walk", icon: W95PaintCurve, title: "Curve tool" },
  { id: "bucket", icon: W95PaintBucket, title: "Fill with selected color" },
  { id: "eraser", icon: W95PaintEraser, title: "Erase back to checker pattern" },
];

const MS_PAINT_PALETTE = [
  "#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080", "#808040", "#004040",
  "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffff80", "#00ff80",
];

interface Win95MinimapProps {
  /** Current paint tool */
  tool: PaintTool;
  setTool: (t: PaintTool) => void;
  /** Foreground paint color */
  selectedPaintColor: string;
  setSelectedPaintColor: (c: string) => void;
  /** Contrast color shown in the FG/BG preview swatch (computed by parent) */
  contrastPreviewColor: string;
  /** Container ref forwarded to the canvas-area wrapper for ResizeObserver */
  containerRef: RefObject<HTMLDivElement>;
  /** The actual <canvas> element rendered by the parent */
  canvasEl: ReactNode;
}

export default function Win95Minimap({
  tool,
  setTool,
  selectedPaintColor,
  setSelectedPaintColor,
  contrastPreviewColor,
  containerRef,
  canvasEl,
}: Win95MinimapProps) {
  const paintWindowRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [windowPos, setWindowPos] = useState({ x: 80, y: 80 });
  const [isMinimized, setIsMinimized] = useState(false);

  const clampPaintWindowPos = useCallback((pos: { x: number; y: number }) => {
    const rect = paintWindowRef.current?.getBoundingClientRect();
    const windowWidth = rect?.width ?? 280;
    return {
      x: Math.min(Math.max(pos.x, 0), Math.max(0, window.innerWidth - windowWidth)),
      y: Math.min(Math.max(pos.y, 0), Math.max(0, window.innerHeight - (rect?.height ?? 0))),
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowPos((pos) => clampPaintWindowPos(pos));
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPaintWindowPos]);

  const handleTitlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: windowPos.x, oy: windowPos.y };
    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      setWindowPos(clampPaintWindowPos({
        x: dragStartRef.current.ox + (ev.clientX - dragStartRef.current.x),
        y: dragStartRef.current.oy + (ev.clientY - dragStartRef.current.y),
      }));
    };
    const onUp = () => {
      dragStartRef.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [clampPaintWindowPos, windowPos]);

  return (
    <div
      ref={paintWindowRef}
      className="win95-paint-window fixed z-[100]"
      style={{ left: windowPos.x, top: windowPos.y }}
    >
      {/* Title bar */}
      <div
        className="win95-paint-titlebar flex items-center gap-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted select-none"
        onPointerDown={handleTitlePointerDown}
      >
        <W95HeaderMap size={16} className="win95-icon-multi flex-shrink-0" />
        <span className="flex-1 text-left truncate">Floorplan</span>
        <span className="flex win95-titlebar-btns">
          <button className="win95-titlebar-btn" title="Minimize" onClick={() => setIsMinimized(true)}>
            <svg width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges" fill="none">
              <rect x="1" y="8" width="6" height="3" fill="#000" />
            </svg>
          </button>
          <button className="win95-titlebar-btn" title="Maximize" onClick={() => setIsMinimized(false)}>
            <svg width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges" fill="none">
              <rect x="1" y="1" width="9" height="2" fill="#000" />
              <rect x="1" y="3" width="1" height="6" fill="#000" />
              <rect x="9" y="3" width="1" height="6" fill="#000" />
              <rect x="1" y="8" width="9" height="1" fill="#000" />
            </svg>
          </button>
          <button className="win95-titlebar-btn" title="Close" onClick={() => setIsMinimized(true)}>
            <W95CloseGlyph />
          </button>
        </span>
      </div>

      {!isMinimized && (
        <>
          {/* Menu bar */}
          <div className="win95-paint-menubar flex items-center px-1 py-0.5 bg-[#c0c0c0] text-[12px]">
            <span className="win95-menu-item px-2 py-0.5 text-black"><span className="underline">F</span>ile</span>
            <span className="win95-menu-item px-2 py-0.5 text-black"><span className="underline">V</span>iew</span>
            <span className="win95-menu-item px-2 py-0.5 text-black"><span className="underline">I</span>mage</span>
            <span className="win95-menu-item px-2 py-0.5 text-black"><span className="underline">O</span>ptions</span>
            <span className="win95-menu-item px-2 py-0.5 text-black"><span className="underline">H</span>elp</span>
          </div>

          {/* Body: vertical toolbar + canvas */}
          <div className="flex bg-[#c0c0c0]">
            <div className="win95-paint-toolbar flex flex-col gap-0 p-[2px]">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={`win95-paint-tool-btn ${tool === t.id ? "win95-paint-tool-active" : ""}`}
                  title={t.title}
                >
                  <t.icon size={16} className="win95-icon-multi" />
                </button>
              ))}
            </div>

            <div className="win95-canvas-border win95-canvas-scrollframe flex-1" ref={containerRef}>
              {canvasEl}
            </div>
          </div>

          {/* Color palette */}
          <div className="win95-paint-palette flex items-center gap-1 bg-[#c0c0c0]">
            <div className="win95-paint-palette-group">
              <div className="win95-paint-color-preview">
                <div
                  className="win95-paint-fg"
                  style={{ "--win95-paint-fg-color": selectedPaintColor } as CSSProperties}
                />
                <div
                  className="win95-paint-bg"
                  style={{ "--win95-paint-bg-color": contrastPreviewColor } as CSSProperties}
                />
              </div>
              <div className="win95-paint-colors">
                {MS_PAINT_PALETTE.map((color, i) => (
                  <button
                    type="button"
                    key={i}
                    className={`win95-paint-color-swatch${selectedPaintColor === color ? " is-active" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedPaintColor(color)}
                    title={color}
                    aria-label={`Select ${color}`}
                    aria-pressed={selectedPaintColor === color}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export type { PaintTool };
