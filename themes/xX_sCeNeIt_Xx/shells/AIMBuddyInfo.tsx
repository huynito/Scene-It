"use client";

import React, { useEffect, useRef } from "react";
import type { SceneAnchor, MediaLibraryItem } from "@/lib/scene-context";
import type { CameraPath } from "@/lib/camera-path";
import { AimGetInfo } from "@/themes/xX_sCeNeIt_Xx/icons";

type InfoTarget =
  | { type: "anchor"; data: SceneAnchor; isTarget: boolean }
  | { type: "media"; data: MediaLibraryItem; assignedTo?: string }
  | { type: "path"; data: CameraPath };

interface AIMBuddyInfoProps {
  target: InfoTarget;
  position: { x: number; y: number };
  onClose: () => void;
}

function fmt(n: number) {
  return n.toFixed(2);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="aim-info-row">
      <span className="aim-info-label">{label}:</span>
      <span className="aim-info-value">{value}</span>
    </div>
  );
}

export default function AIMBuddyInfo({ target, position, onClose }: AIMBuddyInfoProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  let title = "";
  let body: React.ReactNode = null;

  if (target.type === "anchor") {
    const a = target.data;
    title = a.label;
    body = (
      <>
        <InfoRow label="Position" value={`(${fmt(a.position.x)}, ${fmt(a.position.y)}, ${fmt(a.position.z)})`} />
        <InfoRow label="Rotation" value={`(${fmt(a.rotation.x)}, ${fmt(a.rotation.y)}, ${fmt(a.rotation.z)})`} />
        <InfoRow label="Media" value={a.mediaUrl ? `${a.mediaType || "image"}` : "None"} />
        <InfoRow label="Scale" value={fmt(a.scale)} />
        <InfoRow label="Opacity" value={`${Math.round(a.opacity * 100)}%`} />
        <InfoRow label="Camera Target" value={target.isTarget ? "Yes" : "No"} />
        <InfoRow label="Visible" value={a.visible ? "Yes" : "No"} />
      </>
    );
  } else if (target.type === "media") {
    const m = target.data;
    title = m.name;
    body = (
      <>
        <InfoRow label="Type" value={m.type} />
        <InfoRow label="Aspect Ratio" value={fmt(m.aspectRatio)} />
        {m.duration != null && <InfoRow label="Duration" value={`${fmt(m.duration)}s`} />}
        <InfoRow label="Assigned To" value={target.assignedTo || "Unassigned"} />
      </>
    );
  } else {
    const p = target.data;
    const dur = p.keyframes.length > 0 ? p.keyframes[p.keyframes.length - 1].time : 0;
    title = p.name;
    body = (
      <>
        <InfoRow label="Keyframes" value={p.keyframes.length} />
        <InfoRow label="Duration" value={`${fmt(dur)}s`} />
        <InfoRow label="Loop" value={p.loop ? "Yes" : "No"} />
        <InfoRow label="Spline" value={p.splineMode} />
        {p.walkMeta && <InfoRow label="Walk Style" value={p.walkMeta.stylePreset} />}
      </>
    );
  }

  return (
    <div
      ref={ref}
      className="aim-buddy-info"
      style={{
        left: Math.min(position.x, window.innerWidth - 260),
        top: Math.min(position.y, window.innerHeight - 200),
      }}
    >
      <div className="aim-buddy-info-titlebar">
        <span className="aim-buddy-info-title">
          <AimGetInfo className="aim-buddy-info-title-icon" />
          <span>Buddy Info: {title}</span>
        </span>
        <button className="aim-buddy-info-close" onClick={onClose}>×</button>
      </div>
      <div className="aim-buddy-info-body">
        {body}
      </div>
    </div>
  );
}
