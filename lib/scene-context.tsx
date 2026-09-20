"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";

import type { CameraPath, CameraKeyframe, BakedCameraPath, ChannelGroup } from "./camera-path";
import type { PlaybackState } from "./playback-controller";
import type { ScenePreset } from "./scene-preset";
import type { AnchorAnimation } from "./anchor-animation";
type ExportProgress = { phase: string; frame: number; total: number };
import type { WalkSpeedPreset } from "./walk-style";
import {
  generateWalkPath,
  retimeWalkPath,
  convertPathToWalk,
  WALK_STYLES,
  WALK_SPEEDS,
} from "./walk-style";
import { publicUrl } from "./utils";
import { getUserMode, DEFAULT_MODE_ID } from "./user-mode";
import type { UserMode } from "./user-mode";

export type LoadingState = "idle" | "reading" | "processing" | "ready";

export type BillboardMode = "none" | "full" | "y-axis";
export type EntrancePreset = "none" | "fade" | "scale" | "fade-scale";

export interface SceneAnchor {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  billboardMode: BillboardMode;
  width: number;
  height: number;
  cornerRadius: number;
  opacity: number;
  scale: number;
  visible: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "gif" | "video";
  mediaAspectRatio?: number;
  mediaThumbnailUrl?: string;
  leashed?: boolean;
  leashDistance?: number;
  leashOffset?: { x: number; y: number; z: number };
  leashRotation?: { x: number; y: number; z: number };
  appearAt?: number;
  disappearAt?: number;
  entrancePreset?: EntrancePreset;
  entranceDuration?: number;
  exitPreset?: EntrancePreset;
  exitDuration?: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MediaLibraryItem {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  type: "image" | "gif" | "video" | "audio";
  aspectRatio: number;
  file?: File;
  duration?: number;
  isDefault?: boolean;
}

export const DEFAULT_TRACK: MediaLibraryItem = {
  id: "__default_track__",
  name: "Through The Fire And Flames",
  url: publicUrl("/audio/Through The Fire And Flames.mp3"),
  thumbnailUrl: "",
  type: "audio",
  aspectRatio: 1,
  isDefault: true,
};

export interface SceneRefs {
  reset: React.MutableRefObject<(() => void) | null>;
  createAnchor: React.MutableRefObject<
    (() => SceneAnchor | null) | null
  >;
  removeAnchor: React.MutableRefObject<
    ((anchor: SceneAnchor) => void) | null
  >;
  loadDepthMesh: React.MutableRefObject<
    ((buffer: ArrayBuffer, filename: string) => Promise<void>) | null
  >;
  setDepthMeshVisible: React.MutableRefObject<
    ((visible: boolean) => void) | null
  >;
  setDepthMeshTransform: React.MutableRefObject<
    ((position: Vec3, rotation: Vec3, scale: number) => void) | null
  >;
  setDepthMeshDebugView: React.MutableRefObject<
    ((enabled: boolean) => void) | null
  >;
  setDepthMeshBias: React.MutableRefObject<
    ((bias: number) => void) | null
  >;
  getDepthMeshAutoAlign: React.MutableRefObject<
    (() => { position: Vec3; rotation: Vec3; scale: number } | null) | null
  >;
  setOrthoView: React.MutableRefObject<
    ((axis: "top" | "bottom" | "front" | "back" | "left" | "right" | null) => void) | null
  >;
  setAnchorPosition: React.MutableRefObject<
    ((anchor: SceneAnchor, pos: Vec3) => void) | null
  >;
  setAnchorRotation: React.MutableRefObject<
    ((anchor: SceneAnchor, euler: Vec3) => void) | null
  >;
  rebuildAnchor: React.MutableRefObject<
    ((anchor: SceneAnchor, width: number, height: number, cornerRadius: number, clearMedia?: boolean) => void) | null
  >;
  setAnchorOpacity: React.MutableRefObject<
    ((anchor: SceneAnchor, opacity: number) => void) | null
  >;
  setAnchorScale: React.MutableRefObject<
    ((anchor: SceneAnchor, scale: number) => void) | null
  >;
  setAnchorBillboard: React.MutableRefObject<
    ((anchor: SceneAnchor, mode: BillboardMode) => void) | null
  >;
  setAnchorLeash: React.MutableRefObject<
    ((anchor: SceneAnchor, leashed: boolean, distance: number, offset: Vec3) => void) | null
  >;
  setAnchorLeashRotation: React.MutableRefObject<
    ((anchor: SceneAnchor, rotation: Vec3) => void) | null
  >;
  setAnchorMedia: React.MutableRefObject<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((anchor: SceneAnchor, file: File) => Promise<any>) | null
  >;
  setAnchorVisible: React.MutableRefObject<
    ((anchor: SceneAnchor, visible: boolean) => void) | null
  >;
  showGizmo: React.MutableRefObject<
    ((position: Vec3) => void) | null
  >;
  hideGizmo: React.MutableRefObject<
    (() => void) | null
  >;
  worldToScreen: React.MutableRefObject<
    ((worldPos: Vec3) => { x: number; y: number } | null) | null
  >;
  getAnchorAxes: React.MutableRefObject<
    ((anchorId: string) => { center: Vec3; right: Vec3; up: Vec3; forward: Vec3 } | null) | null
  >;
  addKeyframeAtCamera: React.MutableRefObject<
    (() => { position: Vec3; pitch: number; yaw: number; fov: number } | null) | null
  >;
  triggerAddKeyframe: React.MutableRefObject<(() => void) | null>;
  getCameraState: React.MutableRefObject<
    (() => { position: Vec3; pitch: number; yaw: number } | null) | null
  >;
  setCameraPosition: React.MutableRefObject<((pos: Vec3) => void) | null>;
  setCameraRotation: React.MutableRefObject<((pitch: number, yaw: number) => void) | null>;
  addChannelKeyframe: React.MutableRefObject<((groups: ChannelGroup[]) => void) | null>;
  playPath: React.MutableRefObject<(() => void) | null>;
  pausePath: React.MutableRefObject<(() => void) | null>;
  stopPath: React.MutableRefObject<(() => void) | null>;
  seekPath: React.MutableRefObject<((time: number) => void) | null>;
  seekPathSilent: React.MutableRefObject<((time: number) => void) | null>;
  setPlaybackSpeed: React.MutableRefObject<((speed: number) => void) | null>;
  setPlaybackLoop: React.MutableRefObject<((loop: boolean) => void) | null>;
  setHeadWiggle: React.MutableRefObject<((enabled: boolean) => void) | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRenderer: React.MutableRefObject<(() => any) | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPlayback: React.MutableRefObject<(() => any) | null>;
  captureFrame: React.MutableRefObject<((format: "png" | "jpeg") => void) | null>;
  spaceDraggedRef: React.MutableRefObject<boolean>;
  liveWalkPathId: React.MutableRefObject<string | null>;
}

interface SettingsSnapshot {
  fov: number;
  moveSpeed: number;
  exposure: number;
  colorFilter: string;
  contrast: number;
  saturation: number;
  dim: number;
  meshPos: Vec3;
  meshRot: Vec3;
  meshScale: number;
  anchors: SceneAnchor[];
  paths: CameraPath[];
  activePathId: string | null;
  selectedAnchorId: string | null;
  workAreaIn: number | null;
  workAreaOut: number | null;
  compDuration: number;
  walkWaypoints: { x: number; y: number; z: number }[];
  anchorAnimations: AnchorAnimation[];
}

export interface SceneActions {
  loadFile: (file: File) => void;
  closeScene: () => void;
  handleVertexCount: (n: number) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;

  setIsDragging: (v: boolean) => void;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;

  setFov: (v: number) => void;
  setMoveSpeed: (v: number) => void;
  setExposure: (v: number) => void;
  setColorFilter: (v: string) => void;
  setContrast: (v: number) => void;
  setSaturation: (v: number) => void;
  setDim: (v: number) => void;
  setBlur: (v: number) => void;
  setShowFovFrame: (v: boolean) => void;
  setShowFovStroke: (v: boolean) => void;
  setFovFeather: (v: number) => void;

  setDepthMeshLoaded: (v: boolean) => void;
  setDepthMeshVisible: (v: boolean) => void;
  setMeshPos: React.Dispatch<React.SetStateAction<Vec3>>;
  setMeshRot: React.Dispatch<React.SetStateAction<Vec3>>;
  setMeshScale: (v: number) => void;
  setAnchors: React.Dispatch<React.SetStateAction<SceneAnchor[]>>;
  setSelectedAnchorId: React.Dispatch<React.SetStateAction<string | null>>;

  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  handleLoadError: (msg: string) => void;
  clearAll: () => void;

  setWalkthroughActive: React.Dispatch<React.SetStateAction<boolean>>;
  setPaths: React.Dispatch<React.SetStateAction<CameraPath[]>>;
  setActivePathId: React.Dispatch<React.SetStateAction<string | null>>;
  setBakedPaths: React.Dispatch<React.SetStateAction<BakedCameraPath[]>>;
  setActiveBakedPathId: React.Dispatch<React.SetStateAction<string | null>>;
  setPlaybackState: React.Dispatch<React.SetStateAction<PlaybackState>>;
  setCollisionEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setLockY: React.Dispatch<React.SetStateAction<boolean>>;
  setCompFps: (v: number) => void;
  setCompDuration: (v: number) => void;
  setAnchorAnimations: React.Dispatch<React.SetStateAction<AnchorAnimation[]>>;
  setCameraTargetAnchorId: React.Dispatch<React.SetStateAction<string | null>>;
  setMediaLibrary: React.Dispatch<React.SetStateAction<MediaLibraryItem[]>>;
  setBackgroundMusicId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowExportModal: (v: boolean) => void;
  setExportFormat: React.Dispatch<React.SetStateAction<"mp4" | "gif">>;
  setShowGraphEditor: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPathPanel: (v: boolean) => void;
  setIsExporting: (v: boolean) => void;
  setExportProgress: (p: ExportProgress | null) => void;
  setSelectedKfIds: React.Dispatch<React.SetStateAction<string[]>>;
  kfClipboardRef: React.MutableRefObject<{ keyframes: CameraKeyframe[]; baseTime: number } | null>;
  loadPreset: (preset: ScenePreset) => void;

  setPlaylist: React.Dispatch<React.SetStateAction<MediaLibraryItem[]>>;
  setCurrentTrackId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsAudioPlaying: React.Dispatch<React.SetStateAction<boolean>>;

  setWalkStylePreset: React.Dispatch<React.SetStateAction<string>>;
  setWalkSpeedPreset: React.Dispatch<React.SetStateAction<WalkSpeedPreset>>;
  setWalkIntensity: (v: number) => void;
  setWalkWaypoints: React.Dispatch<React.SetStateAction<{ x: number; y: number; z: number }[]>>;
  autoGenerateWalkFromWaypoints: () => void;
  finalizeWalkWaypoints: () => void;
  retimeActiveWalkPath: (newDuration: number) => { warning?: string } | null;
  convertActivePathToWalk: () => void;

  handleDragEnter: (e: React.DragEvent) => void;
  addBoundaryPoint: () => void;
  finalizeBoundary: () => void;
  clearBoundary: () => void;
  setWorkAreaIn: (t: number | null) => void;
  setWorkAreaOut: (t: number | null) => void;
  condenseToWorkArea: () => void;

  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;

  setUserModeId: (id: string) => void;

  setDofEnabled: (v: boolean) => void;
  setDofFocusDistance: (v: number) => void;
  setDofFocusRange: (v: number) => void;
  setDofBlurRadius: (v: number) => void;

  setShowTutorial: (v: boolean) => void;
  setTutorialSectionId: (id: string | null) => void;
}

export interface SceneContextValue {
  plyBuffer: ArrayBuffer | null;
  fileName: string | null;
  vertexCount: number | null;
  loadingState: LoadingState;
  error: string | null;
  isLoading: boolean;

  showGrid: boolean;
  showSettings: boolean;
  fov: number;
  moveSpeed: number;
  exposure: number;
  colorFilter: string;
  contrast: number;
  saturation: number;
  dim: number;
  blur: number;
  showFovFrame: boolean;
  showFovStroke: boolean;
  fovFeather: number;

  depthMeshLoaded: boolean;
  depthMeshVisible: boolean;
  meshPos: Vec3;
  meshRot: Vec3;
  meshScale: number;
  anchors: SceneAnchor[];

  selectedAnchorId: string | null;
  anchorAnimations: AnchorAnimation[];
  cameraTargetAnchorId: string | null;

  walkthroughActive: boolean;
  paths: CameraPath[];
  activePathId: string | null;
  bakedPaths: BakedCameraPath[];
  activeBakedPathId: string | null;
  playbackState: PlaybackState;
  collisionEnabled: boolean;
  lockY: boolean;
  sceneOrigin: { position: Vec3; yaw: number; eyeHeight: number };
  capturedBoundary: { x: number; z: number }[];
  activePreset: ScenePreset | null;

  walkStylePreset: string;
  walkSpeedPreset: WalkSpeedPreset;
  walkIntensity: number;
  walkWaypoints: { x: number; y: number; z: number }[];

  compFps: number;
  compDuration: number;
  workAreaIn: number | null;
  workAreaOut: number | null;
  mediaLibrary: MediaLibraryItem[];
  backgroundMusicId: string | null;
  playlist: MediaLibraryItem[];
  currentTrackId: string | null;
  isAudioPlaying: boolean;
  showExportModal: boolean;
  exportFormat: "mp4" | "gif";
  showGraphEditor: boolean;
  showPathPanel: boolean;
  isExporting: boolean;
  selectedKfIds: string[];

  isDragging: boolean;
  downloadProgress: number | null;
  fileInputKey: number;

  userModeId: string;
  userMode: UserMode;

  dofEnabled: boolean;
  dofFocusDistance: number;
  dofFocusRange: number;
  dofBlurRadius: number;

  showTutorial: boolean;
  tutorialSectionId: string | null;

  actions: SceneActions;
  refs: SceneRefs;
}

const SceneContext = createContext<SceneContextValue | null>(null);

export function useScene(): SceneContextValue {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useScene must be used within SceneProvider");
  return ctx;
}

export function SceneProvider({ children }: { children: React.ReactNode }) {
  const [plyBuffer, setPlyBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [vertexCount, setVertexCount] = useState<number | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [fov, setFov] = useState(36);
  const [moveSpeed, setMoveSpeed] = useState(0.5);
  const [exposure, setExposure] = useState(1);
  const [colorFilter, setColorFilter] = useState("none");
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [dim, setDim] = useState(0);
  const [blur, setBlur] = useState(0);
  const [showFovFrame, setShowFovFrame] = useState(false);
  const [showFovStroke, setShowFovStroke] = useState(true);
  const [fovFeather, setFovFeather] = useState(0);

  const [anchors, setAnchors] = useState<SceneAnchor[]>([]);
  const [depthMeshLoaded, setDepthMeshLoaded] = useState(false);
  const [depthMeshVisible, setDepthMeshVisible] = useState(true);
  const [meshPos, setMeshPos] = useState<Vec3>({ x: 0.2172, y: -0.016, z: -0.203 });
  const [meshRot, setMeshRot] = useState<Vec3>({ x: 0, y: -138, z: 0 });
  const [meshScale, setMeshScale] = useState(0.2);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [anchorAnimations, setAnchorAnimations] = useState<AnchorAnimation[]>([]);
  const [cameraTargetAnchorId, setCameraTargetAnchorId] = useState<string | null>(null);

  const [walkthroughActive, setWalkthroughActive] = useState(false);
  const [paths, setPaths] = useState<CameraPath[]>([]);
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [bakedPaths, setBakedPaths] = useState<BakedCameraPath[]>([]);
  const [activeBakedPathId, setActiveBakedPathId] = useState<string | null>(null);
  const [walkStylePreset, setWalkStylePreset] = useState("casual");
  const [walkSpeedPreset, setWalkSpeedPreset] = useState<WalkSpeedPreset>("medium");
  const [walkIntensity, setWalkIntensity] = useState(0.5);
  const [walkWaypoints, setWalkWaypoints] = useState<{ x: number; y: number; z: number }[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    speed: 1,
    loop: false,
    headWiggle: false,
    isBaked: false,
  });
  const [collisionEnabled, setCollisionEnabled] = useState(false);
  const [lockY, setLockY] = useState(true);
  const [capturedBoundary, setCapturedBoundary] = useState<{ x: number; z: number }[]>([]);
  const [sceneOrigin, setSceneOrigin] = useState<{ position: Vec3; yaw: number; eyeHeight: number }>({
    position: { x: 0, y: 0, z: 0 },
    yaw: 0,
    eyeHeight: 0,
  });
  const [activePreset, setActivePreset] = useState<ScenePreset | null>(null);

  const sceneStateCache = useRef<Map<string, {
    anchors: SceneAnchor[];
    anchorAnimations: AnchorAnimation[];
    paths: CameraPath[];
    activePathId: string | null;
    selectedKfIds: string[];
    walkSpeedPreset: WalkSpeedPreset;
    walkStylePreset: string;
    walkIntensity: number;
    moveSpeed: number;
  }>>(new Map());

  const [compFps, setCompFps] = useState(30);
  const [compDuration, setCompDuration] = useState(8);
  const [workAreaIn, setWorkAreaIn] = useState<number | null>(null);
  const [workAreaOut, setWorkAreaOut] = useState<number | null>(null);
  const [mediaLibrary, setMediaLibrary] = useState<MediaLibraryItem[]>([]);
  const [backgroundMusicId, setBackgroundMusicId] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<MediaLibraryItem[]>([DEFAULT_TRACK]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<"mp4" | "gif">("mp4");
  const [showGraphEditor, setShowGraphEditor] = useState(false);
  const [showPathPanel, setShowPathPanel] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [selectedKfIds, setSelectedKfIds] = useState<string[]>([]);

  const [userModeId, setUserModeId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sceneit_user_mode") ?? DEFAULT_MODE_ID;
    }
    return DEFAULT_MODE_ID;
  });
  const userMode = getUserMode(userModeId);

  const handleSetUserModeId = useCallback((id: string) => {
    setUserModeId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("sceneit_user_mode", id);
    }
    const mode = getUserMode(id);
    setCompDuration(mode.defaultCompDuration);
  }, []);

  const [dofEnabled, setDofEnabled] = useState(false);
  const [dofFocusDistance, setDofFocusDistance] = useState(1.5);
  const [dofFocusRange, setDofFocusRange] = useState(4);
  const [dofBlurRadius, setDofBlurRadius] = useState(8);

  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialSectionId, setTutorialSectionId] = useState<string | null>(null);

  const kfClipboardRef = useRef<{ keyframes: CameraKeyframe[]; baseTime: number } | null>(null);

  const dragCounter = useRef(0);

  const MAX_UNDO = 50;
  const undoStackRef = useRef<SettingsSnapshot[]>([]);
  const redoStackRef = useRef<SettingsSnapshot[]>([]);
  const settingsRef = useRef<SettingsSnapshot>({
    fov: 36, moveSpeed: 0.5, exposure: 1, colorFilter: "none",
    contrast: 0, saturation: 0, dim: 0,
    meshPos: { x: 0, y: 0, z: 0 }, meshRot: { x: 0, y: 0, z: 0 }, meshScale: 1,
    anchors: [], paths: [], activePathId: null, selectedAnchorId: null,
    workAreaIn: null, workAreaOut: null, compDuration: 8, walkWaypoints: [],
    anchorAnimations: [],
  });

  settingsRef.current = {
    fov, moveSpeed, exposure, colorFilter, contrast, saturation, dim,
    meshPos, meshRot, meshScale,
    anchors, paths, activePathId, selectedAnchorId,
    workAreaIn, workAreaOut, compDuration, walkWaypoints,
    anchorAnimations,
  };

  const cloneSnapshot = (s: SettingsSnapshot): SettingsSnapshot => ({
    ...s,
    meshPos: { ...s.meshPos },
    meshRot: { ...s.meshRot },
    anchors: JSON.parse(JSON.stringify(s.anchors)),
    paths: JSON.parse(JSON.stringify(s.paths)),
    walkWaypoints: s.walkWaypoints.map((w) => ({ ...w })),
    anchorAnimations: JSON.parse(JSON.stringify(s.anchorAnimations)),
  });

  const pushUndo = useCallback(() => {
    undoStackRef.current.push(cloneSnapshot(settingsRef.current));
    if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
    redoStackRef.current = [];
  }, []);

  const _resetRef = useRef(null);
  const _createAnchorRef = useRef(null);
  const _removeAnchorRef = useRef(null);
  const _loadDepthMeshRef = useRef(null);
  const _setDepthMeshVisibleRef = useRef(null);
  const _setDepthMeshTransformRef = useRef(null);
  const _setDepthMeshDebugViewRef = useRef(null);
  const _setDepthMeshBiasRef = useRef(null);
  const _getDepthMeshAutoAlignRef = useRef(null);
  const _setOrthoViewRef = useRef(null);
  const _setAnchorPositionRef = useRef(null);
  const _setAnchorRotationRef = useRef(null);
  const _rebuildAnchorRef = useRef(null);
  const _setAnchorOpacityRef = useRef(null);
  const _setAnchorScaleRef = useRef(null);
  const _setAnchorBillboardRef = useRef(null);
  const _setAnchorLeashRef = useRef(null);
  const _setAnchorLeashRotationRef = useRef(null);
  const _setAnchorMediaRef = useRef(null);
  const _setAnchorVisibleRef = useRef(null);
  const _showGizmoRef = useRef(null);
  const _hideGizmoRef = useRef(null);
  const _worldToScreenRef = useRef(null);
  const _getAnchorAxesRef = useRef(null);
  const _addKeyframeAtCameraRef = useRef(null);
  const _triggerAddKeyframeRef = useRef(null);
  const _getCameraStateRef = useRef(null);
  const _setCameraPositionRef = useRef(null);
  const _setCameraRotationRef = useRef(null);
  const _addChannelKeyframeRef = useRef(null);
  const _playPathRef = useRef(null);
  const _pausePathRef = useRef(null);
  const _stopPathRef = useRef(null);
  const _seekPathRef = useRef(null);
  const _seekPathSilentRef = useRef(null);
  const _setPlaybackSpeedRef = useRef(null);
  const _setPlaybackLoopRef = useRef(null);
  const _setHeadWiggleRef = useRef(null);
  const _getRendererRef = useRef(null);
  const _getPlaybackRef = useRef(null);
  const _captureFrameRef = useRef(null);
  const _spaceDraggedRef = useRef(false);
  const _liveWalkPathIdRef = useRef(null);

  const refs: SceneRefs = useMemo(() => ({
    reset: _resetRef,
    createAnchor: _createAnchorRef,
    removeAnchor: _removeAnchorRef,
    loadDepthMesh: _loadDepthMeshRef,
    setDepthMeshVisible: _setDepthMeshVisibleRef,
    setDepthMeshTransform: _setDepthMeshTransformRef,
    setDepthMeshDebugView: _setDepthMeshDebugViewRef,
    setDepthMeshBias: _setDepthMeshBiasRef,
    getDepthMeshAutoAlign: _getDepthMeshAutoAlignRef,
    setOrthoView: _setOrthoViewRef,
    setAnchorPosition: _setAnchorPositionRef,
    setAnchorRotation: _setAnchorRotationRef,
    rebuildAnchor: _rebuildAnchorRef,
    setAnchorOpacity: _setAnchorOpacityRef,
    setAnchorScale: _setAnchorScaleRef,
    setAnchorBillboard: _setAnchorBillboardRef,
    setAnchorLeash: _setAnchorLeashRef,
    setAnchorLeashRotation: _setAnchorLeashRotationRef,
    setAnchorMedia: _setAnchorMediaRef,
    setAnchorVisible: _setAnchorVisibleRef,
    showGizmo: _showGizmoRef,
    hideGizmo: _hideGizmoRef,
    worldToScreen: _worldToScreenRef,
    getAnchorAxes: _getAnchorAxesRef,
    addKeyframeAtCamera: _addKeyframeAtCameraRef,
    triggerAddKeyframe: _triggerAddKeyframeRef,
    getCameraState: _getCameraStateRef,
    setCameraPosition: _setCameraPositionRef,
    setCameraRotation: _setCameraRotationRef,
    addChannelKeyframe: _addChannelKeyframeRef,
    playPath: _playPathRef,
    pausePath: _pausePathRef,
    stopPath: _stopPathRef,
    seekPath: _seekPathRef,
    seekPathSilent: _seekPathSilentRef,
    setPlaybackSpeed: _setPlaybackSpeedRef,
    setPlaybackLoop: _setPlaybackLoopRef,
    setHeadWiggle: _setHeadWiggleRef,
    getRenderer: _getRendererRef,
    getPlayback: _getPlaybackRef,
    captureFrame: _captureFrameRef,
    spaceDraggedRef: _spaceDraggedRef,
    liveWalkPathId: _liveWalkPathIdRef,
  }), []);

  const restoreSnapshot = useCallback((snap: SettingsSnapshot) => {
    setFov(snap.fov);
    setMoveSpeed(snap.moveSpeed);
    setExposure(snap.exposure);
    setColorFilter(snap.colorFilter);
    setContrast(snap.contrast);
    setSaturation(snap.saturation);
    setDim(snap.dim);
    setMeshPos(snap.meshPos);
    setMeshRot(snap.meshRot);
    setMeshScale(snap.meshScale);
    refs.setDepthMeshTransform.current?.(snap.meshPos, snap.meshRot, snap.meshScale);
    setAnchors(snap.anchors);
    setPaths(snap.paths);
    setActivePathId(snap.activePathId);
    setSelectedAnchorId(snap.selectedAnchorId);
    setWorkAreaIn(snap.workAreaIn);
    setWorkAreaOut(snap.workAreaOut);
    setCompDuration(snap.compDuration);
    setWalkWaypoints(snap.walkWaypoints);
    setAnchorAnimations(snap.anchorAnimations);
  }, [refs.setDepthMeshTransform]);

  const undo = useCallback(() => {
    const snap = undoStackRef.current.pop();
    if (!snap) return;
    redoStackRef.current.push(cloneSnapshot(settingsRef.current));
    restoreSnapshot(snap);
  }, [restoreSnapshot]);

  const redo = useCallback(() => {
    const snap = redoStackRef.current.pop();
    if (!snap) return;
    undoStackRef.current.push(cloneSnapshot(settingsRef.current));
    restoreSnapshot(snap);
  }, [restoreSnapshot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "TEXTAREA") return;
      if (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range")
        return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const loadFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "ply") {
      setError("Please use a .ply file from 3DGS training output.");
      return;
    }
    setActivePreset(null);
    setCollisionEnabled(false);
    setLockY(false);
    setCapturedBoundary([]);
    setSceneOrigin({ position: { x: 0, y: 0, z: 0 }, yaw: 0, eyeHeight: 0 });
    setDepthMeshLoaded(false);
    setAnchors([]);
    setSelectedAnchorId(null);
    setCameraTargetAnchorId(null);
    setAnchorAnimations([]);
    setPaths([]);
    setActivePathId(null);
    setSelectedKfIds([]);
    setError(null);
    setLoadingState("reading");
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setPlyBuffer(reader.result as ArrayBuffer);
        setFileName(file.name);
        setLoadingState("processing");
      } else {
        setError("File read returned empty result.");
        setLoadingState("idle");
      }
    };
    reader.onerror = () => {
      setError(`Failed to read file: ${reader.error?.message || "unknown error"}`);
      setLoadingState("idle");
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleLoadError = useCallback((msg: string) => {
    setError(msg);
    setLoadingState("idle");
  }, []);

  const clearAll = useCallback(() => {
    setAnchors([]);
    setPaths([]);
    setActivePathId(null);
    setBakedPaths([]);
    setActiveBakedPathId(null);
    setSelectedAnchorId(null);
    setCameraTargetAnchorId(null);
    setAnchorAnimations([]);
    setSelectedKfIds([]);
    setMediaLibrary([]);
    setBackgroundMusicId(null);
    setWalkWaypoints([]);
  }, []);

  const closeScene = useCallback(() => {
    setPlyBuffer(null);
    setFileName(null);
    setVertexCount(null);
    setError(null);
    setLoadingState("idle");
    setFileInputKey((k) => k + 1);
  }, []);

  const loadPreset = useCallback(async (preset: ScenePreset) => {
    if (activePreset) {
      sceneStateCache.current.set(activePreset.id, {
        anchors, anchorAnimations, paths, activePathId, selectedKfIds,
        walkSpeedPreset, walkStylePreset, walkIntensity, moveSpeed,
      });
    }

    setSelectedAnchorId(null);
    setCameraTargetAnchorId(null);

    const cached = sceneStateCache.current.get(preset.id);
    if (cached) {
      setAnchors(cached.anchors);
      setAnchorAnimations(cached.anchorAnimations);
      setPaths(cached.paths);
      setActivePathId(cached.activePathId);
      setSelectedKfIds(cached.selectedKfIds);
      setWalkSpeedPreset(cached.walkSpeedPreset);
      setWalkStylePreset(cached.walkStylePreset);
      setWalkIntensity(cached.walkIntensity);
      setMoveSpeed(cached.moveSpeed);
    } else {
      setAnchors(preset.anchors ?? []);
      setAnchorAnimations([]);
      if (preset.walkthroughPaths && preset.walkthroughPaths.length > 0) {
        setPaths(preset.walkthroughPaths);
        setActivePathId(preset.walkthroughPaths[0].id);
      } else {
        setPaths([]);
        setActivePathId(null);
      }
      setSelectedKfIds([]);
      const wd = preset.walkDefaults;
      if (wd) {
        if (wd.walkSpeedPreset) setWalkSpeedPreset(wd.walkSpeedPreset);
        if (wd.walkStylePreset) setWalkStylePreset(wd.walkStylePreset);
        if (wd.walkIntensity != null) setWalkIntensity(wd.walkIntensity);
        if (wd.moveSpeed != null) setMoveSpeed(wd.moveSpeed);
      } else {
        setWalkSpeedPreset("medium");
        setWalkStylePreset("casual");
        setWalkIntensity(0.5);
        setMoveSpeed(0.5);
      }
    }

    setError(null);
    setLoadingState("reading");
    setActivePreset(preset);
    setDownloadProgress(0);

    if (preset.meshTransform) {
      setMeshPos(preset.meshTransform.position);
      setMeshRot(preset.meshTransform.rotation);
      setMeshScale(preset.meshTransform.scale);
    } else {
      setMeshPos({ x: 0, y: 0, z: 0 });
      setMeshRot({ x: 0, y: 0, z: 0 });
      setMeshScale(1);
    }

    setCollisionEnabled(preset.collisionPolygons.length > 0);
    setLockY(true);

    const origin = preset.sceneOrigin ?? {
      position: preset.initialCamera.position,
      yaw: preset.initialCamera.yaw,
    };
    setSceneOrigin({
      position: origin.position,
      yaw: origin.yaw,
      eyeHeight: preset.defaultEyeHeight ?? origin.position.y,
    });

    try {
      let buffer: ArrayBuffer;

      if (preset.plyChunks && preset.plyChunks > 1) {
        // Fetch chunked PLY files in parallel and concatenate.
        const chunkUrls = Array.from({ length: preset.plyChunks }, (_, i) =>
          `${preset.plyUrl}.${String(i).padStart(2, "0")}`
        );
        const chunkBuffers = await Promise.all(
          chunkUrls.map(async (url, idx) => {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status} loading PLY chunk ${idx}`);
            const ab = await resp.arrayBuffer();
            setDownloadProgress(Math.round(((idx + 1) / chunkUrls.length) * 100));
            return ab;
          })
        );
        const totalSize = chunkBuffers.reduce((sum, b) => sum + b.byteLength, 0);
        const merged = new Uint8Array(totalSize);
        let offset = 0;
        for (const cb of chunkBuffers) {
          merged.set(new Uint8Array(cb), offset);
          offset += cb.byteLength;
        }
        buffer = merged.buffer;
      } else {
        const resp = await fetch(preset.plyUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} loading PLY`);

        const contentLength = parseInt(resp.headers.get("content-length") ?? "0", 10);

        if (contentLength > 0 && resp.body) {
          const reader = resp.body.getReader();
          const chunks: Uint8Array[] = [];
          let received = 0;

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            setDownloadProgress(Math.round((received / contentLength) * 100));
          }

          const merged = new Uint8Array(received);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          buffer = merged.buffer;
        } else {
          buffer = await resp.arrayBuffer();
        }
      }

      setPlyBuffer(buffer);
      setFileName(preset.name);
      setDownloadProgress(null);
      setLoadingState("processing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scene preset");
      setDownloadProgress(null);
    }
  }, []);

  const handleVertexCount = useCallback((n: number) => {
    setVertexCount(n);
    setLoadingState("ready");
    setFileInputKey((k) => k + 1);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) loadFile(files[0]);
    },
    [loadFile]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      const files = e.dataTransfer.files;
      if (files.length > 0) loadFile(files[0]);
    },
    [loadFile]
  );

  const autoGenerateWalkFromWaypoints = useCallback(() => {
    if (walkWaypoints.length < 2) return;
    pushUndo();
    const style = WALK_STYLES[walkStylePreset] ?? WALK_STYLES.casual;
    const speed = WALK_SPEEDS[walkSpeedPreset] ?? WALK_SPEEDS.medium;
    const sceneSpeedScale = activePreset?.walkDefaults?.speedScale;
    const path = generateWalkPath(walkWaypoints, style, speed, {
      intensity: walkIntensity,
      speedScale: sceneSpeedScale,
    });
    const existingId = refs.liveWalkPathId.current;
    if (existingId) {
      path.id = existingId;
      setPaths((prev) => prev.map((p) => (p.id === existingId ? path : p)));
    } else {
      refs.liveWalkPathId.current = path.id;
      setPaths((prev) => [...prev, path]);
    }
    setActivePathId(path.id);
    setActiveBakedPathId(null);
  }, [walkWaypoints, walkStylePreset, walkSpeedPreset, walkIntensity, refs, activePreset, pushUndo]);

  const finalizeWalkWaypoints = useCallback(() => {
    refs.liveWalkPathId.current = null;
    setWalkWaypoints([]);
  }, [refs]);

  const retimeActiveWalkPath = useCallback(
    (newDuration: number): { warning?: string } | null => {
      const activePath = paths.find((p) => p.id === activePathId);
      if (!activePath?.walkMeta) return null;
      pushUndo();
      const result = retimeWalkPath(activePath, newDuration);
      setPaths((prev) =>
        prev.map((p) => (p.id === result.path.id ? result.path : p))
      );
      return result.warning ? { warning: result.warning } : null;
    },
    [paths, activePathId, pushUndo]
  );

  const convertActivePathToWalk = useCallback(() => {
    const activePath = paths.find((p) => p.id === activePathId);
    if (!activePath || activePath.walkMeta) return;
    const posKfs = activePath.keyframes.filter(
      (kf) => !kf.keyedChannels || kf.keyedChannels.includes("position"),
    );
    if (posKfs.length < 2) return;

    pushUndo();
    const style = WALK_STYLES[walkStylePreset] ?? WALK_STYLES.casual;
    const speed = WALK_SPEEDS[walkSpeedPreset] ?? WALK_SPEEDS.medium;
    const sceneSpeedScale = activePreset?.walkDefaults?.speedScale;
    const converted = convertPathToWalk(activePath, style, speed, {
      intensity: walkIntensity,
      speedScale: sceneSpeedScale,
    });
    setPaths((prev) => prev.map((p) => (p.id === converted.id ? converted : p)));
  }, [paths, activePathId, walkStylePreset, walkSpeedPreset, walkIntensity, pushUndo, activePreset]);

  const isLoading = loadingState === "reading" || loadingState === "processing";
  const addBoundaryPoint = useCallback(() => {
    const cam = refs.getCameraState.current?.();
    if (!cam) return;
    setCapturedBoundary((prev) => [...prev, { x: cam.position.x, z: cam.position.z }]);
  }, [refs]);

  const finalizeBoundary = useCallback(() => {
    setCapturedBoundary((prev) => {
      if (prev.length >= 3) {
        setCollisionEnabled(true);
        const rounded = prev.map((p) => ({ x: +p.x.toFixed(4), z: +p.z.toFixed(4) }));
        try {
          navigator.clipboard.writeText(
            `collisionPolygons: [{ points: ${JSON.stringify(rounded)} }],`
          );
        } catch { /* clipboard unavailable in insecure contexts */ }
      }
      return prev;
    });
  }, []);

  const clearBoundary = useCallback(() => {
    setCapturedBoundary([]);
    setCollisionEnabled(false);
  }, []);

  const condenseToWorkArea = useCallback(() => {
    if (workAreaIn == null && workAreaOut == null) return;
    const inTime = workAreaIn ?? 0;
    const outTime = workAreaOut ?? compDuration;
    if (inTime >= outTime) return;
    const newDuration = outTime - inTime;
    setPaths((prev) =>
      prev.map((p) => ({
        ...p,
        keyframes: p.keyframes
          .filter((kf) => kf.time >= inTime)
          .map((kf) => ({ ...kf, time: kf.time - inTime }))
          .sort((a, b) => a.time - b.time),
        lookAtEvents: p.lookAtEvents
          ?.filter((e) => e.time >= inTime)
          .map((e) => ({ ...e, time: e.time - inTime })),
      }))
    );
    setCompDuration(newDuration);
    setWorkAreaIn(null);
    setWorkAreaOut(null);
  }, [workAreaIn, workAreaOut, compDuration]);

  const actions: SceneActions = useMemo(
    () => ({
      loadFile,
      closeScene,
      handleVertexCount,
      handleFileInput,
      setIsDragging,
      setShowGrid,
      setShowSettings,
      setFov,
      setMoveSpeed,
      setExposure,
      setColorFilter,
      setContrast,
      setSaturation,
      setDim,
      setBlur,
      setShowFovFrame,
      setShowFovStroke,
      setFovFeather,
      setDepthMeshLoaded,
      setDepthMeshVisible,
      setMeshPos,
      setMeshRot,
      setMeshScale,
      setAnchors,
      setSelectedAnchorId,
      pushUndo,
      undo,
      redo,
      handleLoadError,
      clearAll,
      setWalkthroughActive,
      setPaths,
      setActivePathId,
      setBakedPaths,
      setActiveBakedPathId,
      setPlaybackState,
      setCollisionEnabled,
      setLockY,
      setCompFps,
      setCompDuration,
      setAnchorAnimations,
      setCameraTargetAnchorId,
      setMediaLibrary,
      setBackgroundMusicId,
      setPlaylist,
      setCurrentTrackId,
      setIsAudioPlaying,
      setShowExportModal,
      setExportFormat,
      setShowGraphEditor,
      setShowPathPanel,
      setIsExporting,
      setExportProgress,
      setSelectedKfIds,
      kfClipboardRef,
      loadPreset,
      setWalkStylePreset,
      setWalkSpeedPreset,
      setWalkIntensity,
      setWalkWaypoints,
      autoGenerateWalkFromWaypoints,
      finalizeWalkWaypoints,
      retimeActiveWalkPath,
      convertActivePathToWalk,
      addBoundaryPoint,
      finalizeBoundary,
      clearBoundary,
      setWorkAreaIn,
      setWorkAreaOut,
      condenseToWorkArea,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      setUserModeId: handleSetUserModeId,
      setDofEnabled,
      setDofFocusDistance,
      setDofFocusRange,
      setDofBlurRadius,
      setShowTutorial,
      setTutorialSectionId,
    }),
    [loadFile, closeScene, loadPreset, handleVertexCount, handleFileInput, pushUndo, undo, redo, handleLoadError, clearAll, autoGenerateWalkFromWaypoints, finalizeWalkWaypoints, retimeActiveWalkPath, convertActivePathToWalk, addBoundaryPoint, finalizeBoundary, clearBoundary, condenseToWorkArea, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, handleSetUserModeId]
  );

  const value: SceneContextValue = {
    plyBuffer,
    fileName,
    vertexCount,
    loadingState,
    error,
    isLoading,
    showGrid,
    showSettings,
    fov,
    moveSpeed,
    exposure,
    colorFilter,
    contrast,
    saturation,
    dim,
    blur,
    showFovFrame,
    showFovStroke,
    fovFeather,
    depthMeshLoaded,
    depthMeshVisible,
    meshPos,
    meshRot,
    meshScale,
    anchors,
    selectedAnchorId,
    anchorAnimations,
    cameraTargetAnchorId,
    walkthroughActive,
    paths,
    activePathId,
    bakedPaths,
    activeBakedPathId,
    playbackState,
    collisionEnabled,
    lockY,
    sceneOrigin,
    capturedBoundary,
    activePreset,
    walkStylePreset,
    walkSpeedPreset,
    walkIntensity,
    walkWaypoints,
    compFps,
    compDuration,
    workAreaIn,
    workAreaOut,
    mediaLibrary,
    backgroundMusicId,
    playlist,
    currentTrackId,
    isAudioPlaying,
    showExportModal,
    exportFormat,
    showGraphEditor,
    showPathPanel,
    isExporting,
    selectedKfIds,
    isDragging,
    downloadProgress,
    fileInputKey,
    userModeId,
    userMode,
    dofEnabled,
    dofFocusDistance,
    dofFocusRange,
    dofBlurRadius,
    showTutorial,
    tutorialSectionId,
    actions,
    refs,
  };

  return (
    <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
  );
}
