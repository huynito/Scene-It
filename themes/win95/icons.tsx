import React from "react";
import { publicUrl } from "@/lib/utils";

interface Win95IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

const base = (children: React.ReactNode): React.FC<Win95IconProps> => {
  const Icon: React.FC<Win95IconProps> = ({ size = 16, className, ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      fill="none"
      shapeRendering="crispEdges"
      {...props}
    >
      {children}
    </svg>
  );
  Icon.displayName = "Win95Icon";
  return Icon;
};

const pngIcon = (src16: string, src32: string): React.FC<Win95IconProps> => {
  const Icon: React.FC<Win95IconProps> = ({ size = 16, className }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={Number(size) > 16 ? src32 : src16}
      width={size}
      height={size}
      className={`win95-icon-multi ${className ?? ""}`}
      alt=""
      draggable={false}
      style={{ imageRendering: "pixelated" }}
    />
  );
  Icon.displayName = "Win95PngIcon";
  return Icon;
};

export const W95Upload = pngIcon(publicUrl("/icons/win95/upload-16.png"), publicUrl("/icons/win95/upload-32.png"));

export const W95RotateCcw = pngIcon(publicUrl("/icons/win95/home-16.png"), publicUrl("/icons/win95/home-32.png"));

export const W95Grid3x3 = base(
  <path d="M1 1h4v4H1V1zm5 0h4v4H6V1zm5 0h4v4h-4V1zM1 6h4v4H1V6zm5 0h4v4H6V6zm5 0h4v4h-4V6zM1 11h4v4H1v-4zm5 0h4v4H6v-4zm5 0h4v4h-4v-4z" fill="currentColor" />
);

export const W95X = pngIcon(publicUrl("/icons/win95/x-16.png"), publicUrl("/icons/win95/x-32.png"));

export const W95Box = base(
  <path d="M4 1h8l3 3v8l-3 3H4l-3-3V4l3-3zm0 2L2 5v6l2 2h8l2-2V5l-2-2H4z" fill="currentColor" />
);

export const W95Plus = base(
  <path d="M7 2h2v5h5v2H9v5H7V9H2V7h5V2z" fill="currentColor" />
);

export const W95Palette = base(
  <path d="M8 2a6 6 0 00-1 11.9c1 .1 1-.7 1-.7v-.5c0-.6.4-.8.7-.7 2.1.5 4.3-.6 4.3-3a6 6 0 00-5-7zM5 7a1 1 0 110 2 1 1 0 010-2zm2-2a1 1 0 110 2 1 1 0 010-2zm4 0a1 1 0 110 2 1 1 0 010-2zm1 3a1 1 0 110 2 1 1 0 010-2z" fill="currentColor" />
);

export const W95Film = base(
  <path d="M2 1h12v14H2V1zm2 1v2h2V2H4zm6 0v2h2V2h-2zM4 5v3h8V5H4zm0 4v3h8V9H4zm0 4v1h2v-1H4zm6 0v1h2v-1h-2z" fill="currentColor" />
);

export const W95Crosshair = pngIcon(publicUrl("/icons/win95/crosshair-16.png"), publicUrl("/icons/win95/crosshair-32.png"));

export const W95Trash2 = pngIcon(publicUrl("/icons/win95/trash-16.png"), publicUrl("/icons/win95/trash-32.png"));

export const W95ChevronDown = base(
  <path d="M3 5l5 5 5-5H3z" fill="currentColor" />
);

export const W95Image = pngIcon(publicUrl("/icons/win95/image-32.png"), publicUrl("/icons/win95/image-32.png"));

export const W95Play = base(
  <path d="M5 3v10l8-5-8-5z" fill="currentColor" />
);

export const W95Pause = base(
  <path d="M4 3h3v10H4V3zm5 0h3v10H9V3z" fill="currentColor" />
);

export const W95Repeat = base(
  <path d="M13 4l-3-3v2H4a3 3 0 000 6h1V7H4a1 1 0 010-2h6v2l3-3zM3 12l3 3v-2h6a3 3 0 000-6h-1v2h1a1 1 0 010 2H6v-2l-3 3z" fill="currentColor" />
);

export const W95StepBack = base(
  <path d="M3 3h2v10H3V3zm9 0v10L7 8l5-5z" fill="currentColor" />
);

export const W95StepForward = base(
  <path d="M11 3h2v10h-2V3zM4 3v10l5-5-5-5z" fill="currentColor" />
);

export const W95SkipBack = base(
  <path d="M2 3h2v10H2V3zm11 0v10L8 8l5-5zm-3 0v10L5 8l5-5z" fill="currentColor" />
);

export const W95SkipForward = base(
  <path d="M12 3h2v10h-2V3zM3 3v10l5-5-5-5zm3 0v10l5-5-5-5z" fill="currentColor" />
);

export const W95ChevronRight = base(
  <path d="M5 3l5 5-5 5V3z" fill="currentColor" />
);

export const W95Download = pngIcon(publicUrl("/icons/win95/download-16.png"), publicUrl("/icons/win95/download-16.png"));

export const W95Copy = pngIcon(publicUrl("/icons/win95/copy-16.png"), publicUrl("/icons/win95/copy-32.png"));

export const W95Check = base(
  <path d="M13 3l-6 8-3-3 1-1 2 2 5-7 1 1z" fill="currentColor" />
);

export const W95Circle = base(
  <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 2a4 4 0 110 8 4 4 0 010-8z" fill="currentColor" />
);

export const W95Shield = pngIcon(publicUrl("/icons/win95/shield-16.png"), publicUrl("/icons/win95/shield-32.png"));

export const W95AlertTriangle = base(
  <path d="M8 1l7 13H1L8 1zm0 4L3.5 12h9L8 5zm-1 3h2v3H7V8zm0 4h2v1H7v-1z" fill="currentColor" />
);

export const W95FileCode = base(
  <path d="M3 1h7l3 3v11H3V1zm2 2v10h6V5h-2V3H5zm1 5l-1 1 1 1v1l-2-2 2-2v1zm4-1l1 1-1 1v1l2-2-2-2v1z" fill="currentColor" />
);

export const W95FileJson = base(
  <path d="M3 1h7l3 3v11H3V1zm2 2v10h6V5h-2V3H5zm1 5c0-1 .5-1 1-1v1c-.3 0-.3.2-.3.5l.3.5-.3.5c0 .3 0 .5.3.5v1c-.5 0-1 0-1-1l.3-.5L6 9l.3-.5L6 8zm4 0c0-1-.5-1-1-1v1c.3 0 .3.2.3.5L9 9l.3.5c0 .3 0 .5-.3.5v1c.5 0 1 0 1-1l-.3-.5.3-.5-.3-.5.3-.5z" fill="currentColor" />
);

export const W95ChevronUp = base(
  <path d="M3 11l5-5 5 5H3z" fill="currentColor" />
);

export const W95Diamond = base(
  <path d="M8 1l7 7-7 7-7-7 7-7zm0 2L3 8l5 5 5-5-5-5z" fill="currentColor" />
);

export const W95Images = base(
  <path d="M1 1h10v3h4v10H5V11H1V1zm2 2v5l2-2 1 1 2-3 1 2V3H3zm6 4v6h4V6H9zm1 2v3l1-1 1 1V8h-2z" fill="currentColor" />
);

export const W95Music = base(
  <path d="M6 2h6v2H8v6a2 2 0 11-2-2V2zm0 8a1 1 0 100 2 1 1 0 000-2z" fill="currentColor" />
);

export const W95Volume2 = base(
  <path d="M2 6h3l3-3v10l-3-3H2V6zm9 0v4c1 0 2-1 2-2s-1-2-2-2zm1-3v1c2 0 3 2 3 4s-1 4-3 4v1c3 0 4-2 4-5s-1-5-4-5z" fill="currentColor" />
);

export const W95Pen = pngIcon(publicUrl("/icons/win95/pencil-16.png"), publicUrl("/icons/win95/pencil-32.png"));

export const W95Move = pngIcon(publicUrl("/icons/win95/cursor-16.png"), publicUrl("/icons/win95/cursor-32.png"));

export const W95Footprints = pngIcon(publicUrl("/icons/win95/walking-16.png"), publicUrl("/icons/win95/walking-32.png"));

export const W95RecycleBin = pngIcon(publicUrl("/icons/win95/pool-recycle.png"), publicUrl("/icons/win95/pool-recycle.png"));

export const W95PaintSelect = pngIcon(publicUrl("/icons/win95/paint-select-16.png"), publicUrl("/icons/win95/paint-select-32.png"));

export const W95PaintLine = pngIcon(publicUrl("/icons/win95/paint-line-16.png"), publicUrl("/icons/win95/paint-line-32.png"));

export const W95PaintCurve = pngIcon(publicUrl("/icons/win95/paint-curve-16.png"), publicUrl("/icons/win95/paint-curve-32.png"));

export const W95PaintBucket = pngIcon(publicUrl("/icons/win95/paint-bucket-16.png"), publicUrl("/icons/win95/paint-bucket-32.png"));

export const W95PaintEraser = pngIcon(publicUrl("/icons/win95/paint-eraser-16.png"), publicUrl("/icons/win95/paint-eraser-32.png"));

export const W95Camera = base(
  <path d="M5 2h4l2 2h3v9H2V4h3l2-2zm3 4a3 3 0 100 6 3 3 0 000-6zm0 2a1 1 0 110 2 1 1 0 010-2z" fill="currentColor" />
);

export const W95SlidersHorizontal = base(
  <path d="M1 3h3v1h11v1H4v1H1V3zm0 5h8v1h6v1H9v1H6V8H1zm0 5h5v1h9v1H6v1H1v-3z" fill="currentColor" />
);

export const W95Layers = base(
  <path d="M8 1l7 4-7 4-7-4 7-4zm0 6l7 4-7 4-7-4 7-4z" fill="currentColor" />
);

export const W95ArrowRight = base(
  <path d="M2 7h8V4l5 4-5 4V9H2V7z" fill="currentColor" />
);

export const W95Info = pngIcon(publicUrl("/icons/win95/info-16.png"), publicUrl("/icons/win95/info-32.png"));

export const W95MapPin = base(
  <path d="M8 1c-3 0-5 2-5 5 0 4 5 9 5 9s5-5 5-9c0-3-2-5-5-5zm0 3a2 2 0 110 4 2 2 0 010-4z" fill="currentColor" />
);

export const W95Loader2 = base(
  <path d="M3 1h10v2H5v2h6v1H5v1h6v1H5v2h8v2H3V1z" fill="currentColor" />
);

/* ── Authentic Win95 title bar close (X) glyph ── */
export function W95CloseGlyph({ size = 7 }: { size?: number }) {
  return (
    <svg className="win95-close-glyph" width={size} height={size} viewBox="0 0 8 7" shapeRendering="crispEdges" fill="none">
      <rect x="0" y="0" width="2" height="1" fill="#000" />
      <rect x="6" y="0" width="2" height="1" fill="#000" />
      <rect x="1" y="1" width="2" height="1" fill="#000" />
      <rect x="5" y="1" width="2" height="1" fill="#000" />
      <rect x="2" y="2" width="4" height="1" fill="#000" />
      <rect x="3" y="3" width="2" height="1" fill="#000" />
      <rect x="2" y="4" width="4" height="1" fill="#000" />
      <rect x="1" y="5" width="2" height="1" fill="#000" />
      <rect x="5" y="5" width="2" height="1" fill="#000" />
      <rect x="0" y="6" width="2" height="1" fill="#000" />
      <rect x="6" y="6" width="2" height="1" fill="#000" />
    </svg>
  );
}

/* ── Multi-color header icons (authentic Win95 PNGs) ── */

const baseMultiColor = (children: React.ReactNode): React.FC<Win95IconProps> => {
  const Icon: React.FC<Win95IconProps> = ({ size = 16, className, ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`win95-icon-multi ${className ?? ""}`}
      fill="none"
      {...props}
    >
      {children}
    </svg>
  );
  Icon.displayName = "Win95HeaderIcon";
  return Icon;
};

export const W95HeaderPushpin = pngIcon(publicUrl("/icons/win95/pushpin-16.png"), publicUrl("/icons/win95/pushpin-32.png"));

export const W95HeaderFolder = pngIcon(publicUrl("/icons/win95/folder-16.png"), publicUrl("/icons/win95/folder-32.png"));

export const W95HeaderComputer = pngIcon(publicUrl("/icons/win95/computer-16.png"), publicUrl("/icons/win95/computer-32.png"));
export const W95HeaderCamera = pngIcon(publicUrl("/icons/win95/camera-alt-16.png"), publicUrl("/icons/win95/camera-alt-32.png"));

export const W95HeaderSolitaire = pngIcon(publicUrl("/icons/win95/solitaire-16.png"), publicUrl("/icons/win95/solitaire-32.png"));
export const W95HeaderWindowObjs = pngIcon(publicUrl("/icons/win95/window-objs-32.png"), publicUrl("/icons/win95/window-objs-32.png"));

export const W95HeaderPaint = pngIcon(publicUrl("/icons/win95/paint-16.png"), publicUrl("/icons/win95/paint-32.png"));

export const W95HeaderMesh = pngIcon(publicUrl("/icons/win95/mesh-16.png"), publicUrl("/icons/win95/mesh-32.png"));

export const W95HeaderMap = pngIcon(publicUrl("/icons/win95/search-web-16.png"), publicUrl("/icons/win95/search-web-32.png"));

export const W95HeaderDisk = pngIcon(publicUrl("/icons/win95/disk-16.png"), publicUrl("/icons/win95/disk-32.png"));

export const W95HeaderClock = pngIcon(publicUrl("/icons/win95/clock-16.png"), publicUrl("/icons/win95/clock-32.png"));

export const W95HeaderNetwork = pngIcon(publicUrl("/icons/win95/network-16.png"), publicUrl("/icons/win95/network-32.png"));

export const W95HeaderClapperboard = pngIcon(publicUrl("/icons/win95/clapperboard-16.png"), publicUrl("/icons/win95/clapperboard-32.png"));

export const WIN95_ICON_MAP: Record<string, React.FC<Win95IconProps>> = {
  Upload: W95Upload,
  RotateCcw: W95RotateCcw,
  Grid3x3: W95Grid3x3,
  X: W95X,
  Box: W95Box,
  Plus: W95Plus,
  Palette: W95Palette,
  Film: W95Film,
  Crosshair: W95Crosshair,
  Trash2: W95Trash2,
  ChevronDown: W95ChevronDown,
  Image: W95Image,
  Play: W95Play,
  Pause: W95Pause,
  Repeat: W95Repeat,
  StepBack: W95StepBack,
  StepForward: W95StepForward,
  SkipBack: W95SkipBack,
  SkipForward: W95SkipForward,
  ChevronRight: W95ChevronRight,
  Download: W95Download,
  Copy: W95Copy,
  Check: W95Check,
  Circle: W95Circle,
  Shield: W95Shield,
  AlertTriangle: W95AlertTriangle,
  FileCode: W95FileCode,
  FileJson: W95FileJson,
  ChevronUp: W95ChevronUp,
  Diamond: W95Diamond,
  Images: W95Images,
  Music: W95Music,
  Volume2: W95Volume2,
  Pen: W95Pen,
  Move: W95Move,
  Footprints: W95Footprints,
  Camera: W95Camera,
  SlidersHorizontal: W95SlidersHorizontal,
  Layers: W95Layers,
  ArrowRight: W95ArrowRight,
  Info: W95Info,
  MapPin: W95MapPin,
  Loader2: W95Loader2,
};

export const W95HeaderViewport = pngIcon(publicUrl("/icons/win95/monitor-16.png"), publicUrl("/icons/win95/monitor-32.png"));

export const W95StartFlag = pngIcon(publicUrl("/icons/win95/windows-flag-16.png"), publicUrl("/icons/win95/windows-flag-32.png"));

export const W95_BUCKET_CURSOR_URL = publicUrl("/icons/win95/paint-bucket-16.png");
export const W95_ERASER_CURSOR_URL = publicUrl("/icons/win95/paint-eraser-16.png");

export const W95ExplorerFolder = pngIcon(publicUrl("/icons/win95/folder-16.png"), publicUrl("/icons/win95/folder-32.png"));

export const W95_EXPLORER_ICON_POOL: string[] = [
  publicUrl("/icons/win95/folder-32.png"),
  publicUrl("/icons/win95/pool-accessibility.png"),
  publicUrl("/icons/win95/pool-briefcase.png"),
  publicUrl("/icons/win95/pool-calc.png"),
  publicUrl("/icons/win95/pool-camera.png"),
  publicUrl("/icons/win95/pool-globe.png"),
  publicUrl("/icons/win95/pool-keyboard.png"),
  publicUrl("/icons/win95/pool-modem.png"),
  publicUrl("/icons/win95/pool-mouse.png"),
  publicUrl("/icons/win95/pool-network.png"),
  publicUrl("/icons/win95/pool-recycle.png"),
  publicUrl("/icons/win95/pool-sounds.png"),
];

/* ── Toolbar icons (multicolor, 32x32 viewBox) ── */

export const W95TbReset = pngIcon(publicUrl("/icons/win95/home-16.png"), publicUrl("/icons/win95/home-32.png"));

export const W95TbTheme = pngIcon(publicUrl("/icons/win95/tb-theme-16.png"), publicUrl("/icons/win95/tb-theme-32.png"));

export const W95TbClear = pngIcon(publicUrl("/icons/win95/tb-clear-16.png"), publicUrl("/icons/win95/tb-clear-32.png"));

export const W95TbClose = pngIcon(publicUrl("/icons/win95/tb-close-32.png"), publicUrl("/icons/win95/tb-close-32.png"));

export const WIN95_HEADER_ICON_MAP: Record<string, React.FC<Win95IconProps>> = {
  MapPin: W95HeaderPushpin,
  Images: W95HeaderFolder,
  Camera: W95HeaderCamera,
  Layers: W95HeaderWindowObjs,
  SlidersHorizontal: W95HeaderPaint,
  Box: W95HeaderMesh,
  Route: W95HeaderNetwork,
};
