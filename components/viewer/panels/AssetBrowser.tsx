"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, Images, Plus, Music, Volume2, X, ListPlus } from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import { useScene } from "@/lib/scene-context";
import type { MediaLibraryItem, SceneAnchor } from "@/lib/scene-context";
import { isAccepted, buildLibraryItem } from "@/lib/media-utils";
import { anchorColor, CGA_PALETTE } from "@/themes/_shared/anchor-colors";
import { formatDuration } from "@/lib/camera-path";
import { W95ExplorerFolder, W95CloseGlyph, W95RecycleBin, W95TbClear, W95_EXPLORER_ICON_POOL } from "@/themes/win95/icons";

const MARQUEE_GAP = "\u00A0\u00A0\u00A0\u00A0";

export function MarqueeName({ name }: { name: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [scrolling, setScrolling] = useState(false);
  const [duration, setDuration] = useState(12);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      const isOver = el.scrollWidth > el.clientWidth + 2;
      setScrolling(isOver);
      if (isOver) setDuration(Math.max(4, el.scrollWidth / 40));
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [name]);

  return (
    <span
      ref={containerRef}
      className={`playlist-name${scrolling ? " is-overflowing" : ""}`}
      style={scrolling ? { "--marquee-duration": `${duration}s` } as React.CSSProperties : undefined}
    >
      <span className="playlist-name-inner">
        {name}{MARQUEE_GAP}{name}{MARQUEE_GAP}
      </span>
    </span>
  );
}

interface AssetBrowserProps {
  mediaFilter?: "image" | "video" | "audio";
}

export default function AssetBrowser({ mediaFilter }: AssetBrowserProps = {}) {
  const { anchors, selectedAnchorId, mediaLibrary, backgroundMusicId, actions, refs } = useScene();
  const cap = useThemeCapabilities();
  const isWin95 = cap.iconStyle === "win95-pixel";
  const isAim = cap.layoutShell === "xp-desktop";
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isSciin = cap.usesTextControls;
  const isSkeuomorphic = isWin95 || isAim;
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [assignPopoverItemId, setAssignPopoverItemId] = useState<string | null>(null);
  const [propertiesItemId, setPropertiesItemId] = useState<string | null>(null);
  const [emptyFolderSelected, setEmptyFolderSelected] = useState(false);
  const emptyFolderRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!emptyFolderSelected) return;
    const onMouseDown = (e: MouseEvent) => {
      if (emptyFolderRef.current && !emptyFolderRef.current.contains(e.target as Node)) {
        setEmptyFolderSelected(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [emptyFolderSelected]);

  useEffect(() => {
    if (!assignPopoverItemId) return;
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAssignPopoverItemId(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAssignPopoverItemId(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [assignPopoverItemId]);

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

  const removeLibraryItem = useCallback(
    (id: string) => {
      actions.pushUndo();
      if (backgroundMusicId === id) actions.setBackgroundMusicId(null);
      actions.setMediaLibrary((prev) => {
        const item = prev.find((i) => i.id === id);
        if (item) URL.revokeObjectURL(item.url);
        return prev.filter((i) => i.id !== id);
      });
    },
    [actions, backgroundMusicId],
  );

  const assignToAnchor = useCallback(
    async (anchor: SceneAnchor, item: MediaLibraryItem) => {
      try {
        if (!item.file) return;
        actions.pushUndo();
        const result = await refs.setAnchorMedia.current?.(anchor, item.file);
        if (!result) return;
        if (anchor.mediaUrl) URL.revokeObjectURL(anchor.mediaUrl);
        const BASE_SIZE = 1;
        const ar = result.aspectRatio || 1;
        const newW = ar >= 1 ? BASE_SIZE * ar : BASE_SIZE;
        const newH = ar >= 1 ? BASE_SIZE : BASE_SIZE / ar;
        refs.rebuildAnchor.current?.(anchor, newW, newH, 0);
        actions.setAnchors((prev) =>
          prev.map((a) =>
            a.id === anchor.id
              ? {
                  ...a,
                  width: newW,
                  height: newH,
                  cornerRadius: 0,
                  mediaUrl: result.url,
                  mediaThumbnailUrl: item.thumbnailUrl,
                  mediaType: result.mediaType,
                  mediaAspectRatio: result.aspectRatio,
                }
              : a,
          ),
        );
      } catch (err) {
        console.error("Assign media error:", err);
      }
    },
    [refs.setAnchorMedia, refs.rebuildAnchor, actions],
  );

  const handleAssignClick = useCallback(
    async (item: MediaLibraryItem) => {
      if (anchors.length === 0) return;
      if (anchors.length === 1) {
        await assignToAnchor(anchors[0], item);
        return;
      }
      setAssignPopoverItemId((prev) => (prev === item.id ? null : item.id));
    },
    [anchors, assignToAnchor],
  );

  const sortedAnchors = selectedAnchorId
    ? [...anchors].sort((a, b) => {
        if (a.id === selectedAnchorId) return -1;
        if (b.id === selectedAnchorId) return 1;
        return 0;
      })
    : anchors;

  const anchorByThumbnail = new Map<string, SceneAnchor>();
  for (const a of anchors) {
    if (a.mediaThumbnailUrl) anchorByThumbnail.set(a.mediaThumbnailUrl, a);
  }

  const visualItems = mediaLibrary.filter((m) => m.type !== "audio");
  const audioItems = mediaLibrary.filter((m) => m.type === "audio");

  const filteredItems = mediaFilter
    ? mediaFilter === "video"
      ? mediaLibrary.filter((m) => m.type === "video" || m.type === "gif")
      : mediaLibrary.filter((m) => m.type === mediaFilter)
    : visualItems;

  if (isWin95) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <input
          ref={mediaInputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm,video/quicktime,.gif,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/flac,.mp3,.wav,.ogg,.aac,.m4a,.flac"
          className="hidden"
          onChange={handleMediaUpload}
        />

        {mediaLoading && (
          <p className="animate-pulse text-center text-[11px] py-2" style={{ color: "#000" }}>
            Processing files…
          </p>
        )}

        {/* White content area with its own sunken bevel */}
        <div className="win95-canvas-border flex flex-col">
          <div className="win95-explorer-area overflow-y-auto">
            {mediaLibrary.length === 0 && !mediaLoading ? (
              <div className="win95-explorer-empty-wrap">
                <button
                  ref={emptyFolderRef}
                  type="button"
                  onClick={() => setEmptyFolderSelected(true)}
                  onDoubleClick={() => mediaInputRef.current?.click()}
                  className={`win95-explorer-empty${emptyFolderSelected ? " selected" : ""}`}
                >
                  <div className="win95-explorer-icon-wrap">
                    <W95ExplorerFolder size={32} />
                  </div>
                  <span className="win95-explorer-label win95-explorer-empty-label">My Documents</span>
                </button>
              </div>
            ) : (
              <div className="win95-explorer-grid">
                {mediaLibrary.map((item, idx) => {
                  const isAudio = item.type === "audio";
                  const isBgMusic = backgroundMusicId === item.id;
                  const poolIcon = W95_EXPLORER_ICON_POOL[idx % W95_EXPLORER_ICON_POOL.length];
                  return (
                    <div
                      key={item.id}
                      className={`win95-explorer-item${assignPopoverItemId === item.id ? " selected" : ""}`}
                      onDoubleClick={() => setPropertiesItemId(item.id)}
                      onClick={() => {
                        setAssignPopoverItemId(item.id);
                      }}
                      title={item.name}
                    >
                      <div className="win95-explorer-icon-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={poolIcon} width={32} height={32} alt="" draggable={false} style={{ imageRendering: "pixelated" }} />
                        {isAudio && (
                          <div className="win95-explorer-badge">♪</div>
                        )}
                      </div>
                      <span className="win95-explorer-label">
                        {item.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Status bar + action buttons (outside the bevel, on gray background) */}
        <div className="win95-explorer-footer">
          <div className="win95-explorer-statusbar">
            <span>{mediaLibrary.length} object{mediaLibrary.length !== 1 ? "(s)" : ""}</span>
          </div>
          <div className="win95-explorer-actions">
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className="win95-btn flex items-center gap-1 px-2 py-0.5 text-[11px]"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
            {assignPopoverItemId && (() => {
              const sel = mediaLibrary.find((m) => m.id === assignPopoverItemId);
              return sel && sel.type !== "audio" ? (
                <button
                  onClick={() => {
                    if (sel) handleAssignClick(sel);
                  }}
                  disabled={anchors.length === 0}
                  className="win95-btn flex items-center gap-1 px-2 py-0.5 text-[11px] disabled:opacity-50"
                  title={anchors.length === 0 ? "Place an anchor first" : `Assign "${sel.name}" to anchor`}
                >
                  Assign
                </button>
              ) : null;
            })()}
            {assignPopoverItemId && (
              <button
                onClick={() => removeLibraryItem(assignPopoverItemId)}
                className="win95-btn flex items-center gap-1 px-2 py-0.5 text-[11px]"
                title="Remove selected"
              >
                {mediaLibrary.length > 0 ? <W95RecycleBin size={16} /> : <W95TbClear size={16} />}
              </button>
            )}
            {mediaLibrary.length > 0 && (
              <button
                onClick={() => {
                  actions.pushUndo();
                  actions.setBackgroundMusicId(null);
                  mediaLibrary.forEach((it) => URL.revokeObjectURL(it.url));
                  actions.setMediaLibrary([]);
                }}
                className="win95-btn flex items-center gap-1 px-2 py-0.5 text-[11px]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Assign popover for selected item */}
        {assignPopoverItemId && anchors.length > 1 && (
          <div
            ref={popoverRef}
            style={{
              border: "2px solid",
              borderColor: "#dfdfdf #808080 #808080 #dfdfdf",
              backgroundColor: "#c0c0c0",
            }}
          >
            <div
              className="px-2 py-1 text-[11px]"
              style={{ borderBottom: "1px solid #808080", color: "#000" }}
            >
              Assign to anchor:
            </div>
            <div className="max-h-[160px] overflow-y-auto">
              {sortedAnchors.map((anchor) => (
                <button
                  key={anchor.id}
                  onClick={async () => {
                    const item = mediaLibrary.find((m) => m.id === assignPopoverItemId);
                    setAssignPopoverItemId(null);
                    if (item) await assignToAnchor(anchor, item);
                  }}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left text-[11px] hover:text-white"
                  style={{ color: "#000" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#000080";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#000";
                  }}
                >
                  <div
                    className="h-2.5 w-2.5 flex-shrink-0"
                    style={{
                      backgroundColor: anchorColor(anchor.id),
                      border: "1px solid #000",
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {anchor.label}
                  </span>
                  {anchor.mediaUrl && (
                    <span style={{ color: "#808080", fontSize: "10px" }}>
                      replace
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Properties dialog */}
        {propertiesItemId && (() => {
          const pItem = mediaLibrary.find((m) => m.id === propertiesItemId);
          if (!pItem) return null;
          const isAudio = pItem.type === "audio";
          const isBgMusic = backgroundMusicId === pItem.id;
          const closeProps = () => setPropertiesItemId(null);
          return createPortal(
            <div
              className="win95-modal-backdrop fixed inset-0 z-50 flex items-center justify-center"
              onClick={closeProps}
            >
              <div
                className="win95-window win95-properties-dialog"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title bar */}
                <div className="win95-props-titlebar">
                  <span className="min-w-0 flex-1 truncate">{pItem.name} Properties</span>
                  <button onClick={closeProps} className="win95-titlebar-close">
                    <W95CloseGlyph size={8} />
                  </button>
                </div>

                {/* Body */}
                <div className="win95-props-body">
                  {/* Thumbnail / icon */}
                  <div className="win95-props-preview">
                    {isAudio ? (
                      <div className="win95-props-audio-icon">
                        <Music size={32} strokeWidth={1.5} />
                      </div>
                    ) : (
                      <img
                        src={pItem.thumbnailUrl}
                        alt={pItem.name}
                        className="win95-props-thumb"
                      />
                    )}
                  </div>

                  {/* Details */}
                  <div className="win95-props-details">
                    <div className="win95-props-row">
                      <span className="win95-props-label">Name:</span>
                      <span className="win95-props-value">{pItem.name}</span>
                    </div>
                    <div className="win95-props-row">
                      <span className="win95-props-label">Type:</span>
                      <span className="win95-props-value" style={{ textTransform: "capitalize" }}>{pItem.type}</span>
                    </div>
                    {!isAudio && pItem.aspectRatio && (
                      <div className="win95-props-row">
                        <span className="win95-props-label">Aspect:</span>
                        <span className="win95-props-value">{pItem.aspectRatio.toFixed(2)}</span>
                      </div>
                    )}
                    {isAudio && pItem.duration != null && (
                      <div className="win95-props-row">
                        <span className="win95-props-label">Duration:</span>
                        <span className="win95-props-value">{formatDuration(pItem.duration)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="win95-props-buttons">
                  {!isAudio && (
                    <button
                      onClick={() => {
                        closeProps();
                        handleAssignClick(pItem);
                      }}
                      disabled={anchors.length === 0}
                      className="win95-btn px-3 py-1 text-[11px] disabled:opacity-50"
                    >
                      Assign
                    </button>
                  )}
                  {isAudio && (
                    <button
                      onClick={() => {
                        actions.setBackgroundMusicId(isBgMusic ? null : pItem.id);
                      }}
                      className="win95-btn px-3 py-1 text-[11px]"
                    >
                      {isBgMusic ? "Unset BG Music" : "Set as BG Music"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      closeProps();
                      removeLibraryItem(pItem.id);
                    }}
                    className="win95-btn px-3 py-1 text-[11px]"
                  >
                    Remove
                  </button>
                  <button
                    onClick={closeProps}
                    className="win95-btn px-3 py-1 text-[11px]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          );
        })()}
      </div>
    );
  }

  if (isWinamp) {
    const isAudioView = mediaFilter === "audio";
    const emptyLabel = mediaFilter === "image" ? "No images"
      : mediaFilter === "video" ? "No videos"
      : isAudioView ? "No audio files"
      : "No media yet";
    const emptyHint = mediaFilter === "image" ? "Add .png, .jpg, .webp files"
      : mediaFilter === "video" ? "Add .mp4, .webm, .gif files"
      : isAudioView ? "Add .mp3, .wav, .ogg files"
      : "Add images, videos, or GIFs";

    const sendToPlaylist = (item: MediaLibraryItem) => {
      actions.setPlaylist((prev) => {
        if (prev.some((t) => t.id === item.id)) return prev;
        return [...prev, item];
      });
    };

    return (
      <div className="flex flex-col gap-0">
        {mediaLoading && (
          <p className="animate-pulse text-center text-[10px] text-content-muted py-1">
            Processing files…
          </p>
        )}

        <div className="winamp-playlist" style={{ minHeight: 80 }}>
          {filteredItems.length === 0 && !mediaLoading ? (
            <div className="winamp-playlist-empty">
              <span>{emptyLabel}</span>
              <span className="empty-sub">{emptyHint}</span>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const assignedAnchor = anchorByThumbnail.get(item.thumbnailUrl);
              const isAssigned = !!assignedAnchor;
              return (
                <div
                  key={item.id}
                  className={`winamp-playlist-row${!isAudioView && !isAssigned ? " unassigned" : ""}`}
                  onClick={() => {
                    if (!isAudioView && anchors.length > 0) handleAssignClick(item);
                  }}
                >
                  <span className="playlist-num">{idx + 1}.</span>
                  <MarqueeName name={item.name} />
                  {isAudioView && item.duration != null && (
                    <span className="playlist-info">{formatDuration(item.duration)}</span>
                  )}
                  {!isAudioView && (
                    <span className="playlist-info">{item.type}</span>
                  )}
                  <span className="playlist-actions">
                    {isAudioView && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendToPlaylist(item);
                        }}
                        title="Send to Playlist"
                      >
                        <ListPlus className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLibraryItem(item.id);
                      }}
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>

        {assignPopoverItemId && anchors.length > 1 && (
          <div
            ref={popoverRef}
            className="overflow-hidden rounded-lg border border-surface-border-secondary bg-surface-raised shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-surface-border-secondary px-2.5 py-1.5">
              <span className="text-[10px] font-semibold text-content-secondary">
                Assign to:
              </span>
            </div>
            <div className="max-h-[200px] overflow-y-auto scrollbar-thin">
              {sortedAnchors.map((anchor) => (
                <button
                  key={anchor.id}
                  onClick={async () => {
                    const item = mediaLibrary.find((m) => m.id === assignPopoverItemId);
                    setAssignPopoverItemId(null);
                    if (item) await assignToAnchor(anchor, item);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-border-secondary"
                >
                  <div
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: anchorColor(anchor.id) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-content-primary">
                    {anchor.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept="image/*,video/mp4,video/webm,video/quicktime,.gif,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/flac,.mp3,.wav,.ogg,.aac,.m4a,.flac"
        className="hidden"
        onChange={handleMediaUpload}
      />

      {mediaLoading && (
        <p className="animate-pulse text-center text-[10px] text-content-muted">
          Processing files…
        </p>
      )}

      {isSciin && (
        <button
          type="button"
          className="sciin-toolbar-btn font-bold text-[11px] w-full py-1"
          onClick={() => mediaInputRef.current?.click()}
        >
          [+ Add Media]
        </button>
      )}

      {/* Empty state */}
      {mediaLibrary.length === 0 && !mediaLoading && (
        isSciin ? (
          <div style={{ color: "rgba(255, 255, 255, 0.6)" }}>
            No media yet
          </div>
        ) : (
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-surface-border-secondary px-4 py-10 text-center transition-colors hover:border-content-muted hover:bg-surface-raised/50"
          >
            <ThemeIcon icon={Images} className="mx-auto mb-2 h-8 w-8 text-content-faint" />
            <p className="text-[11px] text-content-muted">No media yet</p>
            <p className="mt-1 text-[10px] text-content-faint">
              Click to upload images, GIFs, videos, or audio
            </p>
          </button>
        )
      )}

      {mediaLibrary.length > 0 && (
        <>
          {!isSciin && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-content-muted">
                {mediaLibrary.length}{" "}
                {mediaLibrary.length === 1 ? "item" : "items"}
              </span>
              <button
                onClick={() => {
                  actions.pushUndo();
                  actions.setBackgroundMusicId(null);
                  mediaLibrary.forEach((item) => URL.revokeObjectURL(item.url));
                  actions.setMediaLibrary([]);
                }}
                className={`text-[10px] px-2 py-0.5 ${isSkeuomorphic ? "win95-btn" : "text-content-faint hover:text-red-400"}`}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Visual media */}
          {visualItems.length > 0 && (
            isSciin ? (
              <div className="flex flex-col" style={{ gap: 16 }}>
                {visualItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 text-[10px]">
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ color: CGA_PALETTE[idx % CGA_PALETTE.length] }}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <button
                      onClick={() => handleAssignClick(item)}
                      disabled={anchors.length === 0}
                      className="sciin-toolbar-btn font-bold text-[9px] shrink-0"
                      style={{ color: "#FFFFFF" }}
                    >
                      [Assign]
                    </button>
                    <button
                      onClick={() => removeLibraryItem(item.id)}
                      className="sciin-toolbar-btn font-bold text-[9px] shrink-0"
                      style={{ color: "#FFFFFF" }}
                    >
                      [X]
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {visualItems.map((item) => {
                  const assignedAnchor = anchorByThumbnail.get(item.thumbnailUrl);
                  return (
                  <React.Fragment key={item.id}>
                    <div className="relative">
                      <div
                        className={`group relative overflow-hidden bg-surface-primary ${isSkeuomorphic ? "win95-group-box" : `rounded-md ${assignedAnchor ? "border-2" : "border border-surface-border-secondary"}`}`}
                        style={!isSkeuomorphic && assignedAnchor ? { borderColor: anchorColor(assignedAnchor.id) } : undefined}
                      >
                        <div className="aspect-square">
                          <img
                            src={item.thumbnailUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className={`absolute left-1 top-1 rounded bg-surface-primary/80 px-1 py-0.5 text-[8px] capitalize text-content-secondary ${isSkeuomorphic ? "transition-opacity group-hover:opacity-0" : ""}`}>
                          {item.type}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLibraryItem(item.id);
                          }}
                          className={isSkeuomorphic
                            ? "win95-path-action-btn absolute right-1 top-1 z-10 opacity-0 transition-opacity group-hover:opacity-100"
                            : "absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-surface-primary/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-900/80"
                          }
                          title="Remove from library"
                        >
                          <ThemeIcon icon={Trash2} className={isSkeuomorphic ? "h-4 w-4" : "h-3 w-3 text-content-secondary group-hover:text-red-300"} />
                        </button>

                        {!isSkeuomorphic && (
                          <button
                            onClick={() => handleAssignClick(item)}
                            disabled={anchors.length === 0}
                            className={`absolute inset-0 flex items-center justify-center transition-all ${
                              anchors.length === 0
                                ? "cursor-not-allowed opacity-0 group-hover:opacity-100 group-hover:bg-surface-primary/40"
                                : "opacity-0 group-hover:bg-accent-500/25 group-hover:opacity-100"
                            }`}
                            title={anchors.length === 0 ? "Place an anchor first" : "Assign to anchor"}
                          >
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold shadow ${
                                anchors.length === 0
                                  ? "bg-content-faint text-content-secondary"
                                  : "bg-accent-500 text-white"
                              }`}
                            >
                              Assign
                            </span>
                          </button>
                        )}

                        <div className="relative">
                          <div className={`bg-surface-primary/70 px-1.5 ${isSkeuomorphic ? "py-1.5" : "py-0.5"}`}>
                            <p
                              className="truncate text-[9px] text-content-secondary"
                              title={item.name}
                            >
                              {item.name}
                            </p>
                          </div>
                          {isSkeuomorphic && anchors.length > 0 && (
                            <button
                              onClick={() => handleAssignClick(item)}
                              className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold opacity-0 transition-opacity group-hover:opacity-100"
                              style={{ backgroundColor: "#000080", color: "#fff" }}
                              title="Assign to anchor"
                            >
                              As<span style={{ display: "inline-block", width: "1px" }} />s<span style={{ display: "inline-block", width: "1px" }} />ign
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {assignPopoverItemId === item.id && anchors.length > 1 && (
                      <div
                        ref={popoverRef}
                        style={{ gridColumn: "1 / -1" }}
                        className="overflow-hidden rounded-lg border border-surface-border-secondary bg-surface-raised shadow-lg"
                      >
                        <div className="flex items-center justify-between border-b border-surface-border-secondary px-2.5 py-1.5">
                          <span className="text-[10px] font-semibold text-content-secondary">
                            Assign to:
                          </span>
                          <span className="max-w-[60%] truncate text-[10px] text-content-muted" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto scrollbar-thin">
                          {sortedAnchors.map((anchor) => (
                            <button
                              key={anchor.id}
                              onClick={async () => {
                                setAssignPopoverItemId(null);
                                await assignToAnchor(anchor, item);
                              }}
                              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-border-secondary"
                            >
                              <div
                                className="win95-color-swatch h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: anchorColor(anchor.id) }}
                              />
                              <span className="min-w-0 flex-1 truncate text-[11px] text-content-primary">
                                {anchor.label}
                              </span>
                              {anchor.id === selectedAnchorId && (
                                <span className="flex-shrink-0 rounded bg-accent-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-accent-300">
                                  Selected
                                </span>
                              )}
                              {anchor.mediaUrl && (
                                <span className="flex-shrink-0 text-[8px] text-content-muted">
                                  replace
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                  );
                })}
              </div>
            )
          )}

          {/* Audio files */}
          {audioItems.length > 0 && (
            isSciin ? (
              <div className="flex flex-col" style={{ gap: 16 }}>
                <span className="text-[10px] font-medium text-content-muted">Audio</span>
                {audioItems.map((item, idx) => {
                  const isActive = backgroundMusicId === item.id;
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-[10px]">
                      <span
                        className="min-w-0 flex-1 truncate"
                        style={{ color: CGA_PALETTE[(visualItems.length + idx) % CGA_PALETTE.length] }}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      <button
                        onClick={() => actions.setBackgroundMusicId(isActive ? null : item.id)}
                        className="sciin-toolbar-btn font-bold text-[9px] shrink-0"
                        style={{ color: isActive ? "#FFFF00" : "#FFFFFF" }}
                      >
                        [{isActive ? "BG" : "Set BG"}]
                      </button>
                      <button
                        onClick={() => removeLibraryItem(item.id)}
                        className="sciin-toolbar-btn font-bold text-[9px] shrink-0"
                        style={{ color: "#FFFFFF" }}
                      >
                        [X]
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-content-muted">Audio</span>
                {audioItems.map((item) => {
                  const isActive = backgroundMusicId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                        isActive
                          ? "border border-accent-500/50 bg-accent-500/10"
                          : "border border-surface-border bg-surface-primary hover:border-surface-border-secondary"
                      }`}
                    >
                      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded ${
                        isActive ? "bg-accent-500/20" : "bg-surface-raised"
                      }`}>
                        {isActive ? (
                          <ThemeIcon icon={Volume2} className="h-3.5 w-3.5 text-accent-400" />
                        ) : (
                          <ThemeIcon icon={Music} className="h-3.5 w-3.5 text-content-muted" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] text-content-primary" title={item.name}>
                          {item.name}
                        </p>
                        {item.duration != null && (
                          <p className="text-[9px] text-content-faint">{formatDuration(item.duration)}</p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          actions.setBackgroundMusicId(isActive ? null : item.id)
                        }
                        className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                          isActive
                            ? "bg-accent-500/20 text-accent-300 hover:bg-accent-500/30"
                            : "bg-surface-raised text-content-muted hover:bg-surface-border-secondary hover:text-content-primary"
                        }`}
                      >
                        {isActive ? "BG Music" : "Set BG"}
                      </button>
                      <button
                        onClick={() => removeLibraryItem(item.id)}
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-900/80"
                        title="Remove"
                      >
                        <ThemeIcon icon={Trash2} className="h-3 w-3 text-content-muted hover:text-red-300" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}


          {isSciin ? (
            <button
              type="button"
              onClick={() => {
                actions.pushUndo();
                actions.setBackgroundMusicId(null);
                mediaLibrary.forEach((item) => URL.revokeObjectURL(item.url));
                actions.setMediaLibrary([]);
              }}
              className="sciin-toolbar-btn font-bold text-[11px] w-full py-1"
            >
              [Clear All ({mediaLibrary.length})]
            </button>
          ) : (
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className={isSkeuomorphic
                ? "win95-btn flex w-full items-center justify-center gap-1.5 py-2 text-[11px]"
                : "flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-surface-border-secondary py-2 text-[11px] text-content-muted transition-colors hover:border-content-muted hover:text-content-primary"
              }
            >
              <ThemeIcon icon={Plus} className="h-3.5 w-3.5" />
              Add more
            </button>
          )}
        </>
      )}
    </div>
  );
}
