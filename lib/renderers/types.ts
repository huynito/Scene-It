export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface SceneInfo {
  center: Vec3;
  radius: number;
  splatCount: number;
}

export interface SplatRenderer {
  onContextLost: (() => void) | null;
  init(container: HTMLElement): Promise<void>;
  loadScene(buffer: ArrayBuffer): Promise<SceneInfo>;
  dispose(): void;

  getCameraPosition(): Vec3;
  setCameraPosition(x: number, y: number, z: number): void;
  setCameraQuaternion(x: number, y: number, z: number, w: number): void;
  getCanvas(): HTMLCanvasElement | null;

  setFov(degrees: number): void;
  setExposure(value: number): void;
  setToneMapping(mode: number): void;
  setDim(opacity: number): void;
  setBlur(amount: number): void;
  setFovFrame(enabled: boolean): void;
  getFovFrame(): boolean;
  setFovStroke(visible: boolean): void;
  setFovFeather(amount: number): void;

  addGrid(center: Vec3, radius: number): void;
  setGridVisible(visible: boolean): void;

  addAnchor(
    position: Vec3,
    rotation: { x: number; y: number; z: number; w: number },
    width: number,
    height: number,
    color: [number, number, number, number],
    cornerRadius?: number,
    existingId?: string
  ): string;
  removeAnchor(id: string): void;
  setAnchorPosition(id: string, position: Vec3): void;
  setAnchorRotation(id: string, euler: Vec3): void;
  rebuildAnchor(
    id: string,
    width: number,
    height: number,
    cornerRadius: number,
    clearMedia?: boolean
  ): void;
  setAnchorOpacity(id: string, opacity: number): void;
  setAnchorScale(id: string, scale: number): void;
  setAnchorBillboard(id: string, mode: "none" | "full" | "y-axis"): void;
  setAnchorLeash(id: string, leashed: boolean, distance: number, offset: { x: number; y: number; z: number }): void;
  setAnchorLeashRotation(id: string, rotation: { x: number; y: number; z: number }): void;
  setAnchorMedia(id: string, source: ImageBitmap | HTMLVideoElement | HTMLImageElement): void;
  /** Pre-decoded GIF: frames are ImageBitmaps, durations in microseconds per frame. */
  setAnchorGifFrames(id: string, frames: ImageBitmap[], durations: number[]): void;
  setAnchorVisible(id: string, visible: boolean): void;
  setAnchorEntranceState(id: string, progress: number, preset: string): void;
  updateBillboards(): void;
  updateVideoTextures(): void;
  getAnchorIds(): string[];

  seekAnchorGifsToTime(compositionTimeSec: number): void;
  pauseAnchorVideos(): void;
  resumeAnchorVideos(): void;
  /** Seek each anchor's video to the given time (seconds into the video) and upload the frame to its GPU texture. */
  seekAnchorVideosToTime(anchorVideoTimes: Array<{ id: string; time: number }>): Promise<void>;

  addDepthProxy(
    position: Vec3,
    rotation: { x: number; y: number; z: number; w: number },
    width: number,
    height: number
  ): string;
  removeDepthProxy(id: string): void;
  setDepthProxyPosition(id: string, position: Vec3): void;
  setDepthProxyRotation(id: string, euler: Vec3): void;
  rebuildDepthProxy(id: string, width: number, height: number): void;
  setProxyWireframeVisible(visible: boolean): void;

  loadDepthMesh(buffer: ArrayBuffer, filename: string): Promise<void>;
  setDepthMeshVisible(visible: boolean): void;
  setDepthMeshTransform(
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    scale: number
  ): void;
  /** Toggle translucent debug view for the depth mesh so it's visible during alignment. */
  setDepthMeshDebugView(enabled: boolean): void;
  /** Adjust depth bias on the occlusion mesh for edge artifact tuning. */
  setDepthMeshBias(bias: number): void;
  /** Compute position + scale that centers the mesh on the splat scene via AABB matching. */
  getDepthMeshAutoAlign(): { position: Vec3; scale: number } | null;

  /** Set the scene origin yaw (radians) so gizmo handles align with room axes. */
  setSceneYaw(yawRad: number): void;

  /** Snap camera to an orthographic axis-aligned view centered on the scene.
   *  Pass null to return to perspective. */
  setOrthoView(axis: "top" | "bottom" | "front" | "back" | "left" | "right" | null): void;
  /** Zoom the orthographic camera by adjusting orthoHeight. */
  orthoZoom(deltaPixels: number): void;

  showGizmo(position: Vec3): void;
  hideGizmo(): void;
  worldToScreen(worldPos: Vec3): { x: number; y: number } | null;
  getAnchorAxes(id: string): { center: Vec3; right: Vec3; up: Vec3; forward: Vec3 } | null;

  getCollisionClampFn():
    | ((origin: Vec3, dx: number, dy: number, dz: number) => Vec3)
    | null;

  setDofEnabled(enabled: boolean): void;
  setDofFocusDistance(distance: number): void;
  setDofFocusRange(range: number): void;
  setDofBlurRadius(radius: number): void;

  // Export pipeline support
  setAutoRender(auto: boolean): void;
  requestSingleFrame(): void;
  grabFrame(): Promise<ImageBitmap>;
  setMaxPixelRatio(ratio: number): void;
  getMaxPixelRatio(): number;
  resizeCanvas(width: number, height: number): void;
  restoreCanvasToViewport(): void;
  /** Hide editing-only artifacts (gizmo, grid, wireframes, debug mesh) before capture. */
  prepareForCapture(): void;
  /** Restore editing artifacts hidden by prepareForCapture(). */
  restoreAfterCapture(): void;
  getApp(): unknown;
}
