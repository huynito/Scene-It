import { applyEasing, lerp, shortestAngleLerp } from "./camera-path";
import type { EasingType } from "./camera-path";

export interface AnchorKeyframe {
  time: number;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  easing: EasingType;
}

export interface AnchorAnimation {
  anchorId: string;
  keyframes: AnchorKeyframe[];
}

export function evaluateAnchorAnimation(
  anim: AnchorAnimation,
  time: number
): { position: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number } } | null {
  const kfs = anim.keyframes;
  if (kfs.length === 0) return null;
  if (kfs.length === 1) {
    return { position: { ...kfs[0].position }, rotation: kfs[0].rotation ? { ...kfs[0].rotation } : undefined };
  }

  if (time <= kfs[0].time) {
    return { position: { ...kfs[0].position }, rotation: kfs[0].rotation ? { ...kfs[0].rotation } : undefined };
  }

  const duration = kfs[kfs.length - 1].time;
  time = Math.min(time, duration);

  let i1 = kfs.length - 2;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time <= kfs[i + 1].time) {
      i1 = i;
      break;
    }
  }

  const k1 = kfs[i1];
  const k2 = kfs[i1 + 1];
  const segDuration = k2.time - k1.time;
  const rawT = segDuration > 0 ? (time - k1.time) / segDuration : 0;
  const t = applyEasing(rawT, k2.easing);

  const position = {
    x: lerp(k1.position.x, k2.position.x, t),
    y: lerp(k1.position.y, k2.position.y, t),
    z: lerp(k1.position.z, k2.position.z, t),
  };

  let rotation: { x: number; y: number; z: number } | undefined;
  if (k1.rotation && k2.rotation) {
    rotation = {
      x: shortestAngleLerp(k1.rotation.x, k2.rotation.x, t),
      y: shortestAngleLerp(k1.rotation.y, k2.rotation.y, t),
      z: shortestAngleLerp(k1.rotation.z, k2.rotation.z, t),
    };
  }

  return { position, rotation };
}

export class AnchorAnimationController {
  private animations: Map<string, AnchorAnimation> = new Map();

  addAnimation(anim: AnchorAnimation): void {
    this.animations.set(anim.anchorId, anim);
  }

  removeAnimation(anchorId: string): void {
    this.animations.delete(anchorId);
  }

  evaluate(time: number): Map<string, { position: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number } }> {
    const results = new Map<string, { position: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number } }>();
    this.animations.forEach((anim, id) => {
      const result = evaluateAnchorAnimation(anim, time);
      if (result) results.set(id, result);
    });
    return results;
  }

  clear(): void {
    this.animations.clear();
  }

  has(anchorId: string): boolean {
    return this.animations.has(anchorId);
  }

  hasPlayable(): boolean {
    let found = false;
    this.animations.forEach((anim) => {
      if (anim.keyframes.length >= 2) found = true;
    });
    return found;
  }
}
