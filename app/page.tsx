"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Upload, Loader2, MapPin, Images, Camera, SlidersHorizontal, Layers, Box } from "lucide-react";
import ScenItViewportHeader from "@/components/viewer/ScenItViewportHeader";
import ScenitDecorations from "@/components/ui/ScenitDecorations";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities, type ThemeCapabilities } from "@/themes";
import { W95HeaderDisk } from "@/themes/win95/icons";
import CollapsibleSection from "@/components/viewer/panels/CollapsibleSection";
import { Win95ViewportChrome } from "@/themes/win95/shells";
import { SceneProvider, useScene } from "@/lib/scene-context";
import { CanvasPortalProvider, useCanvasHolder, CanvasHost } from "@/lib/canvas-portal";
import ColorFilterOverlay from "@/components/ColorFilterOverlay";
import { isTutorialCompleted } from "@/lib/tutorial";
import { createPath, addKeyframe, DEFAULT_KEYFRAME_GAP } from "@/lib/camera-path";
import type { ChannelGroup } from "@/lib/camera-path";
import { useFrameExport } from "@/lib/use-frame-export";
import {
  LEFT_PANEL_WIDTH,
  RIGHT_PANEL_WIDTH,
  MIN_BOTTOM_HEIGHT,
  TOOLBAR_HEIGHT,
  GRAPH_EDITOR_EXTRA_HEIGHT,
  WIN95_EXTRA_OVERHEAD,
} from "@/lib/layout-constants";
import LandingScreen from "@/components/viewer/LandingScreen";
import Toolbar from "@/components/viewer/Toolbar";
import GizmoOverlay from "@/components/viewer/GizmoOverlay";
import PathPanel from "@/components/viewer/PathPanel";
import SettingsPanel from "@/components/viewer/SettingsPanel";
import LeftPanel from "@/components/viewer/panels/LeftPanel";
import AnchorPanel from "@/components/viewer/panels/AnchorPanel";
import AssetBrowser from "@/components/viewer/panels/AssetBrowser";
import CameraPanel from "@/components/viewer/panels/CameraPanel";
import AROverlayPanel from "@/components/viewer/panels/AROverlayPanel";
import PostProcessingPanel from "@/components/viewer/panels/PostProcessingPanel";
import DepthMeshPanel from "@/components/viewer/panels/DepthMeshPanel";
import BottomPanel from "@/components/viewer/panels/BottomPanel";
import MinimapView from "@/components/viewer/MinimapView";
import ExportModal from "@/components/viewer/ExportModal";
import TutorialOverlay from "@/components/viewer/TutorialOverlay";
import KeyHints from "@/components/viewer/KeyHints";
import HashBorder, { HASH_BORDER_H, HASH_BORDER_W } from "@/components/ui/HashBorder";
import ThemeEditor from "@/components/ui/ThemeEditor";
import { XPDesktop, AIMBuddyList, AIMPreferences, AimEmojiPicker, AimSessionLifecycle } from "@/themes/xX_sCeNeIt_Xx/shells";
import { useAimSounds } from "@/themes/xX_sCeNeIt_Xx/sounds";
import { publicUrl } from "@/lib/utils";
import {
  AimWarn, AimBlock, AimSendMan,
  AimHeaderComputer, AimHeaderBuddy,
  AimResetCamera, AimPaletteLg, AimTrash, AimCloseX,
} from "@/themes/xX_sCeNeIt_Xx/icons";
import Timeline from "@/components/viewer/Timeline";
import GraphEditor from "@/components/viewer/GraphEditor";
import WinampDesktop from "@/components/viewer/WinampDesktop";

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === "true";

const PlyCanvas = dynamic(() => import("@/components/PlyCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <ThemeIcon icon={Loader2} className="h-8 w-8 animate-spin text-content-muted" />
    </div>
  ),
});

/** Mounts <PlyCanvas /> exactly once into a persistent offscreen holder.
 * Layout branches use <CanvasHost /> to DOM-reparent the rendered canvas
 * into themselves. This guarantees the React component is never unmounted,
 * preserving the renderer / camera / playback state across theme switches. */
function PlyCanvasPortal() {
  const holder = useCanvasHolder();
  if (!holder) return null;
  return createPortal(<PlyCanvas />, holder);
}

function useViewportLayout(showGraphEditor: boolean, cap: ThemeCapabilities) {
  const [baseBottomHeight, setBaseBottomHeight] = useState(MIN_BOTTOM_HEIGHT);
  const [adjustedMinimapHeight, setAdjustedMinimapHeight] = useState(384);
  const containerRef = useRef<HTMLDivElement>(null);
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isSciinLayout = cap.usesTextControls;
  const leftPanelWidth = isSciinLayout ? 380 : LEFT_PANEL_WIDTH;
  const rightPanelWidth = isSciinLayout ? 300 : RIGHT_PANEL_WIDTH;
  const minBottomHeight = isSciinLayout ? 160 : MIN_BOTTOM_HEIGHT;
  const hPad = isSciinLayout ? 5 * HASH_BORDER_W : 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;

      if (isSciinLayout) {
        const toolbarH = 2 * HASH_BORDER_H;
        const viewportW = W - leftPanelWidth - rightPanelWidth - hPad;
        const rawViewportH = viewportW * (9 / 16);
        const centerH = H - 2 * HASH_BORDER_H;
        const available = centerH - toolbarH - HASH_BORDER_H;

        let snappedViewport = Math.round(rawViewportH / HASH_BORDER_H) * HASH_BORDER_H;
        let bottom = available - snappedViewport;
        if (bottom < minBottomHeight) {
          snappedViewport = Math.floor((available - minBottomHeight) / HASH_BORDER_H) * HASH_BORDER_H;
          bottom = available - snappedViewport;
        }
        setBaseBottomHeight(bottom);

        const colHeight = centerH;
        const panelsArea = colHeight - HASH_BORDER_H - 380;
        const alignedPanels = Math.round(panelsArea / HASH_BORDER_H) * HASH_BORDER_H;
        setAdjustedMinimapHeight(colHeight - HASH_BORDER_H - alignedPanels);
      } else {
        const viewportW = W - LEFT_PANEL_WIDTH - RIGHT_PANEL_WIDTH;
        const viewportH = viewportW * (9 / 16);
        const overhead = TOOLBAR_HEIGHT + (isWin95 ? WIN95_EXTRA_OVERHEAD : 0);
        const bh = H - overhead - viewportH;
        setBaseBottomHeight(Math.max(MIN_BOTTOM_HEIGHT, Math.round(bh)));
      }
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [leftPanelWidth, minBottomHeight, rightPanelWidth, hPad, isSciinLayout, isWin95]);

  const bottomHeight =
    baseBottomHeight + (showGraphEditor ? GRAPH_EDITOR_EXTRA_HEIGHT : 0);
  const minimapHeight = isSciinLayout ? adjustedMinimapHeight : baseBottomHeight;

  return { containerRef, bottomHeight, leftPanelWidth, rightPanelWidth, minimapHeight };
}

function XPDesktopLayout({
  contrast,
  saturation,
  showPathPanel,
  showGraphEditor,
  showExportModal,
  isDragging,
  actions,
  dragProps,
}: {
  contrast: number;
  saturation: number;
  showPathPanel: boolean;
  showGraphEditor: boolean;
  showExportModal: boolean;
  isDragging: boolean;
  actions: ReturnType<typeof useScene>["actions"];
  dragProps: Record<string, unknown>;
}) {
  const {
    paths,
    activePathId,
    playbackState,
    isExporting,
    anchors,
    cameraTargetAnchorId,
    showGrid,
    fileInputKey,
    compDuration,
    refs,
  } = useScene();

  const [floorplanButtons, setFloorplanButtons] = useState<React.ReactNode>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [avatarA, setAvatarA] = useState(1);
  const [avatarB, setAvatarB] = useState(1);
  const chatFieldRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playImSend } = useAimSounds();

  const AVATAR_COUNT = 16;
  const shuffleOrder = useCallback(() => {
    const arr = Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);
  const orderARef = useRef(shuffleOrder());
  const orderBRef = useRef(shuffleOrder());
  const idxARef = useRef(0);
  const idxBRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      idxARef.current++;
      if (idxARef.current >= AVATAR_COUNT) { idxARef.current = 0; orderARef.current = shuffleOrder(); }
      idxBRef.current++;
      if (idxBRef.current >= AVATAR_COUNT) { idxBRef.current = 0; orderBRef.current = shuffleOrder(); }
      setAvatarA(orderARef.current[idxARef.current]);
      setAvatarB(orderBRef.current[idxBRef.current]);
    }, 4000);
    return () => clearInterval(id);
  }, [shuffleOrder]);

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

  const fe = useFrameExport();

  const captureFrame = useCallback((format: "png" | "jpeg") => {
    fe.captureFrameAtSize(format, 1920, 1080);
  }, [fe]);

  useEffect(() => {
    refs.triggerAddKeyframe.current = handleAddKeyframe;
  }, [handleAddKeyframe, refs.triggerAddKeyframe]);

  useEffect(() => {
    refs.captureFrame.current = captureFrame;
  }, [captureFrame, refs.captureFrame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (e.code === "KeyK") { e.preventDefault(); handleAddKeyframe(); }
      else if (e.code === "KeyP" || e.code === "KeyR") {
        if (document.pointerLockElement) return;
        e.preventDefault();
        const groups: ChannelGroup[] = e.code === "KeyP" ? ["position"] : ["rotation"];
        refs.addChannelKeyframe.current?.(groups);
      } else if (e.code === "KeyG" && e.shiftKey) { e.preventDefault(); actions.finalizeBoundary(); }
      else if (e.code === "KeyG" && !e.shiftKey) { e.preventDefault(); actions.addBoundaryPoint(); }
      else if (e.code === "KeyB") { e.preventDefault(); actions.pushUndo(); actions.setWorkAreaIn(playbackState.currentTime); }
      else if (e.code === "KeyN") { e.preventDefault(); actions.pushUndo(); actions.setWorkAreaOut(playbackState.currentTime); }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      e.preventDefault();
      if (refs.spaceDraggedRef.current) { refs.spaceDraggedRef.current = false; return; }
      if (playbackState.isPlaying) refs.pausePath.current?.();
      else refs.playPath.current?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => { document.removeEventListener("keydown", handleKeyDown); document.removeEventListener("keyup", handleKeyUp); };
  }, [handleAddKeyframe, refs, actions, playbackState.isPlaying, playbackState.currentTime]);

  const filterStyle =
    contrast === 0 && saturation === 0
      ? undefined
      : `contrast(${contrast + 100}%) saturate(${saturation + 100}%)`;

  const curvesButton = (
    <button
      onClick={() => actions.setShowGraphEditor((v: boolean) => !v)}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase transition-colors ${
        showGraphEditor
          ? "bg-accent-500/20 text-accent-400"
          : "text-content-faint hover:text-content-secondary"
      }`}
    >
      Curves
    </button>
  );

  const overlays = (
    <>
      {IS_DEV && isDragging && (
        <div className="pointer-events-none absolute inset-0 z-[9000] flex items-center justify-center bg-surface-base/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-accent-500/60 bg-accent-500/10 px-16 py-12">
            <ThemeIcon icon={Upload} className="h-12 w-12 text-accent-400" />
            <p className="text-lg font-medium text-accent-300">Drop your .ply file here</p>
          </div>
        </div>
      )}
      {showExportModal && <ExportModal />}
    </>
  );

  const closeMenu = () => setOpenMenu(null);

  return (
    <div className="h-screen w-screen overflow-hidden" {...dragProps}>
      <AimSessionLifecycle />
      <XPDesktop
        buddyList={<AIMBuddyList />}
        viewport={
          <div className="aim-chat-window flex h-full w-full flex-col">
            <div className="aim-chat-menubar">
              <div className="aim-menubar-items">
                <button className="aim-menubar-item">File</button>
                <button className="aim-menubar-item">Edit</button>
                <button className="aim-menubar-item">View</button>
                <button className="aim-menubar-item">People</button>
              </div>
              <span className="aim-chat-menubar-info">
                {targetAnchor ? (
                  <>
                    Target: {targetAnchor.label}
                    <button onClick={() => actions.setCameraTargetAnchorId(null)} title="Clear target">&nbsp;✕</button>
                  </>
                ) : (
                  <>Warning Level: 0%</>
                )}
              </span>
            </div>
            <div className="aim-chat-body">
              <div className="aim-chat-buddy-icon">
                <img src={publicUrl(`/avatars/buddy-a/${avatarA}.gif`)} alt="Buddy" className="aim-chat-avatar" draggable={false} />
              </div>
              <div className="aim-chat-canvas relative min-h-0 flex-1" data-aspect-target>
                <CanvasHost className="h-full w-full" style={{ filter: filterStyle }} />
                <GizmoOverlay />
                <KeyHints />
              </div>
            </div>
            <div className="aim-chat-input-area">
              <div className="aim-chat-buddy-icon">
                <img src={publicUrl(`/avatars/buddy-b/${avatarB}.gif`)} alt="Buddy" className="aim-chat-avatar" draggable={false} />
              </div>
              <div className="aim-chat-input-col">
                <div className="aim-chat-format-bar">
                  <button className="aim-fmt-btn" title="Font">A</button>
                  <button className="aim-fmt-btn aim-fmt-bg" title="Background Color">A</button>
                  <span className="aim-fmt-sep" />
                  <button className="aim-fmt-btn" title="Font Size">A<small>&#x25BE;</small></button>
                  <button className="aim-fmt-btn" title="Font Color">A</button>
                  <button className="aim-fmt-btn" title="Larger" style={{lineHeight:1}}><span style={{fontSize:'8px',verticalAlign:'top'}}>A</span><span style={{fontSize:'12px'}}>A</span></button>
                  <span className="aim-fmt-sep" />
                  <button className="aim-fmt-btn aim-fmt-btn-bold" title="Bold" onMouseDown={(e) => { e.preventDefault(); setTimeout(() => document.execCommand("bold", false), 0); }}>B</button>
                  <button className="aim-fmt-btn" title="Italic" onMouseDown={(e) => { e.preventDefault(); setTimeout(() => document.execCommand("italic", false), 0); }}><i>I</i></button>
                  <button className="aim-fmt-btn" title="Underline" onMouseDown={(e) => { e.preventDefault(); setTimeout(() => document.execCommand("underline", false), 0); }}><u>U</u></button>
                  <span className="aim-fmt-sep" />
                  <button className="aim-fmt-btn" title="Insert Link"><u>link</u></button>
                  <button className="aim-fmt-btn aim-fmt-btn-lg" title="Insert Image">&#x1F5BC;</button>
                  <div style={{position:'relative',display:'inline-block'}}>
                    <button className="aim-fmt-btn aim-fmt-btn-lg" title="Insert Smiley" onClick={() => setEmojiPickerOpen(v => !v)}>&#x263A;</button>
                    <AimEmojiPicker
                      open={emojiPickerOpen}
                      onClose={() => setEmojiPickerOpen(false)}
                      chatFieldRef={chatFieldRef}
                    />
                  </div>
                </div>
                <div ref={chatFieldRef} className="aim-chat-textfield" contentEditable suppressContentEditableWarning>
                </div>
              </div>
            </div>
            <div className="aim-chat-bottom-bar">
              <a className="aim-chat-freeicons" href="#" onClick={(e) => e.preventDefault()}>Free Icons &amp;<br/>More</a>
              <div className="aim-chat-action-group">
                <button className="aim-chat-action-btn">
                  <AimWarn className="aim-chat-action-icon aim-chat-action-icon-warn" />
                  <span>Warn</span>
                </button>
                <button className="aim-chat-action-btn">
                  <AimBlock className="aim-chat-action-icon aim-chat-action-icon-warnblock" />
                  <span>Block</span>
                </button>
              </div>
              <div className="aim-chat-action-group aim-chat-action-group-center">
                <button className="aim-chat-action-btn-lg" onClick={() => refs.reset.current?.()} title="Reset camera">
                  <AimResetCamera className="aim-chat-action-icon-lg aim-chat-action-icon-sm" />
                  <span>Reset</span>
                </button>
                <button className="aim-chat-action-btn-lg" onClick={actions.clearAll} title="Clear all">
                  <AimTrash className="aim-chat-action-icon-lg aim-chat-action-icon-sm" />
                  <span>Clear</span>
                </button>
                <button
                  className="aim-chat-action-btn-lg aim-chat-action-btn-lg-palette"
                  onClick={() => setShowThemeEditor((s) => !s)}
                  title="Theme editor"
                  style={{ position: "relative" }}
                >
                  <AimPaletteLg className="aim-chat-action-icon-lg aim-chat-action-icon-palette" />
                  <span>Themes</span>
                  {showThemeEditor && createPortal(
                    <div className="fixed" style={(() => { const r = document.querySelector(".aim-chat-action-btn-lg-palette")?.getBoundingClientRect(); return r ? { zIndex: 9999, right: window.innerWidth - r.right, bottom: window.innerHeight - r.top + 8 } : { zIndex: 9999 }; })()}>
                      <ThemeEditor onClose={() => setShowThemeEditor(false)} />
                    </div>,
                    document.body,
                  )}
                </button>
                <button className="aim-chat-action-btn-lg" onClick={actions.closeScene} title="Close scene">
                  <AimCloseX className="aim-chat-action-icon-lg aim-chat-action-icon-sm" />
                  <span>Close</span>
                </button>
              </div>
              <button className="aim-chat-send-btn" title="Send" aria-label="Send" onClick={() => { playImSend(); if (chatFieldRef.current) chatFieldRef.current.innerHTML = ""; }}>
                <AimSendMan size={47} className="aim-send-man" />
              </button>
            </div>
            {IS_DEV && (
              <input
                ref={fileInputRef}
                key={`aim-file-${fileInputKey}`}
                type="file"
                accept=".ply"
                onChange={actions.handleFileInput}
                className="hidden"
              />
            )}
          </div>
        }
        settings={<AIMPreferences />}
        timeline={{
          content: (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <Timeline />
              {showGraphEditor && (
                <div className="border-t border-surface-border">
                  <GraphEditor />
                </div>
              )}
            </div>
          ),
        }}
        floorplan={{
          content: (
            <MinimapView desktopMode onToolButtons={setFloorplanButtons} />
          ),
          actionButtons: floorplanButtons,
        }}
        overlays={overlays}
      />
    </div>
  );
}

function SceneViewer() {
  const {
    plyBuffer,
    loadingState,
    isLoading,
    isDragging,
    downloadProgress,
    showExportModal,
    showGraphEditor,
    showPathPanel,
    showTutorial,
    contrast,
    saturation,
    actions,
    refs,
  } = useScene();

  const cap = useThemeCapabilities();
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isSciin = cap.usesTextControls;
  const isScenit = cap.layoutShell === "scenit-grid";
  const isAim = cap.layoutShell === "xp-desktop";
  const isSkeuomorphic = isWin95 || isAim;
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isDefaultTheme = cap.id === "default";
  const { containerRef, bottomHeight, leftPanelWidth, rightPanelWidth, minimapHeight } =
    useViewportLayout(showGraphEditor, cap);
  const isReady = plyBuffer && loadingState === "ready";

  const tutorialLaunchedRef = useRef(false);
  useEffect(() => {
    if (isReady && !tutorialLaunchedRef.current && isDefaultTheme) {
      tutorialLaunchedRef.current = true;
      if (!isTutorialCompleted()) {
        setTimeout(() => actions.setShowTutorial(true), 800);
      }
    }
  }, [isReady, isDefaultTheme, actions]);

  const [viewportCamPos, setViewportCamPos] = useState<{ x: number; y: number; z: number } | null>(null);
  const lastVpCamRef = useRef<{ x: number; y: number; z: number } | null>(null);
  useEffect(() => {
    if (!isSciin || !isReady) return;
    const id = setInterval(() => {
      const data = refs.addKeyframeAtCamera.current?.();
      if (!data) return;
      const { x, y, z } = data.position;
      const prev = lastVpCamRef.current;
      if (!prev || Math.abs(x - prev.x) > 0.005 || Math.abs(y - prev.y) > 0.005 || Math.abs(z - prev.z) > 0.005) {
        lastVpCamRef.current = { x, y, z };
        setViewportCamPos({ x, y, z });
      }
    }, 100);
    return () => clearInterval(id);
  }, [isSciin, isReady, refs]);

  const steppedScrollRef = useRef<Map<HTMLElement, (e: WheelEvent) => void>>(new Map());
  useEffect(() => {
    if (!isSciin) return;

    const attached = steppedScrollRef.current;

    const attachAll = () => {
      document.querySelectorAll<HTMLElement>(".scrollbar-thin").forEach((el) => {
        if (attached.has(el)) return;
        const fn = (e: WheelEvent) => {
          e.preventDefault();
          const dir = Math.sign(e.deltaY);
          const maxScroll = el.scrollHeight - el.clientHeight;
          const snapped = Math.round(el.scrollTop / HASH_BORDER_H) * HASH_BORDER_H;
          const next = snapped + dir * HASH_BORDER_H;
          el.scrollTop = Math.max(0, Math.min(maxScroll, next));
        };
        el.addEventListener("wheel", fn, { passive: false });
        attached.set(el, fn);
      });
    };

    attachAll();
    const interval = setInterval(attachAll, 1000);

    return () => {
      clearInterval(interval);
      attached.forEach((fn, el) => el.removeEventListener("wheel", fn));
      attached.clear();
    };
  }, [isSciin]);

  const dragProps = IS_DEV
    ? {
        onDragEnter: actions.handleDragEnter,
        onDragLeave: actions.handleDragLeave,
        onDragOver: actions.handleDragOver,
        onDrop: actions.handleDrop,
      }
    : {};

  /* ── XP Desktop floating-window layout ── */
  if (isAim && plyBuffer && isReady) {
    return (
      <XPDesktopLayout
        contrast={contrast}
        saturation={saturation}
        showPathPanel={showPathPanel}
        showGraphEditor={showGraphEditor}
        showExportModal={showExportModal}
        isDragging={isDragging}
        actions={actions}
        dragProps={dragProps}
      />
    );
  }

  /* ── Standard fixed layout (all other themes + non-ready states) ── */
  return (
    <div
      ref={containerRef}
      className={`flex h-screen w-screen flex-col overflow-hidden bg-surface-base${isSciin ? ' sciin-layout-root' : ''}`}
      {...dragProps}
    >
      {IS_DEV && isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-surface-base/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-accent-500/60 bg-accent-500/10 px-16 py-12">
            <ThemeIcon icon={Upload} className="h-12 w-12 text-accent-400" />
            <p className="text-lg font-medium text-accent-300">
              Drop your .ply file here
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-surface-base/90">
          <ThemeIcon icon={Loader2} className="h-10 w-10 animate-spin text-accent-400" />
          <p className="text-sm text-content-secondary">
            {loadingState === "reading"
              ? "Loading scene..."
              : "Processing PLY (building covariance data)..."}
          </p>
          {loadingState === "reading" && downloadProgress != null && (
            <div className="flex w-64 flex-col items-center gap-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-accent-500 transition-all duration-150"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className="text-xs text-content-muted">
                {downloadProgress}%
              </span>
            </div>
          )}
        </div>
      )}

      {!plyBuffer && !isLoading && <LandingScreen />}

      {isWinamp && plyBuffer ? (
        <WinampDesktop />
      ) : isScenit && plyBuffer && isReady ? (
        <div className="scenit-main-grid relative min-h-0 flex-1">
          <ScenitDecorations />
          <div className="scenit-panel-column" data-panel="left">
            <div className="scenit-floating-panel scenit-panel-scroll" data-section="anchors">
              <CollapsibleSection title="Anchors" sectionId="anchors" icon={<ThemeIcon icon={MapPin} className="h-3 w-3" header />} defaultOpen={false}>
                <AnchorPanel />
              </CollapsibleSection>
            </div>
            <div className="scenit-floating-panel scenit-panel-scroll" data-section="media-library">
              <CollapsibleSection title="Media Library" sectionId="media-library" icon={<ThemeIcon icon={Images} className="h-3 w-3" header />} defaultOpen={false}>
                <AssetBrowser />
              </CollapsibleSection>
            </div>
            <div className="scenit-floating-panel scenit-panel-scroll" data-panel="paths">
              <CollapsibleSection title="Paths" sectionId="paths" icon={<ThemeIcon icon={MapPin} className="h-3 w-3" header />} defaultOpen={false}>
                <PathPanel />
              </CollapsibleSection>
            </div>
            <div className="scenit-floating-panel layout-minimap" style={{ height: minimapHeight }}>
              <MinimapView />
            </div>
          </div>
          <div className="scenit-panel-column scenit-center-zone">
            <div className="scenit-floating-panel scenit-viewport-panel flex min-h-0 flex-1 flex-col">
              <ScenItViewportHeader />
              <div className="relative min-h-0 flex-1">
                <CanvasHost className="h-full w-full" style={{ filter: contrast === 0 && saturation === 0 ? undefined : `contrast(${contrast + 100}%) saturate(${saturation + 100}%)` }} />
                <GizmoOverlay />
                <KeyHints />
              </div>
            </div>
            <div className="scenit-floating-panel layout-timeline shrink-0" style={{ height: bottomHeight }}>
              <BottomPanel />
            </div>
          </div>
          <div className="scenit-panel-column" data-panel="right">
            <div className="scenit-floating-panel scenit-panel-scroll" data-section="camera">
              <CollapsibleSection title="Camera" sectionId="camera" icon={<ThemeIcon icon={Camera} className="h-3 w-3" header />} defaultOpen={false}>
                <CameraPanel />
              </CollapsibleSection>
            </div>
            <div className="scenit-floating-panel scenit-panel-scroll" data-section="ar-overlay">
              <CollapsibleSection title="AR Settings" sectionId="ar-overlay" icon={<ThemeIcon icon={Layers} className="h-3 w-3" header />} defaultOpen={false}>
                <AROverlayPanel />
              </CollapsibleSection>
            </div>
            <div className="scenit-floating-panel scenit-panel-scroll" data-section="post-processing">
              <CollapsibleSection title="Post Processing" sectionId="post-processing" icon={<ThemeIcon icon={SlidersHorizontal} className="h-3 w-3" header />} defaultOpen={false}>
                <PostProcessingPanel />
              </CollapsibleSection>
            </div>
            {process.env.NEXT_PUBLIC_DEV_MODE === "true" && (
              <div className="scenit-floating-panel scenit-panel-scroll" data-section="depth-mesh">
                <CollapsibleSection title="Occlusion" sectionId="depth-mesh" icon={<ThemeIcon icon={Box} className="h-3 w-3" header />} defaultOpen={false}>
                  <DepthMeshPanel />
                </CollapsibleSection>
              </div>
            )}
          </div>
        </div>
      ) : plyBuffer ? (
        <>
          {isReady && !isWin95 && !isSciin && <Toolbar />}
          {isSciin && <HashBorder direction="horizontal" />}

          <div className="flex min-h-0 flex-1">
            {isSciin && <HashBorder direction="vertical" />}

            {/* Left column: Anchors + Media on top, Minimap on bottom */}
            {isReady && (
              <div
                className={`layout-left-column flex flex-col bg-surface-primary/95 ${isWin95 ? '' : 'border-x border-surface-border'}`}
                style={isSciin
                  ? { flex: `0 1 ${leftPanelWidth}px`, minWidth: 280 }
                  : { width: LEFT_PANEL_WIDTH, flexShrink: 0 }
                }
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <LeftPanel />
                </div>
                {isSciin && <HashBorder direction="horizontal" />}
                {!isWin95 && (
                  <div
                    className="layout-minimap shrink-0 border-t border-surface-border"
                    style={{ height: minimapHeight }}
                  >
                    <MinimapView />
                  </div>
                )}
              </div>
            )}

            {isSciin && <HashBorder direction="vertical" />}

            {/* Center column: toolbar + viewport + timeline */}
            <div className="layout-center-column flex min-w-0 flex-1 flex-col">
              {isSciin && isReady && <Toolbar />}

              {isWin95 ? (
                <>
                  <Win95ViewportChrome>
                    <div className="relative min-h-0 flex-1">
                      <CanvasHost
                        className="h-full w-full"
                        style={{
                          filter:
                            contrast === 0 && saturation === 0
                              ? undefined
                              : `contrast(${contrast + 100}%) saturate(${saturation + 100}%)`,
                        }}
                      />
                      {isReady && <GizmoOverlay />}
                      {isReady && <KeyHints />}
                    </div>
                  </Win95ViewportChrome>

                  {isReady && (
                    <div
                      className="layout-timeline shrink-0 bg-[#c0c0c0]"
                      style={{ height: bottomHeight }}
                    >
                      <BottomPanel />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Viewport (16:9 locked) */}
                  <div className="layout-viewport-shell relative min-h-0 flex-1">
                    <CanvasHost
                      className="layout-viewport-frame h-full w-full"
                      style={{
                        filter:
                          contrast === 0 && saturation === 0
                            ? undefined
                            : `contrast(${contrast + 100}%) saturate(${saturation + 100}%)`,
                      }}
                    />
                    {isReady && <GizmoOverlay />}

                    {isReady && isSciin && (
                      <div className="sciin-viewport-hud pointer-events-none absolute left-[30px] right-[30px] top-[32px] z-[12] flex items-center justify-between">
                        <span className="sciin-hud-coords">
                          <span className="sciin-hud-coords-inline">[X:<span style={{ color: "var(--rl-green)" }}>{viewportCamPos ? viewportCamPos.x.toFixed(2) : "-.--"}</span> Y:<span style={{ color: "var(--rl-yellow)" }}>{viewportCamPos ? viewportCamPos.y.toFixed(2) : "-.--"}</span> Z:<span style={{ color: "var(--rl-magenta)" }}>{viewportCamPos ? viewportCamPos.z.toFixed(2) : "-.--"}</span>]</span>
                          <span className="sciin-hud-coords-stacked" style={{ display: "none" }}>
                            <span>[X:<span style={{ color: "var(--rl-green)" }}>{viewportCamPos ? viewportCamPos.x.toFixed(2) : "-.--"}</span>]</span>
                            <span>[Y:<span style={{ color: "var(--rl-yellow)" }}>{viewportCamPos ? viewportCamPos.y.toFixed(2) : "-.--"}</span>]</span>
                            <span>[Z:<span style={{ color: "var(--rl-magenta)" }}>{viewportCamPos ? viewportCamPos.z.toFixed(2) : "-.--"}</span>]</span>
                          </span>
                        </span>
                        <span className="sciin-hud-info">
                          <span className="sciin-hud-info-inline">[SCAN:60HZ][HUD:ASCII]</span>
                          <span className="sciin-hud-info-stacked" style={{ display: "none" }}>
                            <span>[SCAN:60HZ]</span>
                            <span>[HUD:ASCII]</span>
                          </span>
                        </span>
                      </div>
                    )}

                    {isReady && isSkeuomorphic && !isWinamp && !isSciin && (
                      <div className="absolute left-0 z-[15] top-0">
                        <div
                          className={isAim ? "aim-window" : "win95-window"}
                        >
                          <CollapsibleSection
                            title="Paths"
                            bare
                            icon={<W95HeaderDisk size={16} />}
                            open={showPathPanel}
                            onToggle={(v) => actions.setShowPathPanel(v)}
                            contentClassName="w-72"
                            sectionId="paths-overlay"
                          >
                            <PathPanel />
                          </CollapsibleSection>
                        </div>
                      </div>
                    )}

                    {isReady && <KeyHints />}
                  </div>

                  {isReady && (
                    <>
                      {isSciin && <HashBorder direction="horizontal" />}
                      <div
                        className="layout-timeline shrink-0 border-t border-surface-border bg-surface-primary/95"
                        style={{ height: bottomHeight }}
                      >
                        <BottomPanel />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {isSciin && <HashBorder direction="vertical" />}

            {/* Right panel: Camera / Post / AR / Depth settings */}
            {isReady && (
              <div
                className={`layout-right-column flex flex-col bg-surface-primary/95 ${isWin95 ? '' : 'border-x border-surface-border'}`}
                style={isSciin
                  ? { flex: `0 1 ${rightPanelWidth}px`, minWidth: 240 }
                  : { width: RIGHT_PANEL_WIDTH, flexShrink: 0 }
                }
              >
                <SettingsPanel />
              </div>
            )}

            {isSciin && <HashBorder direction="vertical" />}
          </div>

          {isSciin && <HashBorder direction="horizontal" />}
          {isReady && isWin95 && <Toolbar />}
          {isReady && isWin95 && <MinimapView />}
        </>
      ) : null}

      {showExportModal && <ExportModal />}
      {showTutorial && <TutorialOverlay onClose={() => actions.setShowTutorial(false)} />}
    </div>
  );
}

export default function Home() {
  return (
    <SceneProvider>
      <CanvasPortalProvider>
        <ColorFilterOverlay />
        <PlyCanvasPortal />
        <SceneViewer />
      </CanvasPortalProvider>
    </SceneProvider>
  );
}
