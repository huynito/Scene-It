"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Plus, Trash2, Play, Pause, Square, SkipBack, SkipForward } from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { isAccepted, buildLibraryItem } from "@/lib/media-utils";
import { formatDuration } from "@/lib/camera-path";
import { MarqueeName } from "./AssetBrowser";

const SPECTRUM_BAR_COUNT = 48;
const SPECTRUM_DELAYS = Array.from({ length: SPECTRUM_BAR_COUNT }, (_, i) =>
  ((i * 13 + 7) % SPECTRUM_BAR_COUNT) * 0.06
);

function WinampSpectrum({ active }: { active?: boolean }) {
  return (
    <div className={`winamp-spectrum${active ? "" : " paused"}`}>
      {SPECTRUM_DELAYS.map((delay, i) => (
        <div
          key={i}
          className="winamp-spectrum-bar"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlaylistPanel() {
  const { playlist, currentTrackId, isAudioPlaying, actions } = useScene();
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);

  const currentTrack = playlist.find((t) => t.id === currentTrackId);

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

  const playPause = useCallback(() => {
    if (!currentTrack) {
      if (playlist.length > 0) {
        actions.setCurrentTrackId(playlist[0].id);
        actions.setIsAudioPlaying(true);
      }
      return;
    }
    actions.setIsAudioPlaying(!isAudioPlaying);
  }, [currentTrack, isAudioPlaying, playlist, actions]);

  const stop = useCallback(() => {
    actions.setIsAudioPlaying(false);
    if (audioRef.current) audioRef.current.currentTime = 0;
    setCurrentTime(0);
  }, [actions]);

  const skipPrev = useCallback(() => {
    if (playlist.length === 0) return;
    const idx = playlist.findIndex((t) => t.id === currentTrackId);
    const prevIdx = idx <= 0 ? playlist.length - 1 : idx - 1;
    actions.setCurrentTrackId(playlist[prevIdx].id);
    actions.setIsAudioPlaying(true);
  }, [playlist, currentTrackId, actions]);

  const skipNext = useCallback(() => {
    if (playlist.length === 0) return;
    const idx = playlist.findIndex((t) => t.id === currentTrackId);
    const nextIdx = idx >= playlist.length - 1 ? 0 : idx + 1;
    actions.setCurrentTrackId(playlist[nextIdx].id);
    actions.setIsAudioPlaying(true);
  }, [playlist, currentTrackId, actions]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = currentTrack.url;
    audio.volume = volume;
    if (isAudioPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentTrackId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isAudioPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isAudioPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      const idx = playlist.findIndex((t) => t.id === currentTrackId);
      if (idx < playlist.length - 1) {
        actions.setCurrentTrackId(playlist[idx + 1].id);
        actions.setIsAudioPlaying(true);
      } else {
        actions.setIsAudioPlaying(false);
        setCurrentTime(0);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playlist, currentTrackId, actions]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  }, []);

  return (
    <div className="flex flex-col gap-0">
      <audio ref={audioRef} preload="auto" />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/flac,.mp3,.wav,.ogg,.aac,.m4a,.flac,.wma"
        className="hidden"
        onChange={handleUpload}
      />

      {/* Now playing + spectrum */}
      <div className="winamp-playlist-now-playing">
        <WinampSpectrum active={isAudioPlaying} />
        <div className="winamp-playlist-now-playing-info">
          {currentTrack ? (
            <MarqueeName name={currentTrack.name} />
          ) : (
            <span className="text-content-faint">No track selected</span>
          )}
        </div>
      </div>

      {/* Transport + time */}
      <div className="winamp-playlist-transport">
        <div className="winamp-playlist-time">
          <span className="winamp-time-display">{formatTime(currentTime)}</span>
          <span className="winamp-time-separator">/</span>
          <span className="winamp-time-display">{formatTime(duration)}</span>
        </div>
        <div className="winamp-playlist-controls">
          <button onClick={skipPrev} title="Previous" className="winamp-transport-btn">
            <SkipBack className="h-3 w-3" />
          </button>
          <button onClick={playPause} title={isAudioPlaying ? "Pause" : "Play"} className="winamp-transport-btn play">
            {isAudioPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button onClick={stop} title="Stop" className="winamp-transport-btn">
            <Square className="h-3 w-3" />
          </button>
          <button onClick={skipNext} title="Next" className="winamp-transport-btn">
            <SkipForward className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Seek bar */}
      <div className="winamp-playlist-seek">
        <div className="slider-track-wrapper relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-border-secondary"
          />
        </div>
      </div>

      {/* Volume */}
      <div className="winamp-playlist-volume">
        <span className="winamp-label">VOL</span>
        <div className="slider-track-wrapper relative flex flex-1 items-center">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-border-secondary"
          />
        </div>
      </div>

      {/* Track list */}
      <div className="winamp-playlist" style={{ minHeight: 60 }}>
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
            </div>
          ))
        )}
      </div>

      {loading && (
        <p className="animate-pulse text-center text-[10px] text-content-muted py-1">
          Processing…
        </p>
      )}

      {/* Bottom buttons */}
      <div className="winamp-btn-tray self-center" style={{ padding: "4px 6px" }}>
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
              stop();
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
