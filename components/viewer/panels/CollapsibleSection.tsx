"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown } from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import { useScene } from "@/lib/scene-context";
import HashBorder from "@/components/ui/HashBorder";

interface FrameGeometry {
  outline: string;
  panelRect: string;
  highlightPath: string;
  coverPath: string;
  tabFill: string;
  tabGradY1: number;
  tabGradY2: number;
  panelGradY1: number;
  panelGradY2: number;
  moduleW: number;
}

const TAB_PAD_L = 10;
const TAB_PAD_R = 10;
const TAB_PAD_T = 21;
const TAB_PAD_B = 6;
const PANEL_R = 10;
const TAB_TOP_Y = 6;
const TAB_CORNER_R = 4;
const TAB_ANGLE_DEG = 28;
const TAB_SVG_EXTEND = 6;
const FLAT_HALF_RATIO = 34 / 60;

function computeTabPanelFrame(
  W: number,
  H: number,
  tabElLeft: number,
  tabElWidth: number
): FrameGeometry {
  const pL = TAB_PAD_L;
  const pR = W - TAB_PAD_R;
  const pT = TAB_PAD_T;
  const pB = H - TAB_PAD_B;
  const r = PANEL_R;
  const tY = TAB_TOP_Y;
  const cr = TAB_CORNER_R;

  const diagH = pT - tY;
  const diagRun = diagH * Math.tan((TAB_ANGLE_DEG * Math.PI) / 180);
  const diagLen = Math.sqrt(diagRun * diagRun + diagH * diagH);
  const dxN = diagRun / diagLen;
  const dyN = diagH / diagLen;

  const tabCX = tabElLeft + tabElWidth / 2;
  const tabShapeW = tabElWidth + 2 * TAB_SVG_EXTEND;
  const flatHalf = FLAT_HALF_RATIO * (tabShapeW / 2);

  const tFL = tabCX - flatHalf;
  const tFR = tabCX + flatHalf;
  const tBL = tFL - diagRun;
  const tBR = tFR + diagRun;

  const lcX = tFL - cr * dxN;
  const lcY = tY + cr * dyN;
  const rcX = tFR + cr * dxN;
  const rcY = tY + cr * dyN;

  const outline = [
    `M ${pL + r} ${pT}`,
    `H ${tBL}`,
    `L ${lcX} ${lcY}`,
    `Q ${tFL} ${tY} ${tFL + cr} ${tY}`,
    `H ${tFR - cr}`,
    `Q ${tFR} ${tY} ${rcX} ${rcY}`,
    `L ${tBR} ${pT}`,
    `H ${pR - r}`,
    `Q ${pR} ${pT} ${pR} ${pT + r}`,
    `V ${pB - r}`,
    `Q ${pR} ${pB} ${pR - r} ${pB}`,
    `H ${pL + r}`,
    `Q ${pL} ${pB} ${pL} ${pB - r}`,
    `V ${pT + r}`,
    `Q ${pL} ${pT} ${pL + r} ${pT}`,
    "Z",
  ].join(" ");

  const fillBot = pT + 6;
  const tabFill = [
    `M ${tBL - 2} ${fillBot}`,
    `L ${tBL} ${pT}`,
    `L ${lcX} ${lcY}`,
    `Q ${tFL} ${tY} ${tFL + cr} ${tY}`,
    `H ${tFR - cr}`,
    `Q ${tFR} ${tY} ${rcX} ${rcY}`,
    `L ${tBR} ${pT}`,
    `L ${tBR + 2} ${fillBot}`,
    "Z",
  ].join(" ");

  const panelRect = [
    `M ${pL + r} ${pT}`,
    `H ${pR - r}`,
    `Q ${pR} ${pT} ${pR} ${pT + r}`,
    `V ${pB - r}`,
    `Q ${pR} ${pB} ${pR - r} ${pB}`,
    `H ${pL + r}`,
    `Q ${pL} ${pB} ${pL} ${pB - r}`,
    `V ${pT + r}`,
    `Q ${pL} ${pT} ${pL + r} ${pT}`,
    "Z",
  ].join(" ");

  const hi = 1.5;
  const highlightPath = [
    `M ${pL + hi} ${pB}`,
    `V ${pT + r}`,
    `Q ${pL + hi} ${pT + hi} ${pL + r} ${pT + hi}`,
    `H ${tBL + hi * dxN}`,
    `L ${lcX + hi * dxN} ${lcY + hi * dyN}`,
    `Q ${tFL + hi} ${tY + hi} ${tFL + cr} ${tY + hi}`,
    `H ${tFR - cr}`,
    `Q ${tFR - hi} ${tY + hi} ${rcX - hi * dxN} ${rcY + hi * dyN}`,
    `L ${tBR - hi * dxN} ${pT + hi}`,
    `H ${pR - r}`,
    `Q ${pR - hi} ${pT + hi} ${pR - hi} ${pT + r}`,
    `V ${pB}`,
  ].join(" ");

  const co = 0.75;
  const coverPath = [
    `M ${pL + co} ${pB - r}`,
    `V ${pT + r}`,
    `Q ${pL + co} ${pT + co} ${pL + r} ${pT + co}`,
    `H ${tBL + co * dxN}`,
    `L ${lcX + co * dxN} ${lcY + co * dyN}`,
    `Q ${tFL + co} ${tY + co} ${tFL + cr} ${tY + co}`,
    `H ${tFR - cr}`,
    `Q ${tFR - co} ${tY + co} ${rcX - co * dxN} ${rcY + co * dyN}`,
    `L ${tBR - co * dxN} ${pT + co}`,
    `H ${pR - r}`,
    `Q ${pR - co} ${pT + co} ${pR - co} ${pT + r}`,
    `V ${pB - r}`,
  ].join(" ");

  return { outline, panelRect, highlightPath, coverPath, tabFill, tabGradY1: tY, tabGradY2: pT, panelGradY1: pT, panelGradY2: pB, moduleW: W };
}

function Win95Minimize() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges" fill="none">
      <rect x="1" y="8" width="6" height="3" fill="#000" />
    </svg>
  );
}

function Win95Maximize() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" shapeRendering="crispEdges" fill="none">
      <rect x="1" y="1" width="9" height="2" fill="#000" />
      <rect x="1" y="3" width="1" height="6" fill="#000" />
      <rect x="9" y="3" width="1" height="6" fill="#000" />
      <rect x="1" y="8" width="9" height="1" fill="#000" />
    </svg>
  );
}

function WinampMinimize() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <rect x="1" y="6" width="5" height="2" fill="currentColor" />
    </svg>
  );
}

function WinampMaximize() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <rect x="0" y="0" width="8" height="2" fill="currentColor" />
      <rect x="0" y="2" width="1" height="5" fill="currentColor" />
      <rect x="7" y="2" width="1" height="5" fill="currentColor" />
      <rect x="0" y="6" width="8" height="1" fill="currentColor" />
    </svg>
  );
}

function AimMinimize() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="8" width="6" height="2" rx="0.5" fill="#fff" />
    </svg>
  );
}

function AimMaximize() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="2" y="2" width="8" height="2" rx="0.5" fill="#fff" />
      <rect x="2" y="2" width="8" height="8" rx="0.5" stroke="#fff" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function AimClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 3l6 6M9 3l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  actionButtons?: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** When true, the outer wrapper div omits win95-panel-section and border classes */
  bare?: boolean;
  /** Additional className on the children wrapper */
  contentClassName?: string;
  tabStyle?: boolean;
  /** Stable ID for tutorial targeting via data-section-id attribute */
  sectionId?: string;
}

export default function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
  actionButtons,
  collapsible = true,
  open: controlledOpen,
  onToggle,
  bare = false,
  contentClassName,
  tabStyle = false,
  sectionId: sectionIdProp,
}: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const cap = useThemeCapabilities();
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isSciin = cap.usesTextControls;
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isScenit = cap.layoutShell === "scenit-grid";
  const sectionId = sectionIdProp ?? title.toLowerCase().replace(/\s+/g, "-");
  const isAim = cap.layoutShell === "xp-desktop";

  const moduleRef = useRef<HTMLDivElement>(null);
  const tabElRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<FrameGeometry | null>(null);
  const reactId = useId();
  const svgId = (name: string) => `${name}-${reactId}`;

  const configKey = `${TAB_PAD_T}.${TAB_PAD_B}.${TAB_PAD_L}.${TAB_PAD_R}.${TAB_TOP_Y}.${PANEL_R}.${TAB_CORNER_R}.${TAB_ANGLE_DEG}.${TAB_SVG_EXTEND}.${FLAT_HALF_RATIO}`;

  useEffect(() => {
    if (!isWinamp || !tabStyle) return;
    const mod = moduleRef.current;
    const tab = tabElRef.current;
    if (!mod || !tab) return;

    const measure = () => {
      const mR = mod.getBoundingClientRect();
      const tR = tab.getBoundingClientRect();
      if (mR.width === 0 || mR.height === 0) return;
      setFrame(
        computeTabPanelFrame(
          mR.width,
          mR.height,
          tR.left - mR.left,
          tR.width
        )
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(mod);
    return () => ro.disconnect();
  }, [isWinamp, tabStyle, configKey]);

  const { tutorialSectionId } = useScene();
  const tutorialActive = tutorialSectionId != null;

  const isControlled = controlledOpen !== undefined;
  const isOpen = tutorialActive
    ? sectionId === tutorialSectionId
    : collapsible
      ? (isControlled ? controlledOpen : internalOpen)
      : true;
  const handleOpen = (v: boolean) => {
    if (onToggle) onToggle(v);
    if (!isControlled) setInternalOpen(v);
  };

  useEffect(() => {
    if (tutorialSectionId === sectionId && moduleRef.current) {
      moduleRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [tutorialSectionId, sectionId]);

  const wrapperClass = bare
    ? `${isSciin ? "sciin-panel-shell " : ""}flex flex-col flex-1 min-h-0`
    : `${isSciin ? "sciin-panel-shell " : ""}win95-panel-section border-b border-surface-border last:border-b-0`;

  return (
    <div className={wrapperClass} data-section={sectionId} data-section-id={sectionId}>
      {isSciin ? (
        <div
          className="sciin-section-header sciin-terminal-band relative flex w-full items-center gap-0 px-[10px] text-[10px] font-bold uppercase"
          style={{ fontFamily: "'Courier New', Courier, monospace", letterSpacing: "0.15em", background: "none", border: "none", height: 16, marginBottom: isOpen ? 0 : 16 }}
        >
          {collapsible && (
            <button
              onClick={() => handleOpen(!isOpen)}
              style={{ color: "var(--section-accent, rgb(var(--ac-400)))", flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit", textTransform: "inherit" }}
            >
              {isOpen ? "[-]" : "[+]"}
            </button>
          )}
          <span style={{ color: "var(--section-accent, rgb(var(--ac-400)))", opacity: 0.5 }}>{collapsible ? " = " : "=== "}</span>
          <span className="sciin-section-title shrink-0" style={{ color: "var(--section-accent, rgb(var(--ac-400)))" }}>{title}</span>
          <span className="sciin-section-rule" style={{ color: "var(--section-accent, rgb(var(--ac-400)))", flex: "1 1 0%", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", opacity: 0.5 }}>
            {" "}{"=".repeat(200)}
          </span>
          {actionButtons && <span className="sciin-section-actions ml-[10px]">{actionButtons}</span>}
        </div>
      ) : isAim ? (
        <div className="flex w-full items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="flex-1 text-left">{title}</span>
          {actionButtons && <span className="ml-auto">{actionButtons}</span>}
          {collapsible && (
            <span className={`${actionButtons ? "ml-1" : "ml-auto"} flex aim-titlebar-btns`}>
              <button
                onClick={() => handleOpen(false)}
                className="aim-titlebar-btn aim-titlebar-btn-blue"
                title="Minimize"
              >
                <AimMinimize />
              </button>
              <button
                onClick={() => handleOpen(true)}
                className="aim-titlebar-btn aim-titlebar-btn-blue"
                title="Maximize"
              >
                <AimMaximize />
              </button>
              <button
                onClick={() => handleOpen(false)}
                className="aim-titlebar-btn aim-titlebar-btn-red"
                title="Close"
              >
                <AimClose />
              </button>
            </span>
          )}
        </div>
      ) : isWinamp && tabStyle ? (
        <div className="winamp-tab-module" ref={moduleRef}>
          {frame && (
            <>
              <svg
                className="winamp-tab-fill"
                width="100%"
                height="100%"
                style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 1 }}
              >
                <defs>
                  <linearGradient
                    id={svgId("wtfTabGrad")}
                    x1="0"
                    y1={frame.tabGradY1}
                    x2="0"
                    y2={frame.tabGradY2}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#DDDEE7" />
                    <stop offset="9%" stopColor="#D9DAE3" />
                    <stop offset="100%" stopColor="#F4F4F6" />
                  </linearGradient>
                  <linearGradient
                    id={svgId("wtfPanelGrad")}
                    x1="0"
                    y1={frame.panelGradY1}
                    x2="0"
                    y2={frame.panelGradY2}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#EFF0F5" />
                    <stop offset="4%" stopColor="#EAEBF1" />
                    <stop offset="7%" stopColor="#E8E8EF" />
                    <stop offset="14%" stopColor="#F6F6F8" />
                    <stop offset="24%" stopColor="#F5F5F7" />
                    <stop offset="50%" stopColor="#DBDCE5" />
                    <stop offset="70%" stopColor="#BEC4D0" />
                    <stop offset="82%" stopColor="#BCC3CF" />
                    <stop offset="90%" stopColor="#D3D5DE" />
                    <stop offset="95%" stopColor="#DFE0E8" />
                    <stop offset="100%" stopColor="#E8E8EC" />
                  </linearGradient>
                  <clipPath id={svgId("wtfShadowClipA")} clipPathUnits="userSpaceOnUse">
                    <path d={`M 0 0 H 9999 V 9999 H 0 Z ${frame.panelRect}`} clipRule="evenodd" />
                  </clipPath>
                  <linearGradient id={svgId("wtfSideFadeGrad")} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={frame.moduleW} y2="0">
                    <stop offset="0" stopColor="#808080" />
                    <stop offset={9 / frame.moduleW} stopColor="#808080" />
                    <stop offset={16 / frame.moduleW} stopColor="white" />
                    <stop offset={1 - 16 / frame.moduleW} stopColor="white" />
                    <stop offset={1 - 9 / frame.moduleW} stopColor="#808080" />
                    <stop offset="1" stopColor="#808080" />
                  </linearGradient>
                  <mask id={svgId("wtfSideFade")} maskUnits="userSpaceOnUse" x="0" y="0" width={frame.moduleW} height="9999">
                    <rect x="0" y="0" width={frame.moduleW} height="9999" fill={`url(#${svgId("wtfSideFadeGrad")})`} />
                  </mask>
                  <linearGradient id={svgId("wtfHighlightFadeGrad")} gradientUnits="userSpaceOnUse" x1="0" y1={frame.panelGradY1} x2="0" y2={frame.panelGradY2}>
                    <stop offset="0%" stopColor="white" />
                    <stop offset="65%" stopColor="white" />
                    <stop offset="100%" stopColor="black" />
                  </linearGradient>
                  <mask id={svgId("wtfHighlightFade")} maskUnits="userSpaceOnUse" x="0" y="0" width={frame.moduleW} height="9999">
                    <rect x="0" y="0" width={frame.moduleW} height="9999" fill={`url(#${svgId("wtfHighlightFadeGrad")})`} />
                  </mask>
                </defs>
                <g className="wtf-shadow-group" clipPath={`url(#${svgId("wtfShadowClipA")})`} mask={`url(#${svgId("wtfSideFade")})`}>
                  <path
                    d={frame.outline}
                    fill="none"
                    stroke="rgba(0,0,0,0.015)"
                    strokeWidth="7"
                    strokeLinejoin="round"
                  />
                  <path
                    d={frame.outline}
                    fill="none"
                    stroke="rgba(0,0,0,0.027)"
                    strokeWidth="6"
                    strokeLinejoin="round"
                  />
                  <path
                    d={frame.outline}
                    fill="none"
                    stroke="rgba(0,0,0,0.025)"
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                  <path
                    d={frame.outline}
                    fill="none"
                    stroke="rgba(0,0,0,0.04)"
                    strokeWidth="5"
                    strokeLinejoin="round"
                  />
                  <path
                    d={frame.outline}
                    fill="none"
                    stroke="rgba(0,0,0,0.068)"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                  <path
                    d={frame.outline}
                    fill="none"
                    stroke="rgba(0,0,0,0.04)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <path
                    d={frame.outline}
                    fill="none"
                    stroke="rgba(0,0,0,0.095)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <path
                    d={frame.outline}
                    fill="none"
                    stroke="rgba(0,0,0,0.122)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </g>
                <path className="wtf-tab-fill" d={frame.tabFill} fill={`url(#${svgId("wtfTabGrad")})`} />
                <path className="wtf-panel-fill" d={frame.panelRect} fill={`url(#${svgId("wtfPanelGrad")})`} />
                <path
                  d={frame.highlightPath}
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  mask={`url(#${svgId("wtfHighlightFade")})`}
                />
                <path
                  d={frame.outline}
                  fill="none"
                  stroke="rgba(30,34,42,0.7)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
          <div className="winamp-tab-backplate">
            {collapsible && (
              <span className="winamp-tab-corner-btns">
                <button
                  onClick={() => handleOpen(false)}
                  className="winamp-tab-btn"
                  title="Minimize"
                >
                  <WinampMinimize />
                </button>
                <button
                  onClick={() => handleOpen(true)}
                  className="winamp-tab-btn"
                  title="Maximize"
                >
                  <WinampMaximize />
                </button>
              </span>
            )}
            <div className="winamp-tab-header-lip">
              <span className="winamp-folder-tab" ref={tabElRef}>
                <span className="winamp-folder-tab-label">{title}</span>
              </span>
              {actionButtons && <span className="winamp-tab-actions">{actionButtons}</span>}
            </div>
          </div>
          <div ref={panelRef} className={`winamp-tab-panel ${contentClassName || "px-3 py-3"}`}>
            {isOpen && children}
          </div>
        </div>
      ) : isWinamp ? (
        <div className="flex w-full items-center gap-1.5 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
          <span className="winamp-header-groove flex-1 min-w-[12px]" />
          <span className="shrink-0">{title}</span>
          <span className="winamp-header-groove flex-1" />
          {actionButtons && <span className="ml-1">{actionButtons}</span>}
          {collapsible && (
            <span className={`${actionButtons ? "" : "ml-1 "}flex winamp-titlebar-btns`}>
              <button
                onClick={() => handleOpen(false)}
                className="winamp-titlebar-btn"
                title="Minimize"
              >
                <WinampMinimize />
              </button>
              <button
                onClick={() => handleOpen(true)}
                className="winamp-titlebar-btn"
                title="Maximize"
              >
                <WinampMaximize />
              </button>
            </span>
          )}
        </div>
      ) : isWin95 ? (
        <div className="flex w-full items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="flex-1 text-left">{title}</span>
          {actionButtons && <span className="ml-auto">{actionButtons}</span>}
          {collapsible && (
            <span className={`${actionButtons ? "ml-1" : "ml-auto"} flex win95-titlebar-btns`}>
              <button
                onClick={() => handleOpen(false)}
                className="win95-titlebar-btn"
                title="Minimize"
              >
                <Win95Minimize />
              </button>
              <button
                onClick={() => handleOpen(true)}
                className="win95-titlebar-btn"
                title="Maximize"
              >
                <Win95Maximize />
              </button>
            </span>
          )}
        </div>
      ) : collapsible && !actionButtons ? (
        isScenit ? (
        <div
          data-section-header
          role="button"
          tabIndex={0}
          onClick={() => handleOpen(!isOpen)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOpen(!isOpen); }}
          className="flex w-full cursor-pointer items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted transition-colors hover:text-content-primary"
        >
          <span className="flex-1 text-left">{title}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
          />
        </div>
        ) : (
        <button
          onClick={() => handleOpen(!isOpen)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-content-muted transition-colors hover:text-content-primary"
        >
          <ThemeIcon
            icon={ChevronDown}
            className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
          />
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="flex-1 text-left">{title}</span>
        </button>
        )
      ) : (
        <div className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-content-muted">
          {collapsible ? (
            <button
              onClick={() => handleOpen(!isOpen)}
              className="flex items-center gap-2 transition-colors hover:text-content-primary"
            >
              <ThemeIcon
                icon={ChevronDown}
                className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
              />
              {icon && <span className="shrink-0">{icon}</span>}
              <span className="text-left">{title}</span>
            </button>
          ) : (
            <>
              {icon && <span className="shrink-0">{icon}</span>}
              <span className="text-left">{title}</span>
            </>
          )}
          {actionButtons && <span className="ml-auto">{actionButtons}</span>}
        </div>
      )}
      {!(isWinamp && tabStyle) && isOpen && (
        <div
          className={
            isSciin
              ? `sciin-section-body sciin-texture-body ${contentClassName || "px-3 pt-2 pb-[16px]"}`
              : isWinamp
                ? `winamp-panel-content ${contentClassName || "px-3 py-3"}`
                : contentClassName || "px-3 py-3"
          }
        >
          {children}
        </div>
      )}
      {isSciin && !bare && (
        <div className="sciin-section-divider" style={{ marginTop: isOpen ? 0 : 16, marginBottom: 16 }}>
          <HashBorder direction="horizontal" />
        </div>
      )}
    </div>
  );
}
