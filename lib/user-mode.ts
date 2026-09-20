import type { BillboardMode } from "./scene-context";

export interface UserMode {
  id: string;
  label: string;
  tagline: string;
  description: string;
  icon: "monitor" | "smartphone" | "compass";
  defaultAnchorSettings: {
    leashed: boolean;
    leashDistance: number;
    billboardMode: BillboardMode;
    scale: number;
  };
  /** Which CollapsibleSection IDs start expanded vs collapsed. */
  panelDefaults: {
    expanded: string[];
    collapsed: string[];
  };
  /** Feature IDs highlighted during the tutorial for this mode. */
  suggestedFeatures: string[];
  defaultCompDuration: number;
}

export const USER_MODES: Record<string, UserMode> = {
  "leashed-ar": {
    id: "leashed-ar",
    label: "Leashed AR",
    tagline: "HUD overlays",
    description:
      "UI panels follow the camera. Best for heads-up overlays and persistent HUD elements.",
    icon: "smartphone",
    defaultAnchorSettings: {
      leashed: true,
      leashDistance: 2,
      billboardMode: "full",
      scale: 0.85,
    },
    panelDefaults: {
      expanded: ["anchors", "camera", "ar-overlay"],
      collapsed: ["media-library", "post-processing", "paths"],
    },
    suggestedFeatures: [
      "viewport-nav",
      "anchors",
      "leash-controls",
      "ar-overlay",
      "keyframe",
      "export",
    ],
    defaultCompDuration: 5,
  },
  "world-locked": {
    id: "world-locked",
    label: "World-Locked AR",
    tagline: "Spatial content",
    description:
      "Anchor points positioned in 3D space independently of the camera. Best for spatial content.",
    icon: "compass",
    defaultAnchorSettings: {
      leashed: false,
      leashDistance: 2,
      billboardMode: "y-axis",
      scale: 1,
    },
    panelDefaults: {
      expanded: ["anchors", "paths", "camera"],
      collapsed: ["media-library", "ar-overlay", "post-processing"],
    },
    suggestedFeatures: [
      "viewport-nav",
      "anchors",
      "anchor-positioning",
      "camera-target",
      "paths",
      "minimap",
      "keyframe",
      "export",
    ],
    defaultCompDuration: 8,
  },
  explore: {
    id: "explore",
    label: "Explore",
    tagline: "All features",
    description:
      "Full access to every feature with no opinionated defaults. For advanced users or free exploration.",
    icon: "monitor",
    defaultAnchorSettings: {
      leashed: false,
      leashDistance: 2,
      billboardMode: "full",
      scale: 1,
    },
    panelDefaults: {
      expanded: ["anchors", "camera"],
      collapsed: [],
    },
    suggestedFeatures: [
      "viewport-nav",
      "keyframe",
      "timeline",
      "paths",
      "anchors",
      "camera-settings",
      "ar-overlay",
      "post-processing",
      "export",
    ],
    defaultCompDuration: 5,
  },
};

export const USER_MODE_IDS = Object.keys(USER_MODES) as string[];
export const DEFAULT_MODE_ID = "explore";

export function getUserMode(id: string | null): UserMode {
  return USER_MODES[id ?? DEFAULT_MODE_ID] ?? USER_MODES[DEFAULT_MODE_ID];
}
