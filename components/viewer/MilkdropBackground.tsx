"use client";

import { publicUrl } from "@/lib/utils";

export default function MilkdropBackground() {
  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      className="winamp-milkdrop-bg"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none", objectFit: "cover" }}
      src={publicUrl("/video/winamp-visualizer.mp4")}
    />
  );
}
