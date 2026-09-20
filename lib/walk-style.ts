import type {
  CameraPath,
  CameraKeyframe,
  ChannelGroup,
  EasingType,
  WalkMeta,
} from "./camera-path";
import { genId } from "./camera-path";

// ---- Types ----

export interface WalkStyleProfile {
  name: string;
  description: string;
  bobScale: number;
  swayScale: number;
  pitchScale: number;
  yawScale: number;
  noiseScale: number;
  speedVariation: number;
  turnAnticipation: number;
  turnSpeedFactor: number;
  accelDuration: number;
  decelDuration: number;
  sampleRate: number;
}

export type WalkSpeedPreset = "slow" | "medium" | "fast";

// ---- Style Presets ----

export const WALK_STYLES: Record<string, WalkStyleProfile> = {
  casual: {
    name: "Casual",
    description: "Select a path to generate realistic walking and head movement",
    bobScale: 1.0,
    swayScale: 1.0,
    pitchScale: 1.0,
    yawScale: 1.0,
    noiseScale: 1.0,
    speedVariation: 0.05,
    turnAnticipation: 0.3,
    turnSpeedFactor: 0.7,
    accelDuration: 0.8,
    decelDuration: 0.6,
    sampleRate: 8,
  },
  steadicam: {
    name: "Cinematic Steadicam",
    description: "Smooth stabilized camera on a dolly or gimbal",
    bobScale: 0.2,
    swayScale: 0.1,
    pitchScale: 0.15,
    yawScale: 0.1,
    noiseScale: 0.3,
    speedVariation: 0.02,
    turnAnticipation: 0.5,
    turnSpeedFactor: 0.8,
    accelDuration: 1.2,
    decelDuration: 1.0,
    sampleRate: 8,
  },
  architectural: {
    name: "Architectural Tour",
    description: "Slow measured pace for showcasing spaces",
    bobScale: 0.15,
    swayScale: 0.08,
    pitchScale: 0.1,
    yawScale: 0.08,
    noiseScale: 0.15,
    speedVariation: 0.01,
    turnAnticipation: 0.6,
    turnSpeedFactor: 0.85,
    accelDuration: 1.5,
    decelDuration: 1.2,
    sampleRate: 8,
  },
};

export const WALK_STYLE_IDS = Object.keys(WALK_STYLES) as string[];

// ---- Speed Presets ----

export const WALK_SPEEDS: Record<WalkSpeedPreset, number> = {
  slow: 0.15,
  medium: 0.3,
  fast: 0.5,
};

export const WALK_SPEED_LABELS: Record<WalkSpeedPreset, string> = {
  slow: "Slow",
  medium: "Medium",
  fast: "Fast",
};

export const WALK_SPEED_IDS: WalkSpeedPreset[] = ["slow", "medium", "fast"];

// ---- Biomechanical Reference Functions ----
// Compute "normal human" values from walking speed. Style scale factors are applied on top.

function stepFrequency(speed: number): number {
  // Empirical gait research (Grieve & Gear, 1966)
  return 0.9 + 0.6 * speed;
}

function baseBobAmplitude(speed: number): number {
  return 0.015 + 0.015 * speed;
}

function baseSwayAmplitude(speed: number): number {
  return 0.008 + 0.008 * speed;
}

function basePitchAmplitude(speed: number): number {
  return 0.012 + 0.008 * speed;
}

function baseYawAmplitude(speed: number): number {
  return 0.02 + 0.012 * speed;
}

// ---- Catmull-Rom Spline Utilities ----

type Vec3 = { x: number; y: number; z: number };

function cr1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
}

function cr3D(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  return {
    x: cr1D(p0.x, p1.x, p2.x, p3.x, t),
    y: cr1D(p0.y, p1.y, p2.y, p3.y, t),
    z: cr1D(p0.z, p1.z, p2.z, p3.z, t),
  };
}

function crDeriv1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return 0.5 * (
    (-p0 + p2) +
    2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
    3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t * t
  );
}

function crTangent(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  return {
    x: crDeriv1D(p0.x, p1.x, p2.x, p3.x, t),
    y: crDeriv1D(p0.y, p1.y, p2.y, p3.y, t),
    z: crDeriv1D(p0.z, p1.z, p2.z, p3.z, t),
  };
}

function splineControlPoints(waypoints: Vec3[], seg: number) {
  const n = waypoints.length;
  return {
    p0: waypoints[Math.max(0, seg - 1)],
    p1: waypoints[seg],
    p2: waypoints[Math.min(n - 1, seg + 1)],
    p3: waypoints[Math.min(n - 1, seg + 2)],
  };
}

function evalSpline(waypoints: Vec3[], param: number): Vec3 {
  const segments = waypoints.length - 1;
  const seg = Math.min(Math.floor(param), segments - 1);
  const localT = Math.max(0, Math.min(1, param - seg));
  const { p0, p1, p2, p3 } = splineControlPoints(waypoints, seg);
  return cr3D(p0, p1, p2, p3, localT);
}

function evalSplineTangent(waypoints: Vec3[], param: number): Vec3 {
  const segments = waypoints.length - 1;
  const seg = Math.min(Math.floor(param), segments - 1);
  const localT = Math.max(0, Math.min(1, param - seg));
  const { p0, p1, p2, p3 } = splineControlPoints(waypoints, seg);
  return crTangent(p0, p1, p2, p3, localT);
}

// ---- Arc-Length Parameterization ----
// Maps distance along the spline to the Catmull-Rom parameter space.

interface ArcTable {
  totalLength: number;
  params: number[];
  lengths: number[];
}

function buildArcTable(waypoints: Vec3[], resolution = 1000): ArcTable {
  const n = waypoints.length;
  if (n < 2) return { totalLength: 0, params: [], lengths: [] };

  const segments = n - 1;
  const totalSamples = Math.max(segments * 20, resolution);
  const params: number[] = [0];
  const lengths: number[] = [0];
  let totalLength = 0;
  let prev = { ...waypoints[0] };

  for (let i = 1; i <= totalSamples; i++) {
    const param = (i / totalSamples) * segments;
    const pos = evalSpline(waypoints, param);
    const dx = pos.x - prev.x;
    const dy = pos.y - prev.y;
    const dz = pos.z - prev.z;
    totalLength += Math.sqrt(dx * dx + dy * dy + dz * dz);
    params.push(param);
    lengths.push(totalLength);
    prev = pos;
  }

  return { totalLength, params, lengths };
}

function paramAtDistance(table: ArcTable, distance: number): number {
  const d = Math.max(0, Math.min(distance, table.totalLength));
  let lo = 0, hi = table.lengths.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table.lengths[mid] <= d) lo = mid;
    else hi = mid;
  }
  const segLen = table.lengths[hi] - table.lengths[lo];
  const frac = segLen > 0 ? (d - table.lengths[lo]) / segLen : 0;
  return table.params[lo] + (table.params[hi] - table.params[lo]) * frac;
}

function distanceAtParam(table: ArcTable, param: number): number {
  const p = Math.max(0, Math.min(param, table.params[table.params.length - 1]));
  let lo = 0, hi = table.params.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table.params[mid] <= p) lo = mid;
    else hi = mid;
  }
  const segLen = table.params[hi] - table.params[lo];
  const frac = segLen > 0 ? (p - table.params[lo]) / segLen : 0;
  return table.lengths[lo] + (table.lengths[hi] - table.lengths[lo]) * frac;
}

// ---- Speed Envelope & Distance Integration ----

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function speedEnvelope(
  t: number, duration: number, accelDur: number, decelDur: number,
): number {
  const accel = smoothstep(0, Math.min(accelDur, duration * 0.4), t);
  const decel = smoothstep(0, Math.min(decelDur, duration * 0.4), duration - t);
  return accel * decel;
}

interface DistTable {
  times: number[];
  distances: number[];
}

function buildDistTable(
  duration: number,
  speed: number,
  accelDur: number,
  decelDur: number,
  targetDist: number,
  numSamples = 500,
): DistTable {
  const dt = duration / numSamples;
  const times: number[] = [0];
  const distances: number[] = [0];
  let total = 0;

  for (let i = 1; i <= numSamples; i++) {
    const t = i * dt;
    const env = speedEnvelope(t - dt / 2, duration, accelDur, decelDur);
    total += speed * env * dt;
    times.push(t);
    distances.push(total);
  }

  // Normalize so total distance matches targetDist
  if (total > 0) {
    const scale = targetDist / total;
    for (let i = 0; i < distances.length; i++) distances[i] *= scale;
  }

  return { times, distances };
}

function distAtTime(table: DistTable, t: number): number {
  if (t <= table.times[0]) return table.distances[0];
  if (t >= table.times[table.times.length - 1])
    return table.distances[table.distances.length - 1];

  let lo = 0, hi = table.times.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table.times[mid] <= t) lo = mid;
    else hi = mid;
  }
  const frac = (t - table.times[lo]) / (table.times[hi] - table.times[lo]);
  return table.distances[lo] + (table.distances[hi] - table.distances[lo]) * frac;
}

function timeAtDist(table: DistTable, d: number): number {
  if (d <= table.distances[0]) return table.times[0];
  if (d >= table.distances[table.distances.length - 1])
    return table.times[table.times.length - 1];

  let lo = 0, hi = table.distances.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table.distances[mid] <= d) lo = mid;
    else hi = mid;
  }
  const segLen = table.distances[hi] - table.distances[lo];
  const frac = segLen > 0 ? (d - table.distances[lo]) / segLen : 0;
  return table.times[lo] + (table.times[hi] - table.times[lo]) * frac;
}

// ---- Seeded Deterministic Noise ----
// Hash-based noise that is reproducible for any (seed, integer_index) pair,
// with hermite smoothing for continuous output.

function hashNoise(seed: number, index: number): number {
  let h = (seed ^ (index * 2654435761)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = h ^ (h >>> 16);
  return ((h >>> 0) / 4294967296) * 2 - 1; // -1 to 1
}

function smoothNoise(seed: number, t: number, frequency: number): number {
  const phase = t * frequency;
  const i = Math.floor(phase);
  const f = phase - i;
  const s = f * f * (3 - 2 * f); // hermite
  return hashNoise(seed, i) * (1 - s) + hashNoise(seed, i + 1) * s;
}

function noiseFromWaypoints(waypoints: Vec3[]): number {
  let h = 0;
  for (const w of waypoints) {
    h = ((h * 31) + Math.round(w.x * 1000)) | 0;
    h = ((h * 31) + Math.round(w.y * 1000)) | 0;
    h = ((h * 31) + Math.round(w.z * 1000)) | 0;
  }
  return h >>> 0;
}

// ---- Yaw from tangent (matches camera-path.ts convention) ----

function yawFromTangent(tangent: Vec3): number {
  return Math.atan2(-tangent.x, -tangent.z);
}

// ---- Duration estimation with accel/decel compensation ----

function estimateDuration(
  totalArcLength: number,
  speed: number,
  accelDur: number,
  decelDur: number,
): number {
  let dur = totalArcLength / speed;
  // Iteratively adjust for the distance lost to the accel/decel envelope
  for (let i = 0; i < 4; i++) {
    const dt = dur / 200;
    let integrated = 0;
    for (let j = 0; j < 200; j++) {
      const t = (j + 0.5) * dt;
      integrated += speed * speedEnvelope(t, dur, accelDur, decelDur) * dt;
    }
    if (integrated > 0) dur *= totalArcLength / integrated;
  }
  return dur;
}

// ---- Main Generation Function ----

export function generateWalkPath(
  waypoints: Vec3[],
  style: WalkStyleProfile,
  speed: WalkSpeedPreset | number,
  options?: {
    eyeHeight?: number;
    intensity?: number;
    speedScale?: number;
    rotationHints?: { pitch: number; yaw: number }[];
  },
): CameraPath {
  if (waypoints.length < 2) {
    throw new Error("Need at least 2 waypoints");
  }

  const baseSpeed = typeof speed === "number" ? speed : WALK_SPEEDS[speed];
  const effectiveSpeed = baseSpeed * (options?.speedScale ?? 1);
  const speedPreset = typeof speed === "string" ? speed : "medium";
  const stylePreset =
    Object.entries(WALK_STYLES).find(([, s]) => s === style)?.[0] ?? "casual";

  // 1. Arc-length parameterized spline
  const arcTable = buildArcTable(waypoints);
  const totalArcLength = arcTable.totalLength;
  if (totalArcLength < 0.01) {
    throw new Error("Waypoints are too close together");
  }

  // 2. Duration adjusted for accel/decel
  const duration = estimateDuration(
    totalArcLength, effectiveSpeed, style.accelDuration, style.decelDuration,
  );

  // 3. Biomechanical parameters (reference values scaled by style and intensity)
  const intensity = options?.intensity ?? 1;
  const freq = stepFrequency(effectiveSpeed);
  const bobAmp = baseBobAmplitude(effectiveSpeed) * style.bobScale * intensity;
  const swayAmp = baseSwayAmplitude(effectiveSpeed) * style.swayScale * intensity;
  const pitchAmp = basePitchAmplitude(effectiveSpeed) * style.pitchScale * intensity;
  const yawAmp = baseYawAmplitude(effectiveSpeed) * style.yawScale * intensity;
  const noiseAmp = 0.003 * style.noiseScale * intensity;
  const noiseRotAmp = 0.005 * style.noiseScale * intensity;

  // 4. Distance-at-time table (for speed envelope integration)
  const dTable = buildDistTable(
    duration, effectiveSpeed, style.accelDuration, style.decelDuration,
    totalArcLength,
  );

  // 5. Noise seed (deterministic from waypoints)
  const seed = noiseFromWaypoints(waypoints);

  // 6. Generate dense position keyframes
  const positionKfs: CameraKeyframe[] = [];
  const dt = 1 / style.sampleRate;
  const numSamples = Math.ceil(duration * style.sampleRate);
  const eyeHeight = options?.eyeHeight;

  for (let i = 0; i <= numSamples; i++) {
    const t = Math.min(i * dt, duration);
    const dist = distAtTime(dTable, t);
    const param = paramAtDistance(arcTable, dist);

    const basePos = evalSpline(waypoints, param);
    const tangent = evalSplineTangent(waypoints, param);

    // Forward and right vectors in the XZ plane
    const tLenXZ = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z);
    const fwdX = tLenXZ > 1e-6 ? tangent.x / tLenXZ : 0;
    const fwdZ = tLenXZ > 1e-6 ? tangent.z / tLenXZ : -1;
    const rightX = -fwdZ;
    const rightZ = fwdX;

    // Walking oscillations
    const stepPhase = 2 * Math.PI * freq * t;
    const gaitPhase = 2 * Math.PI * (freq / 2) * t;

    const bob = bobAmp * Math.cos(stepPhase);
    const sway = swayAmp * Math.sin(gaitPhase);

    // Multi-frequency noise for organic imperfection
    const nx =
      smoothNoise(seed, t, 5) * noiseAmp +
      smoothNoise(seed + 100, t, 8) * noiseAmp * 0.4;
    const ny =
      smoothNoise(seed + 200, t, 5) * noiseAmp +
      smoothNoise(seed + 300, t, 8) * noiseAmp * 0.4;
    const nz =
      smoothNoise(seed + 400, t, 5) * noiseAmp +
      smoothNoise(seed + 500, t, 8) * noiseAmp * 0.4;

    positionKfs.push({
      id: genId(),
      time: t,
      position: {
        x: basePos.x + rightX * sway + nx,
        y: (eyeHeight != null ? eyeHeight : basePos.y) + bob + ny,
        z: basePos.z + rightZ * sway + nz,
      },
      target: { pitch: 0, yaw: 0 },
      easing: "linear" as EasingType,
      keyedChannels: ["position"] as ChannelGroup[],
    });
  }

  // 7. Compute waypoint-to-time mapping
  const waypointTimes: number[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    if (i === 0) {
      waypointTimes.push(0);
    } else if (i >= waypoints.length - 1) {
      waypointTimes.push(duration);
    } else {
      const wpDist = distanceAtParam(arcTable, i);
      waypointTimes.push(timeAtDist(dTable, wpDist));
    }
  }

  // 8. Generate rotation keyframes
  const rotationKfs: CameraKeyframe[] = [];
  const hints = options?.rotationHints;

  if (hints && hints.length === waypoints.length) {
    // Use caller-provided rotations (from converted keyframed paths)
    for (let i = 0; i < waypoints.length; i++) {
      const t = waypointTimes[i];
      const stepPhase = 2 * Math.PI * freq * t;
      const gaitPhase = 2 * Math.PI * (freq / 2) * t;
      const headPitch = pitchAmp * Math.cos(stepPhase);
      const headYaw = yawAmp * Math.sin(gaitPhase);
      const pitchNoise = smoothNoise(seed + 600, t, 3) * noiseRotAmp;
      const yawNoise = smoothNoise(seed + 700, t, 3) * noiseRotAmp;

      rotationKfs.push({
        id: genId(),
        time: t,
        position: { x: 0, y: 0, z: 0 },
        target: {
          pitch: hints[i].pitch + headPitch + pitchNoise,
          yaw: hints[i].yaw + headYaw + yawNoise,
        },
        easing: "easeInOutCubic" as EasingType,
        keyedChannels: ["rotation"] as ChannelGroup[],
      });
    }
  } else {
    // Derive rotation from path tangent (minimap waypoint paths)
    for (let i = 0; i < waypoints.length; i++) {
      const t = waypointTimes[i];
      const dist = distAtTime(dTable, t);

      const lookDist = Math.min(
        dist + effectiveSpeed * style.turnAnticipation,
        totalArcLength,
      );
      const lookParam = paramAtDistance(arcTable, lookDist);
      const lookTangent = evalSplineTangent(waypoints, lookParam);

      const yaw = yawFromTangent(lookTangent);
      const basePitch = -0.04;
      const stepPhase = 2 * Math.PI * freq * t;
      const gaitPhase = 2 * Math.PI * (freq / 2) * t;
      const headPitch = pitchAmp * Math.cos(stepPhase);
      const headYaw = yawAmp * Math.sin(gaitPhase);
      const pitchNoise = smoothNoise(seed + 600, t, 3) * noiseRotAmp;
      const yawNoise = smoothNoise(seed + 700, t, 3) * noiseRotAmp;

      rotationKfs.push({
        id: genId(),
        time: t,
        position: { x: 0, y: 0, z: 0 },
        target: { pitch: basePitch + headPitch + pitchNoise, yaw: yaw + headYaw + yawNoise },
        easing: "easeInOutCubic" as EasingType,
        keyedChannels: ["rotation"] as ChannelGroup[],
      });
    }

    // 9. Add turn midpoint rotation keyframes where direction changes significantly
    for (let i = 0; i < waypoints.length - 2; i++) {
      const d1 = {
        x: waypoints[i + 1].x - waypoints[i].x,
        z: waypoints[i + 1].z - waypoints[i].z,
      };
      const d2 = {
        x: waypoints[i + 2].x - waypoints[i + 1].x,
        z: waypoints[i + 2].z - waypoints[i + 1].z,
      };
      const yaw1 = Math.atan2(-d1.x, -d1.z);
      const yaw2 = Math.atan2(-d2.x, -d2.z);
      let dYaw = yaw2 - yaw1;
      dYaw -= Math.round(dYaw / (2 * Math.PI)) * 2 * Math.PI;

      if (Math.abs(dYaw) > 0.3) {
        const midT = (waypointTimes[i + 1] + waypointTimes[i + 2]) / 2;
        const midDist = distAtTime(dTable, midT);
        const lookDist = Math.min(
          midDist + effectiveSpeed * style.turnAnticipation * 0.5,
          totalArcLength,
        );
        const lookParam = paramAtDistance(arcTable, lookDist);
        const lookTangent = evalSplineTangent(waypoints, lookParam);

        rotationKfs.push({
          id: genId(),
          time: midT,
          position: { x: 0, y: 0, z: 0 },
          target: { pitch: -0.04, yaw: yawFromTangent(lookTangent) },
          easing: "easeInOutCubic" as EasingType,
          keyedChannels: ["rotation"] as ChannelGroup[],
        });
      }
    }
  }

  // 10. Merge, sort, return
  const allKfs = [...positionKfs, ...rotationKfs].sort((a, b) => a.time - b.time);

  return {
    id: `path-${Date.now()}`,
    name: "Walk Path",
    keyframes: allKfs,
    loop: false,
    splineMode: "linear",
    walkMeta: {
      waypoints: waypoints.map((w) => ({ ...w })),
      stylePreset,
      speedPreset,
      effectiveSpeed,
      totalArcLength,
      intensity,
    },
  };
}

// ---- Convert keyframed path to walk path ----

export function convertPathToWalk(
  path: CameraPath,
  style: WalkStyleProfile,
  speed: WalkSpeedPreset | number,
  options?: { eyeHeight?: number; intensity?: number; speedScale?: number },
): CameraPath {
  const positionKfs = path.keyframes.filter(
    (kf) => !kf.keyedChannels || kf.keyedChannels.includes("position"),
  );

  if (positionKfs.length < 2) {
    throw new Error("Path needs at least 2 position keyframes to convert");
  }

  const waypoints: Vec3[] = positionKfs.map((kf) => ({ ...kf.position }));
  const rotationHints = positionKfs.map((kf) => ({
    pitch: kf.target.pitch,
    yaw: kf.target.yaw,
  }));

  const walkPath = generateWalkPath(waypoints, style, speed, {
    ...options,
    rotationHints,
  });

  walkPath.id = path.id;
  walkPath.name = path.name;

  if (path.lookAtEvents && path.lookAtEvents.length > 0) {
    const oldDur = path.keyframes.length > 0
      ? path.keyframes[path.keyframes.length - 1].time
      : 1;
    const newDur = walkPath.keyframes.length > 0
      ? walkPath.keyframes[walkPath.keyframes.length - 1].time
      : 1;
    const scale = newDur / Math.max(oldDur, 0.001);
    walkPath.lookAtEvents = path.lookAtEvents.map((evt) => ({
      ...evt,
      time: evt.time * scale,
    }));
  }

  return walkPath;
}

// ---- Retiming (regeneration-based) ----

export interface RetimeResult {
  path: CameraPath;
  warning?: string;
}

export function retimeWalkPath(
  path: CameraPath,
  newDuration: number,
): RetimeResult {
  const meta = path.walkMeta;
  if (!meta) throw new Error("Path has no walkMeta — cannot retime");

  const newSpeed = meta.totalArcLength / newDuration;

  let warning: string | undefined;
  if (newSpeed < 0.3) warning = "Very slow — motion may look unnatural";
  else if (newSpeed > 2.5) warning = "Very fast — motion may look like jogging";

  const style = WALK_STYLES[meta.stylePreset] ?? WALK_STYLES.casual;
  const newPath = generateWalkPath(meta.waypoints, style, newSpeed, {
    intensity: meta.intensity,
  });

  newPath.id = path.id;
  newPath.name = path.name;

  // Re-scale look-at event times proportionally
  if (path.lookAtEvents && path.lookAtEvents.length > 0) {
    const oldKfs = path.keyframes;
    const oldDur =
      oldKfs.length > 0 ? oldKfs[oldKfs.length - 1].time : 1;
    const scale = newDuration / oldDur;
    newPath.lookAtEvents = path.lookAtEvents.map((evt) => ({
      ...evt,
      time: evt.time * scale,
    }));
  }

  return { path: newPath, warning };
}
