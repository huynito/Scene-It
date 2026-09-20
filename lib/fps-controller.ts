import type { SplatRenderer } from "./renderers/types";
import { computeLookAt, shortestAngleLerp } from "./camera-path";

const MOUSE_SENSITIVITY = 0.002;
const KEY_ROTATE_SPEED = 1.35;
const KEY_ROTATE_RAMP = 6;
const DEFAULT_MOVE_SPEED = 1.0;
const LOOK_DAMPING = 15;
const TARGET_BLEND_SPEED = 4;
const MIN_SPEED_MULT = 0.1;
const MAX_SPEED_MULT = 10.0;
const SCROLL_SPEED_FACTOR = 1.15;
const SCROLL_PIXELS_PER_NOTCH = 100;

export const PITCH_LEVEL = 0;
const PITCH_RANGE = (60 * Math.PI) / 180;
const PITCH_MIN = PITCH_LEVEL - PITCH_RANGE;
const PITCH_MAX = PITCH_LEVEL + PITCH_RANGE;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function cameraQuaternion(pitch: number, yaw: number) {
  const cp = Math.cos(pitch / 2),
    sp = Math.sin(pitch / 2);
  const cy = Math.cos(yaw / 2),
    sy = Math.sin(yaw / 2);
  return { x: cy * sp, y: sy * cp, z: -sy * sp, w: cy * cp };
}

function rotateVec(
  vx: number,
  vy: number,
  vz: number,
  q: { x: number; y: number; z: number; w: number }
) {
  const ix = q.w * vx + q.y * vz - q.z * vy;
  const iy = q.w * vy + q.z * vx - q.x * vz;
  const iz = q.w * vz + q.x * vy - q.y * vx;
  const iw = -q.x * vx - q.y * vy - q.z * vz;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

export class FPSController {
  private renderer: SplatRenderer;
  private canvas: HTMLElement;

  yaw: number;
  pitch: number;
  private targetYaw: number;
  private targetPitch: number;
  baseMoveSpeed = DEFAULT_MOVE_SPEED;
  speedMultiplier = 1.0;
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } | null = null;
  collisionFn:
    | ((origin: { x: number; y: number; z: number }, dx: number, dy: number, dz: number) => { x: number; y: number; z: number })
    | null = null;
  onKeyframeRequest: ((key: "K" | "P" | "R") => void) | null = null;
  onOrthoZoom: ((delta: number) => void) | null = null;
  lockY = false;
  eyeHeight = 0;
  targetAnchorPos: { x: number; y: number; z: number } | null = null;
  private targetBlendT = 0;
  private keyRotateRamp = 0;

  private keys = new Set<string>();
  private locked = false;
  private animId = 0;
  private lastTime = 0;
  private disposed = false;
  private _paused = false;

  private handleMouseMove: (e: MouseEvent) => void;
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private handleWheel: (e: WheelEvent) => void;
  private handleClick: () => void;
  private handleLockChange: () => void;

  constructor(
    renderer: SplatRenderer,
    canvas: HTMLElement,
    initialYaw = 0,
    initialPitch = PITCH_LEVEL
  ) {
    this.renderer = renderer;
    this.canvas = canvas;
    this.yaw = initialYaw;
    this.pitch = initialPitch;
    this.targetYaw = initialYaw;
    this.targetPitch = initialPitch;

    this.handleMouseMove = (e: MouseEvent) => {
      if (!this.locked || this.targetAnchorPos) return;
      this.targetYaw -= e.movementX * MOUSE_SENSITIVITY;
      this.targetPitch -= e.movementY * MOUSE_SENSITIVITY;
      this.targetPitch = clamp(this.targetPitch, PITCH_MIN, PITCH_MAX);
    };

    this.handleKeyDown = (e: KeyboardEvent) => {
      if (!this.locked) return;
      e.preventDefault();
      if (this.onKeyframeRequest) {
        if (e.code === "KeyK") { this.onKeyframeRequest("K"); return; }
        if (e.code === "KeyP") { this.onKeyframeRequest("P"); return; }
        if (e.code === "KeyR") { this.onKeyframeRequest("R"); return; }
      }
      this.keys.add(e.code);
    };

    this.handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    this.handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      let deltaPixels = e.deltaY;
      if (e.deltaMode === 1) deltaPixels *= 16;
      else if (e.deltaMode === 2) deltaPixels *= globalThis.innerHeight || 800;
      if (this._paused && this.onOrthoZoom) {
        this.onOrthoZoom(deltaPixels);
        return;
      }
      const notches = deltaPixels / SCROLL_PIXELS_PER_NOTCH;
      const factor = Math.pow(SCROLL_SPEED_FACTOR, -notches);
      this.speedMultiplier = clamp(
        this.speedMultiplier * factor,
        MIN_SPEED_MULT,
        MAX_SPEED_MULT
      );
    };

    this.handleClick = () => {
      if (!this.locked && !this._paused) canvas.requestPointerLock();
    };

    this.handleLockChange = () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
    };

    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);
    canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    canvas.addEventListener("click", this.handleClick);
    document.addEventListener("pointerlockchange", this.handleLockChange);

    this.applyRotation();
    this.lastTime = performance.now();
    this.tick();
  }

  setOrientation(pitch: number, yaw: number) {
    this.pitch = pitch;
    this.yaw = yaw;
    this.targetPitch = pitch;
    this.targetYaw = yaw;
    this.applyRotation();
  }

  private applyRotation() {
    const q = cameraQuaternion(this.pitch, this.yaw);
    this.renderer.setCameraQuaternion(q.x, q.y, q.z, q.w);
  }

  private tick = () => {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.tick);

    if (this._paused) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    const rotating = this.keys.has("ArrowLeft") || this.keys.has("ArrowRight") ||
      this.keys.has("ArrowUp") || this.keys.has("ArrowDown");
    if (rotating) {
      this.keyRotateRamp += (1 - this.keyRotateRamp) * (1 - Math.exp(-KEY_ROTATE_RAMP * dt));
    } else {
      this.keyRotateRamp = 0;
    }
    const rotSpeed = KEY_ROTATE_SPEED * this.keyRotateRamp * dt;
    if (this.keys.has("ArrowLeft")) this.targetYaw += rotSpeed;
    if (this.keys.has("ArrowRight")) this.targetYaw -= rotSpeed;
    if (this.keys.has("ArrowUp")) this.targetPitch += rotSpeed;
    if (this.keys.has("ArrowDown")) this.targetPitch -= rotSpeed;
    this.targetPitch = clamp(this.targetPitch, PITCH_MIN, PITCH_MAX);

    if (this.targetAnchorPos) {
      const pos = this.renderer.getCameraPosition();
      const look = computeLookAt(pos, this.targetAnchorPos);
      this.targetBlendT = Math.min(1, this.targetBlendT + (1 - this.targetBlendT) * (1 - Math.exp(-TARGET_BLEND_SPEED * dt)));
      this.targetPitch = this.pitch + (look.pitch - this.pitch) * this.targetBlendT;
      this.targetYaw = shortestAngleLerp(this.yaw, look.yaw, this.targetBlendT);
    } else if (this.targetBlendT > 0) {
      this.targetBlendT = 0;
    }

    const t = 1 - Math.exp(-LOOK_DAMPING * dt);
    const prevYaw = this.yaw;
    const prevPitch = this.pitch;
    this.yaw += (this.targetYaw - this.yaw) * t;
    this.pitch += (this.targetPitch - this.pitch) * t;
    if (this.yaw !== prevYaw || this.pitch !== prevPitch) {
      this.applyRotation();
    }

    if (this.keys.size === 0) return;

    const speed = this.baseMoveSpeed * this.speedMultiplier * dt;
    const q = cameraQuaternion(this.pitch, this.yaw);
    const fwd = rotateVec(0, 0, -1, q);
    const rgt = rotateVec(1, 0, 0, q);
    const up = rotateVec(0, 1, 0, q);

    let mx = 0,
      my = 0,
      mz = 0;
    if (this.keys.has("KeyW")) {
      mx += fwd.x;
      my += fwd.y;
      mz += fwd.z;
    }
    if (this.keys.has("KeyS")) {
      mx -= fwd.x;
      my -= fwd.y;
      mz -= fwd.z;
    }
    if (this.keys.has("KeyA")) {
      mx -= rgt.x;
      my -= rgt.y;
      mz -= rgt.z;
    }
    if (this.keys.has("KeyD")) {
      mx += rgt.x;
      my += rgt.y;
      mz += rgt.z;
    }
    if (!this.lockY) {
      if (this.keys.has("KeyQ")) {
        mx += up.x;
        my += up.y;
        mz += up.z;
      }
      if (this.keys.has("KeyE")) {
        mx -= up.x;
        my -= up.y;
        mz -= up.z;
      }
    }

    const len = Math.sqrt(mx * mx + my * my + mz * mz);
    if (len === 0) return;
    const s = speed / len;
    mx *= s;
    my *= s;
    mz *= s;

    const pos = this.renderer.getCameraPosition();
    let nx: number, ny: number, nz: number;

    if (this.collisionFn) {
      const clamped = this.collisionFn(pos, mx, my, mz);
      nx = clamped.x;
      ny = clamped.y;
      nz = clamped.z;
    } else {
      nx = pos.x + mx;
      ny = pos.y + my;
      nz = pos.z + mz;
    }

    if (this.lockY) {
      ny = this.eyeHeight;
    }

    if (this.bounds) {
      nx = clamp(nx, this.bounds.min.x, this.bounds.max.x);
      ny = clamp(ny, this.bounds.min.y, this.bounds.max.y);
      nz = clamp(nz, this.bounds.min.z, this.bounds.max.z);
    }

    this.renderer.setCameraPosition(nx, ny, nz);
  };

  get paused() {
    return this._paused;
  }

  pause() {
    this._paused = true;
    this.keys.clear();
    if (this.locked) {
      document.exitPointerLock();
    }
  }

  resume(yaw?: number, pitch?: number) {
    if (yaw != null) {
      this.yaw = yaw;
      this.targetYaw = yaw;
    }
    if (pitch != null) {
      this.pitch = pitch;
      this.targetPitch = pitch;
    }
    this._paused = false;
    this.lastTime = performance.now();
    this.applyRotation();
  }

  resetTo(x: number, y: number, z: number, yaw: number, pitch: number) {
    this.renderer.setCameraPosition(x, y, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.targetYaw = yaw;
    this.targetPitch = pitch;
    this.speedMultiplier = 1.0;
    this.applyRotation();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("click", this.handleClick);
    document.removeEventListener("pointerlockchange", this.handleLockChange);
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }
}
