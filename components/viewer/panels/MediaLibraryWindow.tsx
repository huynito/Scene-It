"use client";

import React, { useRef, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { isAccepted, buildLibraryItem } from "@/lib/media-utils";
import AnchorPanel from "./AnchorPanel";
import AssetBrowser from "./AssetBrowser";
import WinampAnchorDetail from "./WinampAnchorDetail";

type Section = "now-playing" | "anchors" | "media" | "video" | "audio";

const TREE_LEAVES: { id: Section; label: string }[] = [
  { id: "anchors", label: "Anchors" },
  { id: "media", label: "Media" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
];

export default function MediaLibraryWindow() {
  const [activeSection, setActiveSection] = useState<Section>("anchors");
  const { anchors, selectedAnchorId, actions, refs } = useScene();
  const selectedAnchor = activeSection === "anchors" && selectedAnchorId
    ? anchors.find((a) => a.id === selectedAnchorId) ?? null
    : null;
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [mediaLoading, setMediaLoading] = useState(false);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter(isAccepted);
      if (arr.length === 0) return;
      setMediaLoading(true);
      try {
        const items = await Promise.all(arr.map(buildLibraryItem));
        actions.setMediaLibrary((prev) => [...prev, ...items]);
      } finally {
        setMediaLoading(false);
      }
    },
    [actions],
  );

  const handleMediaUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files);
      e.target.value = "";
    },
    [processFiles],
  );

  const handleAddAnchor = useCallback(() => {
    actions.pushUndo();
    const result = refs.createAnchor.current?.();
    if (result) {
      actions.setAnchors((prev) => [...prev, result]);
      setActiveSection("anchors");
    }
  }, [actions, refs]);

  return (
    <div className="winamp-media-library">
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm,video/quicktime,.gif,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/flac,.mp3,.wav,.ogg,.aac,.m4a,.flac"
        className="hidden"
        onChange={handleMediaUpload}
      />

      {/* Columns */}
      <div className="winamp-media-library-columns">
        <div className="winamp-media-library-sidebar">
          <div className="winamp-media-library-category" style={{ marginTop: 4 }}>Local Media</div>
          <div className="winamp-media-library-tree">
            {TREE_LEAVES.map(({ id, label }, i) => (
              <button
                key={id}
                className={`winamp-media-library-nav-item indented${activeSection === id ? " active" : ""}${i === TREE_LEAVES.length - 1 ? " last" : ""}`}
                onClick={() => setActiveSection(id)}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="winamp-media-library-divider" />

        <div className="winamp-media-library-content">
          {activeSection === "anchors" && <AnchorPanel />}
          {activeSection === "media" && <AssetBrowser mediaFilter="image" />}
          {activeSection === "video" && <AssetBrowser mediaFilter="video" />}
          {activeSection === "audio" && <AssetBrowser mediaFilter="audio" />}
        </div>
      </div>

      {/* Detail zone (lighter chrome, visible when anchor selected) */}
      {activeSection === "anchors" && selectedAnchor && (
        <WinampAnchorDetail anchor={selectedAnchor} />
      )}

      <div className="winamp-media-library-rim" />

      {mediaLoading && (
        <p className="animate-pulse text-center text-[10px] text-content-muted py-1">
          Processing…
        </p>
      )}

      {/* Footer actions (darker chrome strip) */}
      <div className="winamp-media-library-footer">
        <button
          type="button"
          onClick={handleAddAnchor}
          className="winamp-btn-label flex items-center gap-1 text-[9px]"
        >
          <Plus className="h-2.5 w-2.5" />
          Place Anchor
        </button>
        <button
          type="button"
          onClick={() => mediaInputRef.current?.click()}
          className="winamp-btn-label flex items-center gap-1 text-[9px]"
        >
          <Plus className="h-2.5 w-2.5" />
          Add Media
        </button>
      </div>
    </div>
  );
}
