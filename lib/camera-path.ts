// --------------- Bezier Curve Types ---------------

export interface BezierTangent {
  x: number; // time handle (0-1 normalized within segment)
  y: number; // value handle (0-1 normalized within segment)
}

export interface ChannelCurve {
  outTangent: BezierTangent;
  inTangent: BezierTangent;
}

export type ChannelName = "posX" | "posY" | "posZ" | "pitch" | "yaw" | "fov";

export type TangentMode = "auto" | "unified" | "broken" | "linear" | "stepped";

export type ChannelGroup = "position" | "rotation" | "fov";

export const ALL_CHANNEL_GROUPS: ChannelGroup[] = ["position", "rotation", "fov"];

const CHANNEL_GROUP_MAP: Record<ChannelGroup, ChannelName[]> = {
  position: ["posX", "posY", "posZ"],
  rotation: ["pitch", "yaw"],
  fov: ["fov"],
};

export function isChannelKeyed(kf: CameraKeyframe, ch: ChannelName): boolean {
  if (!kf.keyedChannels) return true;
  return kf.keyedChannels.some(g => CHANNEL_GROUP_MAP[g].includes(ch));
}

export function channelGroupForChannel(ch: ChannelName): ChannelGroup {
  if (ch === "posX" || ch === "posY" || ch === "posZ") return "position";
  if (ch === "pitch" || ch === "yaw") return "rotation";
  return "fov";
}

export const CHANNEL_LABELS: Record<ChannelName, string> = {
  posX: "Pos X",
  posY: "Pos Y",
  posZ: "Pos Z",
  pitch: "Rot X",
  yaw: "Rot Y",
  fov: "FOV",
};

export const CHANNEL_COLORS: Record<ChannelName, string> = {
  posX: "#ef4444",
  posY: "#22c55e",
  posZ: "#3b82f6",
  pitch: "#f97316",
  yaw: "#a855f7",
  fov: "#eab308",
};

export interface CameraKeyframe {
  id: string;
  time: number;
  position: { x: number; y: number; z: number };
  target: { pitch: number; yaw: number };
  fov?: number;
  easing: EasingType;
  lookAtAnchorId?: string;
  curves?: Partial<Record<ChannelName, ChannelCurve>>;
  tangentMode?: TangentMode;
  keyedChannels?: ChannelGroup[];
}

export interface LookAtEvent {
  time: number;
  anchorId: string;
  transitionDuration: number;
  easing: EasingType;
  mode?: "lock" | "glance";
  holdDuration?: number;
  releaseDuration?: number;
}

export type EasingType =
  | "linear"
  | "easeInQuad"
  | "easeOutQuad"
  | "easeInOutQuad"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeInOutSine";

export const EASING_LABELS: Record<EasingType, string> = {
  linear: "Linear",
  easeInQuad: "Ease In",
  easeOutQuad: "Ease Out",
  easeInOutQuad: "Ease In-Out",
  easeInCubic: "Cubic In",
  easeOutCubic: "Cubic Out",
  easeInOutCubic: "Cubic In-Out",
  easeInOutSine: "Sine In-Out",
};

export const EASING_TO_BEZIER: Record<EasingType, { out: BezierTangent; in: BezierTangent }> = {
  linear:         { out: { x: 1/3, y: 1/3 }, in: { x: 2/3, y: 2/3 } },
  easeInQuad:     { out: { x: 0.55, y: 0.085 }, in: { x: 0.68, y: 0.53 } },
  easeOutQuad:    { out: { x: 0.25, y: 0.46 }, in: { x: 0.45, y: 0.94 } },
  easeInOutQuad:  { out: { x: 0.455, y: 0.03 }, in: { x: 0.515, y: 0.955 } },
  easeInCubic:    { out: { x: 0.55, y: 0.055 }, in: { x: 0.675, y: 0.19 } },
  easeOutCubic:   { out: { x: 0.215, y: 0.61 }, in: { x: 0.355, y: 1.0 } },
  easeInOutCubic: { out: { x: 0.645, y: 0.045 }, in: { x: 0.355, y: 1.0 } },
  easeInOutSine:  { out: { x: 0.445, y: 0.05 }, in: { x: 0.55, y: 0.95 } },
};

export interface WalkMeta {
  waypoints: { x: number; y: number; z: number }[];
  stylePreset: string;
  speedPreset: string;
  effectiveSpeed: number;
  totalArcLength: number;
  intensity: number;
}

export interface CameraPath {
  id: string;
  name: string;
  keyframes: CameraKeyframe[];
  loop: boolean;
  splineMode: "catmullRom" | "linear";
  lookAtEvents?: LookAtEvent[];
  walkMeta?: WalkMeta;
}

export const DEFAULT_KEYFRAME_GAP = 2;

let _nextId = 0;
export function genId(): string {
  return `kf-${Date.now()}-${_nextId++}`;
}

export function createPath(name = "Path 1"): CameraPath {
  return {
    id: `path-${Date.now()}-${_nextId++}`,
    name,
    keyframes: [],
    loop: false,
    splineMode: "catmullRom",
  };
}

export function addKeyframe(
  path: CameraPath,
  position: { x: number; y: number; z: number },
  pitch: number,
  yaw: number,
  fov?: number,
  currentTime?: number
): CameraPath {
  const TIME_EPSILON = 0.001;
  let time: number;
  if (currentTime != null) {
    time = currentTime;
  } else {
    const last = path.keyframes[path.keyframes.length - 1];
    time = last ? last.time + DEFAULT_KEYFRAME_GAP : 0;
  }

  const existingIdx = path.keyframes.findIndex(k => Math.abs(k.time - time) < TIME_EPSILON);
  if (existingIdx >= 0) {
    const updated = { ...path.keyframes[existingIdx], position: { ...position }, target: { pitch, yaw }, fov };
    return {
      ...path,
      keyframes: path.keyframes.map((k, i) => i === existingIdx ? updated : k),
    };
  }

  const kf: CameraKeyframe = {
    id: genId(),
    time,
    position: { ...position },
    target: { pitch, yaw },
    fov,
    easing: "linear",
  };
  return { ...path, keyframes: [...path.keyframes, kf].sort((a, b) => a.time - b.time) };
}

export function addChannelKeyframe(
  path: CameraPath,
  time: number,
  position: { x: number; y: number; z: number },
  pitch: number,
  yaw: number,
  fov: number | undefined,
  groups: ChannelGroup[]
): CameraPath {
  const TIME_EPSILON = 0.001;
  const existingIdx = path.keyframes.findIndex(k => Math.abs(k.time - time) < TIME_EPSILON);

  if (existingIdx >= 0) {
    const existing = path.keyframes[existingIdx];
    const currentGroups = existing.keyedChannels ?? [...ALL_CHANNEL_GROUPS];
    const merged = Array.from(new Set([...currentGroups, ...groups])) as ChannelGroup[];

    const updated = { ...existing, keyedChannels: merged };
    if (groups.includes("position")) updated.position = { ...position };
    if (groups.includes("rotation")) updated.target = { pitch, yaw };
    if (groups.includes("fov")) updated.fov = fov;

    return {
      ...path,
      keyframes: path.keyframes.map((k, i) => i === existingIdx ? updated : k),
    };
  }

  const kf: CameraKeyframe = {
    id: genId(),
    time,
    position: { ...position },
    target: { pitch, yaw },
    fov,
    easing: "linear",
    keyedChannels: groups,
  };

  return {
    ...path,
    keyframes: [...path.keyframes, kf].sort((a, b) => a.time - b.time),
  };
}

export function removeKeyframe(path: CameraPath, id: string): CameraPath {
  return { ...path, keyframes: path.keyframes.filter((k) => k.id !== id) };
}

export function syncLookAtEventTimes(path: CameraPath): CameraPath {
  if (!path.lookAtEvents || path.lookAtEvents.length === 0) return path;
  const kfMap = new Map(path.keyframes.map(kf => [kf.id, kf]));
  const updated = path.lookAtEvents.map(evt => {
    const kf = path.keyframes.find(k => k.lookAtAnchorId === evt.anchorId && kfMap.has(k.id));
    return kf ? { ...evt, time: kf.time } : evt;
  });
  return { ...path, lookAtEvents: updated };
}

export function pathDuration(path: CameraPath): number {
  if (path.keyframes.length === 0) return 0;
  return path.keyframes[path.keyframes.length - 1].time;
}

export function setPathDuration(path: CameraPath, newDuration: number): CameraPath {
  const currentDuration = pathDuration(path);
  if (currentDuration <= 0 || newDuration <= 0) return path;
  const scale = newDuration / currentDuration;
  return {
    ...path,
    keyframes: path.keyframes.map((kf) => ({
      ...kf,
      time: kf.time * scale,
    })),
  };
}

// --------------- Easing ---------------

export function applyEasing(t: number, type: EasingType): number {
  switch (type) {
    case "linear":
      return t;
    case "easeInQuad":
      return t * t;
    case "easeOutQuad":
      return 1 - (1 - t) * (1 - t);
    case "easeInOutQuad":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "easeInCubic":
      return t * t * t;
    case "easeOutCubic":
      return 1 - Math.pow(1 - t, 3);
    case "easeInOutCubic":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case "easeInOutSine":
      return -(Math.cos(Math.PI * t) - 1) / 2;
    default:
      return t;
  }
}

// --------------- Cubic Bezier ---------------

export function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function evaluateChannelBezier(
  v0: number,
  v1: number,
  outTangent: BezierTangent,
  inTangent: BezierTangent,
  t: number
): number {
  const cp1 = v0 + (v1 - v0) * outTangent.y;
  const cp2 = v0 + (v1 - v0) * inTangent.y;
  return cubicBezier(v0, cp1, cp2, v1, t);
}

function evaluateTimingBezier(
  outTangent: BezierTangent,
  inTangent: BezierTangent,
  t: number,
  iterations = 8
): number {
  const targetX = t;
  let lo = 0, hi = 1;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const x = cubicBezier(0, outTangent.x, inTangent.x, 1, mid);
    if (x < targetX) lo = mid;
    else hi = mid;
  }
  const param = (lo + hi) / 2;
  return cubicBezier(0, outTangent.y, inTangent.y, 1, param);
}

export function getChannelValue(kf: CameraKeyframe, ch: ChannelName): number {
  switch (ch) {
    case "posX": return kf.position.x;
    case "posY": return kf.position.y;
    case "posZ": return kf.position.z;
    case "pitch": return kf.target.pitch;
    case "yaw": return kf.target.yaw;
    case "fov": return kf.fov ?? 36;
  }
}

export function evaluateChannelAtTime(
  k1: CameraKeyframe,
  k2: CameraKeyframe,
  channel: ChannelName,
  rawT: number
): number | null {
  const c1 = k1.curves?.[channel];
  const c2 = k2.curves?.[channel];
  if (!c1 && !c2) return null;

  const out = c1?.outTangent ?? { x: 1/3, y: 1/3 };
  const inp = c2?.inTangent ?? { x: 2/3, y: 2/3 };

  if (k1.tangentMode === "stepped") {
    return getChannelValue(k1, channel);
  }

  const v0 = getChannelValue(k1, channel);
  const v1 = getChannelValue(k2, channel);
  const t = evaluateTimingBezier(out, inp, rawT);
  return lerp(v0, v1, t);
}

export function autoSmoothTangents(
  prev: CameraKeyframe | null,
  current: CameraKeyframe,
  next: CameraKeyframe | null,
  channel: ChannelName
): ChannelCurve {
  const vCurr = getChannelValue(current, channel);
  const vPrev = prev ? getChannelValue(prev, channel) : vCurr;
  const vNext = next ? getChannelValue(next, channel) : vCurr;

  const tCurr = current.time;
  const tPrev = prev?.time ?? tCurr;
  const tNext = next?.time ?? tCurr;

  const dtIn = tCurr - tPrev;
  const dtOut = tNext - tCurr;
  const totalDt = dtIn + dtOut;

  if (totalDt === 0) {
    return { inTangent: { x: 2/3, y: 2/3 }, outTangent: { x: 1/3, y: 1/3 } };
  }

  const slope = (vNext - vPrev) / totalDt;
  const inY = dtIn > 0 ? Math.max(0, Math.min(1, 0.5 + (slope * dtIn * -0.5) / (vCurr - vPrev || 1))) : 2/3;
  const outY = dtOut > 0 ? Math.max(0, Math.min(1, (slope * dtOut * 0.5) / (vNext - vCurr || 1))) : 1/3;

  return {
    inTangent: { x: 2/3, y: isFinite(inY) ? inY : 2/3 },
    outTangent: { x: 1/3, y: isFinite(outY) ? outY : 1/3 },
  };
}

// --------------- Catmull-Rom ---------------

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
}

function catmullRom3D(
  p0: { x: number; y: number; z: number },
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  p3: { x: number; y: number; z: number },
  t: number
): { x: number; y: number; z: number } {
  return {
    x: catmullRom1D(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullRom1D(p0.y, p1.y, p2.y, p3.y, t),
    z: catmullRom1D(p0.z, p1.z, p2.z, p3.z, t),
  };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function shortestAngleLerp(from: number, to: number, t: number): number {
  let diff = to - from;
  diff = diff - Math.round(diff / (2 * Math.PI)) * (2 * Math.PI);
  return from + diff * t;
}

// --------------- Per-Channel Keyframe Pair Lookup ---------------

interface KeyedPair {
  k1: CameraKeyframe;
  k2: CameraKeyframe;
  rawT: number;
  keyedKfs: CameraKeyframe[];
  idx1: number;
  idx2: number;
}

function findKeyedPair(
  kfs: CameraKeyframe[],
  time: number,
  channel: ChannelName
): KeyedPair | null {
  const keyed = kfs.filter(kf => isChannelKeyed(kf, channel));
  if (keyed.length === 0) return null;
  if (keyed.length === 1) {
    return { k1: keyed[0], k2: keyed[0], rawT: 0, keyedKfs: keyed, idx1: 0, idx2: 0 };
  }

  let idx1 = 0;
  for (let i = 0; i < keyed.length - 1; i++) {
    if (time >= keyed[i].time && time <= keyed[i + 1].time) {
      idx1 = i;
      break;
    }
    if (i === keyed.length - 2) idx1 = i;
  }
  const idx2 = idx1 + 1;
  const k1 = keyed[idx1];
  const k2 = keyed[idx2];
  const seg = k2.time - k1.time;
  const rawT = seg > 0 ? (time - k1.time) / seg : 0;
  return { k1, k2, rawT, keyedKfs: keyed, idx1, idx2 };
}

function evaluateChannelValue(
  kfs: CameraKeyframe[],
  time: number,
  channel: ChannelName,
  splineMode: "catmullRom" | "linear"
): number | null {
  const pair = findKeyedPair(kfs, time, channel);
  if (!pair) return null;
  const { k1, k2, rawT, keyedKfs, idx1, idx2 } = pair;

  if (k1 === k2) return getChannelValue(k1, channel);

  if (k1.curves || k2.curves) {
    const bVal = evaluateChannelAtTime(k1, k2, channel, rawT);
    if (bVal != null) return bVal;
  }

  const t = applyEasing(rawT, k2.easing);

  const isPos = channel === "posX" || channel === "posY" || channel === "posZ";
  if (splineMode === "catmullRom" && isPos) {
    const p0 = keyedKfs[Math.max(0, idx1 - 1)];
    const p3 = keyedKfs[Math.min(keyedKfs.length - 1, idx2 + 1)];
    return catmullRom1D(
      getChannelValue(p0, channel),
      getChannelValue(k1, channel),
      getChannelValue(k2, channel),
      getChannelValue(p3, channel),
      t
    );
  }

  const v1 = getChannelValue(k1, channel);
  const v2 = getChannelValue(k2, channel);
  if (channel === "yaw") return shortestAngleLerp(v1, v2, t);
  return lerp(v1, v2, t);
}

// --------------- Evaluate Path ---------------

export interface PathSample {
  position: { x: number; y: number; z: number };
  pitch: number;
  yaw: number;
  fov: number | undefined;
}

export function evaluatePath(path: CameraPath, time: number): PathSample | null {
  const kfs = path.keyframes;
  if (kfs.length === 0) return null;
  if (kfs.length === 1) {
    return {
      position: { ...kfs[0].position },
      pitch: kfs[0].target.pitch,
      yaw: kfs[0].target.yaw,
      fov: kfs[0].fov,
    };
  }

  const duration = pathDuration(path);
  if (path.loop && duration > 0) {
    time = ((time % duration) + duration) % duration;
  } else {
    time = Math.max(0, Math.min(time, duration));
  }

  const hasPartialKeying = kfs.some(kf => kf.keyedChannels != null);

  if (hasPartialKeying) {
    const posX = evaluateChannelValue(kfs, time, "posX", path.splineMode);
    const posY = evaluateChannelValue(kfs, time, "posY", path.splineMode);
    const posZ = evaluateChannelValue(kfs, time, "posZ", path.splineMode);
    const pitch = evaluateChannelValue(kfs, time, "pitch", path.splineMode);
    const yaw = evaluateChannelValue(kfs, time, "yaw", path.splineMode);
    const fovVal = evaluateChannelValue(kfs, time, "fov", path.splineMode);
    return {
      position: { x: posX ?? 0, y: posY ?? 0, z: posZ ?? 0 },
      pitch: pitch ?? 0,
      yaw: yaw ?? 0,
      fov: fovVal ?? undefined,
    };
  }

  // Fast path: all keyframes have all channels keyed (original algorithm)
  let i1 = 0;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time <= kfs[i + 1].time) {
      i1 = i;
      break;
    }
    if (i === kfs.length - 2) i1 = i;
  }
  const i2 = i1 + 1;

  const k1 = kfs[i1];
  const k2 = kfs[i2];
  const segDuration = k2.time - k1.time;
  const rawT = segDuration > 0 ? (time - k1.time) / segDuration : 0;

  const hasCurves = k1.curves || k2.curves;

  let position: { x: number; y: number; z: number };

  if (hasCurves) {
    const bPosX = evaluateChannelAtTime(k1, k2, "posX", rawT);
    const bPosY = evaluateChannelAtTime(k1, k2, "posY", rawT);
    const bPosZ = evaluateChannelAtTime(k1, k2, "posZ", rawT);
    const fallbackT = applyEasing(rawT, k2.easing);
    position = {
      x: bPosX ?? (path.splineMode === "catmullRom"
        ? catmullRom1D(
            kfs[Math.max(0, i1 - 1)].position.x, k1.position.x,
            k2.position.x, kfs[Math.min(kfs.length - 1, i2 + 1)].position.x, fallbackT)
        : lerp(k1.position.x, k2.position.x, fallbackT)),
      y: bPosY ?? (path.splineMode === "catmullRom"
        ? catmullRom1D(
            kfs[Math.max(0, i1 - 1)].position.y, k1.position.y,
            k2.position.y, kfs[Math.min(kfs.length - 1, i2 + 1)].position.y, fallbackT)
        : lerp(k1.position.y, k2.position.y, fallbackT)),
      z: bPosZ ?? (path.splineMode === "catmullRom"
        ? catmullRom1D(
            kfs[Math.max(0, i1 - 1)].position.z, k1.position.z,
            k2.position.z, kfs[Math.min(kfs.length - 1, i2 + 1)].position.z, fallbackT)
        : lerp(k1.position.z, k2.position.z, fallbackT)),
    };
  } else {
    const t = applyEasing(rawT, k2.easing);
    if (path.splineMode === "catmullRom") {
      const p0 = kfs[Math.max(0, i1 - 1)].position;
      const p1 = k1.position;
      const p2 = k2.position;
      const p3 = kfs[Math.min(kfs.length - 1, i2 + 1)].position;
      position = catmullRom3D(p0, p1, p2, p3, t);
    } else {
      position = {
        x: lerp(k1.position.x, k2.position.x, t),
        y: lerp(k1.position.y, k2.position.y, t),
        z: lerp(k1.position.z, k2.position.z, t),
      };
    }
  }

  const fallbackT = applyEasing(rawT, k2.easing);
  const bPitch = hasCurves ? evaluateChannelAtTime(k1, k2, "pitch", rawT) : null;
  const bYaw = hasCurves ? evaluateChannelAtTime(k1, k2, "yaw", rawT) : null;
  const bFov = hasCurves ? evaluateChannelAtTime(k1, k2, "fov", rawT) : null;

  const pitch = bPitch ?? lerp(k1.target.pitch, k2.target.pitch, fallbackT);
  const yaw = bYaw ?? shortestAngleLerp(k1.target.yaw, k2.target.yaw, fallbackT);
  const fov = bFov ?? (
    k1.fov != null && k2.fov != null ? lerp(k1.fov, k2.fov, fallbackT) : k1.fov ?? k2.fov
  );

  return { position, pitch, yaw, fov };
}

// --------------- Sampling for visualization ---------------

export function samplePathPositions(
  path: CameraPath,
  numSamples = 100
): { x: number; y: number; z: number }[] {
  const duration = pathDuration(path);
  if (duration <= 0 || path.keyframes.length < 2) return [];
  const points: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = (i / numSamples) * duration;
    const sample = evaluatePath(path, t);
    if (sample) points.push(sample.position);
  }
  return points;
}

// --------------- Serialization ---------------

export function serializePath(path: CameraPath): string {
  return JSON.stringify(path, null, 2);
}

export function deserializePath(json: string): CameraPath | null {
  try {
    const obj = JSON.parse(json);
    if (!obj.id || !Array.isArray(obj.keyframes)) return null;
    return obj as CameraPath;
  } catch {
    return null;
  }
}

// --------------- GSV Exchange Format ---------------

export interface GsvExchangeKeyframe {
  time: number;
  position: { x: number; y: number; z: number };
  rotation: { pitch: number; yaw: number };
  fov?: number;
  curves?: Partial<Record<ChannelName, ChannelCurve>>;
  tangentMode?: TangentMode;
}

export interface GsvExchangeFormat {
  format: "gsv-camera";
  version: number;
  name: string;
  fps: number;
  duration: number;
  source?: string;
  keyframes?: GsvExchangeKeyframe[];
  frames?: BakedFrame[];
  loop?: boolean;
}

export function deserializeExchangeFormat(json: string): CameraPath | BakedCameraPath | null {
  try {
    const obj = JSON.parse(json);
    if (obj.format !== "gsv-camera") return null;

    if (Array.isArray(obj.keyframes) && obj.keyframes.length > 0) {
      const keyframes: CameraKeyframe[] = obj.keyframes.map((kf: GsvExchangeKeyframe, i: number) => ({
        id: genId(),
        time: kf.time,
        position: { ...kf.position },
        target: { pitch: kf.rotation.pitch, yaw: kf.rotation.yaw },
        fov: kf.fov,
        easing: "linear" as EasingType,
        curves: kf.curves,
        tangentMode: kf.tangentMode ?? (kf.curves ? "broken" : undefined),
      }));
      return {
        id: `path-${Date.now()}`,
        name: obj.name || "Imported Path",
        keyframes,
        loop: obj.loop ?? false,
        splineMode: "linear",
      } satisfies CameraPath;
    }

    if (Array.isArray(obj.frames) && obj.frames.length > 0) {
      return {
        id: `baked-${Date.now()}`,
        name: obj.name || "Imported Path",
        fps: obj.fps || 30,
        frames: obj.frames,
        loop: obj.loop ?? false,
      } satisfies BakedCameraPath;
    }

    return null;
  } catch {
    return null;
  }
}

// --------------- Baked Camera Path ---------------

export interface BakedFrame {
  time: number;
  position: { x: number; y: number; z: number };
  rotation: { pitch: number; yaw: number };
  fov?: number;
}

export interface BakedCameraPath {
  id: string;
  name: string;
  fps: number;
  frames: BakedFrame[];
  loop: boolean;
}

export function bakedPathDuration(path: BakedCameraPath): number {
  if (path.frames.length === 0) return 0;
  return path.frames[path.frames.length - 1].time;
}

export function evaluateBakedPath(path: BakedCameraPath, time: number): PathSample | null {
  const frames = path.frames;
  if (frames.length === 0) return null;
  if (frames.length === 1) {
    const f = frames[0];
    return { position: { ...f.position }, pitch: f.rotation.pitch, yaw: f.rotation.yaw, fov: f.fov };
  }

  const duration = bakedPathDuration(path);
  if (path.loop && duration > 0) {
    time = ((time % duration) + duration) % duration;
  } else {
    time = Math.max(0, Math.min(time, duration));
  }

  let lo = 0, hi = frames.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].time <= time) lo = mid;
    else hi = mid;
  }

  const f1 = frames[lo];
  const f2 = frames[hi];
  const segDur = f2.time - f1.time;
  const t = segDur > 0 ? (time - f1.time) / segDur : 0;

  return {
    position: {
      x: lerp(f1.position.x, f2.position.x, t),
      y: lerp(f1.position.y, f2.position.y, t),
      z: lerp(f1.position.z, f2.position.z, t),
    },
    pitch: lerp(f1.rotation.pitch, f2.rotation.pitch, t),
    yaw: lerp(f1.rotation.yaw, f2.rotation.yaw, t),
    fov: f1.fov != null && f2.fov != null ? lerp(f1.fov, f2.fov, t) : f1.fov ?? f2.fov,
  };
}

export function deserializeBakedPath(json: string): BakedCameraPath | null {
  try {
    const obj = JSON.parse(json);
    if (!obj.frames || !Array.isArray(obj.frames) || obj.frames.length === 0) return null;
    if (typeof obj.frames[0].rotation?.pitch !== "number") return null;
    return {
      id: obj.id || `baked-${Date.now()}`,
      name: obj.name || "Baked Import",
      fps: obj.fps || 30,
      frames: obj.frames,
      loop: obj.loop ?? false,
    };
  } catch {
    return null;
  }
}

// --------------- Look-At ---------------

export function computeLookAt(
  cameraPos: { x: number; y: number; z: number },
  targetPos: { x: number; y: number; z: number }
): { pitch: number; yaw: number } {
  const dx = targetPos.x - cameraPos.x;
  const dy = targetPos.y - cameraPos.y;
  const dz = targetPos.z - cameraPos.z;
  const distXZ = Math.sqrt(dx * dx + dz * dz);
  // Camera forward = (-sin(yaw)*cos(pitch), sin(pitch), -cos(yaw)*cos(pitch))
  const pitch = Math.atan2(dy, distXZ);
  const yaw = Math.atan2(-dx, -dz);
  return { pitch, yaw };
}

export function evaluateLookAt(
  events: LookAtEvent[],
  time: number,
  defaultPitch: number,
  defaultYaw: number,
  anchorPositions: Map<string, { x: number; y: number; z: number }>,
  cameraPos: { x: number; y: number; z: number }
): { pitch: number; yaw: number } | null {
  if (!events || events.length === 0) return null;

  const sorted = [...events].sort((a, b) => a.time - b.time);
  let active: LookAtEvent | null = null;
  let prev: LookAtEvent | null = null;

  for (let i = 0; i < sorted.length; i++) {
    if (time >= sorted[i].time) {
      active = sorted[i];
      prev = i > 0 ? sorted[i - 1] : null;
    }
  }

  if (!active) return null;

  const targetPos = anchorPositions.get(active.anchorId);
  if (!targetPos) return null;

  const target = computeLookAt(cameraPos, targetPos);
  const mode = active.mode ?? "lock";
  const elapsed = time - active.time;

  // Compute the "from" rotation (previous event's target, or keyframed default)
  const fromPitch = prev
    ? (() => {
        const prevPos = anchorPositions.get(prev.anchorId);
        return prevPos ? computeLookAt(cameraPos, prevPos).pitch : defaultPitch;
      })()
    : defaultPitch;
  const fromYaw = prev
    ? (() => {
        const prevPos = anchorPositions.get(prev.anchorId);
        return prevPos ? computeLookAt(cameraPos, prevPos).yaw : defaultYaw;
      })()
    : defaultYaw;

  if (mode === "lock") {
    if (elapsed >= active.transitionDuration) return target;

    const rawT = elapsed / active.transitionDuration;
    const t = applyEasing(rawT, active.easing);
    return {
      pitch: lerp(fromPitch, target.pitch, t),
      yaw: shortestAngleLerp(fromYaw, target.yaw, t),
    };
  }

  // Glance mode: transition → hold → release → null
  const holdDur = active.holdDuration ?? 1.0;
  const releaseDur = active.releaseDuration ?? 0.8;
  const transDur = active.transitionDuration;

  if (elapsed < transDur) {
    // Phase 1: blend toward anchor
    const rawT = elapsed / transDur;
    const t = applyEasing(rawT, active.easing);
    return {
      pitch: lerp(fromPitch, target.pitch, t),
      yaw: shortestAngleLerp(fromYaw, target.yaw, t),
    };
  }

  if (elapsed < transDur + holdDur) {
    // Phase 2: hold on anchor
    return target;
  }

  if (elapsed < transDur + holdDur + releaseDur) {
    // Phase 3: blend back to keyframed rotation
    const releaseElapsed = elapsed - transDur - holdDur;
    const rawT = releaseElapsed / releaseDur;
    const t = applyEasing(rawT, active.easing);
    return {
      pitch: lerp(target.pitch, defaultPitch, t),
      yaw: shortestAngleLerp(target.yaw, defaultYaw, t),
    };
  }

  // Phase 4: glance complete — keyframed rotation takes over
  return null;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
