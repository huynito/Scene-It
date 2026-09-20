import type { SplatRenderer } from "./renderers/types";
import type { PlaybackController } from "./playback-controller";
import type { SceneAnchor } from "./scene-context";
import { createGifExporter, buildGlobalPalette, downsampleForPalette, type GifExporter } from "./gif-encoder";

export type GifExportPhase = "sampling" | "rendering" | "finalizing";

export interface GifExportProgress {
  phase: GifExportPhase;
  frame: number;
  total: number;
}

export interface GifExportOptions {
  width: number;
  height: number;
  fps: number;
  maxColors: number;
  includeFovFrame: boolean;
  compDuration: number;
  fileName: string;
}

export interface GifExportDeps {
  renderer: SplatRenderer;
  playback: PlaybackController;
  anchors: SceneAnchor[];
}

export class GifExportController {
  private cancelled = false;
  private exporter: GifExporter | null = null;

  async start(
    deps: GifExportDeps,
    options: GifExportOptions,
    onProgress: (p: GifExportProgress) => void
  ): Promise<Blob | null> {
    this.cancelled = false;
    const { renderer, playback, anchors } = deps;
    const { width, height, fps, maxColors, includeFovFrame, compDuration, fileName } = options;

    const totalFrames = Math.round(compDuration * fps);
    const canvas = renderer.getCanvas();
    if (!canvas) throw new Error("No canvas available");

    const savedTime = playback.currentTime;
    const savedPixelRatio = renderer.getMaxPixelRatio();
    const savedFovFrame = renderer.getFovFrame();

    renderer.setFovFrame(includeFovFrame);

    const restore = () => {
      renderer.restoreAfterCapture();
      renderer.setFovFrame(savedFovFrame);
      renderer.resumeAnchorVideos();
      renderer.setMaxPixelRatio(savedPixelRatio);
      renderer.setAutoRender(true);
      renderer.restoreCanvasToViewport();
      playback.seek(savedTime);
      playback.resumeControls();
    };

    try {
      const captureCanvas = document.createElement("canvas");
      captureCanvas.width = width;
      captureCanvas.height = height;
      const captureCtx = captureCanvas.getContext("2d", { alpha: false, willReadFrequently: true })!;

      this.exporter = createGifExporter({ width, height, fps });

      if (this.cancelled) { restore(); return null; }

      renderer.prepareForCapture();
      renderer.setMaxPixelRatio(1);
      renderer.setAutoRender(false);
      renderer.resizeCanvas(width, height);
      renderer.pauseAnchorVideos();

      const videoAnchors = anchors.filter((a) => a.mediaType === "video");

      playback.seek(0);
      for (let i = 0; i < 3; i++) {
        renderer.requestSingleFrame();
        const wb = await renderer.grabFrame();
        wb.close();
      }

      // Phase 1: Sample frames to build a global palette
      const sampleInterval = Math.min(4, Math.max(1, Math.floor(totalFrames / 30)));
      const sampleFrames: number[] = [];
      for (let f = 0; f < totalFrames; f += sampleInterval) {
        sampleFrames.push(f);
      }
      if (sampleFrames[sampleFrames.length - 1] !== totalFrames - 1 && totalFrames > 1) {
        sampleFrames.push(totalFrames - 1);
      }

      const samples: Uint8ClampedArray[] = [];
      for (let i = 0; i < sampleFrames.length; i++) {
        if (this.cancelled) { restore(); return null; }

        const frame = sampleFrames[i];
        const time = frame / fps;
        onProgress({ phase: "sampling", frame: i, total: sampleFrames.length });

        playback.seek(time);
        renderer.seekAnchorGifsToTime(time);

        if (videoAnchors.length > 0) {
          const seeks: Array<{ id: string; time: number }> = [];
          for (const anchor of videoAnchors) {
            const appearAt = anchor.appearAt ?? 0;
            const disappearAt = anchor.disappearAt ?? Infinity;
            if (time >= appearAt && time < disappearAt) {
              seeks.push({ id: anchor.id, time: time - appearAt });
            }
          }
          if (seeks.length > 0) {
            await renderer.seekAnchorVideosToTime(seeks);
          }
        }

        renderer.requestSingleFrame();
        const bitmap = await renderer.grabFrame();
        captureCtx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        samples.push(downsampleForPalette(captureCanvas));
        await new Promise<void>((r) => setTimeout(r, 0));
      }

      if (this.cancelled) { restore(); return null; }

      const globalPalette = buildGlobalPalette(samples, maxColors);

      // Phase 2: Render all frames using the global palette
      // Re-seek to start after sampling pass
      playback.seek(0);
      for (let i = 0; i < 3; i++) {
        renderer.requestSingleFrame();
        const wb = await renderer.grabFrame();
        wb.close();
      }

      for (let frame = 0; frame < totalFrames; frame++) {
        if (this.cancelled) { restore(); return null; }

        const time = frame / fps;
        onProgress({ phase: "rendering", frame, total: totalFrames });

        playback.seek(time);
        renderer.seekAnchorGifsToTime(time);

        if (videoAnchors.length > 0) {
          const seeks: Array<{ id: string; time: number }> = [];
          for (const anchor of videoAnchors) {
            const appearAt = anchor.appearAt ?? 0;
            const disappearAt = anchor.disappearAt ?? Infinity;
            if (time >= appearAt && time < disappearAt) {
              seeks.push({ id: anchor.id, time: time - appearAt });
            }
          }
          if (seeks.length > 0) {
            await renderer.seekAnchorVideosToTime(seeks);
          }
        }

        renderer.requestSingleFrame();
        const bitmap = await renderer.grabFrame();
        captureCtx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        this.exporter.addFrame(captureCanvas, globalPalette);

        await new Promise<void>((r) => setTimeout(r, 0));
      }

      // Phase 3: Finalize
      onProgress({ phase: "finalizing", frame: totalFrames, total: totalFrames });
      const blob = this.exporter.finalize();

      restore();
      if (this.cancelled) return null;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = fileName?.replace(/\.[^.]+$/, "") ?? "export";
      a.download = `${baseName}-export.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return blob;
    } catch (err) {
      this.exporter?.cancel();
      restore();
      throw err;
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.exporter?.cancel();
  }
}
