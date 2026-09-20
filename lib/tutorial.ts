export interface TutorialStep {
  id: string;
  targetSelectors: string[];
  title: string;
  description: string;
  /** Only show this step when one of these modes is active. Omit to show in all modes. */
  modeRelevance?: string[];
  /** CollapsibleSection sectionId to expand for this step (others collapse). */
  sectionId?: string;
  /** RGB triplet for the glow highlight color (space-separated, e.g. "45 212 191"). */
  glowColor: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "viewport-nav",
    targetSelectors: [".ply-canvas-viewport"],
    title: "Fly Mode",
    description:
      "Click the viewport to enter Fly Mode - WASD to move, Mouse/Arrows to Rotate, ESC to exit. Press K to keyframe your current camera Position/Rotation.",
    glowColor: "45 212 191",
  },
  {
    id: "anchors",
    targetSelectors: ["[data-section-id='anchors']"],
    title: "Anchors",
    description:
      "Spatial anchor points are used to map UI onto. Anchors can be positioned freely in 3D space, or leashed to the camera view.",
    sectionId: "anchors",
    glowColor: "56 189 248",
  },
  {
    id: "media-library",
    targetSelectors: ["[data-section-id='media-library']"],
    title: "Media Library",
    description:
      "Upload and manage images, GIFs, videos, and audio assets to attach to anchor points.",
    sectionId: "media-library",
    glowColor: "129 140 248",
  },
  {
    id: "floorplan",
    targetSelectors: ["[data-section-id='floorplan']"],
    title: "Floorplan",
    description:
      "A 2D overview of your scene. See the camera position and collision boundaries at a glance.",
    glowColor: "167 139 250",
  },
  {
    id: "timeline",
    targetSelectors: [".win95-bottom-panel"],
    title: "Timeline",
    description:
      "Your keyframes appear here on a dopesheet. Drag to retime them, and use the playhead to scrub through your animation.",
    glowColor: "232 121 249",
  },
  {
    id: "paths",
    targetSelectors: ["[data-section-id='paths']", "[data-tutorial='paths']"],
    title: "Camera Paths",
    description:
      "Keyframing automatically populates a new path. With at least 2 keyframes, you can instantly generate a realistic walking animation from the Paths panel.",
    sectionId: "paths",
    glowColor: "244 114 182",
  },
  {
    id: "camera-settings",
    targetSelectors: ["[data-section-id='camera']"],
    title: "Camera Settings",
    description:
      "Manually adjust camera position/rotation. Y-Height is locked by default but can be toggled off. Camera FOV, move speed, and depth of field settings can also be adjusted here.",
    sectionId: "camera",
    glowColor: "239 68 68",
  },
  {
    id: "ar-overlay",
    targetSelectors: ["[data-section-id='ar-overlay']"],
    title: "AR Settings",
    description:
      "Control settings for background dimming, blurring, occlusion, and FOV masking.",
    sectionId: "ar-overlay",
    glowColor: "251 146 60",
  },
  {
    id: "post-processing",
    targetSelectors: ["[data-section-id='post-processing']"],
    title: "Post Processing",
    description:
      "Fine-tune exposure, contrast, saturation, and tone mapping for the final look of your scene.",
    sectionId: "post-processing",
    glowColor: "250 204 21",
  },
  {
    id: "reset-clear",
    targetSelectors: ["[data-tutorial='reset-camera']", "[data-tutorial='clear-all']"],
    title: "Reset & Clear",
    description:
      "Reset the camera to its starting position, or clear all anchors, paths, and media to start fresh.",
    glowColor: "163 230 53",
  },
  {
    id: "export",
    targetSelectors: ["[data-tutorial='export']"],
    title: "Export",
    description:
      "Export your animation as MP4 video, GIF, or capture a single frame as PNG/JPG. After Effects and Unity camera path exports are also available.",
    glowColor: "34 211 238",
  },
  {
    id: "themes",
    targetSelectors: ["[data-tutorial='themes']"],
    title: "Themes",
    description:
      "Explore visual themes for a completely different interface and user experience.",
    glowColor: "192 132 252",
  },
];

export function getStepsForMode(modeId: string): TutorialStep[] {
  return TUTORIAL_STEPS.filter(
    (step) => !step.modeRelevance || step.modeRelevance.includes(modeId)
  );
}

const STORAGE_KEY = "sceneit_tutorial_completed";

export function isTutorialCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function markTutorialCompleted(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, "true");
  }
}

export function resetTutorialCompleted(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
