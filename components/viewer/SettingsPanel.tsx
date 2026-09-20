"use client";

import {
  Camera,
  SlidersHorizontal,
  Layers,
  Box,
} from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import { useScene } from "@/lib/scene-context";
import CollapsibleSection from "./panels/CollapsibleSection";
import CameraPanel from "./panels/CameraPanel";
import PostProcessingPanel from "./panels/PostProcessingPanel";
import AROverlayPanel from "./panels/AROverlayPanel";
import DepthMeshPanel from "./panels/DepthMeshPanel";

export default function SettingsPanel() {
  const cap = useThemeCapabilities();
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isSciin = cap.usesTextControls;
  const { userMode } = useScene();
  const expanded = userMode.panelDefaults.expanded;

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${isWinamp ? "winamp-settings-scroll winamp-panel-scroll" : isSciin ? "scrollbar-thin" : "scrollbar-thin pb-6"}`}>
      <CollapsibleSection
        title="Camera"
        icon={<ThemeIcon icon={Camera} className="h-3 w-3" header />}
        defaultOpen={expanded.includes("camera")}
        sectionId="camera"
      >
        <CameraPanel />
      </CollapsibleSection>

      <CollapsibleSection
        title="AR Settings"
        icon={<ThemeIcon icon={Layers} className="h-3 w-3" header />}
        defaultOpen={expanded.includes("ar-overlay")}
        sectionId="ar-overlay"
      >
        <AROverlayPanel />
      </CollapsibleSection>

      <CollapsibleSection
        title="Post Processing"
        icon={<ThemeIcon icon={SlidersHorizontal} className="h-3 w-3" header />}
        defaultOpen={expanded.includes("post-processing")}
        sectionId="post-processing"
      >
        <PostProcessingPanel />
      </CollapsibleSection>

      {process.env.NEXT_PUBLIC_DEV_MODE === "true" && (
        <CollapsibleSection
          title="Occlusion"
          icon={<ThemeIcon icon={Box} className="h-3 w-3" header />}
          defaultOpen={false}
          sectionId="occlusion"
        >
          <DepthMeshPanel />
        </CollapsibleSection>
      )}
    </div>
  );
}
