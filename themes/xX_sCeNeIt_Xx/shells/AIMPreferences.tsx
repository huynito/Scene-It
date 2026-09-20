"use client";

import React, { useState } from "react";
import CameraPanel from "@/components/viewer/panels/CameraPanel";
import AROverlayPanel from "@/components/viewer/panels/AROverlayPanel";
import PostProcessingPanel from "@/components/viewer/panels/PostProcessingPanel";
import DepthMeshPanel from "@/components/viewer/panels/DepthMeshPanel";

const TABS: { id: string; label: string; Panel: React.ComponentType }[] = [
  { id: "camera", label: "Camera", Panel: CameraPanel },
  { id: "overlay", label: "AR Settings", Panel: AROverlayPanel },
  { id: "post", label: "Post Processing", Panel: PostProcessingPanel },
  ...(process.env.NEXT_PUBLIC_DEV_MODE === "true"
    ? [{ id: "mesh", label: "Occlusion", Panel: DepthMeshPanel }]
    : []),
];

export default function AIMPreferences() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="aim-prefs flex h-full min-h-0 flex-col">
      <div className="aim-prefs-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`aim-prefs-tab${tab.id === activeTab ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="aim-prefs-panel">
        <div className="aim-prefs-content-body scrollbar-thin">
          <active.Panel />
        </div>
      </div>
      <div className="aim-prefs-button-bar">
        <button className="aim-prefs-btn">OK</button>
        <button className="aim-prefs-btn">Cancel</button>
      </div>
    </div>
  );
}
