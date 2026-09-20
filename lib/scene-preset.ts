import type { CameraPath, CameraKeyframe } from "./camera-path";
import type { SceneAnchor } from "./scene-context";
import type { WalkSpeedPreset } from "./walk-style";

export interface CollisionPolygon {
  points: { x: number; z: number }[];
  type?: "boundary" | "obstacle";
}

export interface CameraPathPreset {
  id: string;
  name: string;
  positions: CameraKeyframe[];
  defaultDuration: number;
}

export interface ScenePreset {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  plyUrl: string;
  /** Number of chunks the PLY was split into for deployment (each <95MB).
   *  When set, loader fetches plyUrl.00, plyUrl.01, ... and concatenates. */
  plyChunks?: number;
  glbUrl?: string;
  /** Number of chunks the GLB was split into for deployment. */
  glbChunks?: number;
  floorplanUrl?: string;
  floorplanTransform: {
    offsetX: number;
    offsetZ: number;
    scale: number;
    rotation: number;
  };
  collisionPolygons: CollisionPolygon[];
  cameraHeightRange: { min: number; max: number };
  initialCamera: {
    position: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
  };
  /** World-space point + yaw that the user considers (0,0,0). Coordinates in
   *  the camera panel are displayed relative to this origin. */
  sceneOrigin?: {
    position: { x: number; y: number; z: number };
    yaw: number;
  };
  /** World-space Y value for default human eye-level camera height.
   *  Displayed as Y=0 in the camera panel. */
  defaultEyeHeight?: number;
  /** Min/max Y offset (relative to eye height) allowed when Y-lock is
   *  disabled. E.g. { min: -0.3, max: 0.3 } = ±30cm from eye level. */
  yClampRange?: { min: number; max: number };
  walkthroughPaths?: CameraPath[];
  /** Position, rotation (euler degrees), and uniform scale for the depth
   *  occlusion GLB mesh. When omitted the mesh loads at identity. */
  meshTransform?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  };
  uiWorldWidth?: number;
  anchors?: SceneAnchor[];
  cameraPathPresets?: CameraPathPreset[];
  comingSoon?: boolean;
  /** Per-scene walk generation defaults. Applied on scene load and used as
   *  the `speedScale` multiplier when generating walk paths. */
  walkDefaults?: {
    walkSpeedPreset?: WalkSpeedPreset;
    walkStylePreset?: string;
    walkIntensity?: number;
    moveSpeed?: number;
    /** Multiplier on WALK_SPEEDS values for this scene's coordinate scale. */
    speedScale?: number;
  };
}

import { publicUrl } from "./utils";

const IS_DEV = process.env.NODE_ENV === "development";

function sceneUrl(sceneId: string, file: string): string {
  return publicUrl(`/scenes/${sceneId}/${file}`);
}

/**
 * Registry of all authored scene presets.
 *
 * To add a new scene:
 * 1. Export the PLY from your training pipeline
 * 2. Host scene.ply and depth.glb on the asset CDN (or place in public/scenes/<id>/ for local dev)
 * 3. Place the thumbnail in public/scenes/<id>/thumb.jpg (small enough to bundle)
 * 4. Define the preset below with collision polygons, height range, and initial camera
 */
export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "scene-a",
    name: "Living Room",
    description: "",
    thumbnail: publicUrl("/scenes/scene-a/thumb.png"),
    plyUrl: sceneUrl("scene-a", "scene.ply"),
    plyChunks: IS_DEV ? undefined : 4,
    glbUrl: sceneUrl("scene-a", "depth.glb"),
    floorplanUrl: sceneUrl("scene-a", "floorplan.png"),
    floorplanTransform: { offsetX: 0, offsetZ: 0, scale: 0.02, rotation: 0 },
    collisionPolygons: [{ points: [{"x":0.5093,"z":-0.9344},{"x":-0.2479,"z":-0.1503},{"x":-0.3938,"z":0.0007},{"x":0.0882,"z":0.4662},{"x":0.4913,"z":0.0631},{"x":0.2539,"z":-0.1662},{"x":0.6499,"z":-0.5762},{"x":0.6777,"z":-0.605},{"x":0.7541,"z":-0.6841},{"x":0.761,"z":-0.6913}] }],
    cameraHeightRange: { min: -0.15, max: 0.05 },
    initialCamera: {
      position: { x: 0.593, y: 0, z: -0.790 },
      yaw: 134 * Math.PI / 180,
      pitch: 0,
    },
    sceneOrigin: {
      position: { x: 0.017, y: 0, z: 0.036 },
      yaw: 134 * Math.PI / 180,
    },
    defaultEyeHeight: 0,
    meshTransform: {
      position: { x: 0.2439, y: 0.006, z: -0.1731 },
      rotation: { x: 0, y: -137.9, z: 0.5 },
      scale: 0.002,
    },
  },
  {
    id: "scene-b",
    name: "Kitchen",
    description: "",
    thumbnail: publicUrl("/scenes/scene-b/thumb.png"),
    plyUrl: sceneUrl("scene-b", "scene.ply"),
    plyChunks: IS_DEV ? undefined : 4,
    glbUrl: sceneUrl("scene-b", "depth.glb"),
    floorplanTransform: { offsetX: 0, offsetZ: 0, scale: 0.02, rotation: 0 },
    collisionPolygons: [{ points: [{"x":-0.0373,"z":-0.9279},{"x":0.8664,"z":-0.0242},{"x":0.1098,"z":0.7324},{"x":-0.6348,"z":-0.0122},{"x":-0.3647,"z":-0.2823},{"x":-0.5238,"z":-0.4414}] }],
    cameraHeightRange: { min: -0.15, max: 0.05 },
    initialCamera: {
      position: { x: -0.4085, y: 0, z: -0.5496 },
      yaw: 225 * Math.PI / 180,
      pitch: 0,
    },
    sceneOrigin: {
      position: { x: -0.190, y: 0, z: -0.300 },
      yaw: 135 * Math.PI / 180,
    },
    defaultEyeHeight: 0,
    meshTransform: {
      position: { x: -0.3412, y: -0.039, z: -0.1852 },
      rotation: { x: 0, y: -131.5, z: -1 },
      scale: 0.0065,
    },
    walkDefaults: {
      speedScale: 0.8,
      moveSpeed: 0.4,
    },
  },
];

export function getPresetById(id: string): ScenePreset | undefined {
  return SCENE_PRESETS.find((p) => p.id === id);
}
