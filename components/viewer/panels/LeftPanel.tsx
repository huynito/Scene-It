"use client";

import { useRef } from "react";
import { MapPin, Images, Route, Upload } from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import { useScene } from "@/lib/scene-context";
import {
  deserializePath,
  deserializeBakedPath,
  deserializeExchangeFormat,
} from "@/lib/camera-path";
import type { CameraPath, BakedCameraPath } from "@/lib/camera-path";
import CollapsibleSection from "./CollapsibleSection";
import AnchorPanel from "./AnchorPanel";
import AssetBrowser from "./AssetBrowser";
import PathPanel from "@/components/viewer/PathPanel";

export default function LeftPanel() {
  const cap = useThemeCapabilities();
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isSciin = cap.usesTextControls;
  const { showPathPanel, userMode, actions } = useScene();
  const expandedPanels = userMode.panelDefaults.expanded;

  const importFileRef = useRef<HTMLInputElement>(null);
  const handleImportPath = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      actions.pushUndo();
      const exchange = deserializeExchangeFormat(text);
      if (exchange) {
        if ("keyframes" in exchange) {
          actions.setPaths((prev) => [...prev, exchange as CameraPath]);
          actions.setActivePathId(exchange.id);
          actions.setActiveBakedPathId(null);
        } else {
          actions.setBakedPaths((prev) => [...prev, exchange as BakedCameraPath]);
          actions.setActiveBakedPathId(exchange.id);
          actions.setActivePathId(null);
        }
        if (importFileRef.current) importFileRef.current.value = "";
        return;
      }
      const baked = deserializeBakedPath(text);
      if (baked) {
        baked.id = `baked-${Date.now()}`;
        actions.setBakedPaths((prev) => [...prev, baked]);
        actions.setActiveBakedPathId(baked.id);
        actions.setActivePathId(null);
        if (importFileRef.current) importFileRef.current.value = "";
        return;
      }
      const path = deserializePath(text);
      if (path) {
        path.id = `path-${Date.now()}`;
        actions.setPaths((prev) => [...prev, path]);
        actions.setActivePathId(path.id);
        actions.setActiveBakedPathId(null);
      }
    };
    reader.readAsText(file);
    if (importFileRef.current) importFileRef.current.value = "";
  };

  const winampImportButton = isWinamp ? (
    <label className="winamp-playlist-import-btn cursor-pointer" title="Import path JSON">
      <ThemeIcon icon={Upload} className="h-3 w-3" />
      <input
        ref={importFileRef}
        type="file"
        accept=".json"
        onChange={handleImportPath}
        className="hidden"
      />
    </label>
  ) : undefined;

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${isWinamp ? "winamp-panel-scroll" : "scrollbar-thin"} ${isSciin ? "sciin-left-stack" : ""}`}>
      <CollapsibleSection
        title="Anchors"
        icon={<ThemeIcon icon={MapPin} className="h-3 w-3" header />}
        defaultOpen={expandedPanels.includes("anchors")}
        sectionId="anchors"
      >
        <AnchorPanel />
      </CollapsibleSection>

      <CollapsibleSection
        title="Media Library"
        icon={<ThemeIcon icon={Images} className="h-3 w-3" header />}
        defaultOpen={expandedPanels.includes("media-library")}
        sectionId="media-library"
      >
        <AssetBrowser />
      </CollapsibleSection>

      <CollapsibleSection
        title="Paths"
        icon={<ThemeIcon icon={Route} className="h-3 w-3" header />}
        open={showPathPanel}
        onToggle={(v) => actions.setShowPathPanel(v)}
        contentClassName={isSciin ? "px-3 pb-[16px]" : undefined}
        actionButtons={winampImportButton}
        sectionId="paths"
      >
        <PathPanel />
      </CollapsibleSection>
    </div>
  );
}
