"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X, Download, AlertTriangle, FileCode, FileJson, Film, Image as ImageIcon } from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useScene } from "@/lib/scene-context";
import { isExportSupported } from "@/lib/video-encoder";
import { ExportController, type ExportProgress } from "@/lib/export-controller";
import { GifExportController, type GifExportProgress } from "@/lib/gif-export-controller";
import { buildInteropScene } from "@/lib/export-interop";
import { generateAeScript } from "@/lib/export-ae";
import { generateUnityJson, UNITY_IMPORTER_SCRIPT } from "@/lib/export-unity";
import { useAimSounds } from "@/themes/xX_sCeNeIt_Xx/sounds";
import { trackExport } from "@/lib/analytics";

const RESOLUTIONS = [
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
] as const;

const QUALITY_PRESETS = [
  { label: "Low", bitrate: 4_000_000 },
  { label: "Medium", bitrate: 8_000_000 },
  { label: "High", bitrate: 16_000_000 },
] as const;

const GIF_COLOR_OPTIONS = [128, 256] as const;

type ExportState = "settings" | "exporting" | "done" | "error";

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ExportModal() {
  const {
    compFps,
    compDuration,
    fileName,
    anchors,
    mediaLibrary,
    backgroundMusicId,
    showFovFrame,
    exportFormat,
    paths,
    activePathId,
    bakedPaths,
    activeBakedPathId,
    sceneOrigin,
    refs,
    actions,
  } = useScene();
  const { playFileDone } = useAimSounds();

  const [resIdx, setResIdx] = useState(1);
  const [qualIdx, setQualIdx] = useState(2);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeFovFrame, setIncludeFovFrame] = useState(showFovFrame);
  const [exportState, setExportState] = useState<ExportState>("settings");
  const [progress, setProgress] = useState<ExportProgress | GifExportProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [resultSize, setResultSize] = useState(0);
  const [startedAt, setStartedAt] = useState(0);

  const [gifMaxColors, setGifMaxColors] = useState<128 | 256>(256);

  const controllerRef = useRef<ExportController | GifExportController | null>(null);
  const [sceneFormat, setSceneFormat] = useState<"ae" | "unity">("ae");
  const [sceneIncludeCamera, setSceneIncludeCamera] = useState(true);
  const [sceneIncludeAnchors, setSceneIncludeAnchors] = useState(true);
  const [sceneScale, setSceneScale] = useState(100);

  const isGif = exportFormat === "gif";
  const supported = useMemo(() => isExportSupported(), []);
  const res = RESOLUTIONS[resIdx];
  const quality = QUALITY_PRESETS[qualIdx];
  const totalFrames = Math.round(compDuration * compFps);
  const estimatedSize = isGif
    ? totalFrames * res.width * res.height * (gifMaxColors <= 128 ? 0.43 : 0.51)
    : (quality.bitrate / 8) * compDuration;
  const videoAnchorCount = anchors.filter((a) => a.mediaType === "video" && a.mediaUrl).length;
  const bgMusicItem = backgroundMusicId ? mediaLibrary.find((m) => m.id === backgroundMusicId) : null;
  const hasAnyAudioSource = videoAnchorCount > 0 || !!bgMusicItem;

  const elapsed = startedAt > 0 ? (Date.now() - startedAt) / 1000 : 0;
  const pct = (() => {
    if (!progress) return 0;
    const local = progress.total > 0 ? progress.frame / progress.total : 0;
    if (isGif) {
      if (progress.phase === "sampling") return local * 0.2;
      if (progress.phase === "rendering") return 0.2 + local * 0.78;
      return 1;
    }
    if (progress.phase === "mixing") return 0;
    if (progress.phase === "rendering") return local * 0.98;
    return 1;
  })();
  const eta = pct > 0.01 ? (elapsed / pct) * (1 - pct) : 0;

  const handleStart = useCallback(async () => {
    const renderer = refs.getRenderer.current?.();
    const playback = refs.getPlayback.current?.();
    if (!renderer || !playback) return;

    setExportState("exporting");
    setStartedAt(Date.now());
    setProgress({ phase: isGif ? "sampling" : "mixing", frame: 0, total: 0 });
    actions.setIsExporting(true);

    try {
      let blob: Blob | null;

      if (isGif) {
        const controller = new GifExportController();
        controllerRef.current = controller;
        blob = await controller.start(
          { renderer, playback, anchors },
          {
            width: res.width,
            height: res.height,
            fps: compFps,
            maxColors: gifMaxColors,
            includeFovFrame,
            compDuration,
            fileName: fileName ?? "scene",
          },
          (p) => {
            setProgress(p);
            actions.setExportProgress(p);
          }
        );
      } else {
        const controller = new ExportController();
        controllerRef.current = controller;
        blob = await controller.start(
          {
            renderer,
            playback,
            anchors,
            mediaLibrary,
            backgroundMusicFile: bgMusicItem?.file ?? null,
          },
          {
            width: res.width,
            height: res.height,
            fps: compFps,
            videoBitrate: quality.bitrate,
            includeAudio: includeAudio && hasAnyAudioSource,
            includeFovFrame,
            compDuration,
            fileName: fileName ?? "scene",
          },
          (p) => {
            setProgress(p);
            actions.setExportProgress(p);
          }
        );
      }

      if (blob) {
        setResultSize(blob.size);
        setExportState("done");
        playFileDone();
        trackExport(isGif ? "gif" : "mp4", res.label, compDuration);
      } else {
        setExportState("settings");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Export failed");
      setExportState("error");
    } finally {
      actions.setIsExporting(false);
      actions.setExportProgress(null);
      controllerRef.current = null;
    }
  }, [refs, anchors, mediaLibrary, res, compFps, quality, includeAudio, includeFovFrame, compDuration, fileName, hasAnyAudioSource, bgMusicItem, actions, isGif, gifMaxColors]);

  const handleExportSceneData = useCallback(() => {
    const activePath = paths.find((p) => p.id === activePathId) ?? null;
    const activeBaked = bakedPaths.find((p) => p.id === activeBakedPathId) ?? null;
    const pathToExport = activePath ?? activeBaked;

    const scene = buildInteropScene(pathToExport, anchors, compFps, compDuration, 60, sceneOrigin);

    let content: string;
    let ext: string;
    let mime: string;

    if (sceneFormat === "ae") {
      content = generateAeScript(
        scene,
        RESOLUTIONS[resIdx].width,
        RESOLUTIONS[resIdx].height,
        sceneScale,
        sceneIncludeCamera,
        sceneIncludeAnchors,
      );
      ext = "jsx";
      mime = "text/javascript";
    } else {
      content = generateUnityJson(scene, sceneIncludeCamera, sceneIncludeAnchors);
      ext = "json";
      mime = "application/json";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fileName ?? "scene").replace(/[^a-z0-9]/gi, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);

    if (sceneFormat === "unity") {
      const csBlob = new Blob([UNITY_IMPORTER_SCRIPT], { type: "text/plain" });
      const csUrl = URL.createObjectURL(csBlob);
      const csA = document.createElement("a");
      csA.href = csUrl;
      csA.download = "GSVImporter.cs";
      setTimeout(() => {
        csA.click();
        URL.revokeObjectURL(csUrl);
      }, 200);
    }
  }, [paths, activePathId, bakedPaths, activeBakedPathId, anchors, compFps, compDuration, sceneFormat, resIdx, sceneScale, sceneIncludeCamera, sceneIncludeAnchors, fileName]);

  const handleCancel = useCallback(() => {
    if (controllerRef.current) controllerRef.current.cancel();
  }, []);

  const handleClose = useCallback(() => {
    controllerRef.current?.cancel();
    actions.setShowExportModal(false);
    setExportState("settings");
    setProgress(null);
    setErrorMsg("");
    setResultSize(0);
    setStartedAt(0);
  }, [actions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  return (
    <div className="win95-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="win95-window w-full max-w-md max-h-[calc(100vh-2rem)] flex flex-col rounded-xl border border-surface-border-secondary bg-surface-primary shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-surface-border px-5 py-3">
          <h2 className="text-sm font-semibold tracking-wider text-content-primary">Export</h2>
          <button
            onClick={handleClose}
            className="rounded p-1 text-content-secondary transition-colors hover:bg-surface-raised hover:text-content-primary"
          >
            <ThemeIcon icon={X} className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto scrollbar-thin">
          {!supported && !isGif ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <ThemeIcon icon={AlertTriangle} className="h-8 w-8 text-amber-400" />
              <p className="text-sm text-content-primary">
                Your browser does not support WebCodecs (VideoEncoder).
              </p>
              <p className="text-xs text-content-muted">
                Please use Chrome 94+, Edge 94+, Safari 16.4+, or Firefox 130+.
              </p>
            </div>
          ) : exportState === "settings" ? (
            <div className="space-y-4">
              {/* Format toggle */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-content-secondary">Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => actions.setExportFormat("mp4")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      !isGif
                        ? "border-accent-500 bg-accent-500/10 text-accent-400"
                        : "border-surface-border-secondary text-content-secondary hover:border-content-faint hover:text-content-primary"
                    }`}
                  >
                    <ThemeIcon icon={Film} className="h-3.5 w-3.5" />
                    MP4
                  </button>
                  <button
                    onClick={() => actions.setExportFormat("gif")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isGif
                        ? "border-accent-500 bg-accent-500/10 text-accent-400"
                        : "border-surface-border-secondary text-content-secondary hover:border-content-faint hover:text-content-primary"
                    }`}
                  >
                    <ThemeIcon icon={ImageIcon} className="h-3.5 w-3.5" />
                    GIF
                  </button>
                </div>
              </div>

              {/* Resolution */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-content-secondary">Resolution</label>
                <div className="flex gap-2">
                  {RESOLUTIONS.map((r, i) => (
                    <button
                      key={r.label}
                      onClick={() => setResIdx(i)}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        i === resIdx
                          ? "border-accent-500 bg-accent-500/10 text-accent-400"
                          : "border-surface-border-secondary text-content-secondary hover:border-content-faint hover:text-content-primary"
                      }`}
                    >
                      {r.label}
                      <span className="mt-0.5 block text-[10px] opacity-60">
                        {r.width}x{r.height}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {isGif ? (
                <>
                  {/* GIF Max Colors */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-content-secondary">Max Colors</label>
                    <div className="flex gap-2">
                      {GIF_COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setGifMaxColors(c)}
                          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                            c === gifMaxColors
                              ? "border-accent-500 bg-accent-500/10 text-accent-400"
                              : "border-surface-border-secondary text-content-secondary hover:border-content-faint hover:text-content-primary"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                </>
              ) : (
                <>
                  {/* Quality (MP4 only) */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-content-secondary">Quality</label>
                    <div className="flex gap-2">
                      {QUALITY_PRESETS.map((q, i) => (
                        <button
                          key={q.label}
                          onClick={() => setQualIdx(i)}
                          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                            i === qualIdx
                              ? "border-accent-500 bg-accent-500/10 text-accent-400"
                              : "border-surface-border-secondary text-content-secondary hover:border-content-faint hover:text-content-primary"
                          }`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Audio toggle (MP4 only) */}
                  {hasAnyAudioSource && (
                    <div className="flex items-center justify-between rounded-md border border-surface-border px-3 py-2">
                      <div>
                        <span className="text-xs font-medium text-content-primary">Include audio</span>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-content-muted">
                          {videoAnchorCount > 0 && (
                            <span>{videoAnchorCount} video{videoAnchorCount !== 1 ? "s" : ""}</span>
                          )}
                          {bgMusicItem && (
                            <span className="truncate max-w-[140px]" title={bgMusicItem.name}>
                              BG: {bgMusicItem.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <ThemeToggle checked={includeAudio} onChange={setIncludeAudio} />
                    </div>
                  )}
                </>
              )}

              {/* FOV Frame toggle */}
              <div className="flex items-center justify-between rounded-md border border-surface-border px-3 py-2">
                <span className="text-xs font-medium text-content-primary">Include FOV Frame</span>
                <ThemeToggle checked={includeFovFrame} onChange={setIncludeFovFrame} />
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between rounded-md bg-surface-raised/50 px-3 py-2 text-xs text-content-secondary">
                <span>{totalFrames} frames at {compFps} fps ({compDuration.toFixed(1)}s)</span>
                <span>~{formatBytes(estimatedSize)}</span>
              </div>

              {/* Start button */}
              <button
                onClick={handleStart}
                disabled={!isGif && !supported}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ThemeIcon icon={Download} className="h-4 w-4" />
                Export {isGif ? "GIF" : "MP4"}
              </button>

              {/* Divider */}
              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-surface-border" />
                <span className="px-3 text-[10px] uppercase tracking-wider text-content-faint">Scene Data</span>
                <div className="flex-1 border-t border-surface-border" />
              </div>

              {/* Scene data export format */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-content-secondary">Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSceneFormat("ae")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      sceneFormat === "ae"
                        ? "border-accent-500 bg-accent-500/10 text-accent-400"
                        : "border-surface-border-secondary text-content-secondary hover:border-content-faint hover:text-content-primary"
                    }`}
                  >
                    <ThemeIcon icon={FileCode} className="h-3.5 w-3.5" />
                    After Effects (.jsx)
                  </button>
                  <button
                    onClick={() => setSceneFormat("unity")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      sceneFormat === "unity"
                        ? "border-accent-500 bg-accent-500/10 text-accent-400"
                        : "border-surface-border-secondary text-content-secondary hover:border-content-faint hover:text-content-primary"
                    }`}
                  >
                    <ThemeIcon icon={FileJson} className="h-3.5 w-3.5" />
                    Unity (.json)
                  </button>
                </div>
              </div>

              {/* Scene data toggles */}
              <div className="flex gap-3">
                <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-surface-border px-3 py-2">
                  <input
                    type="checkbox"
                    checked={sceneIncludeCamera}
                    onChange={() => setSceneIncludeCamera((v) => !v)}
                    className="accent-accent-500"
                  />
                  <span className="text-xs text-content-primary">Camera</span>
                </label>
                <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-surface-border px-3 py-2">
                  <input
                    type="checkbox"
                    checked={sceneIncludeAnchors}
                    onChange={() => setSceneIncludeAnchors((v) => !v)}
                    className="accent-accent-500"
                  />
                  <span className="text-xs text-content-primary">Anchors ({anchors.length})</span>
                </label>
              </div>

              {/* Scale factor (AE only) */}
              {sceneFormat === "ae" && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-content-secondary">Scale (px/unit)</label>
                  <input
                    type="number"
                    value={sceneScale}
                    min={1}
                    max={10000}
                    onChange={(e) => setSceneScale(Math.max(1, Number(e.target.value) || 100))}
                    className="w-20 rounded border border-surface-border-secondary bg-surface-raised px-2 py-1 text-xs text-content-primary outline-none focus:border-accent-500"
                  />
                </div>
              )}

              {/* Scene data summary */}
              <div className="flex items-center justify-between rounded-md bg-surface-raised/50 px-3 py-2 text-[10px] text-content-muted">
                <span>
                  {sceneIncludeCamera ? `${totalFrames} camera frames` : "No camera"}
                  {sceneIncludeAnchors ? ` · ${anchors.length} anchors` : ""}
                </span>
                <span>{compDuration.toFixed(1)}s @ {compFps} fps</span>
              </div>

              {/* Export scene data button */}
              <button
                onClick={handleExportSceneData}
                disabled={!sceneIncludeCamera && !sceneIncludeAnchors}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-surface-border-secondary px-4 py-2 text-sm font-medium text-content-primary transition-colors hover:bg-surface-raised disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sceneFormat === "ae" ? <ThemeIcon icon={FileCode} className="h-4 w-4" /> : <ThemeIcon icon={FileJson} className="h-4 w-4" />}
                Export Scene Data
              </button>
            </div>
          ) : exportState === "exporting" ? (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <p className="text-sm font-medium text-content-primary">
                  {progress?.phase === "mixing"
                    ? "Mixing audio..."
                    : progress?.phase === "sampling"
                    ? `Sampling colors (${progress?.frame ?? 0} of ${progress?.total ?? 0})...`
                    : progress?.phase === "finalizing"
                    ? "Finalizing..."
                    : `Rendering frame ${progress?.frame ?? 0} of ${progress?.total ?? totalFrames}`}
                </p>
                <p className="mt-1 text-xs text-content-muted">
                  {elapsed > 0 && `${formatTime(elapsed)} elapsed`}
                  {eta > 1 && ` / ~${formatTime(eta)} remaining`}
                </p>
              </div>

              {/* Progress bar */}
              <div className="win95-inset h-3 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-accent-500 transition-all duration-200"
                  style={{ width: `${Math.round(pct * 100)}%` }}
                />
              </div>

              <p className="text-center text-xs tabular-nums text-content-muted">
                {Math.round(pct * 100)}%
              </p>

              <button
                onClick={handleCancel}
                className="flex w-full items-center justify-center rounded-md border border-surface-border-secondary px-4 py-2 text-sm font-medium text-content-primary transition-colors hover:bg-surface-raised"
              >
                Cancel
              </button>
            </div>
          ) : exportState === "done" ? (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/10">
                <ThemeIcon icon={Download} className="h-6 w-6 text-accent-400" />
              </div>
              <p className="text-sm font-medium text-content-primary">Export complete</p>
              <p className="text-xs text-content-muted">
                {formatBytes(resultSize)} saved
              </p>
              <button
                onClick={handleClose}
                className="flex w-full items-center justify-center rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <ThemeIcon icon={AlertTriangle} className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-sm font-medium text-content-primary">Export failed</p>
              <p className="text-xs text-content-muted">{errorMsg}</p>
              <button
                onClick={() => setExportState("settings")}
                className="flex w-full items-center justify-center rounded-md border border-surface-border-secondary px-4 py-2 text-sm font-medium text-content-primary transition-colors hover:bg-surface-raised"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
