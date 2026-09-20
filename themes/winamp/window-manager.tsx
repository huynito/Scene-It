"use client";

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from "react";

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  bare: boolean;
}

interface ManagerState {
  windows: Record<string, WindowState>;
  zOrder: string[];
  dockGroups: string[][];
}

type Action =
  | { type: "REGISTER"; id: string; state: WindowState }
  | { type: "MOVE"; id: string; x: number; y: number }
  | { type: "MOVE_GROUP"; ids: string[]; dx: number; dy: number }
  | { type: "RESIZE"; id: string; width: number; height: number }
  | { type: "BRING_TO_FRONT"; id: string }
  | { type: "BRING_GROUP_TO_FRONT"; ids: string[] }
  | { type: "MINIMIZE"; id: string }
  | { type: "RESTORE"; id: string }
  | { type: "SET_DOCK_GROUPS"; groups: string[][] }
  | { type: "RESTORE_ALL"; state: ManagerState };

const SNAP_DISTANCE = 12;
const TITLEBAR_H = 22;
const STORAGE_KEY = "winamp-window-positions";

function isTitlebarOffScreen(win: WindowState): boolean {
  if (typeof window === "undefined") return false;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return (
    win.x + win.width <= 0 ||
    win.x >= vw ||
    win.y + TITLEBAR_H <= 0 ||
    win.y >= vh
  );
}

function computeRescues(
  windows: Record<string, WindowState>,
): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const offIds = Object.keys(windows).filter((id) => isTitlebarOffScreen(windows[id]));
  if (offIds.length === 0) return {};

  const offSubset: Record<string, WindowState> = {};
  for (const id of offIds) offSubset[id] = windows[id];
  const subGroups = computeDockGroups(offSubset);
  const inSubGroup = new Set(subGroups.flat());

  const result: Record<string, { x: number; y: number }> = {};

  for (const group of subGroups) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of group) {
      const w = windows[id];
      minX = Math.min(minX, w.x);
      minY = Math.min(minY, w.y);
      maxX = Math.max(maxX, w.x + w.width);
      maxY = Math.max(maxY, w.y + w.height);
    }
    let dx = 0, dy = 0;
    if (maxX <= 0) dx = -minX;
    else if (minX >= vw) dx = vw - maxX;
    if (minY + TITLEBAR_H <= 0) dy = -minY;
    else if (minY >= vh) dy = vh - maxY;
    if (dx !== 0 || dy !== 0) {
      for (const id of group) {
        const w = windows[id];
        result[id] = { x: w.x + dx, y: w.y + dy };
      }
    }
  }

  for (const id of offIds) {
    if (inSubGroup.has(id)) continue;
    const w = windows[id];
    let { x, y } = w;
    if (x + w.width <= 0) x = 0;
    else if (x >= vw) x = vw - w.width;
    if (y + TITLEBAR_H <= 0) y = 0;
    else if (y >= vh) y = vh - w.height;
    result[id] = { x, y };
  }

  return result;
}

function reducer(state: ManagerState, action: Action): ManagerState {
  switch (action.type) {
    case "REGISTER": {
      if (state.windows[action.id]) return state;
      return {
        ...state,
        windows: { ...state.windows, [action.id]: action.state },
        zOrder: [...state.zOrder, action.id],
      };
    }
    case "MOVE": {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: { ...state.windows, [action.id]: { ...win, x: action.x, y: action.y } },
      };
    }
    case "MOVE_GROUP": {
      const next = { ...state.windows };
      for (const id of action.ids) {
        const w = next[id];
        if (w) next[id] = { ...w, x: w.x + action.dx, y: w.y + action.dy };
      }
      return { ...state, windows: next };
    }
    case "RESIZE": {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: { ...state.windows, [action.id]: { ...win, width: action.width, height: action.height } },
      };
    }
    case "BRING_TO_FRONT": {
      const filtered = state.zOrder.filter((id) => id !== action.id);
      return { ...state, zOrder: [...filtered, action.id] };
    }
    case "BRING_GROUP_TO_FRONT": {
      const groupSet = new Set(action.ids);
      const rest = state.zOrder.filter((id) => !groupSet.has(id));
      const groupOrdered = state.zOrder.filter((id) => groupSet.has(id));
      return { ...state, zOrder: [...rest, ...groupOrdered] };
    }
    case "MINIMIZE": {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: { ...state.windows, [action.id]: { ...win, minimized: true } },
      };
    }
    case "RESTORE": {
      const win = state.windows[action.id];
      if (!win) return state;
      return {
        ...state,
        windows: { ...state.windows, [action.id]: { ...win, minimized: false } },
      };
    }
    case "SET_DOCK_GROUPS":
      return { ...state, dockGroups: action.groups };
    case "RESTORE_ALL":
      return action.state;
    default:
      return state;
  }
}

function computeSnap(
  dragged: WindowState,
  others: [string, WindowState][],
): { x: number; y: number } {
  let { x, y } = dragged;
  const dR = x + dragged.width;
  const dB = y + dragged.height;

  let bestDx = SNAP_DISTANCE;
  let snapX = x;
  let bestDy = SNAP_DISTANCE;
  let snapY = y;

  for (const [, o] of others) {
    if (o.minimized && o.bare) continue;
    const oR = o.x + o.width;
    const oB = o.y + o.height;

    const overlapX = Math.min(dR, oR) - Math.max(x, o.x);
    const overlapY = Math.min(dB, oB) - Math.max(y, o.y);
    if (overlapX > SNAP_DISTANCE && overlapY > SNAP_DISTANCE) continue;

    const gapY = Math.max(0, Math.max(y, o.y) - Math.min(dB, oB));
    const gapX = Math.max(0, Math.max(x, o.x) - Math.min(dR, oR));
    const nearY = gapY < SNAP_DISTANCE;
    const nearX = gapX < SNAP_DISTANCE;

    if (nearY) {
      const xCandidates = [
        { dist: Math.abs(x - oR), val: oR - 1 },
        { dist: Math.abs(dR - o.x), val: o.x - dragged.width + 1 },
        { dist: Math.abs(x - o.x), val: o.x },
        { dist: Math.abs(dR - oR), val: oR - dragged.width },
      ];
      for (const c of xCandidates) {
        if (c.dist < bestDx) { bestDx = c.dist; snapX = c.val; }
      }
    }

    if (nearX) {
      const yCandidates = [
        { dist: Math.abs(y - oB), val: oB - 1 },
        { dist: Math.abs(dB - o.y), val: o.y - dragged.height + 1 },
        { dist: Math.abs(y - o.y), val: o.y },
        { dist: Math.abs(dB - oB), val: oB - dragged.height },
      ];
      for (const c of yCandidates) {
        if (c.dist < bestDy) { bestDy = c.dist; snapY = c.val; }
      }
    }
  }

  return { x: bestDx < SNAP_DISTANCE ? snapX : x, y: bestDy < SNAP_DISTANCE ? snapY : y };
}

function computeDockGroups(windows: Record<string, WindowState>): string[][] {
  const ids = Object.keys(windows).filter((id) => !(windows[id].minimized && windows[id].bare));
  const adj = new Map<string, Set<string>>();
  for (const id of ids) adj.set(id, new Set());

  for (let i = 0; i < ids.length; i++) {
    const a = windows[ids[i]];
    const aR = a.x + a.width;
    const aB = a.y + a.height;
    for (let j = i + 1; j < ids.length; j++) {
      const b = windows[ids[j]];
      const bR = b.x + b.width;
      const bB = b.y + b.height;

      const overlapY = a.y < bB && aB > b.y;
      const overlapX = a.x < bR && aR > b.x;

      const touching =
        (overlapY && (Math.abs(aR - b.x) <= 1 || Math.abs(a.x - bR) <= 1)) ||
        (overlapX && (Math.abs(aB - b.y) <= 1 || Math.abs(a.y - bB) <= 1));

      if (touching) {
        adj.get(ids[i])!.add(ids[j]);
        adj.get(ids[j])!.add(ids[i]);
      }
    }
  }

  const visited = new Set<string>();
  const groups: string[][] = [];
  for (const id of ids) {
    if (visited.has(id)) continue;
    const group: string[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      group.push(cur);
      adj.get(cur)!.forEach((neighbor) => stack.push(neighbor));
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}

interface WinampWindowManagerContextValue {
  state: ManagerState;
  register: (id: string, initial: WindowState) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  bringToFront: (id: string) => void;
  bringGroupToFront: (ids: string[]) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  snapAndDock: (id: string) => void;
  getSnappedPosition: (id: string, x: number, y: number) => { x: number; y: number };
  getDockGroup: (id: string) => string[] | undefined;
  getZIndex: (id: string) => number;
  moveGroupDelta: (ids: string[], dx: number, dy: number) => void;
  setDomHeight: (id: string, h: number) => void;
  pushDockedBelow: (id: string, delta: number) => void;
  recoverOffscreen: () => void;
}

const Ctx = createContext<WinampWindowManagerContextValue | null>(null);

export function useWinampWindowManager() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWinampWindowManager must be used within WinampWindowManagerProvider");
  return ctx;
}

export function WinampWindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { windows: {}, zOrder: [], dockGroups: [] });
  const stateRef = useRef(state);
  stateRef.current = state;
  const domHeightsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ManagerState;
        if (saved.windows && saved.zOrder) {
          const rescues = computeRescues(saved.windows);
          const fixed = { ...saved.windows };
          for (const [id, pos] of Object.entries(rescues)) {
            fixed[id] = { ...fixed[id], ...pos };
          }
          dispatch({ type: "RESTORE_ALL", state: { windows: fixed, zOrder: saved.zOrder, dockGroups: saved.dockGroups || [] } });
        }
      }
    } catch { /* ignore */ }
  }, []);

  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* ignore */ }
    }, 500);
  }, [state]);

  const register = useCallback((id: string, initial: WindowState) => {
    dispatch({ type: "REGISTER", id, state: initial });
  }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    dispatch({ type: "MOVE", id, x, y });
  }, []);

  const bringToFront = useCallback((id: string) => {
    dispatch({ type: "BRING_TO_FRONT", id });
  }, []);

  const bringGroupToFront = useCallback((ids: string[]) => {
    dispatch({ type: "BRING_GROUP_TO_FRONT", ids });
  }, []);

  const minimize = useCallback((id: string) => {
    dispatch({ type: "MINIMIZE", id });
  }, []);

  const restore = useCallback((id: string) => {
    dispatch({ type: "RESTORE", id });
  }, []);

  const resizeWindow = useCallback((id: string, width: number, height: number) => {
    dispatch({ type: "RESIZE", id, width, height });
  }, []);

  const moveGroupDelta = useCallback((ids: string[], dx: number, dy: number) => {
    dispatch({ type: "MOVE_GROUP", ids, dx, dy });
  }, []);

  const setDomHeight = useCallback((id: string, h: number) => {
    domHeightsRef.current[id] = h;
  }, []);

  const withDomHeights = useCallback((windows: Record<string, WindowState>): Record<string, WindowState> => {
    const dh = domHeightsRef.current;
    const result: Record<string, WindowState> = {};
    for (const [id, w] of Object.entries(windows)) {
      result[id] = dh[id] ? { ...w, height: dh[id] } : w;
    }
    return result;
  }, []);

  const pushDockedBelow = useCallback((id: string, delta: number) => {
    if (delta === 0) return;
    const s = stateRef.current;
    const dh = domHeightsRef.current;
    const group = s.dockGroups.find((g) => g.includes(id));
    if (!group || group.length < 2) return;

    const winH = (wid: string) => {
      const w = s.windows[wid];
      return w ? (dh[wid] || w.height) : 0;
    };

    const belowAdj = new Map<string, string[]>();
    for (const gid of group) belowAdj.set(gid, []);

    for (let i = 0; i < group.length; i++) {
      const a = s.windows[group[i]];
      if (!a) continue;
      const aB = a.y + winH(group[i]);
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue;
        const b = s.windows[group[j]];
        if (!b) continue;
        if (Math.abs(aB - b.y) <= 2) {
          const aR = a.x + a.width;
          const bR = b.x + b.width;
          if (a.x < bR && aR > b.x) {
            belowAdj.get(group[i])!.push(group[j]);
          }
        }
      }
    }

    const toMove = new Set<string>();
    const stack = [id];
    const visited = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const below of belowAdj.get(cur) || []) {
        toMove.add(below);
        stack.push(below);
      }
    }

    if (toMove.size === 0) return;
    dispatch({ type: "MOVE_GROUP", ids: Array.from(toMove), dx: 0, dy: delta });
    setTimeout(() => {
      const groups = computeDockGroups(withDomHeights(stateRef.current.windows));
      dispatch({ type: "SET_DOCK_GROUPS", groups });
    }, 0);
  }, [withDomHeights]);

  const recoverOffscreen = useCallback(() => {
    const s = stateRef.current;
    const resolved = withDomHeights(s.windows);
    const rescues = computeRescues(resolved);
    if (Object.keys(rescues).length === 0) return;
    for (const [id, pos] of Object.entries(rescues)) {
      dispatch({ type: "MOVE", id, x: pos.x, y: pos.y });
    }
    setTimeout(() => {
      const groups = computeDockGroups(withDomHeights(stateRef.current.windows));
      dispatch({ type: "SET_DOCK_GROUPS", groups });
    }, 0);
  }, [withDomHeights]);

  const getSnappedPosition = useCallback((id: string, x: number, y: number): { x: number; y: number } => {
    const s = stateRef.current;
    const win = s.windows[id];
    if (!win) return { x, y };
    const dh = domHeightsRef.current;
    const group = s.dockGroups.find((g) => g.includes(id));
    const excludeIds = new Set(group || [id]);
    const proposed = { ...win, x, y, height: dh[id] || win.height };
    const others = Object.entries(s.windows)
      .filter(([k]) => !excludeIds.has(k))
      .map(([k, w]) => [k, dh[k] ? { ...w, height: dh[k] } : w] as [string, WindowState]);
    return computeSnap(proposed, others);
  }, []);

  const snapAndDock = useCallback((id: string) => {
    const s = stateRef.current;
    const win = s.windows[id];
    if (!win) return;
    const dh = domHeightsRef.current;
    const group = s.dockGroups.find((g) => g.includes(id));
    const excludeIds = new Set(group || [id]);
    const snapWin = dh[id] ? { ...win, height: dh[id] } : win;
    const others = Object.entries(s.windows)
      .filter(([k]) => !excludeIds.has(k))
      .map(([k, w]) => [k, dh[k] ? { ...w, height: dh[k] } : w] as [string, WindowState]);
    const snapped = computeSnap(snapWin, others);
    const dx = snapped.x - win.x;
    const dy = snapped.y - win.y;
    if (dx !== 0 || dy !== 0) {
      if (group && group.length > 1) {
        dispatch({ type: "MOVE_GROUP", ids: group, dx, dy });
      } else {
        dispatch({ type: "MOVE", id, x: snapped.x, y: snapped.y });
      }
    }
    setTimeout(() => {
      const groups = computeDockGroups(withDomHeights(stateRef.current.windows));
      dispatch({ type: "SET_DOCK_GROUPS", groups });
    }, 0);
  }, [withDomHeights]);

  const getDockGroup = useCallback((id: string): string[] | undefined => {
    return stateRef.current.dockGroups.find((g) => g.includes(id));
  }, []);

  const getZIndex = useCallback((id: string): number => {
    const idx = stateRef.current.zOrder.indexOf(id);
    return idx === -1 ? 0 : idx + 10;
  }, []);

  return (
    <Ctx.Provider value={{ state, register, moveWindow, resizeWindow, bringToFront, bringGroupToFront, minimize, restore, snapAndDock, getSnappedPosition, getDockGroup, getZIndex, moveGroupDelta, setDomHeight, pushDockedBelow, recoverOffscreen }}>
      {children}
    </Ctx.Provider>
  );
}
