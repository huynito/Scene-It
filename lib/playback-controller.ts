import type { SplatRenderer } from "./renderers/types";
import type { FPSController } from "./fps-controller";
import { cameraQuaternion } from "./fps-controller";
import { evaluatePath, pathDuration, evaluateLookAt, evaluateBakedPath, bakedPathDuration, computeLookAt, applyEasing, lerp, shortestAngleLerp } from "./camera-path";
import type { CameraPath, BakedCameraPath } from "./camera-path";
import type { SceneAnchor, EntrancePreset } from "./scene-context";
import { AnchorAnimationController } from "./anchor-animation";
import type { AnchorAnimation } from "./anchor-animation";

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  loop: boolean;
  /** @deprecated Use walk style system instead */
  headWiggle: boolean;
  isBaked: boolean;
}

export type PlaybackListener = (state: PlaybackState) => void;

export class PlaybackController {
  private renderer: SplatRenderer;
  private fps: FPSController;
  private path: CameraPath | null = null;
  private bakedPath: BakedCameraPath | null = null;
  private animId = 0;
  private lastTime = 0;
  private _currentTime = 0;
  private _isPlaying = false;
  private _speed = 1;
  private _loop = false;
  private listener: PlaybackListener | null = null;
  private anchorsRef: { current: SceneAnchor[] } = { current: [] };
  private anchorAnimController = new AnchorAnimationController();
  private _cameraTargetAnchorId: string | null = null;
  private _targetBlendT = 0;
  private pausedControlsForPlayback = false;
  private lastAppliedPitch: number | null = null;
  private lastAppliedYaw: number | null = null;
  lockY = false;
  eyeHeight = 0;
  compDuration = 8;

  constructor(renderer: SplatRenderer, fps: FPSController) {
    this.renderer = renderer;
    this.fps = fps;
  }

  setAnchorsRef(ref: { current: SceneAnchor[] }) {
    this.anchorsRef = ref;
  }

  setAnchorAnimations(anims: AnchorAnimation[]) {
    this.anchorAnimController.clear();
    for (const a of anims) this.anchorAnimController.addAnimation(a);
  }

  setCameraTargetAnchorId(id: string | null) {
    if (this._cameraTargetAnchorId !== id) this._targetBlendT = 0;
    this._cameraTargetAnchorId = id;
  }

  /** @deprecated Walk style system replaces head wiggle */
  setHeadWiggle(_enabled: boolean) {
    this.emit();
  }

  onUpdate(fn: PlaybackListener) {
    this.listener = fn;
  }

  private get activeDuration(): number {
    return this.compDuration;
  }

  private emit() {
    this.listener?.({
      isPlaying: this._isPlaying,
      currentTime: this._currentTime,
      duration: this.activeDuration,
      speed: this._speed,
      loop: this._loop,
      headWiggle: false,
      isBaked: !!this.bakedPath,
    });
  }

  setPath(path: CameraPath | null) {
    const changed = path?.id !== this.path?.id;
    this.path = path;
    this.bakedPath = null;
    if (changed) this._currentTime = 0;
    this.emit();
  }

  setBakedPath(path: BakedCameraPath | null) {
    this.bakedPath = path;
    this.path = null;
    this._currentTime = 0;
    this.emit();
  }

  play() {
    const canPlayKeyframed = this.path && this.path.keyframes.length >= 2;
    const canPlayBaked = this.bakedPath && this.bakedPath.frames.length >= 2;
    const canPlayAnchors = this.anchorAnimController.hasPlayable();
    if (!canPlayKeyframed && !canPlayBaked && !canPlayAnchors) return;
    if (this._isPlaying) return;

    const duration = this.activeDuration;
    if (this._currentTime >= duration && !this._loop) {
      this._currentTime = 0;
    }

    this._isPlaying = true;
    this.fps.pause();
    this.pausedControlsForPlayback = true;
    this.lastTime = performance.now();
    this.tick();
    this.emit();
  }

  pause() {
    if (!this._isPlaying) return;
    this._isPlaying = false;
    cancelAnimationFrame(this.animId);
    this.resumeControlsAfterPlayback();
    this.emit();
  }

  stop() {
    const wasPlaying = this._isPlaying;
    this._isPlaying = false;
    cancelAnimationFrame(this.animId);
    this._currentTime = 0;

    if (wasPlaying) this.resumeControlsAfterPlayback();
    this.emit();
  }

  seek(time: number) {
    this._currentTime = Math.max(0, time);
    const duration = this.activeDuration;
    if (duration > 0 && !this._loop) {
      this._currentTime = Math.min(this._currentTime, duration);
    }
    this.applySample();
    this.emit();
  }

  /** Advance the playhead time and update UI without moving the camera. */
  seekSilent(time: number) {
    this._currentTime = Math.max(0, time);
    this.emit();
  }

  setSpeed(speed: number) {
    this._speed = Math.max(0.1, Math.min(speed, 10));
    this.emit();
  }

  setLoop(loop: boolean) {
    this._loop = loop;
    this.emit();
  }

  resumeControls() {
    this._isPlaying = false;
    cancelAnimationFrame(this.animId);
    this.resumeControlsAfterPlayback();
    this.emit();
  }

  get isPlaying() {
    return this._isPlaying;
  }
  get currentTime() {
    return this._currentTime;
  }
  get speed() {
    return this._speed;
  }
  get loop() {
    return this._loop;
  }

  private resumeControlsAfterPlayback() {
    if (!this.pausedControlsForPlayback) return;
    let pitch = this.lastAppliedPitch;
    let yaw = this.lastAppliedYaw;
    const sample = this.path
      ? evaluatePath(this.path, this._currentTime)
      : this.bakedPath
        ? evaluateBakedPath(this.bakedPath, this._currentTime)
        : null;
    if (sample) {
      pitch = sample.pitch;
      yaw = sample.yaw;
    }
    this.fps.resume(yaw ?? undefined, pitch ?? undefined);
    this.pausedControlsForPlayback = false;
  }

  private applySample() {
    let sample = this.path ? evaluatePath(this.path, this._currentTime) : null;
    if (!sample && this.bakedPath) sample = evaluateBakedPath(this.bakedPath, this._currentTime);

    if (sample) {
      const hasWalkBounce = this.path?.walkMeta != null;
      const posY = (this.lockY && !hasWalkBounce) ? this.eyeHeight : sample.position.y;
      this.renderer.setCameraPosition(sample.position.x, posY, sample.position.z);

      let pitch = sample.pitch;
      let yaw = sample.yaw;

      if (this._cameraTargetAnchorId) {
        const target = this.anchorsRef.current.find(a => a.id === this._cameraTargetAnchorId);
        if (target) {
          const look = computeLookAt(sample.position, target.position);
          this._targetBlendT = Math.min(1, this._targetBlendT + (1 - this._targetBlendT) * 0.08);
          const easedT = applyEasing(this._targetBlendT, "easeInOutCubic");
          pitch = lerp(pitch, look.pitch, easedT);
          yaw = shortestAngleLerp(yaw, look.yaw, easedT);
        }
      } else if (this.path?.lookAtEvents && this.path.lookAtEvents.length > 0) {
        const anchorPositions = new Map<string, { x: number; y: number; z: number }>();
        for (const a of this.anchorsRef.current) {
          anchorPositions.set(a.id, a.position);
        }
        const lookAt = evaluateLookAt(
          this.path.lookAtEvents,
          this._currentTime,
          sample.pitch,
          sample.yaw,
          anchorPositions,
          sample.position
        );
        if (lookAt) {
          pitch = lookAt.pitch;
          yaw = lookAt.yaw;
        }
      }

      const q = cameraQuaternion(pitch, yaw);
      this.renderer.setCameraQuaternion(q.x, q.y, q.z, q.w);
      this.lastAppliedPitch = pitch;
      this.lastAppliedYaw = yaw;
      if (sample.fov != null) this.renderer.setFov(sample.fov);
    }

    this.evaluateAnchorAnimations(this._currentTime);
    this.evaluateAnchors(this._currentTime);
    this.renderer.updateBillboards();
  }

  private evaluateAnchors(time: number) {
    for (const anchor of this.anchorsRef.current) {
      if (anchor.appearAt == null && anchor.disappearAt == null) continue;

      const appearAt = anchor.appearAt ?? 0;
      const disappearAt = anchor.disappearAt ?? Infinity;
      const entranceDur = anchor.entranceDuration ?? 0.4;
      const exitDur = anchor.exitDuration ?? 0.3;
      const entrancePreset: EntrancePreset = anchor.entrancePreset ?? "fade";
      const exitPreset: EntrancePreset = anchor.exitPreset ?? "fade";

      if (time < appearAt) {
        this.renderer.setAnchorEntranceState(anchor.id, 0, entrancePreset);
      } else if (time < appearAt + entranceDur) {
        const progress = (time - appearAt) / entranceDur;
        this.renderer.setAnchorEntranceState(anchor.id, progress, entrancePreset);
      } else if (time < disappearAt - exitDur) {
        this.renderer.setAnchorEntranceState(anchor.id, 1, entrancePreset);
      } else if (time < disappearAt) {
        const progress = 1 - (time - (disappearAt - exitDur)) / exitDur;
        this.renderer.setAnchorEntranceState(anchor.id, progress, exitPreset);
      } else {
        this.renderer.setAnchorEntranceState(anchor.id, 0, exitPreset);
      }
    }
  }

  private evaluateAnchorAnimations(time: number) {
    const results = this.anchorAnimController.evaluate(time);
    const anchorIds = new Set(this.anchorsRef.current.map(a => a.id));
    results.forEach((result, id) => {
      if (!anchorIds.has(id)) return;
      try {
        this.renderer.setAnchorPosition(id, result.position);
        if (result.rotation) {
          this.renderer.setAnchorRotation(id, result.rotation);
        }
      } catch { /* anchor may have been removed from renderer */ }
    });
  }

  private tick = () => {
    if (!this._isPlaying) return;
    this.animId = requestAnimationFrame(this.tick);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this._currentTime += dt * this._speed;
    const duration = this.activeDuration;

    if (this._currentTime >= duration) {
      if (this._loop) {
        this._currentTime = this._currentTime % duration;
      } else {
        this._currentTime = duration;
        this._isPlaying = false;
        cancelAnimationFrame(this.animId);
        this.resumeControlsAfterPlayback();
      }
    }

    this.applySample();
    this.emit();
  };

  dispose() {
    this._isPlaying = false;
    cancelAnimationFrame(this.animId);
  }
}
