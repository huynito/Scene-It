import React from "react";
import { publicUrl } from "@/lib/utils";

interface AimIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

function shouldSmoothAimIcon(src: string) {
  return src.includes("warn.png")
    || src.includes("block.png")
    || src.includes("expressions.png")
    || src.includes("close-x.png")
    || src.includes("send-man.png")
    || src.includes("add-buddy.png")
    || src.includes("image.png")
    || src.includes("footprints.png")
    || src.includes("reset-camera.png")
    || src.includes("trash-colored.png")
    || src.includes("running-man-18.png");
}

const imgIcon = (src: string, defaultSize: number | "auto" = 16): React.FC<AimIconProps> => {
  const Icon: React.FC<AimIconProps> = ({ size = defaultSize, className }) => {
    const dims = size === "auto" ? {} : { width: Number(size), height: Number(size) };
    return (
      <img
        src={`${src}?v=3`}
        {...dims}
        className={`aim-icon-img ${className || ""}`}
        style={{ imageRendering: shouldSmoothAimIcon(src) ? "auto" : "pixelated", pointerEvents: "none" }}
        draggable={false}
        alt=""
      />
    );
  };
  Icon.displayName = "AimIcon";
  return Icon;
};

const headerImgIcon = (src: string): React.FC<AimIconProps> => {
  const Icon: React.FC<AimIconProps> = ({ size = 16, className }) => (
    <img
      src={src}
      width={Number(size)}
      height={Number(size)}
      className={`aim-icon-multi aim-icon-img ${className || ""}`}
      style={{ imageRendering: "pixelated", pointerEvents: "none" }}
      draggable={false}
      alt=""
    />
  );
  Icon.displayName = "AimHeaderIcon";
  return Icon;
};

/* ── Standard 16x16 Icons ── */

export const AimUpload = imgIcon(publicUrl("/icons/aim/upload.png"));
export const AimRotateCcw = imgIcon(publicUrl("/icons/aim/rotate-ccw.png"));
export const AimGrid3x3 = imgIcon(publicUrl("/icons/aim/grid.png"));
export const AimX = imgIcon(publicUrl("/icons/aim/close.png"));
export const AimBox = imgIcon(publicUrl("/icons/aim/cube.png"));
export const AimPlus = imgIcon(publicUrl("/icons/aim/plus.png"));
export const AimPalette = imgIcon(publicUrl("/icons/aim/palette.png"));
export const AimFilm = imgIcon(publicUrl("/icons/aim/film.png"));
export const AimCrosshair = imgIcon(publicUrl("/icons/aim/crosshair.png"));
export const AimTrash2 = imgIcon(publicUrl("/icons/aim/trash.png"));
export const AimChevronDown = imgIcon(publicUrl("/icons/aim/chevron-down.png"));
export const AimImage = imgIcon(publicUrl("/icons/aim/image.png"), "auto");
export const AimPlay = imgIcon(publicUrl("/icons/aim/play.png"));
export const AimPause = imgIcon(publicUrl("/icons/aim/pause.png"));
export const AimRepeat = imgIcon(publicUrl("/icons/aim/repeat.png"));
export const AimStepBack = imgIcon(publicUrl("/icons/aim/step-back.png"));
export const AimStepForward = imgIcon(publicUrl("/icons/aim/step-forward.png"));
export const AimSkipBack = imgIcon(publicUrl("/icons/aim/skip-back.png"));
export const AimSkipForward = imgIcon(publicUrl("/icons/aim/skip-forward.png"));
export const AimChevronRight = imgIcon(publicUrl("/icons/aim/chevron-right.png"));
export const AimDownload = imgIcon(publicUrl("/icons/aim/download.png"));
export const AimCopy = imgIcon(publicUrl("/icons/aim/copy.png"));
export const AimCheck = imgIcon(publicUrl("/icons/aim/check.png"));
export const AimCircle = imgIcon(publicUrl("/icons/aim/circle.png"));
export const AimShield = imgIcon(publicUrl("/icons/aim/shield.png"));
export const AimAlertTriangle = imgIcon(publicUrl("/icons/aim/alert.png"));
export const AimFileCode = imgIcon(publicUrl("/icons/aim/file-code.png"));
export const AimFileJson = imgIcon(publicUrl("/icons/aim/file-json.png"));
export const AimChevronUp = imgIcon(publicUrl("/icons/aim/chevron-up.png"));
export const AimDiamond = imgIcon(publicUrl("/icons/aim/diamond.png"));
export const AimImages = imgIcon(publicUrl("/icons/aim/images.png"));
export const AimMusic = imgIcon(publicUrl("/icons/aim/music.png"));
export const AimVolume2 = imgIcon(publicUrl("/icons/aim/volume.png"));
export const AimPen = imgIcon(publicUrl("/icons/aim/pen.png"));
export const AimMove = imgIcon(publicUrl("/icons/aim/move.png"));
export const AimFootprints = imgIcon(publicUrl("/icons/aim/footprints.png"), "auto");
export const AimCamera = imgIcon(publicUrl("/icons/aim/camera.png"));
export const AimSlidersHorizontal = imgIcon(publicUrl("/icons/aim/sliders.png"));
export const AimLayers = imgIcon(publicUrl("/icons/aim/layers.png"));
export const AimArrowRight = imgIcon(publicUrl("/icons/aim/arrow-right.png"));
export const AimInfo = imgIcon(publicUrl("/icons/aim/info.png"));
export const AimMapPin = imgIcon(publicUrl("/icons/aim/map-pin.png"));
export const AimLoader2 = imgIcon(publicUrl("/icons/aim/loader.png"));

/* ── Header 32x32 Icons ── */

export const AimHeaderBuddy = headerImgIcon(publicUrl("/icons/aim/header-buddy.png"));
export const AimHeaderFolder = headerImgIcon(publicUrl("/icons/aim/header-folder.png"));
export const AimHeaderComputer = headerImgIcon(publicUrl("/icons/aim/header-computer.png"));
export const AimHeaderSolitaire = headerImgIcon(publicUrl("/icons/aim/header-solitaire.png"));
export const AimHeaderPaint = headerImgIcon(publicUrl("/icons/aim/header-paint.png"));
export const AimHeaderMesh = headerImgIcon(publicUrl("/icons/aim/header-mesh.png"));

/* ── AIM-Specific Icons ── */

export const AimRunningMan = imgIcon(publicUrl("/icons/aim/running-man-18.png"));
export const AimBuddyOnline = imgIcon(publicUrl("/icons/aim/buddy-online.png"));
export const AimBuddyAway = imgIcon(publicUrl("/icons/aim/buddy-away.png"));
export const AimBuddyOffline = imgIcon(publicUrl("/icons/aim/buddy-offline.png"));
export const AimBuddyAwayLarge = headerImgIcon(publicUrl("/icons/aim/buddy-away-large.png"));
export const AimBuddyListIcon = imgIcon(publicUrl("/icons/aim/buddy-list-eye.png"));
export const AimSendMan = imgIcon(publicUrl("/icons/aim/send-man.png"), "auto");

export const AimWarn = imgIcon(publicUrl("/icons/aim/warn.png"), "auto");
export const AimBlock = imgIcon(publicUrl("/icons/aim/block.png"), "auto");
export const AimExpressions = imgIcon(publicUrl("/icons/aim/expressions.png"));
export const AimGames = imgIcon(publicUrl("/icons/aim/games.png"));
export const AimVideo = imgIcon(publicUrl("/icons/aim/video.png"));
export const AimTalk = imgIcon(publicUrl("/icons/aim/talk.png"));
export const AimGetInfo = imgIcon(publicUrl("/icons/aim/get-info.png"));

export const AimPaletteLg = imgIcon(publicUrl("/icons/aim/expressions.png"), "auto");

export const AimAddBuddy = imgIcon(publicUrl("/icons/aim/add-buddy.png"), "auto");
export const AimResetCamera = imgIcon(publicUrl("/icons/aim/reset-camera.png"), "auto");
export const AimTrash = imgIcon(publicUrl("/icons/aim/trash-colored.png"), "auto");
export const AimCloseX = imgIcon(publicUrl("/icons/aim/close-x.png"), "auto");

/* ── Branded chrome (custom classNames, not the dispatcher pipeline) ── */

export function AimLoginBanner() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={publicUrl("/icons/aim/aim-login-banner.svg")}
      alt=""
      draggable={false}
      className="aim-banner-img"
    />
  );
}

export function AimMapQuestLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={publicUrl("/icons/aim/mapquest-logo.svg")}
      alt="MapQuest"
      className="mq-header-logo"
      draggable={false}
    />
  );
}

export function AimXPStartFlag({ size = 20 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={publicUrl("/icons/aim/xp-windows-flag-small.png")}
      alt=""
      width={size}
      height={size}
      style={{ imageRendering: "auto", pointerEvents: "none" }}
    />
  );
}

/* ── Emoji picker assets ── */

export const AIM_EMOJI_NAMES = [
  "smiling", "frowning", "winking", "tongue",
  "surprised", "kissing", "yelling", "cool",
  "money-mouth", "foot-in-mouth", "embarrassed", "innocent",
  "undecided", "crying", "lips-sealed", "laughing",
] as const;

export type AimEmojiName = (typeof AIM_EMOJI_NAMES)[number];

export const AIM_EMOJI_PATHS: Record<AimEmojiName, string> = AIM_EMOJI_NAMES.reduce(
  (acc, name) => {
    acc[name] = publicUrl(`/icons/aim/emoji/${name}.png`);
    return acc;
  },
  {} as Record<AimEmojiName, string>,
);

/* ── Icon Maps ── */

export const AIM_ICON_MAP: Record<string, React.FC<AimIconProps>> = {
  Upload: AimUpload,
  RotateCcw: AimRotateCcw,
  Grid3x3: AimGrid3x3,
  X: AimX,
  Box: AimBox,
  Plus: AimPlus,
  Palette: AimPalette,
  Film: AimFilm,
  Crosshair: AimCrosshair,
  Trash2: AimTrash2,
  ChevronDown: AimChevronDown,
  Image: AimImage,
  Play: AimPlay,
  Pause: AimPause,
  Repeat: AimRepeat,
  StepBack: AimStepBack,
  StepForward: AimStepForward,
  SkipBack: AimSkipBack,
  SkipForward: AimSkipForward,
  ChevronRight: AimChevronRight,
  Download: AimDownload,
  Copy: AimCopy,
  Check: AimCheck,
  Circle: AimCircle,
  Shield: AimShield,
  AlertTriangle: AimAlertTriangle,
  FileCode: AimFileCode,
  FileJson: AimFileJson,
  ChevronUp: AimChevronUp,
  Diamond: AimDiamond,
  Images: AimImages,
  Music: AimMusic,
  Volume2: AimVolume2,
  Pen: AimPen,
  Move: AimMove,
  Footprints: AimFootprints,
  Camera: AimCamera,
  SlidersHorizontal: AimSlidersHorizontal,
  Layers: AimLayers,
  ArrowRight: AimArrowRight,
  Info: AimInfo,
  MapPin: AimMapPin,
  Loader2: AimLoader2,
};

export const AIM_HEADER_ICON_MAP: Record<string, React.FC<AimIconProps>> = {
  MapPin: AimHeaderBuddy,
  Images: AimHeaderFolder,
  Camera: AimHeaderComputer,
  Layers: AimHeaderSolitaire,
  SlidersHorizontal: AimHeaderPaint,
  Box: AimHeaderMesh,
};
