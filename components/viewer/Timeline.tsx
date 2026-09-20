"use client";

import { useRef, useCallback, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Pause,
  Repeat,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  StepBack,
  StepForward,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { pathDuration, removeKeyframe, EASING_LABELS, genId, isChannelKeyed, CHANNEL_COLORS, CHANNEL_LABELS } from "@/lib/camera-path";
import type { EasingType, LookAtEvent, CameraKeyframe, ChannelName } from "@/lib/camera-path";
import IconButton from "@/components/ui/IconButton";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import CycleSelect from "@/components/ui/CycleSelect";
import ScrubInput from "./ScrubInput";
import { useFrameExport } from "@/lib/use-frame-export";
import FrameSizePopover from "@/components/viewer/FrameSizePopover";

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];
const FPS_OPTIONS = [24, 25, 30, 48, 50, 60];
const TRACK_H = 38;
const SUB_TRACK_H = 20;
const LABEL_W_DEFAULT = 116;
const LABEL_W_SCIIN = 104;
const LABEL_W_WINAMP = 96;
const LABEL_W_WIN95 = 96;
const RULER_H = 18;
const DOPE_CHANNELS: ChannelName[] = ["posX", "posY", "posZ", "pitch", "yaw", "fov"];

const CGA_CHANNEL_COLORS: Record<ChannelName, string> = {
  posX: "#FF0000",
  posY: "#00FF00",
  posZ: "#00FFFF",
  pitch: "#FFFF00",
  yaw: "#FF00FF",
  fov: "#FFFFFF",
};

function timeToFrame(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

function frameToTime(frame: number, fps: number): number {
  return frame / fps;
}

function formatFrameDisplay(seconds: number, fps: number): string {
  const totalFrames = Math.round(seconds * fps);
  const sec = Math.floor(totalFrames / fps);
  const fr = totalFrames % fps;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) {
    return `${m}:${String(s).padStart(2, "0")}:${String(fr).padStart(2, "0")}`;
  }
  return `${s}:${String(fr).padStart(2, "0")}`;
}

function formatFrameShort(seconds: number, fps: number): string {
  const totalFrames = Math.round(seconds * fps);
  return String(totalFrames);
}

function channelLabel(kf: { keyedChannels?: string[] }): string {
  if (!kf.keyedChannels) return "";
  const map: Record<string, string> = { position: "P", rotation: "R", fov: "F" };
  return kf.keyedChannels.map(g => map[g] ?? "").join("");
}

export default function Timeline() {
  const {
    paths,
    activePathId,
    playbackState,
    anchors,
    selectedAnchorId,
    anchorAnimations,
    compFps,
    compDuration,
    workAreaIn,
    workAreaOut,
    selectedKfIds,
    showGraphEditor,
    actions,
    refs,
  } = useScene();

  const cap = useThemeCapabilities();
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isSciin = cap.usesTextControls;
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isAim = cap.layoutShell === "xp-desktop";
  const isScenit = cap.layoutShell === "scenit-grid";
  const LABEL_W_AIM = 119;
  const labelW = isWinamp ? LABEL_W_WINAMP : isWin95 ? LABEL_W_WIN95 : isAim ? LABEL_W_AIM : isSciin ? LABEL_W_SCIIN : LABEL_W_DEFAULT;
  const labelGap = isWin95 ? 8 : 0;
  const trackRef = useRef<HTMLDivElement>(null);
  const lastClickedKfRef = useRef<string | null>(null);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const fpsBtnRef = useRef<HTMLButtonElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const fpsMenuRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<"keyframe" | "export" | null>(null);
  const kfMenuBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [draggingKf, setDraggingKf] = useState<string | null>(null);
  const [dopeSheetExpanded, setDopeSheetExpanded] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showFpsMenu, setShowFpsMenu] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState("");
  const fe = useFrameExport();
  const [editingFrame, setEditingFrame] = useState(false);
  const [frameInput, setFrameInput] = useState("");
  const [draggingAnchorEdge, setDraggingAnchorEdge] = useState<{
    anchorId: string;
    edge: "left" | "right";
  } | null>(null);
  const [draggingAnchorKf, setDraggingAnchorKf] = useState<{
    anchorId: string;
    kfIndex: number;
  } | null>(null);
  const [boxSelect, setBoxSelect] = useState<{ startX: number; currentX: number } | null>(null);
  const [workAreaMenu, setWorkAreaMenu] = useState<{ x: number; y: number } | null>(null);
  const workAreaMenuRef = useRef<HTMLDivElement>(null);

  const activePath = paths.find((p) => p.id === activePathId);
  const keyframeDuration = activePath ? pathDuration(activePath) : 0;

  const safeD = Math.max(compDuration, 0.1);

  const timeToPercent = (t: number) => (t / safeD) * 100;

  const percentToTime = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * safeD;
    },
    [safeD]
  );

  const snapToFrame = useCallback(
    (time: number) => frameToTime(timeToFrame(time, compFps), compFps),
    [compFps]
  );

  const subdivisions = useMemo(() => {
    const marks: { time: number; major: boolean }[] = [];
    const secInterval = safeD > 20 ? 2 : 1;
    const subInterval = safeD > 20 ? 1 : 0.5;

    for (let t = 0; t <= safeD; t += subInterval) {
      const isMajor = Math.abs(t - Math.round(t / secInterval) * secInterval) < 0.001;
      marks.push({ time: t, major: isMajor });
    }
    return marks;
  }, [safeD]);

  // Keyboard shortcuts for copy/paste/duplicate keyframes.
  // Placed before the early return so hook count is stable.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (!(e.metaKey || e.ctrlKey)) return;

      if (e.key === "c" && selectedKfIds.length > 0 && activePath) {
        e.preventDefault();
        const selected = activePath.keyframes.filter((k) => selectedKfIds.includes(k.id));
        if (selected.length === 0) return;
        const baseTime = Math.min(...selected.map((k) => k.time));
        actions.kfClipboardRef.current = {
          keyframes: selected.map((k) => ({ ...k, time: k.time - baseTime })),
          baseTime,
        };
      }

      if (e.key === "v" && actions.kfClipboardRef.current && activePathId) {
        e.preventDefault();
        const clip = actions.kfClipboardRef.current;
        const pasteTime = playbackState.currentTime;
        actions.pushUndo();
        const newKfs: CameraKeyframe[] = clip.keyframes.map((k) => ({
          ...k,
          id: genId(),
          time: pasteTime + k.time,
        }));
        actions.setPaths((prev) =>
          prev.map((p) =>
            p.id !== activePathId
              ? p
              : {
                  ...p,
                  keyframes: [...p.keyframes, ...newKfs].sort((a, b) => a.time - b.time),
                }
          )
        );
        actions.setSelectedKfIds(newKfs.map((k) => k.id));
      }

      if (e.key === "d" && selectedKfIds.length > 0 && activePath && activePathId) {
        e.preventDefault();
        const selected = activePath.keyframes.filter((k) => selectedKfIds.includes(k.id));
        if (selected.length === 0) return;
        actions.pushUndo();
        const offset = 0.5;
        const newKfs: CameraKeyframe[] = selected.map((k) => ({
          ...k,
          id: genId(),
          time: k.time + offset,
        }));
        actions.setPaths((prev) =>
          prev.map((p) =>
            p.id !== activePathId
              ? p
              : {
                  ...p,
                  keyframes: [...p.keyframes, ...newKfs].sort((a, b) => a.time - b.time),
                }
          )
        );
        actions.setSelectedKfIds(newKfs.map((k) => k.id));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedKfIds, activePath, activePathId, playbackState.currentTime, actions]);

  useEffect(() => {
    if (!showSpeedMenu && !showFpsMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (showSpeedMenu && !speedBtnRef.current?.contains(t) && !speedMenuRef.current?.contains(t)) {
        setShowSpeedMenu(false);
      }
      if (showFpsMenu && !fpsBtnRef.current?.contains(t) && !fpsMenuRef.current?.contains(t)) {
        setShowFpsMenu(false);
      }
    };
    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, [showSpeedMenu, showFpsMenu]);

  useEffect(() => {
    if (!workAreaMenu) return;
    const dismiss = (e: MouseEvent) => {
      if (!workAreaMenuRef.current?.contains(e.target as Node)) setWorkAreaMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [workAreaMenu]);

  const hasAnyAnchorAnim = anchorAnimations.some((a) => a.keyframes.length >= 1);
  const hasPlayableAnchors = anchorAnimations.some((a) => a.keyframes.length >= 2);
  if (!activePath && !isAim && !isWinamp && !hasAnyAnchorAnim) return null;

  const hasKeyframes = activePath ? activePath.keyframes.length > 0 : false;
  const kfCount = activePath?.keyframes.length ?? 0;
  const closeMenu = () => { setOpenMenu(null); fe.resetFrameExport(); };

  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-kf-diamond]")) return;

    const el = trackRef.current;
    if (!el) return;
    const startX = e.clientX;
    const rect = el.getBoundingClientRect();
    const startPct = ((startX - rect.left) / rect.width) * 100;
    let didDrag = false;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = Math.abs(ev.clientX - startX);
      if (!didDrag && dx < 4) return;
      didDrag = true;
      const currentPct = ((ev.clientX - rect.left) / rect.width) * 100;
      setBoxSelect({ startX: startPct, currentX: currentPct });
    };

    const onUp = (ev: PointerEvent) => {
      (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);

      if (didDrag && activePath) {
        const lo = Math.min(startPct, ((ev.clientX - rect.left) / rect.width) * 100);
        const hi = Math.max(startPct, ((ev.clientX - rect.left) / rect.width) * 100);
        const loTime = (lo / 100) * safeD;
        const hiTime = (hi / 100) * safeD;
        const ids = activePath.keyframes
          .filter((kf) => kf.time >= loTime && kf.time <= hiTime)
          .map((kf) => kf.id);
        if (e.shiftKey) {
          actions.setSelectedKfIds((prev) => {
            const set = new Set(prev);
            ids.forEach((id) => set.add(id));
            return Array.from(set);
          });
        } else {
          actions.setSelectedKfIds(ids);
        }
      } else if (!didDrag) {
        const time = snapToFrame(percentToTime(ev.clientX));
        refs.seekPath.current?.(time);
        actions.setSelectedKfIds([]);
      }
      setBoxSelect(null);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const handlePlayheadDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      refs.seekPath.current?.(snapToFrame(percentToTime(ev.clientX)));
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const handleKfDown = (kfId: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isMetaClick = e.metaKey || e.ctrlKey;
    const isShiftClick = e.shiftKey;

    if (isMetaClick) {
      actions.setSelectedKfIds((prev) =>
        prev.includes(kfId) ? prev.filter((id) => id !== kfId) : [...prev, kfId]
      );
    } else if (isShiftClick && activePath && lastClickedKfRef.current) {
      const kfList = activePath.keyframes;
      const lastIdx = kfList.findIndex((k) => k.id === lastClickedKfRef.current);
      const curIdx = kfList.findIndex((k) => k.id === kfId);
      if (lastIdx >= 0 && curIdx >= 0) {
        const lo = Math.min(lastIdx, curIdx);
        const hi = Math.max(lastIdx, curIdx);
        const rangeIds = kfList.slice(lo, hi + 1).map((k) => k.id);
        actions.setSelectedKfIds((prev) => {
          const set = new Set(prev);
          rangeIds.forEach((id) => set.add(id));
          return Array.from(set);
        });
      }
    } else if (!selectedKfIds.includes(kfId)) {
      actions.setSelectedKfIds([kfId]);
    }
    lastClickedKfRef.current = kfId;

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    let dragging = false;
    const DRAG_THRESHOLD = 3;
    let dragStartTime: number | null = null;

    const idsToMove = selectedKfIds.includes(kfId) ? selectedKfIds : [kfId];

    const selectedKfs = activePath?.keyframes.filter((k) => idsToMove.includes(k.id)) ?? [];
    const selTimes = selectedKfs.map((k) => k.time);
    const selMinTime = Math.min(...selTimes);
    const selMaxTime = Math.max(...selTimes);
    const draggedKfTime = activePath?.keyframes.find((k) => k.id === kfId)?.time ?? 0;
    const isEdgeKf = idsToMove.length >= 2 && (draggedKfTime === selMaxTime || draggedKfTime === selMinTime);

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        actions.pushUndo();
        setDraggingKf(kfId);
        const anchor = activePath?.keyframes.find((k) => k.id === kfId);
        dragStartTime = anchor?.time ?? 0;
      }
      const newTime = snapToFrame(percentToTime(ev.clientX));

      if (ev.shiftKey && isEdgeKf && selMaxTime !== selMinTime) {
        const pivotTime = draggedKfTime === selMaxTime ? selMinTime : selMaxTime;
        const origSpan = Math.abs(draggedKfTime - pivotTime);
        const newSpan = Math.abs(newTime - pivotTime);
        const scale = origSpan > 0 ? newSpan / origSpan : 1;
        actions.setPaths((prev) =>
          prev.map((p) => {
            if (p.id !== activePathId) return p;
            const original = activePath!.keyframes;
            return {
              ...p,
              keyframes: p.keyframes
                .map((k) => {
                  if (!idsToMove.includes(k.id)) return k;
                  const orig = original.find((o) => o.id === k.id);
                  const origT = orig?.time ?? k.time;
                  return { ...k, time: Math.max(0, snapToFrame(pivotTime + (origT - pivotTime) * scale)) };
                })
                .sort((a, b) => a.time - b.time),
            };
          })
        );
      } else {
        const delta = newTime - (dragStartTime ?? 0);
        actions.setPaths((prev) =>
          prev.map((p) => {
            if (p.id !== activePathId) return p;
            const original = activePath!.keyframes;
            return {
              ...p,
              keyframes: p.keyframes
                .map((k) => {
                  if (!idsToMove.includes(k.id)) return k;
                  const orig = original.find((o) => o.id === k.id);
                  return { ...k, time: Math.max(0, (orig?.time ?? k.time) + delta) };
                })
                .sort((a, b) => a.time - b.time),
            };
          })
        );
      }
    };
    const onUp = () => {
      setDraggingKf(null);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const handleDeleteKf = () => {
    if (selectedKfIds.length === 0 || !activePathId) return;
    actions.pushUndo();
    actions.setPaths((prev) =>
      prev.map((p) => {
        if (p.id !== activePathId) return p;
        let result = p;
        for (const id of selectedKfIds) result = removeKeyframe(result, id);
        return result;
      })
    );
    actions.setSelectedKfIds([]);
  };

  const handleEasingChange = (kfId: string, easing: EasingType) => {
    actions.pushUndo();
    actions.setPaths((prev) =>
      prev.map((p) =>
        p.id !== activePathId
          ? p
          : {
              ...p,
              keyframes: p.keyframes.map((k) =>
                k.id === kfId ? { ...k, easing } : k
              ),
            }
      )
    );
  };

  const handleLookAtChange = (kfId: string, anchorId: string | null) => {
    actions.pushUndo();
    actions.setPaths((prev) =>
      prev.map((p) => {
        if (p.id !== activePathId) return p;
        const kf = p.keyframes.find(k => k.id === kfId);
        if (!kf) return p;

        const updatedKeyframes = p.keyframes.map(k =>
          k.id === kfId
            ? { ...k, lookAtAnchorId: anchorId ?? undefined }
            : k
        );

        let events = [...(p.lookAtEvents ?? [])];
        events = events.filter(e => e.time !== kf.time);

        if (anchorId) {
          const newEvent: LookAtEvent = {
            time: kf.time,
            anchorId,
            transitionDuration: 0.5,
            easing: "easeInOutCubic",
          };
          events.push(newEvent);
          events.sort((a, b) => a.time - b.time);
        }

        return { ...p, keyframes: updatedKeyframes, lookAtEvents: events };
      })
    );
  };

  const handleLookAtDuration = (kfId: string, dur: number) => {
    actions.pushUndo();
    actions.setPaths((prev) =>
      prev.map((p) => {
        if (p.id !== activePathId) return p;
        const kf = p.keyframes.find(k => k.id === kfId);
        if (!kf || !p.lookAtEvents) return p;
        return {
          ...p,
          lookAtEvents: p.lookAtEvents.map(e =>
            Math.abs(e.time - kf.time) < 0.001
              ? { ...e, transitionDuration: Math.max(0.05, dur) }
              : e
          ),
        };
      })
    );
  };

  const handleLookAtEasing = (kfId: string, easing: EasingType) => {
    actions.pushUndo();
    actions.setPaths((prev) =>
      prev.map((p) => {
        if (p.id !== activePathId) return p;
        const kf = p.keyframes.find(k => k.id === kfId);
        if (!kf || !p.lookAtEvents) return p;
        return {
          ...p,
          lookAtEvents: p.lookAtEvents.map(e =>
            Math.abs(e.time - kf.time) < 0.001
              ? { ...e, easing }
              : e
          ),
        };
      })
    );
  };

  const handleDurationCommit = () => {
    setEditingDuration(false);
    const newDur = parseFloat(durationInput);
    if (!isNaN(newDur) && newDur > 0) {
      actions.pushUndo();
      actions.setCompDuration(newDur);
    }
  };

  const handleFrameCommit = () => {
    setEditingFrame(false);
    if (!primarySelectedId) return;
    const newFrame = parseInt(frameInput, 10);
    if (isNaN(newFrame) || newFrame < 0) return;
    const newTime = frameToTime(newFrame, compFps);
    actions.pushUndo();
    actions.setPaths((prev) =>
      prev.map((p) =>
        p.id !== activePathId
          ? p
          : {
              ...p,
              keyframes: p.keyframes
                .map((k) => (k.id === primarySelectedId ? { ...k, time: newTime } : k))
                .sort((a, b) => a.time - b.time),
            }
      )
    );
  };

  const handleAnchorEdgeDown = (anchorId: string, edge: "left" | "right", e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    actions.pushUndo();
    setDraggingAnchorEdge({ anchorId, edge });
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const time = snapToFrame(percentToTime(ev.clientX));
      actions.setAnchors((prev) =>
        prev.map((a) => {
          if (a.id !== anchorId) return a;
          if (edge === "left") return { ...a, appearAt: Math.max(0, Math.min(time, a.disappearAt ?? safeD)) };
          return { ...a, disappearAt: Math.max(a.appearAt ?? 0, Math.min(time, safeD)) };
        })
      );
    };
    const onUp = () => {
      setDraggingAnchorEdge(null);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const handleAnchorAnimKfDown = (anchorId: string, kfIndex: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    let dragging = false;

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - startX) < 3) return;
      if (!dragging) {
        dragging = true;
        actions.pushUndo();
        setDraggingAnchorKf({ anchorId, kfIndex });
      }
      const newTime = snapToFrame(percentToTime(ev.clientX));
      actions.setAnchorAnimations(prev =>
        prev.map(a => {
          if (a.anchorId !== anchorId) return a;
          return {
            ...a,
            keyframes: a.keyframes
              .map((kf, i) => i === kfIndex ? { ...kf, time: Math.max(0, newTime) } : kf)
              .sort((x, y) => x.time - y.time),
          };
        })
      );
    };
    const onUp = () => {
      setDraggingAnchorKf(null);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const handleBracketDown = (edge: "in" | "out", e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    actions.pushUndo();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const time = snapToFrame(percentToTime(ev.clientX));
      if (edge === "in") actions.setWorkAreaIn(Math.max(0, Math.min(time, (workAreaOut ?? safeD))));
      else actions.setWorkAreaOut(Math.max(workAreaIn ?? 0, Math.min(time, safeD)));
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const handleWorkAreaContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const hasWorkArea = workAreaIn != null || workAreaOut != null;
    if (!hasWorkArea) return;
    const effectiveIn = workAreaIn ?? 0;
    const effectiveOut = workAreaOut ?? safeD;
    const time = percentToTime(e.clientX);
    if (time >= effectiveIn && time <= effectiveOut) {
      setWorkAreaMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const hasAnyBracket = workAreaIn != null || workAreaOut != null;
  const effectiveIn = workAreaIn ?? 0;
  const effectiveOut = workAreaOut ?? safeD;

  const canPlay = (hasKeyframes && activePath != null && activePath.keyframes.length >= 2) || hasPlayableAnchors;
  const primarySelectedId = selectedKfIds.length > 0 ? selectedKfIds[selectedKfIds.length - 1] : null;
  const selectedKfData = hasKeyframes && primarySelectedId && activePath ? activePath.keyframes.find((k) => k.id === primarySelectedId) : undefined;
  const timedAnchors = anchors.filter((a) => a.appearAt != null || a.disappearAt != null);
  const animatedAnchors = anchorAnimations.filter(a => a.keyframes.length > 0);

  const currentFrame = timeToFrame(playbackState.currentTime, compFps);

  const selectedLookAtEvent = selectedKfData && activePath
    ? activePath.lookAtEvents?.find(e => Math.abs(e.time - selectedKfData.time) < 0.001)
    : undefined;

  return (
    <div className={`flex flex-col ${isAim ? "wmm-container gap-0" : `gap-2 ${isWin95 ? "py-3" : "p-3"}`} ${isWinamp ? "winamp-timeline-shell" : ""}`}>
      {/* WMM toolbar */}
      {isAim && (
        <div className="wmm-toolbar">
          <div className="wmm-toolbar-group">
            <div style={{ position: "relative" }}>
              <button
                ref={kfMenuBtnRef}
                className={`wmm-toolbar-menu-btn${openMenu === "keyframe" ? " wmm-toolbar-menu-open" : ""}`}
                onClick={() => setOpenMenu(openMenu === "keyframe" ? null : "keyframe")}
              >
                Keyframe
              </button>
              {openMenu === "keyframe" && createPortal(
                <>
                  <div className="aim-dropdown-backdrop" onClick={closeMenu} />
                  <div
                    className="aim-dropdown"
                    style={(() => {
                      const r = kfMenuBtnRef.current?.getBoundingClientRect();
                      return r ? { position: "fixed" as const, left: r.left, top: r.bottom + 1, zIndex: 9999 } : {};
                    })()}
                  >
                    <button className="aim-dropdown-item" onClick={() => { refs.triggerAddKeyframe.current?.(); closeMenu(); }}>
                      Add Keyframe<span className="aim-dropdown-shortcut">K</span>
                    </button>
                    <button className="aim-dropdown-item" onClick={() => { refs.addChannelKeyframe.current?.(["position"]); closeMenu(); }}>
                      Position Only<span className="aim-dropdown-shortcut">P</span>
                    </button>
                    <button className="aim-dropdown-item" onClick={() => { refs.addChannelKeyframe.current?.(["rotation"]); closeMenu(); }}>
                      Rotation Only<span className="aim-dropdown-shortcut">R</span>
                    </button>
                    {kfCount > 0 && (
                      <>
                        <div className="aim-dropdown-sep" />
                        <button className="aim-dropdown-item" disabled>
                          {kfCount} keyframe{kfCount !== 1 ? "s" : ""} on path
                        </button>
                      </>
                    )}
                  </div>
                </>,
                document.body
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button
                ref={exportMenuBtnRef}
                className={`wmm-toolbar-menu-btn${openMenu === "export" ? " wmm-toolbar-menu-open" : ""}`}
                onClick={() => setOpenMenu(openMenu === "export" ? null : "export")}
              >
                Export
              </button>
              {openMenu === "export" && createPortal(
                <>
                  <div className="aim-dropdown-backdrop" onClick={closeMenu} />
                  <div
                    className="aim-dropdown"
                    style={(() => {
                      const r = exportMenuBtnRef.current?.getBoundingClientRect();
                      return r ? { position: "fixed" as const, left: r.left, top: r.bottom + 1, zIndex: 9999 } : {};
                    })()}
                  >
                    <button className="aim-dropdown-item" onClick={() => { actions.setShowExportModal(true); closeMenu(); }}>
                      Export Video...
                    </button>
                    <div className="aim-dropdown-sep" />
                    <button
                      className={`aim-dropdown-item${fe.frameExportFormat === "png" ? " aim-dropdown-item--active" : ""}`}
                      onClick={() => fe.setFrameExportFormat((v) => v === "png" ? null : "png")}
                    >
                      Save Frame as PNG
                    </button>
                    <button
                      className={`aim-dropdown-item${fe.frameExportFormat === "jpeg" ? " aim-dropdown-item--active" : ""}`}
                      onClick={() => fe.setFrameExportFormat((v) => v === "jpeg" ? null : "jpeg")}
                    >
                      Save Frame as JPG
                    </button>
                    {fe.frameExportFormat && (
                      <FrameSizePopover
                        format={fe.frameExportFormat}
                        width={fe.frameExportWidth}
                        height={fe.computedHeight}
                        onWidthChange={fe.setFrameExportWidth}
                        onExport={() => { fe.captureFrameAtSize(fe.frameExportFormat!, fe.frameExportWidth, fe.computedHeight); closeMenu(); }}
                      />
                    )}
                  </div>
                </>,
                document.body
              )}
            </div>
          </div>
          <button
            className={`wmm-storyboard-toggle${showGraphEditor ? " wmm-storyboard-active" : ""}`}
            title={showGraphEditor ? "Hide Curves" : "Show Curves"}
            onClick={() => actions.setShowGraphEditor((v: boolean) => !v)}
          >
            {showGraphEditor ? "Hide Curves" : "Curves"}
          </button>
        </div>
      )}
      {/* Transport controls */}
      <div className={`transport-controls flex items-center gap-2${isWin95 ? " px-3" : ""}${isAim ? " wmm-monitor" : ""}${isWinamp ? " winamp-transport-shell" : ""}`}>
        {/* Group 1: Playback buttons */}
        <div className={`transport-group flex items-center gap-1${isWinamp ? " winamp-transport-main" : ""}`}>
          {isSciin ? (
            <>
              <button className="sciin-toolbar-btn font-bold text-[11px] px-1 py-0.5" disabled={!canPlay} title="Jump to start" onClick={() => refs.seekPath.current?.(hasAnyBracket ? effectiveIn : 0)}>[|&lt;]</button>
              <button className="sciin-toolbar-btn font-bold text-[11px] px-1 py-0.5" disabled={!canPlay} title="Frame back" onClick={() => { const frameDur = 1 / compFps; const minTime = hasAnyBracket ? effectiveIn : 0; refs.seekPath.current?.(Math.max(minTime, playbackState.currentTime - frameDur)); }}>[&lt;]</button>
              <button
                className="sciin-toolbar-btn font-bold text-[11px] px-1 py-0.5"
                disabled={!canPlay}
                title={playbackState.isPlaying ? "Pause" : "Play"}
                onClick={() => {
                  if (playbackState.isPlaying) {
                    refs.pausePath.current?.();
                  } else {
                    if (hasAnyBracket && (playbackState.currentTime < effectiveIn || playbackState.currentTime >= effectiveOut)) {
                      refs.seekPath.current?.(effectiveIn);
                    }
                    refs.playPath.current?.();
                  }
                }}
              >{playbackState.isPlaying ? "[||]" : "[>]"}</button>
              <button className="sciin-toolbar-btn font-bold text-[11px] px-1 py-0.5" disabled={!canPlay} title="Frame forward" onClick={() => { const frameDur = 1 / compFps; const maxTime = hasAnyBracket ? effectiveOut : safeD; refs.seekPath.current?.(Math.min(maxTime, playbackState.currentTime + frameDur)); }}>[&gt;]</button>
              <button className="sciin-toolbar-btn font-bold text-[11px] px-1 py-0.5" disabled={!canPlay} title="Jump to end" onClick={() => refs.seekPath.current?.(hasAnyBracket ? effectiveOut : safeD)}>[&gt;|]</button>
            </>
          ) : (
            <>
              <IconButton
                size="sm"
                onClick={() => refs.seekPath.current?.(hasAnyBracket ? effectiveIn : 0)}
                disabled={!canPlay}
                title="Jump to start"
              >
                {isWinamp ? (
                  <svg className="h-[13px] w-[13px]" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="2" width="2" height="12" /><polygon points="9,2 2,8 9,14" /><polygon points="15,2 8,8 15,14" /></svg>
                ) : isAim ? <SkipBack className="wmm-icon" /> : <ThemeIcon icon={SkipBack} className="h-3.5 w-3.5" />}
              </IconButton>
              <IconButton
                size="sm"
                onClick={() => {
                  const frameDur = 1 / compFps;
                  const minTime = hasAnyBracket ? effectiveIn : 0;
                  refs.seekPath.current?.(Math.max(minTime, playbackState.currentTime - frameDur));
                }}
                disabled={!canPlay}
                title="Frame back"
              >
                {isAim ? <StepBack className="wmm-icon" /> : <ThemeIcon icon={StepBack} className="h-3.5 w-3.5" />}
              </IconButton>
              <IconButton
                size="sm"
                onClick={() => {
                  if (playbackState.isPlaying) {
                    refs.pausePath.current?.();
                  } else {
                    if (hasAnyBracket && (playbackState.currentTime < effectiveIn || playbackState.currentTime >= effectiveOut)) {
                      refs.seekPath.current?.(effectiveIn);
                    }
                    refs.playPath.current?.();
                  }
                }}
                disabled={!canPlay}
                title={playbackState.isPlaying ? "Pause" : "Play"}
              >
                {isAim ? (
                  playbackState.isPlaying ? <Pause className="wmm-icon" /> : <Play className="wmm-icon" />
                ) : (
                  playbackState.isPlaying ? <ThemeIcon icon={Pause} className="h-3.5 w-3.5" /> : <ThemeIcon icon={Play} className="h-3.5 w-3.5" />
                )}
              </IconButton>
              <IconButton
                size="sm"
                onClick={() => {
                  const frameDur = 1 / compFps;
                  const maxTime = hasAnyBracket ? effectiveOut : safeD;
                  refs.seekPath.current?.(Math.min(maxTime, playbackState.currentTime + frameDur));
                }}
                disabled={!canPlay}
                title="Frame forward"
              >
                {isAim ? <StepForward className="wmm-icon" /> : <ThemeIcon icon={StepForward} className="h-3.5 w-3.5" />}
              </IconButton>
              <IconButton
                size="sm"
                onClick={() => refs.seekPath.current?.(hasAnyBracket ? effectiveOut : safeD)}
                disabled={!canPlay}
                title="Jump to end"
              >
                {isWinamp ? (
                  <svg className="h-[13px] w-[13px]" viewBox="0 0 16 16" fill="currentColor"><polygon points="1,2 8,8 1,14" /><polygon points="7,2 14,8 7,14" /><rect x="14" y="2" width="2" height="12" /></svg>
                ) : isAim ? <SkipForward className="wmm-icon" /> : <ThemeIcon icon={SkipForward} className="h-3.5 w-3.5" />}
              </IconButton>
            </>
          )}
        </div>

        {/* Group 2: Loop */}
        <div className={`transport-group flex items-center${isWinamp ? " winamp-transport-loop" : ""}`}>
          {isSciin ? (
            <button
              className={`sciin-toolbar-btn font-bold text-[11px] px-1 py-0.5 ${playbackState.loop ? "text-accent-400" : ""}`}
              onClick={() => refs.setPlaybackLoop.current?.(!playbackState.loop)}
              title="Loop"
            >[RPT]</button>
          ) : (
            <IconButton
              size="sm"
              active={playbackState.loop}
              onClick={() => refs.setPlaybackLoop.current?.(!playbackState.loop)}
              title="Loop"
            >
              {isWinamp ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  <polygon points="22,1 22,9 14,9" fill="currentColor" stroke="none" />
                  <polygon points="2,23 2,15 10,15" fill="currentColor" stroke="none" />
                </svg>
              ) : isAim ? (
                <svg className="wmm-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="11,1.5 14.5,4 11,6.5" fill="currentColor" stroke="none" />
                  <path d="M13 4H5.5C4.12 4 3 5.12 3 6.5V7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
                  <polygon points="5,9.5 1.5,12 5,14.5" fill="currentColor" stroke="none" />
                  <path d="M3 12H10.5C11.88 12 13 10.88 13 9.5V8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
                </svg>
              ) : <ThemeIcon icon={Repeat} className="h-3.5 w-3.5" />}
            </IconButton>
          )}
        </div>

        {/* Group 3: Speed & FPS */}
        <div className={`transport-group flex items-center gap-1${isWinamp ? " winamp-transport-rate" : ""}`}>
          {isSciin ? (
            <>
              <CycleSelect
                options={SPEED_OPTIONS.map((s) => ({ value: s, label: `${s}x` }))}
                value={playbackState.speed}
                onChange={(v) => refs.setPlaybackSpeed.current?.(v)}
              />
              <CycleSelect
                options={FPS_OPTIONS.map((f) => ({ value: f, label: `${f}fps` }))}
                value={compFps}
                onChange={(v) => actions.setCompFps(v)}
              />
            </>
          ) : (
            <>
              <div>
                <button
                  ref={speedBtnRef}
                  onClick={() => { setShowSpeedMenu((s) => !s); setShowFpsMenu(false); }}
                  className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] tabular-nums text-content-secondary transition-colors hover:bg-surface-raised${isWinamp ? " winamp-btn-toggle" : ""}`}
                >
                  {playbackState.speed}x
                  <ThemeIcon icon={ChevronDown} className="h-3 w-3" />
                </button>
                {showSpeedMenu && createPortal(
                  <div
                    ref={speedMenuRef}
                    className="fixed rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg animate-fade-in z-[9999]"
                    style={(() => {
                      const r = speedBtnRef.current?.getBoundingClientRect();
                      return r ? { left: r.left, top: r.top - 4, transform: "translateY(-100%)" } : {};
                    })()}
                  >
                    {SPEED_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          refs.setPlaybackSpeed.current?.(s);
                          setShowSpeedMenu(false);
                        }}
                        className={`block w-full px-3 py-1 text-left text-[11px] tabular-nums hover:bg-surface-border-secondary ${
                          playbackState.speed === s ? "text-accent-400" : "text-content-primary"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
              </div>
              <div>
                <button
                  ref={fpsBtnRef}
                  onClick={() => { setShowFpsMenu((s) => !s); setShowSpeedMenu(false); }}
                  className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] tabular-nums text-content-secondary transition-colors hover:bg-surface-raised"
                >
                  {compFps}fps
                  <ThemeIcon icon={ChevronDown} className="h-3 w-3" />
                </button>
                {showFpsMenu && createPortal(
                  <div
                    ref={fpsMenuRef}
                    className="fixed rounded-md border border-surface-border-secondary bg-surface-raised py-1 shadow-lg animate-fade-in z-[9999]"
                    style={(() => {
                      const r = fpsBtnRef.current?.getBoundingClientRect();
                      return r ? { left: r.left, top: r.top - 4, transform: "translateY(-100%)" } : {};
                    })()}
                  >
                    {FPS_OPTIONS.map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          actions.setCompFps(f);
                          setShowFpsMenu(false);
                        }}
                        className={`block w-full px-3 py-1 text-left text-[11px] tabular-nums hover:bg-surface-border-secondary ${
                          compFps === f ? "text-accent-400" : "text-content-primary"
                        }`}
                      >
                        {f}fps
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
              </div>
            </>
          )}
        </div>

        {/* Time display */}
        <div className={`ml-auto flex items-center${isWinamp ? " winamp-time-tray" : ""}`}>
          {isWinamp && <span className="winamp-time-caption">TIME</span>}
          <div className={`time-display flex items-center gap-1${isWinamp ? " winamp-time-display" : ""}`}>
            <span className={`text-[11px] tabular-nums ${isSciin ? "" : "text-content-secondary"}`}
              style={isSciin ? { color: "#00FFFF", fontFamily: "monospace" } : undefined}
            >
              {formatFrameDisplay(playbackState.currentTime, compFps)}
            </span>
            <span className={`text-[11px] tabular-nums ${isSciin ? "" : "text-content-faint"}`}
              style={isSciin ? { color: "#00FF00", fontFamily: "monospace" } : undefined}
            >
              f{currentFrame}
            </span>
            <span className={`text-[11px] ${isSciin ? "text-[#FF00FF]" : "text-content-faint"}`}>/</span>
            {editingDuration ? (
              <input
                autoFocus
                type="text"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onBlur={handleDurationCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDurationCommit();
                  if (e.key === "Escape") setEditingDuration(false);
                }}
                className="w-12 rounded border border-accent-500 bg-surface-raised px-1 text-[11px] tabular-nums text-content-primary outline-none"
              />
            ) : (
              <button
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  const startX = e.clientX;
                  const startVal = compDuration;
                  let didDrag = false;
                  let pushed = false;
                  const el = e.currentTarget;
                  el.setPointerCapture(e.pointerId);
                  const onMove = (ev: PointerEvent) => {
                    const dx = ev.clientX - startX;
                    if (!didDrag && Math.abs(dx) < 4) return;
                    didDrag = true;
                    if (!pushed) { actions.pushUndo(); pushed = true; }
                    const frameStep = 5 / compFps;
                    const steps = Math.round(dx / 3);
                    actions.setCompDuration(Math.max(0.5, startVal + steps * frameStep));
                  };
                  const onUp = () => {
                    el.removeEventListener("pointermove", onMove);
                    el.removeEventListener("pointerup", onUp);
                    if (!didDrag) {
                      setDurationInput(compDuration.toFixed(1));
                      setEditingDuration(true);
                    }
                  };
                  el.addEventListener("pointermove", onMove);
                  el.addEventListener("pointerup", onUp);
                }}
                className={`cursor-ew-resize text-[11px] tabular-nums ${isSciin ? "sciin-toolbar-btn hover:text-[#FFFF00]" : "text-content-muted hover:text-accent-400"}`}
                style={isSciin ? { color: "#FFFF00", fontFamily: "monospace" } : undefined}
                title="Click to edit, drag to scrub"
              >
                {formatFrameDisplay(compDuration, compFps)}
                <span className={`ml-0.5 ${isSciin ? "text-[#FFFF00]/60" : "text-content-faint"}`}>({compDuration.toFixed(1)}s)</span>
              </button>
            )}
          </div>
          {isSciin && (
            <button
              onClick={() => actions.setShowGraphEditor((v: boolean) => !v)}
              className={`sciin-toolbar-btn font-bold text-[11px] ml-6 ${showGraphEditor ? "text-[#FFFFFF]" : ""}`}
              style={!showGraphEditor ? { color: "var(--rl-yellow)" } : undefined}
            >
              [Curves]
            </button>
          )}
          {isScenit && (
            <button
              onClick={() => actions.setShowGraphEditor((v: boolean) => !v)}
              className={`curves-toggle ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase transition-colors ${
                showGraphEditor
                  ? "bg-accent-500/20 text-accent-400"
                  : "text-content-faint hover:text-content-secondary"
              }`}
            >
              Curves
            </button>
          )}
        </div>
      </div>

      {/* Multi-track area */}
      {(hasKeyframes || isWinamp || hasAnyAnchorAnim) ? (
      <div className={`flex flex-col${isWin95 ? " px-2" : isAim ? " wmm-tracks-area" : " pr-8"}${isWinamp ? " winamp-track-shell" : ""}`} onContextMenu={handleWorkAreaContextMenu}>
        {/* Ruler with subdivision ticks */}
        <div className={`flex${isWinamp ? " winamp-track-ruler" : ""}`}>
          <div style={{ width: labelW, marginRight: labelGap }} className="shrink-0" />
          <div
            className="relative flex-1 cursor-pointer"
            style={{ height: RULER_H }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const time = snapToFrame(ratio * safeD);
              refs.seekPath.current?.(time);
              actions.setSelectedKfIds([]);
            }}
          >
            {subdivisions.map(({ time, major }) => {
              const pct = timeToPercent(time);
              if (pct < 0 || pct > 100) return null;
              return (
                <div
                  key={time}
                  className="absolute top-0"
                  style={{ left: `${pct}%` }}
                >
                  <div
                    className={isSciin
                      ? (major ? "w-px" : "w-px opacity-30")
                      : (major ? "w-px bg-content-faint" : "w-px bg-surface-border-secondary/60")
                    }
                    style={{
                      height: major ? RULER_H : RULER_H * 0.5,
                      ...(isSciin ? { backgroundColor: major ? "#FF00FF" : "#AA00AA" } : {}),
                    }}
                  />
                  {major && (
                    <span
                      className={`absolute left-1 top-0 text-[8px] tabular-nums select-none ${isSciin ? "" : "text-content-faint"}`}
                      style={isSciin ? { color: "#00FFFF", fontFamily: "monospace" } : undefined}
                    >
                      {formatFrameShort(time, compFps)}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Work area bracket overlays on ruler */}
            {hasAnyBracket && effectiveIn > 0 && (
              <div
                className="pointer-events-none absolute top-0 h-full bg-surface-base/50"
                style={{ left: 0, width: `${timeToPercent(effectiveIn)}%` }}
              />
            )}
            {hasAnyBracket && effectiveOut < safeD && (
              <div
                className="pointer-events-none absolute top-0 h-full bg-surface-base/50"
                style={{ left: `${timeToPercent(effectiveOut)}%`, right: 0 }}
              />
            )}
            {hasAnyBracket && (
              <div
                className={`absolute top-0 h-full w-1 cursor-col-resize ${
                  isSciin
                    ? "hover:bg-[#FFFF00]"
                    : "hover:bg-amber-400"
                } ${workAreaIn != null
                  ? (isSciin ? "bg-[#FFFF00]/80" : "bg-amber-500/80")
                  : (isSciin ? "bg-[#FFFF00]/40" : "bg-amber-500/40")
                }`}
                style={{ left: `${timeToPercent(effectiveIn)}%`, transform: "translateX(-50%)" }}
                onPointerDown={(e) => handleBracketDown("in", e)}
                title={`In: f${timeToFrame(effectiveIn, compFps)}`}
              />
            )}
            {hasAnyBracket && (
              <div
                className={`absolute top-0 h-full w-1 cursor-col-resize ${
                  isSciin
                    ? "hover:bg-[#FFFF00]"
                    : "hover:bg-amber-400"
                } ${workAreaOut != null
                  ? (isSciin ? "bg-[#FFFF00]/80" : "bg-amber-500/80")
                  : (isSciin ? "bg-[#FFFF00]/40" : "bg-amber-500/40")
                }`}
                style={{ left: `${timeToPercent(effectiveOut)}%`, transform: "translateX(-50%)" }}
                onPointerDown={(e) => handleBracketDown("out", e)}
                title={`Out: f${timeToFrame(effectiveOut, compFps)}`}
              />
            )}
          </div>
        </div>

        {/* Camera track */}
        <div className="flex items-center">
          {isSciin ? (
            <button
              className="sciin-toolbar-btn flex shrink-0 items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00FFFF]"
              style={{ width: labelW }}
              onClick={() => setDopeSheetExpanded((v) => !v)}
              title={dopeSheetExpanded ? "Collapse channels" : "Expand channels"}
            >
              <span>{dopeSheetExpanded ? "v" : ">"}</span>
              Camera
            </button>
          ) : isWinamp ? (
            <div className="shrink-0 flex items-center" style={{ width: labelW }}>
              <div className="winamp-btn-tray">
                <button
                  className="winamp-btn-label"
                  onClick={() => setDopeSheetExpanded((v) => !v)}
                  title={dopeSheetExpanded ? "Collapse channels" : "Expand channels"}
                >
                  CAMERA
                </button>
              </div>
            </div>
          ) : isAim ? (
            <button
              className="wmm-track-label flex shrink-0 items-center gap-1"
              style={{ width: labelW, marginRight: labelGap }}
              onClick={() => setDopeSheetExpanded((v) => !v)}
              title={dopeSheetExpanded ? "Collapse channels" : "Expand channels"}
            >
              <span className="wmm-track-expand">{dopeSheetExpanded ? "\u229F" : "\u229E"}</span>
              Camera
            </button>
          ) : (
            <button
              className="win95-plain-label flex shrink-0 items-center gap-0.5 text-[9px] font-medium uppercase tracking-wider text-content-muted hover:text-content-secondary"
              style={{ width: labelW, marginRight: labelGap }}
              onClick={() => setDopeSheetExpanded((v) => !v)}
              title={dopeSheetExpanded ? "Collapse channels" : "Expand channels"}
            >
              {dopeSheetExpanded ? (
                <ThemeIcon icon={ChevronDown} className="h-2.5 w-2.5" />
              ) : (
                <ThemeIcon icon={ChevronRight} className="h-2.5 w-2.5" />
              )}
              Camera
            </button>
          )}
          <div
            ref={trackRef}
            className={isSciin
              ? "relative cursor-pointer bg-[#050403]"
              : `${isWinamp ? "winamp-graph-inset" : "win95-inset win95-track"} relative cursor-pointer rounded ${isAim ? "bg-white" : "bg-surface-raised"}`
            }
            style={{ height: TRACK_H, flex: 1, clipPath: "inset(-6px -8px)" }}
            onPointerDown={handleTrackPointerDown}
          >
            {isWinamp && Array.from({ length: 3 }, (_, i) => (
              <div
                key={`hline-${i}`}
                className="pointer-events-none absolute left-0 w-full h-px bg-white/[0.08]"
                style={{ top: `${((i + 1) / 4) * 100}%` }}
              />
            ))}
            {subdivisions.map(({ time, major }) => {
              const pct = timeToPercent(time);
              if (pct < 0 || pct > 100) return null;
              return (
                <div
                  key={`tick-${time}`}
                  className={`pointer-events-none absolute top-0 h-full w-px ${
                    isSciin
                      ? (major ? "opacity-25" : "opacity-10")
                      : major
                        ? (isWinamp ? "bg-white/[0.1]" : "bg-surface-border-secondary/40")
                        : (isWinamp ? "bg-white/[0.05]" : "bg-surface-border-secondary/15")
                  }`}
                  style={{
                    left: `${pct}%`,
                    ...(isSciin ? { backgroundColor: "#FF00FF" } : {}),
                  }}
                />
              );
            })}

            {(activePath?.keyframes ?? []).map((kf, idx) => {
              const label = channelLabel(kf);
              const hasLookAt = !!kf.lookAtAnchorId;
              const isSelected = selectedKfIds.includes(kf.id);
              return isSciin ? (
                <div
                  key={kf.id}
                  data-kf-diamond
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab font-bold leading-none"
                  style={{
                    left: `${timeToPercent(kf.time)}%`,
                    color: isSelected ? "var(--rl-cyan)" : "var(--rl-gray)",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}
                  title={`Keyframe ${idx + 1} — f${timeToFrame(kf.time, compFps)}${label ? ` [${label}]` : ""}`}
                  onPointerDown={(e) => handleKfDown(kf.id, e)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {hasLookAt ? "@" : "#"}
                </div>
              ) : (
                <div
                  key={kf.id}
                  data-kf-diamond
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab`}
                  style={{ left: `${timeToPercent(kf.time)}%` }}
                  title={`Keyframe ${idx + 1} — f${timeToFrame(kf.time, compFps)}${label ? ` [${label}]` : ""}`}
                  onPointerDown={(e) => handleKfDown(kf.id, e)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div
                    className={`h-3 w-3 rotate-45 rounded-sm border transition-colors ${
                      isSelected
                        ? "border-accent-400 bg-accent-500"
                        : "border-content-muted bg-content-faint hover:border-content-secondary"
                    }`}
                  />
                  {hasLookAt && (
                    <div className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-orange-400" />
                  )}
                </div>
              );
            })}

            {keyframeDuration > compDuration && (
              <div
                className="pointer-events-none absolute top-0 h-full w-0.5 bg-red-500/50"
                style={{ left: `${timeToPercent(compDuration)}%` }}
              />
            )}

            {/* Work area dim overlays on track */}
            {hasAnyBracket && effectiveIn > 0 && (
              <div
                className="pointer-events-none absolute top-0 h-full bg-surface-base/40"
                style={{ left: 0, width: `${timeToPercent(effectiveIn)}%` }}
              />
            )}
            {hasAnyBracket && effectiveOut < safeD && (
              <div
                className="pointer-events-none absolute top-0 h-full bg-surface-base/40"
                style={{ left: `${timeToPercent(effectiveOut)}%`, right: 0 }}
              />
            )}

            {/* Box selection rect */}
            {boxSelect && (
              <div
                className={`pointer-events-none absolute top-0 h-full ${
                  isSciin
                    ? "border border-dashed border-[#00FFFF]/60 bg-[#00FFFF]/10"
                    : "rounded bg-accent-500/15 border border-accent-500/40"
                }`}
                style={{
                  left: `${Math.min(boxSelect.startX, boxSelect.currentX)}%`,
                  width: `${Math.abs(boxSelect.currentX - boxSelect.startX)}%`,
                }}
              />
            )}

            {/* Playhead */}
            <div
              className="absolute top-0 h-full w-4 -translate-x-1/2 cursor-col-resize"
              style={{ left: `${timeToPercent(playbackState.currentTime)}%` }}
              onPointerDown={handlePlayheadDown}
            >
              {isSciin ? (
                <>
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ backgroundColor: "#00FFFF", boxShadow: "0 0 4px #00FFFF" }} />
                  <div className="absolute left-1/2 -translate-x-1/2 -top-0.5 font-bold leading-none" style={{ color: "#00FFFF", fontFamily: "monospace", fontSize: "10px", textShadow: "0 0 4px #00FFFF" }}>v</div>
                </>
              ) : (
                <>
                  <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-accent-400 playhead-line" />
                  <div className="absolute left-1/2 -translate-x-1/2 -top-1 h-2.5 w-3.5 rounded-sm bg-accent-400 playhead-marker" />
                  {(() => {
                    const t = playbackState.currentTime;
                    const s = Math.floor(t);
                    const f = Math.floor((t - s) * compFps);
                    const pct = timeToPercent(t);
                    const tx = pct < 3 ? 0 : pct > 97 ? -100 : -50;
                    return (
                      <div
                        className="pointer-events-none absolute left-1/2 bottom-0.5 rounded bg-accent-400/90 px-1 py-px text-[8px] font-medium tabular-nums text-white whitespace-nowrap"
                        style={{ transform: `translateX(${tx}%)` }}
                      >
                        {`${s}:${String(f).padStart(2, "0")}`}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dope sheet sub-rows */}
        {dopeSheetExpanded && activePath && activePath.keyframes.length > 0 && (
          DOPE_CHANNELS.map((ch, chIdx) => {
            const chColor = isSciin ? CGA_CHANNEL_COLORS[ch] : CHANNEL_COLORS[ch];
            const altBg = !isSciin && chIdx % 2 === 1 ? " bg-surface-base/30" : "";
            return (
              <div key={`dope-${ch}`} className={`flex${altBg}`}>
                <div
                  className="flex shrink-0 items-center pl-4 text-[8px] tracking-wide"
                  style={{ width: labelW, marginRight: labelGap, color: chColor }}
                >
                  {CHANNEL_LABELS[ch]}
                </div>
                <div
                  className={`relative ${isSciin ? "bg-[#050403]/60" : "rounded bg-surface-raised/30"}`}
                  style={{ height: SUB_TRACK_H, flex: 1 }}
                >
                  {activePath.keyframes.map((kf) => {
                    if (!isChannelKeyed(kf, ch)) return null;
                    const isSelected = selectedKfIds.includes(kf.id);
                    return isSciin ? (
                      <div
                        key={`${kf.id}-${ch}`}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab text-[10px] font-bold leading-none"
                        style={{
                          left: `${timeToPercent(kf.time)}%`,
                          color: isSelected ? chColor : "#52525b",
                          fontFamily: "monospace",
                        }}
                        onPointerDown={(e) => handleKfDown(kf.id, e)}
                      >
                        #
                      </div>
                    ) : (
                      <div
                        key={`${kf.id}-${ch}`}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab"
                        style={{ left: `${timeToPercent(kf.time)}%` }}
                        onPointerDown={(e) => handleKfDown(kf.id, e)}
                      >
                        <div
                          className="h-2 w-2 rotate-45 rounded-[1px] border transition-colors"
                          style={{
                            borderColor: isSelected ? chColor : (isWin95 ? "#808080" : isAim ? "#7F9DB9" : "#52525b"),
                            backgroundColor: isSelected ? chColor : "transparent",
                          }}
                        />
                      </div>
                    );
                  })}
                  <div
                    className={`pointer-events-none absolute top-0 h-full w-px -translate-x-1/2 ${isSciin ? "" : "bg-accent-400/30"}`}
                    style={{
                      left: `${timeToPercent(playbackState.currentTime)}%`,
                      ...(isSciin ? { backgroundColor: "#00FFFF", opacity: 0.4 } : {}),
                    }}
                  />
                </div>
              </div>
            );
          })
        )}

        {/* Anchor animation tracks */}
        {animatedAnchors.map((anim) => {
          const anchor = anchors.find(a => a.id === anim.anchorId);
          if (!anchor) return null;
          return (
            <div key={`anim-${anim.anchorId}`} className="mt-1 flex">
              {isWinamp ? (
                <span
                  className="winamp-label flex shrink-0 items-center truncate text-[9px]"
                  style={{ width: labelW - 14, marginRight: 14 + labelGap }}
                  title={anchor.label}
                >
                  <span className="truncate">{anchor.label}</span>
                </span>
              ) : (
                <button
                  className={`flex shrink-0 items-center truncate text-[9px] font-medium tracking-wider ${
                    isAim ? "wmm-track-label-sub" : ""
                  } ${anchor.id === selectedAnchorId ? "text-accent-400" : "text-content-muted"}`}
                  style={{ width: labelW, marginRight: labelGap }}
                  onClick={() => actions.setSelectedAnchorId(anchor.id)}
                  title={anchor.label}
                >
                  <span className="truncate">{anchor.label}</span>
                </button>
              )}
              <div
                className={`relative ${isSciin ? "bg-[#050403]" : isWinamp ? "winamp-graph-inset" : `${isAim ? "bg-white" : "bg-surface-raised"} rounded`}`}
                style={{ height: isWinamp ? SUB_TRACK_H : TRACK_H, flex: 1 }}
              >
                {subdivisions.map(({ time, major }) => {
                  const pct = timeToPercent(time);
                  if (pct < 0 || pct > 100) return null;
                  return (
                    <div
                      key={`atick-${time}`}
                      className={`pointer-events-none absolute top-0 h-full w-px ${
                        isSciin
                          ? (major ? "opacity-25" : "opacity-10")
                          : major
                            ? "bg-surface-border-secondary/40"
                            : "bg-surface-border-secondary/20"
                      }`}
                      style={{
                        left: `${pct}%`,
                        ...(isSciin ? { backgroundColor: major ? "#FF00FF" : "#AA00AA" } : {}),
                      }}
                    />
                  );
                })}
                {anim.keyframes.map((kf, idx) => (
                  isSciin ? (
                    <div
                      key={idx}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab font-bold leading-none"
                      style={{
                        left: `${timeToPercent(kf.time)}%`,
                        color: "var(--rl-green)",
                        fontFamily: "monospace",
                        fontSize: "11px",
                      }}
                      title={`${anchor.label} kf ${idx + 1} — ${kf.time.toFixed(2)}s`}
                      onPointerDown={(e) => handleAnchorAnimKfDown(anim.anchorId, idx, e)}
                    >
                      #
                    </div>
                  ) : (
                    <div
                      key={idx}
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-grab rounded-sm border border-emerald-500/80 bg-emerald-600/80 transition-colors hover:border-emerald-400"
                      style={{ left: `${timeToPercent(kf.time)}%` }}
                      title={`${anchor.label} kf ${idx + 1} — ${kf.time.toFixed(2)}s`}
                      onPointerDown={(e) => handleAnchorAnimKfDown(anim.anchorId, idx, e)}
                    />
                  )
                ))}

                <div
                  className={`pointer-events-none absolute top-0 h-full w-px -translate-x-1/2 ${isSciin ? "" : "bg-accent-400/40"}`}
                  style={{
                    left: `${timeToPercent(playbackState.currentTime)}%`,
                    ...(isSciin ? { backgroundColor: "#00FFFF", opacity: 0.4 } : {}),
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* Anchor visibility tracks */}
        {timedAnchors.map((anchor) => {
          const appearPct = timeToPercent(anchor.appearAt ?? 0);
          const disappearPct = timeToPercent(anchor.disappearAt ?? safeD);
          const entrancePct = timeToPercent(anchor.entranceDuration ?? 0.4);
          const exitPct = timeToPercent(anchor.exitDuration ?? 0.3);

          return (
            <div key={anchor.id} className="mt-1 flex">
              <button
                className={`flex shrink-0 items-center truncate text-[9px] font-medium tracking-wider ${
                  isAim ? "wmm-track-label-sub" : ""
                } ${anchor.id === selectedAnchorId ? "text-accent-400" : "text-content-muted"}`}
                style={{ width: labelW, marginRight: labelGap }}
                onClick={() => actions.setSelectedAnchorId(anchor.id)}
                title={anchor.label}
              >
                {anchor.label}
              </button>
              <div
                className={`relative ${isSciin ? "bg-[#050403]/60" : "rounded bg-surface-raised/50"}`}
                style={{ height: TRACK_H, flex: 1 }}
              >
                <div
                  className={`absolute top-1 bottom-1 ${isSciin ? "bg-[#00FF00]/20" : "rounded bg-accent-500/30"}`}
                  style={{
                    left: `${appearPct}%`,
                    width: `${disappearPct - appearPct}%`,
                  }}
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 ${isSciin ? "bg-gradient-to-r from-[#00FF00]/40 to-transparent" : "rounded-l bg-gradient-to-r from-accent-500/60 to-transparent"}`}
                    style={{ width: `${Math.min(entrancePct / (disappearPct - appearPct) * 100, 100)}%` }}
                  />
                  <div
                    className={`absolute right-0 top-0 bottom-0 ${isSciin ? "bg-gradient-to-l from-[#00FF00]/40 to-transparent" : "rounded-r bg-gradient-to-l from-accent-500/60 to-transparent"}`}
                    style={{ width: `${Math.min(exitPct / (disappearPct - appearPct) * 100, 100)}%` }}
                  />
                </div>

                <div
                  className="absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent-400/50"
                  style={{ left: `calc(${appearPct}% - 3px)` }}
                  onPointerDown={(e) => handleAnchorEdgeDown(anchor.id, "left", e)}
                />
                <div
                  className="absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent-400/50"
                  style={{ left: `calc(${disappearPct}% - 3px)` }}
                  onPointerDown={(e) => handleAnchorEdgeDown(anchor.id, "right", e)}
                />

                <div
                  className={`pointer-events-none absolute top-0 h-full w-px -translate-x-1/2 ${isSciin ? "" : "bg-accent-400/40"}`}
                  style={{
                    left: `${timeToPercent(playbackState.currentTime)}%`,
                    ...(isSciin ? { backgroundColor: "#00FFFF", opacity: 0.4 } : {}),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      ) : (
        <p className="py-4 text-center text-xs text-content-faint">
          No keyframes. Press K to add a keyframe, or P/R for position/rotation only.
        </p>
      )}

      {/* Selected keyframe details */}
      {selectedKfData && (
        <div className={`flex flex-col gap-1.5${isWin95 ? " px-3" : ""}${isAim ? " wmm-properties" : ""}`}>
          {selectedKfIds.length > 1 && (
            <span className="text-[10px] text-content-muted">
              {selectedKfIds.length} keyframes selected
            </span>
          )}
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`${isSciin ? "text-[#FF00FF]" : "text-content-muted"}`}>Frame:</span>
            {editingFrame ? (
              <input
                autoFocus
                type="number"
                value={frameInput}
                min={0}
                onChange={(e) => setFrameInput(e.target.value)}
                onBlur={handleFrameCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFrameCommit();
                  if (e.key === "Escape") setEditingFrame(false);
                }}
                className="w-14 rounded border border-accent-500 bg-surface-raised px-1.5 py-0.5 text-[11px] tabular-nums text-content-primary outline-none"
              />
            ) : (
              <button
                onClick={() => {
                  setFrameInput(String(timeToFrame(selectedKfData.time, compFps)));
                  setEditingFrame(true);
                }}
                className="rounded border border-surface-border-secondary bg-surface-raised px-1.5 py-0.5 text-[11px] tabular-nums text-content-primary hover:border-content-faint"
              >
                {timeToFrame(selectedKfData.time, compFps)}
              </button>
            )}
            <span className="text-[10px] text-content-faint">
              ({selectedKfData.time.toFixed(2)}s)
            </span>
            <span className={`${isSciin ? "text-[#FF00FF]" : "text-content-muted"}`}>Easing:</span>
            {isSciin ? (
              <CycleSelect
                options={(Object.keys(EASING_LABELS) as EasingType[]).map((key) => ({ value: key, label: EASING_LABELS[key] }))}
                value={selectedKfData.easing}
                onChange={(v) => handleEasingChange(selectedKfData.id, v)}
              />
            ) : (
              <select
                value={selectedKfData.easing}
                onChange={(e) =>
                  handleEasingChange(selectedKfData.id, e.target.value as EasingType)
                }
                className="rounded border border-surface-border-secondary bg-surface-raised px-1.5 py-0.5 text-[11px] text-content-primary outline-none"
              >
                {(Object.keys(EASING_LABELS) as EasingType[]).map((key) => (
                  <option key={key} value={key}>
                    {EASING_LABELS[key]}
                  </option>
                ))}
              </select>
            )}
            {isSciin ? (
              <button
                onClick={handleDeleteKf}
                className="sciin-toolbar-btn ml-auto font-bold text-[10px] text-[#FF0000] hover:text-[#FFFF00]"
                title="Delete keyframe"
              >[DEL]</button>
            ) : (
              <IconButton
                size="sm"
                danger
                onClick={handleDeleteKf}
                className="ml-auto"
                title="Delete keyframe"
              >
                <ThemeIcon icon={Trash2} className="h-3.5 w-3.5" />
              </IconButton>
            )}
          </div>

          {/* Look-at controls */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`${isSciin ? "text-[#FF00FF]" : "text-content-muted"}`}>Look At:</span>
            {isSciin ? (
              <CycleSelect
                options={[
                  { value: "", label: "None" },
                  ...anchors.map(a => ({ value: a.id, label: a.label })),
                ]}
                value={selectedKfData.lookAtAnchorId ?? ""}
                onChange={(v) => handleLookAtChange(selectedKfData.id, v || null)}
              />
            ) : (
              <select
                value={selectedKfData.lookAtAnchorId ?? ""}
                onChange={(e) =>
                  handleLookAtChange(selectedKfData.id, e.target.value || null)
                }
                className="rounded border border-surface-border-secondary bg-surface-raised px-1.5 py-0.5 text-[11px] text-content-primary outline-none"
              >
                <option value="">None</option>
                {anchors.map(a => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            )}
            {selectedLookAtEvent && (
              <>
                <span className={`${isSciin ? "text-[#FF00FF]" : "text-content-muted"}`}>Dur:</span>
                <ScrubInput
                  value={selectedLookAtEvent.transitionDuration}
                  step={0.05}
                  min={0.05}
                  max={5}
                  decimals={2}
                  onChange={(v) => handleLookAtDuration(selectedKfData.id, v)}
                />
                <span className={`${isSciin ? "text-[#FF00FF]" : "text-content-muted"}`}>Ease:</span>
                {isSciin ? (
                  <CycleSelect
                    options={(Object.keys(EASING_LABELS) as EasingType[]).map((key) => ({ value: key, label: EASING_LABELS[key] }))}
                    value={selectedLookAtEvent.easing}
                    onChange={(v) => handleLookAtEasing(selectedKfData.id, v)}
                  />
                ) : (
                  <select
                    value={selectedLookAtEvent.easing}
                    onChange={(e) =>
                      handleLookAtEasing(selectedKfData.id, e.target.value as EasingType)
                    }
                    className="rounded border border-surface-border-secondary bg-surface-raised px-1.5 py-0.5 text-[11px] text-content-primary outline-none"
                  >
                    {(Object.keys(EASING_LABELS) as EasingType[]).map((key) => (
                      <option key={key} value={key}>
                        {EASING_LABELS[key]}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Work area context menu */}
      {workAreaMenu && createPortal(
        <div
          ref={workAreaMenuRef}
          className={`fixed py-1 z-[9999] ${
            isSciin
              ? "border border-dashed border-[#FFFF00]/40 bg-[#050403]"
              : "rounded-md border border-surface-border-secondary bg-surface-raised shadow-lg"
          }`}
          style={{ left: workAreaMenu.x, top: workAreaMenu.y }}
        >
          <button
            onClick={() => {
              actions.pushUndo();
              actions.condenseToWorkArea();
              setWorkAreaMenu(null);
            }}
            className={`block w-full whitespace-nowrap px-3 py-1 text-left text-[11px] ${
              isSciin ? "text-[#00FFFF] hover:text-[#FFFF00]" : "text-content-primary hover:bg-surface-border-secondary"
            }`}
          >
            Trim to Work Area
          </button>
          <button
            onClick={() => {
              actions.pushUndo();
              actions.setWorkAreaIn(null);
              actions.setWorkAreaOut(null);
              setWorkAreaMenu(null);
            }}
            className={`block w-full whitespace-nowrap px-3 py-1 text-left text-[11px] ${
              isSciin ? "text-[#00FFFF] hover:text-[#FFFF00]" : "text-content-secondary hover:bg-surface-border-secondary"
            }`}
          >
            Clear Work Area
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
