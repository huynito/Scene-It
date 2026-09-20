import React from "react";

interface WinampIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

const base = (children: React.ReactNode): React.FC<WinampIconProps> => {
  const Icon: React.FC<WinampIconProps> = ({ size = 16, className, ...props }) => (
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
  Icon.displayName = "WinampIcon";
  return Icon;
};

export const WampBox = base(
  <>
    <path d="M3 3h10v9H3z" fill="currentColor" opacity=".18" />
    <path d="M4 2h8l3 3v6l-3 3H4l-3-3V5l3-3zm0 1L2 5v6l2 2h8l2-2V5l-2-2H4z" fill="currentColor" />
    <path d="M8 2v11" stroke="currentColor" strokeWidth="1" />
    <path d="M2 5h12" stroke="currentColor" strokeWidth="1" />
  </>
);

export const WampUpload = base(
  <>
    <path d="M3 11h10v2H3z" fill="currentColor" />
    <path d="M8 2l3 3H9v4H7V5H5l3-3z" fill="currentColor" />
    <path d="M4 9h1v2H4zm7 0h1v2h-1z" fill="currentColor" opacity=".7" />
  </>
);

export const WampArrowRight = base(
  <>
    <path d="M2 7h8v2H2z" fill="currentColor" />
    <path d="M9 4l5 4-5 4V4z" fill="currentColor" />
  </>
);

export const WampPlus = base(
  <path d="M7 2h2v5h5v2H9v5H7V9H2V7h5V2z" fill="currentColor" />
);

export const WampChevronDown = base(
  <path d="M3 5h10L8 11 3 5z" fill="currentColor" />
);

export const WampPlay = base(
  <path d="M5 3v10l8-5-8-5z" fill="currentColor" />
);

export const WampPause = base(
  <>
    <path d="M4 3h3v10H4z" fill="currentColor" />
    <path d="M9 3h3v10H9z" fill="currentColor" />
  </>
);

export const WampStepBack = base(
  <>
    <path d="M4 3h2v10H4z" fill="currentColor" />
    <path d="M12 3v10L6 8l6-5z" fill="currentColor" />
  </>
);

export const WampStepForward = base(
  <>
    <path d="M10 3h2v10h-2z" fill="currentColor" />
    <path d="M4 3v10l6-5-6-5z" fill="currentColor" />
  </>
);

export const WampSkipBack = base(
  <>
    <path d="M2 3h2v10H2z" fill="currentColor" />
    <path d="M11 3v10L6 8l5-5z" fill="currentColor" />
    <path d="M14 3v10L9 8l5-5z" fill="currentColor" />
  </>
);

export const WampSkipForward = base(
  <>
    <path d="M12 3h2v10h-2z" fill="currentColor" />
    <path d="M5 3v10l5-5-5-5z" fill="currentColor" />
    <path d="M8 3v10l5-5-5-5z" fill="currentColor" />
  </>
);

export const WampRepeat = base(
  <>
    <path d="M12 5l2-2v5H9l2-2H5a2 2 0 000 4h2v2H5a4 4 0 010-8h6z" fill="currentColor" />
    <path d="M4 11l-2 2V8h5l-2 2h6a2 2 0 010 4H9v-2h2a2 2 0 000-4H4z" fill="currentColor" />
  </>
);

export const WampRotateCcw = base(
  <path d="M3 5l3-3v2h4a4 4 0 010 8H6v-2h4a2 2 0 000-4H6v2L3 5z" fill="currentColor" />
);

export const WampPalette = base(
  <path d="M8 2a6 6 0 00-1 11.9c1 .1 1-.6 1-.9v-.4c0-.5.4-.7.8-.6 2.1.5 4.2-.6 4.2-3A6 6 0 008 2zm-2 5a1 1 0 110 2 1 1 0 010-2zm2-2a1 1 0 110 2 1 1 0 010-2zm3 0a1 1 0 110 2 1 1 0 010-2z" fill="currentColor" />
);

export const WampTrash = base(
  <>
    <path d="M5 3h6l1 1h2v2H2V4h2l1-1zm-1 4h8l-1 7H5L4 7z" fill="currentColor" />
    <path d="M6 8h1v5H6zm3 0h1v5H9z" fill="#d7dde8" opacity=".55" />
  </>
);

export const WampX = base(
  <>
    <path d="M4 4l8 8" stroke="currentColor" strokeWidth="2" />
    <path d="M12 4L4 12" stroke="currentColor" strokeWidth="2" />
  </>
);

export const WampCrosshair = base(
  <>
    <path d="M7 2h2v2h2v2H9v4h2v2H9v2H7v-2H5v-2h2V6H5V4h2V2z" fill="currentColor" />
    <path d="M8 5a3 3 0 100 6 3 3 0 000-6z" fill="#cfd6e2" opacity=".4" />
  </>
);

export const WampFilm = base(
  <>
    <path d="M2 2h12v12H2z" fill="currentColor" opacity=".16" />
    <path d="M3 2h10l1 1v10l-1 1H3l-1-1V3l1-1zm0 1v2h2V3H3zm8 0v2h2V3h-2zM6 3v2h4V3H6zM3 6v4h10V6H3zm0 5v2h2v-2H3zm8 0v2h2v-2h-2zM6 11v2h4v-2H6z" fill="currentColor" />
  </>
);

export const WampImage = base(
  <>
    <path d="M2 3h12v10H2z" fill="currentColor" opacity=".16" />
    <path d="M3 2h10l1 1v10l-1 1H3l-1-1V3l1-1zm0 1v8h10V3H3zm2 2h2v2H5V5zm7 5H4V9l2-2 2 2 2-3 2 4z" fill="currentColor" />
  </>
);

export const WINAMP_ICON_MAP: Record<string, React.FC<WinampIconProps>> = {
  Box: WampBox,
  Upload: WampUpload,
  ArrowRight: WampArrowRight,
  Plus: WampPlus,
  ChevronDown: WampChevronDown,
  Play: WampPlay,
  Pause: WampPause,
  StepBack: WampStepBack,
  StepForward: WampStepForward,
  SkipBack: WampSkipBack,
  SkipForward: WampSkipForward,
  Repeat: WampRepeat,
  RotateCcw: WampRotateCcw,
  Palette: WampPalette,
  Film: WampFilm,
  Image: WampImage,
  Trash2: WampTrash,
  X: WampX,
  Crosshair: WampCrosshair,
};
