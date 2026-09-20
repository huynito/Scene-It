"use client";

import { useRef, useEffect, useState, Component, type ReactNode } from "react";
import type { SplatRenderer } from "@/lib/renderers/types";
import { FPSController, PITCH_LEVEL, cameraQuaternion } from "@/lib/fps-controller";
import { PlaybackController } from "@/lib/playback-controller";
import { addChannelKeyframe as addChannelKf, createPath } from "@/lib/camera-path";
import type { ChannelGroup } from "@/lib/camera-path";
import { createPolygonCollisionFn } from "@/lib/collision";
import { evaluateAnchorAnimation } from "@/lib/anchor-animation";
import { useScene } from "@/lib/scene-context";
import { trackSceneLoad } from "@/lib/analytics";

const DEFAULT_ANCHOR_W = 0.375;
const DEFAULT_ANCHOR_H = 0.375;
const RAD_TO_DEG = 180 / Math.PI;

function PlyCanvasInner() {
  const {
    plyBuffer,
    showGrid,
    fov,
    exposure,
    colorFilter,
    dim,
    blur,
    showFovFrame,
    showFovStroke,
    fovFeather,
    moveSpeed,
    paths,
    activePathId,
    bakedPaths,
    activeBakedPathId,
    collisionEnabled,
    lockY,
    capturedBoundary,
    compDuration,
    sceneOrigin,
    activePreset,
    meshPos,
    meshRot,
    meshScale,
    anchors,
    selectedAnchorId,
    anchorAnimations,
    cameraTargetAnchorId,
    playbackState,
    dofEnabled,
    dofFocusDistance,
    dofFocusRange,
    dofBlurRadius,
    actions,
    refs,
  } = useScene();

  const [contextLost, setContextLost] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SplatRenderer | null>(null);
  const fpsRef = useRef<FPSController | null>(null);
  const sceneRadiusRef = useRef(1);
  const playbackRef = useRef<PlaybackController | null>(null);
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const activePathIdRef = useRef(activePathId);
  activePathIdRef.current = activePathId;

  // Stable refs so the RAF loop never needs to restart when anchors change
  const hasBillboardsRef = useRef(false);
  const hasVideoRef = useRef(false);
  hasBillboardsRef.current = anchors.length > 0;
  hasVideoRef.current = anchors.some((a) => a.mediaType === "video" || a.mediaType === "gif");
  const initCamRef = useRef<{
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
  } | null>(null);

  useEffect(() => {
    rendererRef.current?.setGridVisible(!!showGrid);
  }, [showGrid]);

  useEffect(() => {
    if (fov != null) rendererRef.current?.setFov(fov);
  }, [fov]);

  useEffect(() => {
    if (exposure != null) rendererRef.current?.setExposure(exposure);
  }, [exposure]);

  useEffect(() => {
    rendererRef.current?.setDim(dim ?? 0);
  }, [dim]);

  useEffect(() => {
    rendererRef.current?.setBlur(blur ?? 0);
  }, [blur]);

  useEffect(() => {
    rendererRef.current?.setFovFrame(!!showFovFrame);
  }, [showFovFrame]);

  useEffect(() => {
    rendererRef.current?.setFovStroke(!!showFovStroke);
  }, [showFovStroke]);

  useEffect(() => {
    rendererRef.current?.setFovFeather(fovFeather ?? 0);
  }, [fovFeather]);

  useEffect(() => {
    rendererRef.current?.setDofEnabled(!!dofEnabled);
  }, [dofEnabled]);

  useEffect(() => {
    rendererRef.current?.setDofFocusDistance(dofFocusDistance);
  }, [dofFocusDistance]);

  useEffect(() => {
    rendererRef.current?.setDofFocusRange(dofFocusRange);
  }, [dofFocusRange]);

  useEffect(() => {
    rendererRef.current?.setDofBlurRadius(dofBlurRadius);
  }, [dofBlurRadius]);

  // Single RAF loop for billboards + video — lifetime tied to the renderer,
  // not to anchors, so it never gets torn down on anchor property changes.
  useEffect(() => {
    if (!plyBuffer) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      if (hasBillboardsRef.current) rendererRef.current?.updateBillboards();
      if (hasVideoRef.current) rendererRef.current?.updateVideoTextures();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { running = false; };
  }, [plyBuffer]);

  useEffect(() => {
    if (!selectedAnchorId) {
      rendererRef.current?.hideGizmo();
      return;
    }
    const anchor = anchors.find((a) => a.id === selectedAnchorId);
    if (!anchor) return;
    if (anchor.leashed) {
      rendererRef.current?.hideGizmo();
      return;
    }
    const anim = anchorAnimations.find((a) => a.anchorId === selectedAnchorId);
    if (anim && anim.keyframes.length > 0) {
      const result = evaluateAnchorAnimation(anim, playbackState.currentTime);
      if (result) {
        rendererRef.current?.showGizmo(result.position);
        return;
      }
    }
    rendererRef.current?.showGizmo(anchor.position);
  }, [selectedAnchorId, anchors, anchorAnimations, playbackState.isPlaying, playbackState.currentTime]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const rendererIds = new Set(renderer.getAnchorIds());
    const stateIds = new Set(anchors.map((a) => a.id));
    const animatedIds = new Set(anchorAnimations.filter(a => a.keyframes.length > 0).map(a => a.anchorId));

    rendererIds.forEach((id) => {
      if (!stateIds.has(id)) renderer.removeAnchor(id);
    });

    anchors.forEach((a) => {
      if (!rendererIds.has(a.id)) {
        const DEG = Math.PI / 180;
        const q = cameraQuaternion(a.rotation.x * DEG, a.rotation.y * DEG);
        renderer.addAnchor(a.position, q, a.width, a.height, [1, 1, 1, a.opacity], a.cornerRadius, a.id);
      } else {
        if (!a.leashed && !animatedIds.has(a.id)) {
          renderer.setAnchorPosition(a.id, a.position);
          renderer.setAnchorRotation(a.id, a.rotation);
        }
        renderer.setAnchorOpacity(a.id, a.opacity);
        renderer.setAnchorBillboard(a.id, a.billboardMode);
        renderer.setAnchorVisible(a.id, a.visible);
      }
      renderer.setAnchorScale(a.id, a.scale ?? 1);
      if (a.leashed) {
        renderer.setAnchorLeash(a.id, true, a.leashDistance ?? 2, a.leashOffset ?? { x: 0, y: 0, z: 0 });
        renderer.setAnchorLeashRotation(a.id, a.leashRotation ?? { x: 0, y: 0, z: 0 });
      }
    });
  }, [anchors, anchorAnimations]);

  useEffect(() => {
    const activeBaked = bakedPaths.find((p) => p.id === activeBakedPathId) ?? null;
    playbackRef.current?.setBakedPath(activeBaked);
  }, [bakedPaths, activeBakedPathId]);

  useEffect(() => {
    const activePath = paths.find((p) => p.id === activePathId) ?? null;
    playbackRef.current?.setPath(activePath);

  }, [paths, activePathId]);

  useEffect(() => {
    const fps = fpsRef.current;
    if (!fps) return;
    if (collisionEnabled && capturedBoundary.length >= 3) {
      fps.collisionFn = createPolygonCollisionFn({
        polygons: [{ points: capturedBoundary }],
        heightRange: activePreset?.cameraHeightRange ?? { min: -0.5, max: 0.5 },
      });
    } else if (collisionEnabled && activePreset && activePreset.collisionPolygons.length > 0) {
      fps.collisionFn = createPolygonCollisionFn({
        polygons: activePreset.collisionPolygons,
        heightRange: activePreset.cameraHeightRange,
      });
    } else {
      fps.collisionFn = null;
    }
  }, [collisionEnabled, activePreset, capturedBoundary]);

  useEffect(() => {
    if (moveSpeed != null && fpsRef.current) {
      fpsRef.current.baseMoveSpeed = moveSpeed;
    }
  }, [moveSpeed]);

  useEffect(() => {
    if (fpsRef.current) fpsRef.current.lockY = lockY;
    if (playbackRef.current) playbackRef.current.lockY = lockY;
  }, [lockY]);

  useEffect(() => {
    if (playbackRef.current) playbackRef.current.compDuration = compDuration;
  }, [compDuration]);

  useEffect(() => {
    playbackRef.current?.setAnchorAnimations(anchorAnimations);
  }, [anchorAnimations]);

  useEffect(() => {
    const anchor = cameraTargetAnchorId
      ? anchors.find(a => a.id === cameraTargetAnchorId)
      : null;
    if (fpsRef.current) {
      fpsRef.current.targetAnchorPos = anchor ? anchor.position : null;
    }
    if (playbackRef.current) {
      playbackRef.current.setCameraTargetAnchorId(cameraTargetAnchorId);
    }
  }, [cameraTargetAnchorId, anchors]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !plyBuffer) return;
    let cancelled = false;

    (async () => {
      const { PlayCanvasRenderer } = await import("@/lib/renderers/playcanvas");
      if (cancelled) return;

      const renderer: SplatRenderer = new PlayCanvasRenderer();
      await renderer.init(container);
      if (cancelled) {
        renderer.dispose();
        return;
      }

      renderer.onContextLost = () => setContextLost(true);
      rendererRef.current = renderer;

      try {
        const { center, radius, splatCount } = await renderer.loadScene(plyBuffer);
        sceneRadiusRef.current = radius;
        if (cancelled) {
          renderer.dispose();
          return;
        }

        const hasPreset = !!activePreset;
        const initYaw = hasPreset ? activePreset.initialCamera.yaw : 0;
        const initPitch = hasPreset ? activePreset.initialCamera.pitch : PITCH_LEVEL;
        const initPos = hasPreset ? activePreset.initialCamera.position : center;

        renderer.setCameraPosition(initPos.x, initPos.y, initPos.z);
        const q = cameraQuaternion(initPitch, initYaw);
        renderer.setCameraQuaternion(q.x, q.y, q.z, q.w);

        initCamRef.current = {
          x: initPos.x,
          y: initPos.y,
          z: initPos.z,
          yaw: initYaw,
          pitch: initPitch,
        };

        const canvas = renderer.getCanvas();
        if (canvas) {
          const fps = new FPSController(renderer, canvas, initYaw, initPitch);
          const padding = radius * 0.1;
          fps.bounds = {
            min: {
              x: center.x - radius - padding,
              y: center.y - radius - padding,
              z: center.z - radius - padding,
            },
            max: {
              x: center.x + radius + padding,
              y: center.y + radius + padding,
              z: center.z + radius + padding,
            },
          };
          fps.onKeyframeRequest = (key) => {
            if (key === "K") {
              refs.triggerAddKeyframe.current?.();
            } else {
              const groups: ChannelGroup[] = key === "P" ? ["position"] : ["rotation"];
              refs.addChannelKeyframe.current?.(groups);
            }
          };
          fps.onOrthoZoom = (delta) => {
            rendererRef.current?.orthoZoom(delta);
          };

          const eyeH = hasPreset
            ? (activePreset.defaultEyeHeight ?? initPos.y)
            : initPos.y;
          fps.lockY = hasPreset;
          fps.eyeHeight = eyeH;

          if (hasPreset && activePreset.yClampRange) {
            fps.bounds = {
              ...fps.bounds!,
              min: { ...fps.bounds!.min, y: eyeH + activePreset.yClampRange.min },
              max: { ...fps.bounds!.max, y: eyeH + activePreset.yClampRange.max },
            };
          }

          fpsRef.current = fps;

          if (hasPreset && activePreset.collisionPolygons.length > 0) {
            fps.collisionFn = createPolygonCollisionFn({
              polygons: activePreset.collisionPolygons,
              heightRange: activePreset.cameraHeightRange,
            });
          }

          const pb = new PlaybackController(renderer, fps);
          pb.onUpdate((state) => actions.setPlaybackState(state));
          pb.setAnchorsRef(anchorsRef);
          pb.lockY = hasPreset;
          pb.eyeHeight = eyeH;
          playbackRef.current = pb;
        }

        renderer.addGrid(center, radius);
        renderer.setGridVisible(!!showGrid);
        renderer.setSceneYaw(sceneOrigin.yaw);
        if (fov != null) renderer.setFov(fov);
        if (exposure != null) renderer.setExposure(exposure);

        actions.handleVertexCount(splatCount);
        trackSceneLoad(activePreset?.name ?? "custom");

        // Auto-load depth mesh from preset
        if (hasPreset && activePreset.glbUrl) {
          try {
            let glbBuffer: ArrayBuffer;
            if (activePreset.glbChunks && activePreset.glbChunks > 1) {
              const urls = Array.from({ length: activePreset.glbChunks }, (_, i) =>
                `${activePreset.glbUrl}.${String(i).padStart(2, "0")}`
              );
              const parts = await Promise.all(urls.map(async (u) => {
                const r = await fetch(u);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.arrayBuffer();
              }));
              const total = parts.reduce((s, b) => s + b.byteLength, 0);
              const merged = new Uint8Array(total);
              let off = 0;
              for (const p of parts) { merged.set(new Uint8Array(p), off); off += p.byteLength; }
              glbBuffer = merged.buffer;
            } else {
              const glbResp = await fetch(activePreset.glbUrl);
              if (!glbResp.ok) throw new Error(`HTTP ${glbResp.status}`);
              glbBuffer = await glbResp.arrayBuffer();
            }
            await renderer.loadDepthMesh(glbBuffer, "depth.glb");
            renderer.setDepthMeshTransform(meshPos, meshRot, meshScale);
            actions.setDepthMeshLoaded(true);
          } catch {
            // Depth mesh is optional — silently continue
          }
        }

        // Auto-load preset anchors
        if (hasPreset && activePreset.anchors && activePreset.anchors.length > 0) {
          const presetAnchors = activePreset.anchors.map((a) => {
            const q = cameraQuaternion(0, 0);
            const anchorId = renderer.addAnchor(
              a.position, q, a.width, a.height,
              [1, 1, 1, a.opacity], a.cornerRadius
            );
            if (a.rotation) {
              renderer.setAnchorRotation(anchorId, a.rotation);
            }
            if (a.billboardMode && a.billboardMode !== "none") {
              renderer.setAnchorBillboard(anchorId, a.billboardMode);
            }
            return { ...a, id: anchorId, scale: a.scale ?? 1 };
          });
          actions.setAnchors(presetAnchors);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error loading scene";
        actions.handleLoadError(msg);
      }
    })();

    return () => {
      cancelled = true;
      playbackRef.current?.dispose();
      playbackRef.current = null;
      fpsRef.current?.dispose();
      fpsRef.current = null;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [plyBuffer, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate imperative refs
  useEffect(() => {
    refs.reset.current = () => {
      const fps = fpsRef.current;
      const init = initCamRef.current;
      if (!fps || !init) return;
      fps.resetTo(init.x, init.y, init.z, init.yaw, init.pitch);
    };
  }, [refs.reset]);

  useEffect(() => {
    refs.createAnchor.current = () => {
      const renderer = rendererRef.current;
      const fps = fpsRef.current;
      if (!renderer || !fps) return null;
      const pos = renderer.getCameraPosition();

      // Camera's true forward in world space is Q·[0,0,-1]
      const qFull = cameraQuaternion(fps.pitch, fps.yaw);
      const camFwd = {
        x: -(2 * (qFull.x * qFull.z + qFull.w * qFull.y)),
        y: -(2 * (qFull.y * qFull.z - qFull.w * qFull.x)),
        z: -(1 - 2 * (qFull.x * qFull.x + qFull.y * qFull.y)),
      };

      const placeDist = sceneRadiusRef.current * 0.08;
      const anchorPos = {
        x: pos.x + camFwd.x * placeDist,
        y: pos.y + camFwd.y * placeDist,
        z: pos.z + camFwd.z * placeDist,
      };

      const qUpright = cameraQuaternion(0, fps.yaw);
      const anchorScale = sceneRadiusRef.current * 0.08;
      const w = Math.max(anchorScale, 0.02);
      const h = Math.max(anchorScale, 0.02);
      const anchorId = renderer.addAnchor(anchorPos, qUpright, w, h, [1, 1, 1, 0.35], 0);
      return {
        id: anchorId,
        label: `Anchor ${anchorId.split("-").pop()}`,
        position: anchorPos,
        rotation: {
          x: 0,
          y: fps.yaw * RAD_TO_DEG,
          z: 0,
        },
        billboardMode: "none" as const,
        width: w,
        height: h,
        cornerRadius: 0,
        opacity: 0.35,
        scale: 0.25,
        visible: true,
      };
    };

    refs.removeAnchor.current = (anchor) => {
      rendererRef.current?.removeAnchor(anchor.id);
    };

    refs.setAnchorPosition.current = (anchor, pos) => {
      rendererRef.current?.setAnchorPosition(anchor.id, pos);
    };

    refs.setAnchorRotation.current = (anchor, euler) => {
      rendererRef.current?.setAnchorRotation(anchor.id, euler);
    };

    refs.rebuildAnchor.current = (anchor, width, height, cornerRadius, clearMedia) => {
      rendererRef.current?.rebuildAnchor(anchor.id, width, height, cornerRadius, clearMedia);
    };

    refs.setAnchorOpacity.current = (anchor, opacity) => {
      rendererRef.current?.setAnchorOpacity(anchor.id, opacity);
    };

    refs.setAnchorScale.current = (anchor, scale) => {
      rendererRef.current?.setAnchorScale(anchor.id, scale);
    };

    refs.setAnchorBillboard.current = (anchor, mode) => {
      rendererRef.current?.setAnchorBillboard(anchor.id, mode);
    };

    refs.setAnchorLeash.current = (anchor, leashed, distance, offset) => {
      rendererRef.current?.setAnchorLeash(anchor.id, leashed, distance, offset);
    };

    refs.setAnchorLeashRotation.current = (anchor, rotation) => {
      rendererRef.current?.setAnchorLeashRotation(anchor.id, rotation);
    };

    refs.setAnchorMedia.current = async (anchor, file) => {
      const renderer = rendererRef.current;
      if (!renderer) return null;

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const isVideo = ["mp4", "webm", "mov"].includes(ext);
      let mediaType: "image" | "gif" | "video";
      let aspectRatio = 1;
      let url: string;

      if (isVideo) {
        mediaType = "video";
        url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.src = url;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => resolve();
        });
        await video.play().catch(() => {});
        if (video.videoWidth && video.videoHeight) {
          aspectRatio = video.videoWidth / video.videoHeight;
        }
        renderer.setAnchorMedia(anchor.id, video);
      } else if (ext === "gif") {
        mediaType = "gif";
        url = URL.createObjectURL(file);
        let gifHandled = false;

        // ImageDecoder path: pre-decode every frame into ImageBitmaps so we can
        // animate by wall-clock time without relying on browser GIF animation of
        // hidden img elements (which Chrome throttles in some configurations).
        if ("ImageDecoder" in window) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decoder = new (window as any).ImageDecoder({ data: arrayBuffer, type: "image/gif" });
            await decoder.tracks.ready;
            const frameCount: number = decoder.tracks.selectedTrack?.frameCount ?? 1;

            const frames: ImageBitmap[] = [];
            const durations: number[] = [];
            for (let i = 0; i < frameCount; i++) {
              try {
                const result = await decoder.decode({ frameIndex: i });
                const bitmap = await createImageBitmap(result.image);
                frames.push(bitmap);
                // VideoFrame.duration is in microseconds; default 100 ms if absent.
                durations.push(result.image.duration ?? 100_000);
                result.image.close();
              } catch { break; }
            }
            decoder.close();

            if (frames.length > 0) {
              aspectRatio = frames[0].width / frames[0].height;
              renderer.setAnchorGifFrames(anchor.id, frames, durations);
              gifHandled = true;
            }
          } catch { /* fall through to img fallback */ }
        }

        if (!gifHandled) {
          // Fallback for Firefox / Safari: HTMLImageElement + canvas intermediary.
          const img = document.createElement("img");
          img.src = url;
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
          if (img.naturalWidth && img.naturalHeight) {
            aspectRatio = img.naturalWidth / img.naturalHeight;
          }
          renderer.setAnchorMedia(anchor.id, img);
        }
      } else {
        mediaType = "image";
        const bitmap = await createImageBitmap(file);
        if (bitmap.width && bitmap.height) {
          aspectRatio = bitmap.width / bitmap.height;
        }
        url = URL.createObjectURL(file);
        renderer.setAnchorMedia(anchor.id, bitmap);
      }

      return { url, mediaType, aspectRatio };
    };

    refs.setAnchorVisible.current = (anchor, visible) => {
      rendererRef.current?.setAnchorVisible(anchor.id, visible);
    };

    refs.showGizmo.current = (position) => {
      rendererRef.current?.showGizmo(position);
    };

    refs.hideGizmo.current = () => {
      rendererRef.current?.hideGizmo();
    };

    refs.worldToScreen.current = (worldPos) => {
      return rendererRef.current?.worldToScreen(worldPos) ?? null;
    };

    refs.getAnchorAxes.current = (anchorId) => {
      return rendererRef.current?.getAnchorAxes(anchorId) ?? null;
    };
  }, [refs]);

  useEffect(() => {
    refs.addKeyframeAtCamera.current = () => {
      const renderer = rendererRef.current;
      const fps = fpsRef.current;
      if (!renderer || !fps) return null;
      const pos = renderer.getCameraPosition();
      return {
        position: { x: pos.x, y: pos.y, z: pos.z },
        pitch: fps.pitch,
        yaw: fps.yaw,
        fov: 0,
      };
    };

    refs.getCameraState.current = () => {
      const renderer = rendererRef.current;
      const fps = fpsRef.current;
      if (!renderer || !fps) return null;
      const pos = renderer.getCameraPosition();
      return { position: pos, pitch: fps.pitch, yaw: fps.yaw };
    };

    refs.setCameraPosition.current = (pos) => {
      rendererRef.current?.setCameraPosition(pos.x, pos.y, pos.z);
    };

    refs.setCameraRotation.current = (pitch, yaw) => {
      fpsRef.current?.setOrientation(pitch, yaw);
    };

    refs.addChannelKeyframe.current = (groups: ChannelGroup[]) => {
      const renderer = rendererRef.current;
      const fps = fpsRef.current;
      const pb = playbackRef.current;
      if (!renderer || !fps) return;
      const pos = renderer.getCameraPosition();
      const time = pb?.currentTime ?? 0;

      actions.pushUndo();
      actions.setPaths(prev => {
        const curActiveId = activePathIdRef.current;
        const existing = prev.find(p => p.id === curActiveId);
        if (!existing) {
          const p = createPath();
          const updated = addChannelKf(p, time, pos, fps.pitch, fps.yaw, undefined, groups);
          actions.setActivePathId(updated.id);
          return [...prev, updated];
        }
        const updated = addChannelKf(existing, time, pos, fps.pitch, fps.yaw, undefined, groups);
        return prev.map(p => p.id === updated.id ? updated : p);
      });
    };

    refs.playPath.current = () => playbackRef.current?.play();
    refs.pausePath.current = () => playbackRef.current?.pause();
    refs.stopPath.current = () => playbackRef.current?.stop();
    refs.seekPath.current = (time) => playbackRef.current?.seek(time);
    refs.seekPathSilent.current = (time) => playbackRef.current?.seekSilent(time);
    refs.setPlaybackSpeed.current = (speed) => playbackRef.current?.setSpeed(speed);
    refs.setPlaybackLoop.current = (loop) => playbackRef.current?.setLoop(loop);
    refs.setHeadWiggle.current = (enabled) => playbackRef.current?.setHeadWiggle(enabled);
    refs.getRenderer.current = () => rendererRef.current;
    refs.getPlayback.current = () => playbackRef.current;
  }, [refs]);

  useEffect(() => {
    refs.loadDepthMesh.current = async (buffer: ArrayBuffer, filename: string) => {
      await rendererRef.current?.loadDepthMesh(buffer, filename);
    };

    refs.setDepthMeshVisible.current = (visible: boolean) => {
      rendererRef.current?.setDepthMeshVisible(visible);
    };

    refs.setDepthMeshTransform.current = (position, rotation, scale) => {
      rendererRef.current?.setDepthMeshTransform(position, rotation, scale);
    };

    refs.setDepthMeshDebugView.current = (enabled: boolean) => {
      rendererRef.current?.setDepthMeshDebugView(enabled);
    };

    refs.setDepthMeshBias.current = (bias: number) => {
      rendererRef.current?.setDepthMeshBias(bias);
    };

    refs.getDepthMeshAutoAlign.current = () => {
      const result = rendererRef.current?.getDepthMeshAutoAlign();
      if (!result) return null;
      return { position: result.position, rotation: { x: 0, y: 0, z: 0 }, scale: result.scale };
    };

    refs.setOrthoView.current = (axis) => {
      rendererRef.current?.setOrthoView(axis);
      if (axis !== null && fpsRef.current) {
        fpsRef.current.pause();
      } else if (axis === null && fpsRef.current) {
        fpsRef.current.resume();
      }
    };
  }, [refs.loadDepthMesh, refs.setDepthMeshVisible, refs.setDepthMeshTransform, refs.setDepthMeshDebugView, refs.setDepthMeshBias, refs.getDepthMeshAutoAlign, refs.setOrthoView]);

  const filterStyle = colorFilter === "none" ? undefined
    : colorFilter === "grayscale" ? "grayscale(1)"
    : `url(#cvd-${colorFilter})`;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", filter: filterStyle }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%"}}
      />
      {contextLost && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3"
          style={{ background: "rgba(0, 0, 0, 0.75)" }}
        >
          <p className="text-content-base text-sm opacity-70">
            The 3D viewport lost its rendering context.
          </p>
          <button
            className="rounded border border-border-subtle px-4 py-2 text-sm text-content-base hover:brightness-125"
            style={{ background: "rgb(var(--sf-raised))" }}
            onClick={() => {
              setContextLost(false);
              setReloadKey((k) => k + 1);
            }}
          >
            Reload Viewport
          </button>
        </div>
      )}
    </div>
  );
}

class PlyCanvasErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3"
          style={{ background: "rgb(var(--sf-base))" }}
        >
          <p className="text-content-base text-sm opacity-70">
            The 3D viewport encountered an error.
          </p>
          <button
            className="rounded border border-border-subtle px-4 py-2 text-sm text-content-base hover:brightness-125"
            style={{ background: "rgb(var(--sf-raised))" }}
            onClick={() => this.setState({ hasError: false })}
          >
            Reload Viewport
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PlyCanvas() {
  return (
    <PlyCanvasErrorBoundary>
      <PlyCanvasInner />
    </PlyCanvasErrorBoundary>
  );
}
