"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useWindow } from "@/themes/xX_sCeNeIt_Xx/window-manager";

interface FloatingWindowProps {
  id: string;
  children: React.ReactNode;
  /** Hide the title bar (for toolbar window) */
  hideChrome?: boolean;
  /** Extra buttons rendered in the title bar before the min/max/close group */
  actionButtons?: React.ReactNode;
}

function AimMinimize() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="8" width="6" height="2" rx="0.5" fill="#fff" />
    </svg>
  );
}

function AimMaximize() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="2" width="8" height="2" rx="0.5" fill="#fff" />
      <rect x="2" y="2" width="8" height="8" rx="0.5" stroke="#fff" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function AimRestore() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="4" y="1" width="7" height="7" rx="0.5" stroke="#fff" strokeWidth="1.5" fill="none" />
      <rect x="4" y="1" width="7" height="2" rx="0.5" fill="#fff" />
      <rect x="1" y="4" width="7" height="7" rx="0.5" stroke="#fff" strokeWidth="1.5" fill="none" />
      <rect x="1" y="4" width="7" height="2" rx="0.5" fill="#fff" />
    </svg>
  );
}

function AimClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 3l6 6M9 3l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const HANDLE_SIZE = 6;

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_CURSORS: Record<ResizeDir, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
};

export default function FloatingWindow({ id, children, hideChrome, actionButtons }: FloatingWindowProps) {
  const { win, moveWindow, resizeWindow, focusWindow, minimizeWindow, maximizeWindow, taskbarHeight } = useWindow(id);
  const windowRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    winX: number;
    winY: number;
    winW: number;
    winH: number;
    dir: ResizeDir;
    arOffsetW?: number;
    arOffsetH?: number;
  } | null>(null);

  const arCorrectedRef = useRef(false);
  useEffect(() => {
    if (arCorrectedRef.current || !win?.aspectRatio || !windowRef.current) return;
    const target = windowRef.current.querySelector("[data-aspect-target]");
    if (!target) return;
    arCorrectedRef.current = true;
    const tr = target.getBoundingClientRect();
    const oW = win.width - tr.width;
    const oH = win.height - tr.height;
    const targetW = win.width - oW;
    const targetH = Math.round(targetW / win.aspectRatio);
    const correctH = targetH + oH;
    if (Math.abs(correctH - win.height) > 2) {
      resizeWindow(id, win.width, correctH, win.x, win.y);
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      if (!win) return;
      focusWindow(id);
      dragStartRef.current = { startX: e.clientX, startY: e.clientY, winX: win.x, winY: win.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [win, id, focusWindow],
  );

  const handleTitlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const ds = dragStartRef.current;
      if (!ds) return;
      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;
      moveWindow(id, ds.winX + dx, ds.winY + dy);
    },
    [id, moveWindow],
  );

  const handleTitlePointerUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  const handleResizePointerDown = useCallback(
    (dir: ResizeDir) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!win) return;
      focusWindow(id);

      let arOffsetW: number | undefined;
      let arOffsetH: number | undefined;
      if (win.aspectRatio && windowRef.current) {
        const target = windowRef.current.querySelector("[data-aspect-target]");
        if (target) {
          const tr = target.getBoundingClientRect();
          arOffsetW = win.width - tr.width;
          arOffsetH = win.height - tr.height;
        }
      }

      resizeStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        winX: win.x,
        winY: win.y,
        winW: win.width,
        winH: win.height,
        dir,
        arOffsetW,
        arOffsetH,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [win, id, focusWindow],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rs = resizeStartRef.current;
      if (!rs || !win) return;
      const dx = e.clientX - rs.startX;
      const dy = e.clientY - rs.startY;

      let newX = rs.winX;
      let newY = rs.winY;
      let newW = rs.winW;
      let newH = rs.winH;
      const minW = win.minWidth ?? 200;
      const minH = win.minHeight ?? 100;
      const ar = win.aspectRatio;

      if (rs.dir.includes("e")) newW = Math.max(minW, rs.winW + dx);
      if (rs.dir.includes("w")) {
        newW = Math.max(minW, rs.winW - dx);
        newX = rs.winX + (rs.winW - newW);
      }
      if (rs.dir.includes("s")) newH = Math.max(minH, rs.winH + dy);
      if (rs.dir.includes("n")) {
        newH = Math.max(minH, rs.winH - dy);
        newY = rs.winY + (rs.winH - newH);
      }

      if (ar && rs.arOffsetW != null && rs.arOffsetH != null) {
        const oW = rs.arOffsetW;
        const oH = rs.arOffsetH;
        const isVert = rs.dir === "n" || rs.dir === "s";

        if (isVert) {
          const targetH = Math.max(minH - oH, newH - oH);
          const targetW = Math.round(targetH * ar);
          newH = targetH + oH;
          newW = targetW + oW;
        } else {
          const targetW = Math.max(minW - oW, newW - oW);
          const targetH = Math.round(targetW / ar);
          newW = targetW + oW;
          newH = targetH + oH;
        }

        if (rs.dir.includes("w")) newX = rs.winX + (rs.winW - newW);
        if (rs.dir.includes("n")) newY = rs.winY + (rs.winH - newH);
      }

      if (newY < 0) newY = 0;
      const maxBottom = window.innerHeight - taskbarHeight;
      if (newY + newH > maxBottom) {
        newH = maxBottom - newY;
        if (ar && rs.arOffsetW != null && rs.arOffsetH != null) {
          const targetH = newH - rs.arOffsetH;
          const targetW = Math.round(targetH * ar);
          newW = targetW + rs.arOffsetW;
          if (rs.dir.includes("w")) newX = rs.winX + (rs.winW - newW);
        }
      }

      resizeWindow(id, newW, newH, newX, newY);
    },
    [win, id, resizeWindow],
  );

  const handleResizePointerUp = useCallback(() => {
    resizeStartRef.current = null;
  }, []);

  const [animState, setAnimState] = useState<"idle" | "minimizing" | "restoring">("idle");
  const prevMinimizedRef = useRef(win?.minimized ?? false);
  const animTransformRef = useRef("");
  const animTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!win) return;
    const wasMinimized = prevMinimizedRef.current;
    prevMinimizedRef.current = win.minimized;
    if (wasMinimized === win.minimized) return;

    const btn = document.querySelector(`[data-taskbar-id="${id}"]`);
    const btnRect = btn?.getBoundingClientRect();
    if (btnRect) {
      const scaleX = btnRect.width / win.width;
      const scaleY = btnRect.height / win.height;
      const dx = btnRect.left - win.x;
      const dy = btnRect.top - win.y;
      animTransformRef.current = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    }

    clearTimeout(animTimerRef.current);
    const dir = win.minimized ? "minimizing" : "restoring";
    setAnimState(dir);
    animTimerRef.current = setTimeout(() => setAnimState("idle"), 200);
  }, [win?.minimized, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!win) return null;
  if (win.minimized && animState === "idle") return null;

  let animStyle: React.CSSProperties = {};
  if (animState === "minimizing") {
    animStyle = {
      "--xp-anim-transform": animTransformRef.current,
      animation: "xp-minimize 200ms ease-in forwards",
      transformOrigin: "top left",
      pointerEvents: "none",
    } as React.CSSProperties;
  } else if (animState === "restoring") {
    animStyle = {
      "--xp-anim-transform": animTransformRef.current,
      animation: "xp-restore 200ms ease-out forwards",
      transformOrigin: "top left",
    } as React.CSSProperties;
  }

  const style: React.CSSProperties = {
    position: "absolute",
    left: win.x,
    top: win.y,
    width: win.width,
    height: win.height,
    zIndex: win.zIndex,
    ...animStyle,
  };

  const resizeHandles: { dir: ResizeDir; style: React.CSSProperties }[] = [
    { dir: "n", style: { top: -HANDLE_SIZE / 2, left: HANDLE_SIZE, right: HANDLE_SIZE, height: HANDLE_SIZE } },
    { dir: "s", style: { bottom: -HANDLE_SIZE / 2, left: HANDLE_SIZE, right: HANDLE_SIZE, height: HANDLE_SIZE } },
    { dir: "e", style: { right: -HANDLE_SIZE / 2, top: HANDLE_SIZE, bottom: HANDLE_SIZE, width: HANDLE_SIZE } },
    { dir: "w", style: { left: -HANDLE_SIZE / 2, top: HANDLE_SIZE, bottom: HANDLE_SIZE, width: HANDLE_SIZE } },
    { dir: "nw", style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, width: HANDLE_SIZE * 2, height: HANDLE_SIZE * 2 } },
    { dir: "ne", style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, width: HANDLE_SIZE * 2, height: HANDLE_SIZE * 2 } },
    { dir: "sw", style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, width: HANDLE_SIZE * 2, height: HANDLE_SIZE * 2 } },
    { dir: "se", style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, width: HANDLE_SIZE * 2, height: HANDLE_SIZE * 2 } },
  ];

  return (
    <div
      ref={windowRef}
      className="xp-floating-window aim-window"
      style={style}
      onPointerDown={() => focusWindow(id)}
    >
      {!hideChrome && (
        <div
          className="xp-titlebar flex w-full items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted"
          onPointerDown={handleTitlePointerDown}
          onPointerMove={handleTitlePointerMove}
          onPointerUp={handleTitlePointerUp}
          onLostPointerCapture={handleTitlePointerUp}
        >
          {win.icon && (
            <img
              src={win.icon}
              width={16}
              height={16}
              className="xp-titlebar-icon"
              draggable={false}
              alt=""
            />
          )}
          <span className="flex-1 text-left select-none">{win.title}</span>
          {actionButtons && <span className="flex items-center gap-1">{actionButtons}</span>}
          <span className="ml-auto flex aim-titlebar-btns">
            <button
              className="aim-titlebar-btn aim-titlebar-btn-blue"
              title="Minimize"
              onClick={() => minimizeWindow(id)}
            >
              <AimMinimize />
            </button>
            <button
              className="aim-titlebar-btn aim-titlebar-btn-blue"
              title={win.maximized ? "Restore" : "Maximize"}
              onClick={() => maximizeWindow(id)}
            >
              {win.maximized ? <AimRestore /> : <AimMaximize />}
            </button>
            <button
              className="aim-titlebar-btn aim-titlebar-btn-red"
              title="Close"
              onClick={() => minimizeWindow(id)}
            >
              <AimClose />
            </button>
          </span>
        </div>
      )}

      <div className="xp-window-content flex-1 min-h-0 overflow-hidden">
        {children}
      </div>

      {resizeHandles.map((h) => (
        <div
          key={h.dir}
          className="xp-resize-handle"
          style={{ ...h.style, position: "absolute", cursor: RESIZE_CURSORS[h.dir], zIndex: 999 }}
          onPointerDown={handleResizePointerDown(h.dir)}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onLostPointerCapture={handleResizePointerUp}
        />
      ))}
    </div>
  );
}
