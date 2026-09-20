"use client";

import React, { useRef, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { isAccepted, buildLibraryItem } from "@/lib/media-utils";
import { formatDuration } from "@/lib/camera-path";
import { MarqueeName } from "./AssetBrowser";

export default function WinampPlaylistWindow() {
  const { playlist, currentTrackId, actions } = useScene();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const audioFiles = Array.from(files).filter(
        (f) => isAccepted(f) && (f.type.startsWith("audio/") || /\.(mp3|wav|ogg|aac|m4a|flac|wma)$/i.test(f.name))
      );
      if (audioFiles.length === 0) return;
      setLoading(true);
      try {
        const items = await Promise.all(audioFiles.map(buildLibraryItem));
        actions.setPlaylist((prev) => [...prev, ...items]);
        if (!currentTrackId && items.length > 0) {
          actions.setCurrentTrackId(items[0].id);
        }
      } finally {
        setLoading(false);
      }
    },
    [actions, currentTrackId],
  );

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files);
      e.target.value = "";
    },
    [processFiles],
  );

  const removeTrack = useCallback(
    (id: string) => {
      actions.setPlaylist((prev) => {
        const item = prev.find((t) => t.id === id);
        if (item) URL.revokeObjectURL(item.url);
        return prev.filter((t) => t.id !== id);
      });
      if (currentTrackId === id) {
        actions.setCurrentTrackId(null);
        actions.setIsAudioPlaying(false);
      }
    },
    [actions, currentTrackId],
  );

  const selectTrack = useCallback(
    (id: string) => {
      actions.setCurrentTrackId(id);
      actions.setIsAudioPlaying(true);
    },
    [actions],
  );

  return (
    <div className="flex flex-col gap-0 h-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/flac,.mp3,.wav,.ogg,.aac,.m4a,.flac,.wma"
        className="hidden"
        onChange={handleUpload}
      />

      {/* Track list */}
      <div className="winamp-playlist flex-1" style={{ minHeight: 80 }}>
        {playlist.length === 0 && !loading ? (
          <div className="winamp-playlist-empty">
            <span>No tracks</span>
            <span className="empty-sub">Add .mp3, .wav, .ogg files</span>
          </div>
        ) : (
          playlist.map((item, idx) => (
            <div
              key={item.id}
              className={`winamp-playlist-row${currentTrackId === item.id ? " selected" : ""}`}
              onDoubleClick={() => selectTrack(item.id)}
              onClick={() => actions.setCurrentTrackId(item.id)}
            >
              <span className="playlist-num">{idx + 1}.</span>
              <MarqueeName name={item.name} />
              {item.duration != null && (
                <span className="playlist-info">{formatDuration(item.duration)}</span>
              )}
              {!item.isDefault && (
                <span className="playlist-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrack(item.id);
                    }}
                    title="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {loading && (
        <p className="animate-pulse text-center text-[10px] text-content-muted py-1">
          Processing…
        </p>
      )}

      {/* Footer buttons */}
      <div className="winamp-playlist-footer">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 text-[10px] text-content-muted transition-colors hover:text-content-primary winamp-btn-label"
        >
          <Plus className="h-3 w-3" />
          ADD MEDIA
        </button>
        {playlist.some((item) => !item.isDefault) && (
          <button
            onClick={() => {
              actions.setIsAudioPlaying(false);
              playlist.forEach((item) => { if (!item.isDefault) URL.revokeObjectURL(item.url); });
              actions.setPlaylist((prev) => prev.filter((item) => item.isDefault));
              actions.setCurrentTrackId(null);
            }}
            className="text-[10px] text-content-faint hover:text-red-400 winamp-btn-label"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
