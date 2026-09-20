"use client";

import React, { useRef, useCallback, useEffect } from "react";
import { useWinampWindowManager } from "@/themes/winamp/window-manager";

function WinampMinimize() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <rect x="1" y="6" width="5" height="2" fill="currentColor" />
    </svg>
  );
}

function WinampMaximize() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <rect x="0" y="0" width="8" height="2" fill="currentColor" />
      <rect x="0" y="2" width="1" height="5" fill="currentColor" />
      <rect x="7" y="2" width="1" height="5" fill="currentColor" />
      <rect x="0" y="6" width="8" height="1" fill="currentColor" />
    </svg>
  );
}

function WinampClose() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ResizeGrip() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="winamp-resize-grip-icon">
      <line x1="9" y1="1" x2="1" y2="9" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <line x1="9" y1="1" x2="1" y2="9" stroke="rgba(0,0,0,0.25)" strokeWidth="1" transform="translate(1,1)" />
      <line x1="9" y1="4" x2="4" y2="9" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <line x1="9" y1="4" x2="4" y2="9" stroke="rgba(0,0,0,0.25)" strokeWidth="1" transform="translate(1,1)" />
      <line x1="9" y1="7" x2="7" y2="9" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
      <line x1="9" y1="7" x2="7" y2="9" stroke="rgba(0,0,0,0.25)" strokeWidth="1" transform="translate(1,1)" />
    </svg>
  );
}

interface WinampFloatingWindowProps {
  id: string;
  title: string;
  defaultX: number;
  defaultY: number;
  width: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: number;
  resizable?: boolean;
  hideHeader?: boolean;
  bare?: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerContent?: React.ReactNode;
  titlebarButtons?: React.ReactNode;
  onClose?: () => void;
}

export default function WinampFloatingWindow({
  id,
  title,
  defaultX,
  defaultY,
  width,
  height,
  minWidth = 160,
  minHeight = 80,
  aspectRatio,
  resizable = false,
  hideHeader = false,
  bare = false,
  children,
  className,
  contentClassName,
  headerContent,
  titlebarButtons,
  onClose,
}: WinampFloatingWindowProps) {
  const { state, register, moveWindow, resizeWindow, bringToFront, bringGroupToFront, minimize, restore, snapAndDock, getSnappedPosition, getDockGroup, getZIndex, moveGroupDelta, setDomHeight, pushDockedBelow, recoverOffscreen } = useWinampWindowManager();
  const UNSNAP_DISTANCE = 14;

  const dragRef = useRef<{
    startX: number; startY: number; origX: number; origY: number;
    groupIds: string[];
    brokenAway: boolean;
    velocityHistory: number[];
    lastSnappedX: number | null;
    lastSnappedY: number | null;
    groupDx: number;
    groupDy: number;
  } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; chromeOffset: number } | null>(null);
  const windowElRef = useRef<HTMLDivElement>(null);

  const win = state.windows[id];
  const isRegistered = !!win;

  useEffect(() => {
    register(id, { x: defaultX, y: defaultY, width, height: height ?? 200, minimized: false, bare: !!bare });
  }, [id, defaultX, defaultY, width, height, register]);

  const lastObservedHeight = useRef(0);
  useEffect(() => {
    if (!isRegistered) return;
    if (height !== undefined || resizable) return;
    const el = windowElRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.offsetHeight);
      if (h > 0 && Math.abs(h - lastObservedHeight.current) > 2) {
        const delta = lastObservedHeight.current > 0 ? h - lastObservedHeight.current : 0;
        lastObservedHeight.current = h;
        resizeWindow(id, width, h);
        if (delta !== 0) pushDockedBelow(id, delta);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, width, height, resizable, resizeWindow, isRegistered, pushDockedBelow]);

  const lastDomHeight = useRef(0);
  useEffect(() => {
    if (!isRegistered) return;
    const el = windowElRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.round(el.offsetHeight);
      if (h > 0 && h !== lastDomHeight.current) {
        lastDomHeight.current = h;
        setDomHeight(id, h);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, setDomHeight, isRegistered]);

  const wasCollapsed = useRef(false);
  const collapsed = win?.minimized && !bare;
  useEffect(() => {
    if (!isRegistered) return;
    if (wasCollapsed.current === !!collapsed) return;
    wasCollapsed.current = !!collapsed;
    requestAnimationFrame(() => {
      const el = windowElRef.current;
      if (!el) return;
      const newH = Math.round(el.offsetHeight);
      const oldH = lastDomHeight.current;
      if (newH !== oldH && oldH > 0) {
        const delta = newH - oldH;
        pushDockedBelow(id, delta);
        lastDomHeight.current = newH;
        setDomHeight(id, newH);
      }
    });
  }, [collapsed, isRegistered, id, setDomHeight, pushDockedBelow, bare]);

  const zIndex = getZIndex(id);

  const VELOCITY_THRESHOLD = 24;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const group = getDockGroup(id);
    const groupIds = group || [id];
    if (groupIds.length > 1) {
      bringGroupToFront(groupIds);
    } else {
      bringToFront(id);
    }
    const w = state.windows[id];
    if (!w) return;

    dragRef.current = {
      startX: e.clientX, startY: e.clientY, origX: w.x, origY: w.y,
      groupIds, brokenAway: false,
      velocityHistory: [],
      lastSnappedX: null, lastSnappedY: null,
      groupDx: 0, groupDy: 0,
    };

    let dragRafId: number | null = null;
    let latestDragEvent: PointerEvent | null = null;
    let pendingMovementX = 0;
    let pendingMovementY = 0;

    const processDragFrame = () => {
      dragRafId = null;
      const ev = latestDragEvent;
      if (!ev || !dragRef.current) return;

      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const ids = dragRef.current.groupIds;
      const avgSpeed = dragRef.current.velocityHistory.length > 0
        ? dragRef.current.velocityHistory.reduce((a, b) => a + b, 0) / dragRef.current.velocityHistory.length
        : 0;

      if (ids.length > 1 && !dragRef.current.brokenAway) {
        if (avgSpeed > VELOCITY_THRESHOLD) {
          dragRef.current.brokenAway = true;
          dragRef.current.groupIds = [id];
          dragRef.current.origX = dragRef.current.origX + dragRef.current.groupDx;
          dragRef.current.origY = dragRef.current.origY + dragRef.current.groupDy;
          dragRef.current.startX = ev.clientX;
          dragRef.current.startY = ev.clientY;
          pendingMovementX = 0;
          pendingMovementY = 0;
          return;
        }
        const rawGx = dragRef.current.origX + dragRef.current.groupDx + pendingMovementX;
        const rawGy = dragRef.current.origY + dragRef.current.groupDy + pendingMovementY;
        const snappedG = getSnappedPosition(id, rawGx, rawGy);
        const snapDx = snappedG.x - (dragRef.current.origX + dragRef.current.groupDx);
        const snapDy = snappedG.y - (dragRef.current.origY + dragRef.current.groupDy);
        dragRef.current.groupDx += snapDx;
        dragRef.current.groupDy += snapDy;
        moveGroupDelta(ids, snapDx, snapDy);
        pendingMovementX = 0;
        pendingMovementY = 0;
      } else {
        const rawX = dragRef.current.origX + dx;
        const rawY = dragRef.current.origY + dy;
        const snapped = getSnappedPosition(id, rawX, rawY);

        let useX = snapped.x;
        if (dragRef.current.lastSnappedX !== null && snapped.x === dragRef.current.lastSnappedX) {
          if (Math.abs(rawX - dragRef.current.lastSnappedX) > UNSNAP_DISTANCE) {
            useX = rawX;
            dragRef.current.lastSnappedX = null;
          }
        } else {
          dragRef.current.lastSnappedX = snapped.x !== rawX ? snapped.x : null;
        }

        let useY = snapped.y;
        if (dragRef.current.lastSnappedY !== null && snapped.y === dragRef.current.lastSnappedY) {
          if (Math.abs(rawY - dragRef.current.lastSnappedY) > UNSNAP_DISTANCE) {
            useY = rawY;
            dragRef.current.lastSnappedY = null;
          }
        } else {
          dragRef.current.lastSnappedY = snapped.y !== rawY ? snapped.y : null;
        }

        moveWindow(id, useX, useY);
      }
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;

      const frameSpeed = Math.sqrt(ev.movementX * ev.movementX + ev.movementY * ev.movementY);
      const hist = dragRef.current.velocityHistory;
      hist.push(frameSpeed);
      if (hist.length > 4) hist.shift();

      pendingMovementX += ev.movementX;
      pendingMovementY += ev.movementY;
      latestDragEvent = ev;

      if (dragRafId == null) {
        dragRafId = requestAnimationFrame(processDragFrame);
      }
    };

    const onUp = () => {
      if (dragRafId != null) {
        cancelAnimationFrame(dragRafId);
        dragRafId = null;
      }
      if (latestDragEvent && dragRef.current) {
        processDragFrame();
      }
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      snapAndDock(id);
      recoverOffscreen();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [id, state.windows, bringToFront, bringGroupToFront, moveWindow, snapAndDock, getSnappedPosition, getDockGroup, moveGroupDelta, recoverOffscreen]);

  const handleResizeDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(id);
    const w = state.windows[id];
    if (!w) return;

    let chromeOffset = 0;
    if (aspectRatio && windowElRef.current) {
      const contentEl = windowElRef.current.querySelector('.winamp-floating-content');
      const canvasEl = windowElRef.current.querySelector('.winamp-viewport-inner');
      if (contentEl && canvasEl) {
        chromeOffset = contentEl.clientHeight - canvasEl.clientHeight;
      }
    }
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: w.width, origH: w.height, chromeOffset };

    let resizeRafId: number | null = null;
    let latestResizeEvent: PointerEvent | null = null;

    const processResizeFrame = () => {
      resizeRafId = null;
      const ev = latestResizeEvent;
      if (!ev || !resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      let newW = Math.max(minWidth, resizeRef.current.origW + dw);
      let newH = Math.max(minHeight, resizeRef.current.origH + dh);
      if (aspectRatio) {
        newW = Math.max(minWidth, resizeRef.current.origW + dw);
        const canvasH = Math.round(newW / aspectRatio);
        newH = canvasH + resizeRef.current.chromeOffset;
      }
      resizeWindow(id, newW, newH);
      requestAnimationFrame(() => {
        const el = windowElRef.current;
        if (el) setDomHeight(id, Math.round(el.offsetHeight));
      });
    };

    const onMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return;
      latestResizeEvent = ev;
      if (resizeRafId == null) {
        resizeRafId = requestAnimationFrame(processResizeFrame);
      }
    };

    const onUp = () => {
      if (resizeRafId != null) {
        cancelAnimationFrame(resizeRafId);
        resizeRafId = null;
      }
      if (latestResizeEvent && resizeRef.current) {
        processResizeFrame();
      }
      resizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [id, state.windows, bringToFront, resizeWindow, minWidth, minHeight, aspectRatio, setDomHeight]);

  if (!win) return null;
  if (win.minimized && bare) return null;

  return (
    <div
      ref={windowElRef}
      className={`${bare ? "winamp-floating-bare" : "winamp-floating-window"} ${className || ""}`}
      data-window-id={id}
      style={{
        position: "fixed",
        left: win.x,
        top: win.y,
        width: win.width,
        zIndex,
      }}
      onPointerDown={(e) => { bringToFront(id); if (bare && !(e.target as HTMLElement).closest('input[type="range"]')) handlePointerDown(e); }}
    >
      {!bare && !hideHeader && (
        <div
          className="flex w-full items-center gap-1.5 px-1.5 py-[3px] text-[10px] font-bold uppercase tracking-wider text-content-muted winamp-floating-titlebar"
          onPointerDown={handlePointerDown}
        >
          <span className="winamp-header-groove flex-1 min-w-[12px]" />
          <span className="shrink-0">{title}</span>
          <span className="winamp-header-groove flex-1 min-w-[12px]" />
          {titlebarButtons}
          <span className="ml-0.5 flex winamp-titlebar-btns">
            <button
              className="winamp-titlebar-btn"
              onClick={(e) => { e.stopPropagation(); minimize(id); }}
              title="Minimize"
            >
              <WinampMinimize />
            </button>
            <button
              className="winamp-titlebar-btn"
              onClick={(e) => { e.stopPropagation(); restore(id); }}
              title="Maximize"
            >
              <WinampMaximize />
            </button>
            {onClose && (
              <button
                className="winamp-titlebar-btn"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                title="Close"
              >
                <WinampClose />
              </button>
            )}
          </span>
        </div>
      )}
      {!collapsed && (
        <>
          {!bare && hideHeader && (
            <div className="winamp-floating-titlebar" onPointerDown={handlePointerDown} style={{ height: 6 }} />
          )}
          {headerContent && <div className="winamp-viewport-header-chrome">{headerContent}</div>}
          {bare ? (
            children
          ) : (
            <div
              className={`winamp-floating-content${contentClassName ? ` ${contentClassName}` : ""}`}
              style={resizable && win.height ? { height: win.height } : undefined}
            >
              {children}
            </div>
          )}
          {resizable && (
            <div className="winamp-resize-grip" onPointerDown={handleResizeDown}>
              <ResizeGrip />
            </div>
          )}
        </>
      )}
    </div>
  );
}
