"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useScene } from "@/lib/scene-context";
import type { SceneAnchor } from "@/lib/scene-context";
import { anchorColor } from "@/themes/_shared/anchor-colors";
import { useAimSounds } from "@/themes/xX_sCeNeIt_Xx/sounds";
import { isAccepted, buildLibraryItem } from "@/lib/media-utils";
import {
  AimBuddyOnline,
  AimBuddyAway,
  AimBuddyOffline,
  AimRunningMan,
  AimCrosshair,
  AimImage,
  AimFootprints,
  AimAddBuddy,
  AimBuddyListIcon,
  AimLoginBanner,
} from "@/themes/xX_sCeNeIt_Xx/icons";
import AIMBuddyInfo from "./AIMBuddyInfo";

function CategorySection({
  title,
  count,
  total,
  defaultOpen = true,
  selected = false,
  onSelect,
  children,
}: {
  title: string;
  count: number;
  total: number;
  defaultOpen?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`aim-buddy-category${open ? "" : " collapsed"}`}>
      <button
        className={`aim-buddy-category-header${selected ? " selected" : ""}`}
        onClick={() => {
          setOpen((v) => !v);
          onSelect?.();
        }}
      >
        <span className="aim-category-triangle" />
        <span>{title}</span>
        <span className="aim-category-count">
          ({count}/{total})
        </span>
      </button>
      {open && <div className="aim-buddy-category-content">{children}</div>}
    </div>
  );
}

function xXify(name: string): string {
  return `xX${name.replace(/\s+/g, "_").replace(/(\D)(\d)/, "$1_$2")}Xx`;
}

export default function AIMBuddyList() {
  const {
    anchors,
    selectedAnchorId,
    cameraTargetAnchorId,
    mediaLibrary,
    paths,
    activePathId,
    actions,
    refs,
  } = useScene();

  const { playDoorOpen, playDoorClose, playReceive, playImReceive, playMoo } = useAimSounds();
  const prevMediaCountRef = useRef(mediaLibrary.length);
  useEffect(() => {
    if (mediaLibrary.length > prevMediaCountRef.current) {
      playReceive();
    }
    prevMediaCountRef.current = mediaLibrary.length;
  }, [mediaLibrary.length, playReceive]);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter(isAccepted);
      if (arr.length === 0) return;
      const items = await Promise.all(arr.map(buildLibraryItem));
      actions.setMediaLibrary((prev) => [...prev, ...items]);
    },
    [actions],
  );

  const [selectedCategory, setSelectedCategory] = useState<string>("Anchors");
  const [infoPopup, setInfoPopup] = useState<{
    target: React.ComponentProps<typeof AIMBuddyInfo>["target"];
    position: { x: number; y: number };
  } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    type: "anchor" | "media" | "path";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = (e: MouseEvent) => {
      if (!ctxMenuRef.current?.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [ctxMenu]);

  const handleDeleteAnchor = useCallback((anchorId: string) => {
    actions.pushUndo();
    const anchor = anchors.find((a) => a.id === anchorId);
    if (anchor) refs.removeAnchor.current?.(anchor);
    actions.setAnchors((prev) => prev.filter((a) => a.id !== anchorId));
    actions.setAnchorAnimations((prev) => prev.filter((a) => a.anchorId !== anchorId));
    if (selectedAnchorId === anchorId) actions.setSelectedAnchorId(null);
    if (cameraTargetAnchorId === anchorId) actions.setCameraTargetAnchorId(null);
    playDoorClose();
    setCtxMenu(null);
  }, [actions, refs, anchors, selectedAnchorId, cameraTargetAnchorId, playDoorClose]);
  const activeAnchors = anchors.filter((a) => a.mediaUrl);
  const activePaths = paths.filter((p) => p.keyframes.length > 0);

  const anchorByThumbnail = useMemo(() => {
    const map = new Map<string, SceneAnchor>();
    for (const a of anchors) {
      if (a.mediaThumbnailUrl) map.set(a.mediaThumbnailUrl, a);
    }
    return map;
  }, [anchors]);

  const assignedMediaCount = useMemo(() => {
    let count = 0;
    for (const item of mediaLibrary) {
      if (anchorByThumbnail.has(item.thumbnailUrl)) count++;
    }
    return count;
  }, [mediaLibrary, anchorByThumbnail]);

  return (
    <div className="aim-buddy-list flex h-full flex-col">
      <div className="aim-buddy-menubar">
        <button className="aim-menubar-item">My AIM</button>
        <button className="aim-menubar-item">People</button>
        <button className="aim-menubar-item">Help</button>
      </div>

      <div className="aim-buddy-banner-wrap" onClick={playMoo} style={{ cursor: "pointer" }}>
        <div className="aim-buddy-banner">
          <AimLoginBanner />
        </div>
      </div>

      <div className="aim-buddy-selector">
        <AimBuddyListIcon size={14} />
        <span>guywhoworkshere123&apos;s Buddy List</span>
      </div>

      <div className="aim-buddy-categories flex-1 overflow-y-auto scrollbar-thin">
        {/* Anchors: online = has media, offline = no media */}
        <CategorySection
          title="Anchors"
          count={activeAnchors.length}
          total={anchors.length}
          selected={selectedCategory === "Anchors"}
          onSelect={() => setSelectedCategory("Anchors")}
        >
          {anchors.length === 0 ? (
            <div
              className="aim-buddy-item offline"
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ type: "anchor", id: "__empty__", x: e.clientX, y: e.clientY });
              }}
            >
              <span className="aim-buddy-icon">
                <AimCrosshair className="h-3.5 w-3.5" />
              </span>
              <span className="aim-buddy-name">No anchors yet</span>
            </div>
          ) : (
            anchors.map((anchor) => {
              const hasMedia = !!anchor.mediaUrl;
              const isTarget = cameraTargetAnchorId === anchor.id;
              const isSelected = selectedAnchorId === anchor.id;
              return (
                <button
                  key={anchor.id}
                  className={`aim-buddy-item${isSelected ? " active" : ""}${!hasMedia ? " offline" : ""}`}
                  onClick={() => actions.setSelectedAnchorId(anchor.id)}
                  onDoubleClick={(e) => setInfoPopup({
                    target: { type: "anchor", data: anchor, isTarget: isTarget },
                    position: { x: e.clientX, y: e.clientY },
                  })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ type: "anchor", id: anchor.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <span className="aim-buddy-status-icon">
                    {hasMedia ? (
                      <AimBuddyOnline style={{ color: anchorColor(anchor.id) }} />
                    ) : (
                      <AimBuddyOffline />
                    )}
                  </span>
                  <span className="aim-buddy-name">
                    {xXify(anchor.label)}
                    {isTarget ? " (targeted)" : ""}
                  </span>
                </button>
              );
            })
          )}
        </CategorySection>

        {/* Media: online = assigned to anchor, away = unassigned */}
        <CategorySection
          title="Media"
          count={assignedMediaCount}
          total={mediaLibrary.length}
          defaultOpen={mediaLibrary.length > 0}
          selected={selectedCategory === "Media"}
          onSelect={() => setSelectedCategory("Media")}
        >
          {mediaLibrary.length === 0 ? (
            <div
              className="aim-buddy-item offline"
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ type: "media", id: "__empty__", x: e.clientX, y: e.clientY });
              }}
            >
              <span className="aim-buddy-icon">
                <AimImage className="h-3.5 w-3.5" />
              </span>
              <span className="aim-buddy-name">No media uploaded</span>
            </div>
          ) : (
            mediaLibrary.map((item) => {
              const assignedAnchor = anchorByThumbnail.get(item.thumbnailUrl);
              const isAssigned = !!assignedAnchor;
              return (
                <div
                  key={item.id}
                  className={`aim-buddy-item${!isAssigned ? " away" : ""}`}
                  onDoubleClick={(e) => setInfoPopup({
                    target: { type: "media", data: item, assignedTo: assignedAnchor?.label },
                    position: { x: e.clientX, y: e.clientY },
                  })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ type: "media", id: item.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <span className="aim-buddy-status-icon">
                    {isAssigned ? (
                      <AimBuddyOnline style={{ color: anchorColor(assignedAnchor.id) }} />
                    ) : (
                      <AimBuddyAway />
                    )}
                  </span>
                  <span className="aim-buddy-name">{xXify(item.name)}</span>
                  <span className="aim-buddy-type-badge">
                    {item.type}
                  </span>
                </div>
              );
            })
          )}
        </CategorySection>

        {/* Paths: online = has keyframes, offline = empty */}
        <CategorySection
          title="Paths"
          count={activePaths.length}
          total={paths.length}
          defaultOpen={paths.length > 0}
          selected={selectedCategory === "Paths"}
          onSelect={() => setSelectedCategory("Paths")}
        >
          {paths.length === 0 ? (
            <div
              className="aim-buddy-item offline"
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ type: "path", id: "__empty__", x: e.clientX, y: e.clientY });
              }}
            >
              <span className="aim-buddy-icon">
                <AimFootprints className="h-3.5 w-3.5" />
              </span>
              <span className="aim-buddy-name">No paths created</span>
            </div>
          ) : (
            paths.map((path) => {
              const isActive = activePathId === path.id;
              const hasKeyframes = path.keyframes.length > 0;
              return (
                <button
                  key={path.id}
                  className={`aim-buddy-item${isActive ? " active" : ""}${!hasKeyframes ? " offline" : ""}`}
                  onClick={() => actions.setActivePathId(path.id)}
                  onDoubleClick={(e) => setInfoPopup({
                    target: { type: "path", data: path },
                    position: { x: e.clientX, y: e.clientY },
                  })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ type: "path", id: path.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <span className="aim-buddy-status-icon">
                    {hasKeyframes ? (
                      <AimBuddyOnline style={{ color: "#4CAF50" }} />
                    ) : (
                      <AimBuddyOffline />
                    )}
                  </span>
                  <span className="aim-buddy-name">{path.name}</span>
                  <span className="aim-buddy-type-badge">
                    {path.keyframes.length} kf
                  </span>
                </button>
              );
            })
          )}
        </CategorySection>
      </div>

      <div className="aim-buddy-toolbar">
        <div className="aim-buddy-toolbar-buttons">
          <button
            className="aim-buddy-toolbar-btn"
            title="Add Anchor"
            onClick={() => {
              actions.pushUndo();
              const result = refs.createAnchor.current?.();
              if (result) {
                actions.setAnchors((prev) => [...prev, result]);
              }
              playDoorOpen();
            }}
          >
            <AimAddBuddy />
            <span>Anchor</span>
          </button>
          <button
            className="aim-buddy-toolbar-btn"
            title="Import Media"
            onClick={() => mediaInputRef.current?.click()}
          >
            <AimImage />
            <span>Media</span>
          </button>
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            className="aim-buddy-toolbar-btn"
            title="Add Path"
            onClick={() => {
              const p = {
                id: `path-${Date.now()}`,
                name: `Path ${paths.length + 1}`,
                keyframes: [],
                loop: false,
                splineMode: "catmullRom" as const,
              };
              actions.setPaths((prev: typeof paths) => [...prev, p]);
              actions.setActivePathId(p.id);
              playImReceive();
            }}
          >
            <AimFootprints />
            <span>Path</span>
          </button>
        </div>
      </div>
      {infoPopup && (
        <AIMBuddyInfo
          target={infoPopup.target}
          position={infoPopup.position}
          onClose={() => setInfoPopup(null)}
        />
      )}

      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          className="aim-ctx-menu"
          style={{
            position: "fixed",
            left: Math.min(ctxMenu.x, window.innerWidth - 160),
            top: Math.min(ctxMenu.y, window.innerHeight - 200),
            zIndex: 10000,
          }}
        >
          {ctxMenu.type === "anchor" && (() => {
            if (ctxMenu.id === "__empty__") {
              return (
                <button className="aim-ctx-item" onClick={() => {
                  actions.pushUndo();
                  const result = refs.createAnchor.current?.();
                  if (result) actions.setAnchors((prev) => [...prev, result]);
                  playDoorOpen();
                  setCtxMenu(null);
                }}>
                  Add Anchor
                </button>
              );
            }
            const anchor = anchors.find(a => a.id === ctxMenu.id);
            if (!anchor) return null;
            const isTarget = cameraTargetAnchorId === anchor.id;
            return (
              <>
                <button className="aim-ctx-item" onClick={() => { actions.setSelectedAnchorId(anchor.id); setCtxMenu(null); }}>
                  Select
                </button>
                <button className="aim-ctx-item" onClick={() => {
                  actions.setCameraTargetAnchorId(isTarget ? null : anchor.id);
                  setCtxMenu(null);
                }}>
                  {isTarget ? "Untarget Camera" : "Target Camera"}
                </button>
                <div className="aim-ctx-sep" />
                <button className="aim-ctx-item" onClick={() => {
                  setInfoPopup({
                    target: { type: "anchor", data: anchor, isTarget },
                    position: { x: ctxMenu.x, y: ctxMenu.y },
                  });
                  setCtxMenu(null);
                }}>
                  Get Info
                </button>
                <div className="aim-ctx-sep" />
                <button className="aim-ctx-item aim-ctx-danger" onClick={() => handleDeleteAnchor(anchor.id)}>
                  Delete Anchor
                </button>
              </>
            );
          })()}

          {ctxMenu.type === "media" && (() => {
            if (ctxMenu.id === "__empty__") {
              return (
                <button className="aim-ctx-item" onClick={() => {
                  mediaInputRef.current?.click();
                  setCtxMenu(null);
                }}>
                  Import Media...
                </button>
              );
            }
            const item = mediaLibrary.find(m => m.id === ctxMenu.id);
            if (!item) return null;
            return (
              <>
                <button className="aim-ctx-item" onClick={() => {
                  setInfoPopup({
                    target: { type: "media", data: item, assignedTo: anchorByThumbnail.get(item.thumbnailUrl)?.label },
                    position: { x: ctxMenu.x, y: ctxMenu.y },
                  });
                  setCtxMenu(null);
                }}>
                  Get Info
                </button>
                <div className="aim-ctx-sep" />
                <button className="aim-ctx-item aim-ctx-danger" onClick={() => {
                  actions.pushUndo();
                  actions.setMediaLibrary((prev) => prev.filter((m) => m.id !== item.id));
                  playDoorClose();
                  setCtxMenu(null);
                }}>
                  Delete Media
                </button>
              </>
            );
          })()}

          {ctxMenu.type === "path" && (() => {
            if (ctxMenu.id === "__empty__") {
              return (
                <button className="aim-ctx-item" onClick={() => {
                  const p = {
                    id: `path-${Date.now()}`,
                    name: `Path ${paths.length + 1}`,
                    keyframes: [],
                    loop: false,
                    splineMode: "catmullRom" as const,
                  };
                  actions.setPaths((prev: typeof paths) => [...prev, p]);
                  actions.setActivePathId(p.id);
                  playImReceive();
                  setCtxMenu(null);
                }}>
                  Add Path
                </button>
              );
            }
            const path = paths.find(p => p.id === ctxMenu.id);
            if (!path) return null;
            const isActive = activePathId === path.id;
            const canGenerate = isActive && !path.walkMeta && path.keyframes.filter(
              (kf) => !kf.keyedChannels || kf.keyedChannels.includes("position"),
            ).length >= 2;
            return (
              <>
                <button className="aim-ctx-item" onClick={() => { actions.setActivePathId(path.id); setCtxMenu(null); }}>
                  Set Active
                </button>
                {canGenerate && (
                  <button className="aim-ctx-item" onClick={() => {
                    actions.convertActivePathToWalk();
                    setCtxMenu(null);
                  }}>
                    Generate
                  </button>
                )}
                <button className="aim-ctx-item" onClick={() => {
                  setInfoPopup({
                    target: { type: "path", data: path },
                    position: { x: ctxMenu.x, y: ctxMenu.y },
                  });
                  setCtxMenu(null);
                }}>
                  Get Info
                </button>
                <div className="aim-ctx-sep" />
                <button className="aim-ctx-item aim-ctx-danger" onClick={() => {
                  actions.pushUndo();
                  actions.setPaths((prev) => prev.filter((p) => p.id !== path.id));
                  if (activePathId === path.id) actions.setActivePathId(null);
                  playDoorClose();
                  setCtxMenu(null);
                }}>
                  Delete Path
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
