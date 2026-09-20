"use client";

import React from "react";
import { WindowManagerProvider } from "@/themes/xX_sCeNeIt_Xx/window-manager";
import FloatingWindow from "./FloatingWindow";
import XPTaskbar from "./XPTaskbar";

interface WindowSlot {
  content: React.ReactNode;
  actionButtons?: React.ReactNode;
}

interface XPDesktopProps {
  buddyList: React.ReactNode;
  viewport: React.ReactNode;
  settings: React.ReactNode;
  timeline: WindowSlot;
  floorplan: WindowSlot;
  overlays?: React.ReactNode;
}

export default function XPDesktop({
  buddyList,
  viewport,
  settings,
  timeline,
  floorplan,
  overlays,
}: XPDesktopProps) {
  return (
    <WindowManagerProvider>
      <div className="xp-desktop">
        <div className="xp-desktop-area">
          <FloatingWindow id="buddy-list">
            {buddyList}
          </FloatingWindow>

          <FloatingWindow id="viewport">
            {viewport}
          </FloatingWindow>

          <FloatingWindow id="settings">
            {settings}
          </FloatingWindow>

          <FloatingWindow id="timeline" actionButtons={timeline.actionButtons}>
            {timeline.content}
          </FloatingWindow>

          <FloatingWindow id="floorplan" actionButtons={floorplan.actionButtons}>
            {floorplan.content}
          </FloatingWindow>
        </div>

        <XPTaskbar />

        {overlays}
      </div>
    </WindowManagerProvider>
  );
}
