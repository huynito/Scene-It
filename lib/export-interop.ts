import type { CameraPath, BakedCameraPath, PathSample } from "./camera-path";
import { evaluatePath, evaluateBakedPath, pathDuration, bakedPathDuration } from "./camera-path";
import type { SceneAnchor } from "./scene-context";

export interface InteropCameraFrame {
  time: number;
  position: { x: number; y: number; z: number };
  rotation: { pitch: number; yaw: number; roll: number };
  fov: number;
}

export interface InteropAnchor {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  width: number;
  height: number;
  appearAt: number | null;
  disappearAt: number | null;
}

export interface InteropScene {
  camera: {
    frames: InteropCameraFrame[];
    fps: number;
    duration: number;
  };
  anchors: InteropAnchor[];
  duration: number;
  fps: number;
}

interface SceneOriginInfo {
  position: { x: number; y: number; z: number };
  yaw: number;
  eyeHeight: number;
}

function toRoomRelativePos(
  world: { x: number; y: number; z: number },
  origin: SceneOriginInfo,
): { x: number; y: number; z: number } {
  const dx = world.x - origin.position.x;
  const dz = world.z - origin.position.z;
  const cos = Math.cos(-origin.yaw);
  const sin = Math.sin(-origin.yaw);
  return {
    x: dx * cos - dz * sin,
    y: world.y - origin.eyeHeight,
    z: dx * sin + dz * cos,
  };
}

export function buildInteropScene(
  path: CameraPath | BakedCameraPath | null,
  anchors: SceneAnchor[],
  fps: number,
  duration: number,
  defaultFov: number,
  sceneOrigin?: SceneOriginInfo,
): InteropScene {
  const origin: SceneOriginInfo = sceneOrigin ?? { position: { x: 0, y: 0, z: 0 }, yaw: 0, eyeHeight: 0 };
  const frames: InteropCameraFrame[] = [];

  if (path) {
    const isBaked = "frames" in path;
    const pathDur = isBaked
      ? bakedPathDuration(path as BakedCameraPath)
      : pathDuration(path as CameraPath);
    const effectiveDur = Math.min(duration, pathDur > 0 ? pathDur : duration);
    const totalFrames = Math.round(effectiveDur * fps);

    for (let f = 0; f <= totalFrames; f++) {
      const time = f / fps;
      let sample: PathSample | null;

      if (isBaked) {
        sample = evaluateBakedPath(path as BakedCameraPath, time);
      } else {
        sample = evaluatePath(path as CameraPath, time);
      }

      if (sample) {
        frames.push({
          time,
          position: toRoomRelativePos(sample.position, origin),
          rotation: { pitch: sample.pitch, yaw: sample.yaw - origin.yaw, roll: 0 },
          fov: sample.fov ?? defaultFov,
        });
      }
    }
  }

  const interopAnchors: InteropAnchor[] = anchors.map((a) => ({
    id: a.id,
    label: a.label,
    position: toRoomRelativePos(a.position, origin),
    rotation: { ...a.rotation },
    scale: a.scale,
    width: a.width,
    height: a.height,
    appearAt: a.appearAt ?? null,
    disappearAt: a.disappearAt ?? null,
  }));

  return {
    camera: { frames, fps, duration },
    anchors: interopAnchors,
    duration,
    fps,
  };
}

// ---- Coordinate system converters ----

export function toAfterEffects(
  scene: InteropScene,
  compWidth: number,
  compHeight: number,
  scale: number,
): { camera: InteropCameraFrame[]; anchors: InteropAnchor[] } {
  const cx = compWidth / 2;
  const cy = compHeight / 2;

  const camera = scene.camera.frames.map((f) => ({
    ...f,
    position: {
      x: f.position.x * scale + cx,
      y: -f.position.y * scale + cy,
      z: -f.position.z * scale,
    },
    rotation: {
      pitch: -(f.rotation.pitch * 180) / Math.PI,
      yaw: -(f.rotation.yaw * 180) / Math.PI,
      roll: 0,
    },
    fov: f.fov,
  }));

  const anchors = scene.anchors.map((a) => ({
    ...a,
    position: {
      x: a.position.x * scale + cx,
      y: -a.position.y * scale + cy,
      z: -a.position.z * scale,
    },
    rotation: {
      x: -(a.rotation.x * 180) / Math.PI,
      y: -(a.rotation.y * 180) / Math.PI,
      z: (a.rotation.z * 180) / Math.PI,
    },
  }));

  return { camera, anchors };
}

export function toUnity(
  scene: InteropScene,
): { camera: InteropCameraFrame[]; anchors: InteropAnchor[] } {
  const camera = scene.camera.frames.map((f) => ({
    ...f,
    position: {
      x: f.position.x,
      y: f.position.y,
      z: -f.position.z,
    },
    rotation: {
      pitch: -(f.rotation.pitch * 180) / Math.PI,
      yaw: (f.rotation.yaw * 180) / Math.PI,
      roll: 0,
    },
  }));

  const anchors = scene.anchors.map((a) => ({
    ...a,
    position: {
      x: a.position.x,
      y: a.position.y,
      z: -a.position.z,
    },
    rotation: {
      x: -(a.rotation.x * 180) / Math.PI,
      y: (a.rotation.y * 180) / Math.PI,
      z: (a.rotation.z * 180) / Math.PI,
    },
  }));

  return { camera, anchors };
}
