"use client";

/**
 * Stable portal mount for <PlyCanvas />.
 *
 * Goal: keep PlyCanvas mounted exactly once across the entire app lifetime so
 * the WebGPU renderer, FPSController, and PlaybackController are never
 * destroyed by layout/theme swaps.
 *
 * Strategy:
 *   1. The provider creates an OFFSCREEN holder div that lives for the
 *      lifetime of the app. PlyCanvas is portaled into this holder by
 *      default — it is always mounted somewhere in the DOM.
 *   2. Layout branches render <CanvasHost />. On mount, CanvasHost MOVES the
 *      PlyCanvas DOM subtree from the offscreen holder (or previous host)
 *      into itself via direct DOM manipulation (appendChild). On unmount,
 *      it moves the subtree back to the offscreen holder.
 *   3. Because we never unmount/re-mount the React component, all React
 *      state (containerRef pointing at PlyCanvas's inner div, refs, hooks)
 *      stays intact. We just reparent the rendered DOM.
 *
 * This is the same technique used by libraries like react-portal-target and
 * solves the unmount-on-layout-swap problem without touching React state at
 * all during transitions.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from "react";

interface CanvasPortalContextValue {
  /** The persistent offscreen container that holds PlyCanvas DOM. */
  holder: HTMLDivElement | null;
}

const CanvasPortalContext = createContext<CanvasPortalContextValue | null>(null);

export function CanvasPortalProvider({ children }: { children: React.ReactNode }) {
  const [holder, setHolder] = useState<HTMLDivElement | null>(null);

  // Create the offscreen holder once, AFTER mount, so SSR and first client
  // render produce identical output (no hydration mismatch).
  useEffect(() => {
    const div = document.createElement("div");
    div.setAttribute("data-canvas-holder", "");
    div.style.position = "absolute";
    div.style.width = "1px";
    div.style.height = "1px";
    div.style.left = "-9999px";
    div.style.top = "-9999px";
    div.style.pointerEvents = "none";
    document.body.appendChild(div);
    setHolder(div);
    return () => {
      if (div.parentNode) div.parentNode.removeChild(div);
    };
  }, []);

  return (
    <CanvasPortalContext.Provider value={{ holder }}>
      {children}
    </CanvasPortalContext.Provider>
  );
}

export function useCanvasHolder(): HTMLDivElement | null {
  const ctx = useContext(CanvasPortalContext);
  return ctx?.holder ?? null;
}

/**
 * Renders a div that, while mounted, DOM-reparents the persistent PlyCanvas
 * subtree into itself. On unmount, the subtree is moved back to the
 * offscreen holder. This never unmounts the React component — it only moves
 * its rendered DOM nodes.
 */
export function CanvasHost({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const ctx = useContext(CanvasPortalContext);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    const holder = ctx?.holder;
    if (!target || !holder) return;

    // Move all children of the holder into this host.
    while (holder.firstChild) {
      target.appendChild(holder.firstChild);
    }

    return () => {
      // Move the children back to the offscreen holder so React keeps them
      // alive between hosts.
      while (target.firstChild) {
        holder.appendChild(target.firstChild);
      }
    };
  }, [ctx?.holder]);

  return (
    <div
      ref={targetRef}
      className={className}
      style={style}
    />
  );
}
