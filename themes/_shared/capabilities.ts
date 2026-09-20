import type { ThemeId } from "./tokens";

/* ── Canvas color maps ── */

export interface CanvasColorMap {
  bg: string;
  grid: string;
  endpointFill: string;
  cameraDot: string;
  collisionStroke: string;
  collisionFill: string;
  penStroke: string;
  walkStroke: string;
  playbackRing: string;
}

export interface GraphColorMap {
  bg: string;
  grid: string;
  label: string;
  zero: string;
  crosshair: string;
  kfEmpty: string;
}

/* ── Theme capabilities ── */

export interface ThemeCapabilities {
  id: ThemeId;

  /** Top-level layout model */
  layoutShell: "stacked" | "xp-desktop" | "winamp-desktop" | "scenit-grid";

  /** How section headers render (CollapsibleSection, SectionHeader) */
  sectionHeaderStyle: "default" | "sciin-terminal" | "aim-titlebar" | "winamp-tab" | "winamp-groove" | "win95-titlebar" | "scenit-collapsible";

  /** Icon dispatch strategy (ThemeIcon) */
  iconStyle: "lucide" | "ascii" | "win95-pixel" | "winamp-svg" | "aim-png";

  /** Checkbox/toggle rendering (ThemeToggle, GraphEditor channel toggles) */
  checkboxStyle: "default" | "sciin-bracket" | "win95-button" | "aim-toggle" | "winamp-toggle";

  /** Slider rendering (Slider.tsx) */
  sliderStyle: "default" | "winamp-vertical" | "sciin-snap";

  /** Whether this theme produces sound effects */
  hasSounds: boolean;

  /** Whether this theme shows a Milkdrop video background */
  hasMilkdropBackground: boolean;

  /** Whether the tutorial overlay is available */
  hasTutorial: boolean;

  /** Uses stepped scroll behavior for panels */
  hasSteppedScroll: boolean;

  /** Shows a viewport HUD with camera coordinates */
  hasViewportHUD: boolean;

  /** Skeuomorphic (uses win95-style bevels, fieldsets, etc.) */
  isSkeuomorphic: boolean;

  /** Uses ASCII/text-based controls (CycleSelect, bracket buttons) */
  usesTextControls: boolean;

  /** Anchor color palette strategy */
  anchorPalette: "hsl" | "cga" | "ms-paint" | "xp-paint";

  /** Canvas drawing color set for MinimapView */
  canvasColors: CanvasColorMap;

  /** Graph editor color set */
  graphColors: GraphColorMap;
}

/* ── Per-theme capability definitions ── */

const DEFAULT_CANVAS: CanvasColorMap = {
  bg: "#18181b", grid: "#27272a", endpointFill: "#18181b",
  cameraDot: "#ffd060", collisionStroke: "#14b8a6", collisionFill: "rgba(20, 184, 166, 0.05)",
  penStroke: "#fbbf24", walkStroke: "#fb7185", playbackRing: "#facc15",
};

const DEFAULT_GRAPH: GraphColorMap = {
  bg: "#18181b", grid: "#27272a", label: "#52525b", zero: "#3f3f46", crosshair: "#a1a1aa", kfEmpty: "#52525b",
};

export const THEME_CAPABILITIES: Record<ThemeId, ThemeCapabilities> = {
  default: {
    id: "default",
    layoutShell: "stacked",
    sectionHeaderStyle: "default",
    iconStyle: "lucide",
    checkboxStyle: "default",
    sliderStyle: "default",
    hasSounds: false,
    hasMilkdropBackground: false,
    hasTutorial: true,
    hasSteppedScroll: false,
    hasViewportHUD: false,
    isSkeuomorphic: false,
    usesTextControls: false,
    anchorPalette: "hsl",
    canvasColors: DEFAULT_CANVAS,
    graphColors: DEFAULT_GRAPH,
  },

  sc3ne_it: {
    id: "sc3ne_it",
    layoutShell: "stacked",
    sectionHeaderStyle: "default",
    iconStyle: "lucide",
    checkboxStyle: "default",
    sliderStyle: "default",
    hasSounds: false,
    hasMilkdropBackground: false,
    hasTutorial: false,
    hasSteppedScroll: false,
    hasViewportHUD: false,
    isSkeuomorphic: false,
    usesTextControls: false,
    anchorPalette: "hsl",
    canvasColors: {
      bg: "#030308", grid: "#0e4a3e", endpointFill: "#030308",
      cameraDot: "#ffd060", collisionStroke: "#ef4444", collisionFill: "rgba(239, 68, 68, 0.05)",
      penStroke: "#ffd060", walkStroke: "#ffd060", playbackRing: "#facc15",
    },
    graphColors: {
      bg: "#030308", grid: "#0e4a3e", label: "#1a6b5a", zero: "#0c3a30", crosshair: "#ffc850", kfEmpty: "#1a6b5a",
    },
  },

  sciin_it: {
    id: "sciin_it",
    layoutShell: "stacked",
    sectionHeaderStyle: "sciin-terminal",
    iconStyle: "ascii",
    checkboxStyle: "sciin-bracket",
    sliderStyle: "sciin-snap",
    hasSounds: false,
    hasMilkdropBackground: false,
    hasTutorial: false,
    hasSteppedScroll: true,
    hasViewportHUD: true,
    isSkeuomorphic: false,
    usesTextControls: true,
    anchorPalette: "cga",
    canvasColors: {
      bg: "#18181b", grid: "#27272a", endpointFill: "#18181b",
      cameraDot: "#ffd060", collisionStroke: "#14b8a6", collisionFill: "rgba(20, 184, 166, 0.05)",
      penStroke: "#fbbf24", walkStroke: "#fb7185", playbackRing: "#facc15",
    },
    graphColors: DEFAULT_GRAPH,
  },

  win95: {
    id: "win95",
    layoutShell: "stacked",
    sectionHeaderStyle: "win95-titlebar",
    iconStyle: "win95-pixel",
    checkboxStyle: "win95-button",
    sliderStyle: "default",
    hasSounds: false,
    hasMilkdropBackground: false,
    hasTutorial: false,
    hasSteppedScroll: false,
    hasViewportHUD: false,
    isSkeuomorphic: true,
    usesTextControls: false,
    anchorPalette: "ms-paint",
    canvasColors: {
      bg: "#c0c0c0", grid: "#c0c0c0", endpointFill: "#c0c0c0",
      cameraDot: "#ffd060", collisionStroke: "#ef4444", collisionFill: "rgba(239, 68, 68, 0.05)",
      penStroke: "#ffd060", walkStroke: "#ffd060", playbackRing: "#facc15",
    },
    graphColors: {
      bg: "#ffffff", grid: "#c0c0c0", label: "#000000", zero: "#808080", crosshair: "#808080", kfEmpty: "#808080",
    },
  },

  winamp: {
    id: "winamp",
    layoutShell: "winamp-desktop",
    sectionHeaderStyle: "winamp-groove",
    iconStyle: "winamp-svg",
    checkboxStyle: "winamp-toggle",
    sliderStyle: "default",
    hasSounds: false,
    hasMilkdropBackground: true,
    hasTutorial: false,
    hasSteppedScroll: false,
    hasViewportHUD: false,
    isSkeuomorphic: false,
    usesTextControls: false,
    anchorPalette: "hsl",
    canvasColors: {
      bg: "#243c79", grid: "#2d4785", endpointFill: "#243c79",
      cameraDot: "#ffd060", collisionStroke: "#ef4444", collisionFill: "rgba(239, 68, 68, 0.05)",
      penStroke: "#ffd060", walkStroke: "#ffd060", playbackRing: "#facc15",
    },
    graphColors: {
      bg: "#243c79", grid: "rgba(255,255,255,0.08)", label: "rgba(255,255,255,0.3)",
      zero: "rgba(255,255,255,0.12)", crosshair: "rgba(255,255,255,0.4)", kfEmpty: "rgba(255,255,255,0.2)",
    },
  },

  scenit: {
    id: "scenit",
    layoutShell: "scenit-grid",
    sectionHeaderStyle: "scenit-collapsible",
    iconStyle: "lucide",
    checkboxStyle: "default",
    sliderStyle: "default",
    hasSounds: false,
    hasMilkdropBackground: false,
    hasTutorial: false,
    hasSteppedScroll: false,
    hasViewportHUD: false,
    isSkeuomorphic: false,
    usesTextControls: false,
    anchorPalette: "hsl",
    canvasColors: {
      bg: "#ffffff", grid: "#d0d0d0", endpointFill: "#ffffff",
      cameraDot: "#ffd060", collisionStroke: "#ef4444", collisionFill: "rgba(239, 68, 68, 0.05)",
      penStroke: "#ffd060", walkStroke: "#ffd060", playbackRing: "#facc15",
    },
    graphColors: {
      bg: "#ffffff", grid: "#d0d0d0", label: "#222222", zero: "#888888", crosshair: "#222222", kfEmpty: "#888888",
    },
  },

  "xX_sCeNeIt_Xx": {
    id: "xX_sCeNeIt_Xx",
    layoutShell: "xp-desktop",
    sectionHeaderStyle: "aim-titlebar",
    iconStyle: "aim-png",
    checkboxStyle: "aim-toggle",
    sliderStyle: "default",
    hasSounds: true,
    hasMilkdropBackground: false,
    hasTutorial: false,
    hasSteppedScroll: false,
    hasViewportHUD: false,
    isSkeuomorphic: true,
    usesTextControls: false,
    anchorPalette: "xp-paint",
    canvasColors: {
      bg: "#ffffff", grid: "#D6E8FF", endpointFill: "#ECE9D8",
      cameraDot: "#ffd060", collisionStroke: "#ef4444", collisionFill: "rgba(239, 68, 68, 0.05)",
      penStroke: "#ffd060", walkStroke: "#ffd060", playbackRing: "#facc15",
    },
    graphColors: {
      bg: "#ffffff", grid: "#D6E8FF", label: "#333333", zero: "#7F9DB9", crosshair: "#0055CC", kfEmpty: "#ADB2B5",
    },
  },
};
