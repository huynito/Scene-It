"use client";

import { useScene } from "@/lib/scene-context";
import { useThemeCapabilities } from "@/themes";
import { W95HeaderClock } from "@/themes/win95/icons";
import CollapsibleSection from "./CollapsibleSection";
import Timeline from "../Timeline";
import GraphEditor from "../GraphEditor";

export default function BottomPanel() {
  const { activePathId, anchorAnimations, showGraphEditor, actions } = useScene();
  const hasAnyAnchorAnim = anchorAnimations.some((a) => a.keyframes.length >= 1);
  const cap = useThemeCapabilities();
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isSciin = cap.usesTextControls;
  const isAim = cap.layoutShell === "xp-desktop";
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isScenit = cap.layoutShell === "scenit-grid";
  const isSkeuomorphic = isWin95 || isAim;

  const curvesButton = (
    <button
      onClick={() => actions.setShowGraphEditor((v) => !v)}
      className={isSciin
        ? `sciin-toolbar-btn font-bold text-[10px] uppercase ${showGraphEditor ? "text-accent-400" : ""}`
        : `rounded px-1.5 py-0.5 text-[10px] font-medium uppercase transition-colors ${
            showGraphEditor
              ? "bg-accent-500/20 text-accent-400"
              : "text-content-faint hover:text-content-secondary"
          }`
      }
    >
      {isSciin ? "[Curves]" : "Curves"}
    </button>
  );

  if (isWinamp) {
    return (
      <div className="winamp-bottom-panel-inner h-full flex flex-col justify-start">
        <Timeline />
        {showGraphEditor && (
          <div className="winamp-bottom-panel-graph">
            <GraphEditor />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-theme win95-window win95-bottom-panel flex h-full min-h-0 flex-col ${isSciin ? "sciin-bottom-shell" : "overflow-hidden"}`}>
      {(activePathId || hasAnyAnchorAnim) ? (
        <CollapsibleSection
          title="Timeline"
          collapsible={false}
          bare
          icon={isWin95 ? <W95HeaderClock size={16} /> : isAim ? <W95HeaderClock size={16} /> : undefined}
          actionButtons={isScenit ? undefined : curvesButton}
          contentClassName="min-h-0 flex-1 overflow-y-auto"
        >
          <div className={isSkeuomorphic ? "min-h-full flex flex-col" : ""} style={isWin95 ? { borderBottom: "2px solid #808080", boxShadow: "0 2px 0 #000" } : isAim ? { borderBottom: "1px solid #7F9DB9" } : undefined}>
            <Timeline />
            {showGraphEditor && (
              <div className={`border-t border-surface-border${isScenit ? " scenit-graph-section" : ""}`}>
                <GraphEditor />
              </div>
            )}
          </div>
        </CollapsibleSection>
      ) : (
        <div className="flex h-full items-center justify-center gap-1">
          <p className="text-[10px] text-content-faint">
            Press <kbd className="rounded bg-surface-raised px-1 py-0.5 text-[9px] font-medium text-content-secondary">K</kbd> to add a keyframe, or open{" "}
            <button
              onClick={() => actions.setShowPathPanel(true)}
              className={`text-accent-400 hover:text-accent-300${isWin95 ? " win95-plain-link px-2 py-0.5" : isScenit ? " px-1 py-0.5" : ""}${isSciin ? " sciin-plain-link" : ""}`}
            >
              Camera Paths
            </button>{" "}
            to generate a walkthrough.
          </p>
        </div>
      )}
    </div>
  );
}
