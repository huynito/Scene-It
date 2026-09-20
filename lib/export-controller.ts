import type { SplatRenderer } from "./renderers/types";
import type { PlaybackController } from "./playback-controller";
import type { SceneAnchor, MediaLibraryItem } from "./scene-context";
import { createExporter, type Exporter } from "./video-encoder";
import { mixAudio } from "./audio-mixer";

export type ExportPhase = "mixing" | "rendering" | "finalizing";

export interface ExportProgress {
  phase: ExportPhase;
  frame: number;
  total: number;
}

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  includeAudio: boolean;
  includeFovFrame: boolean;
  compDuration: number;
  fileName: string;
}

export interface ExportDeps {
  renderer: SplatRenderer;
  playback: PlaybackController;
  anchors: SceneAnchor[];
  mediaLibrary: MediaLibraryItem[];
  backgroundMusicFile?: File | null;
}

export class ExportController {
  private cancelled = false;
  private exporter: Exporter | null = null;

  async start(
    deps: ExportDeps,
    options: ExportOptions,
    onProgress: (p: ExportProgress) => void
  ): Promise<Blob | null> {
    this.cancelled = false;
    const { renderer, playback, anchors, mediaLibrary, backgroundMusicFile } = deps;
    const { width, height, fps, videoBitrate, includeAudio, includeFovFrame, compDuration, fileName } = options;

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
      const hasVideoAudio = anchors.some((a) => a.mediaType === "video" && a.mediaUrl);
      const hasAnyAudio = includeAudio && (hasVideoAudio || !!backgroundMusicFile);

      // 2D intermediary canvas — createImageBitmap captures each frame
      // from the WebGPU canvas, then we draw it here for the encoder.
      const captureCanvas = document.createElement("canvas");
      captureCanvas.width = width;
      captureCanvas.height = height;
      const captureCtx = captureCanvas.getContext("2d", { alpha: false })!;

      this.exporter = createExporter({
        canvas: captureCanvas,
        fps,
        videoBitrate,
        hasAudio: hasAnyAudio,
      });

      // Phase 1: Audio pre-mix
      if (hasAnyAudio) {
        onProgress({ phase: "mixing", frame: 0, total: 0 });
        if (this.cancelled) { restore(); return null; }

        const audioBuffer = await mixAudio({
          anchors,
          mediaLibrary,
          compDuration,
          backgroundMusicFile,
        });
        if (audioBuffer && !this.cancelled) {
          await this.exporter.addAudioBuffer(audioBuffer);
        }
      }

      if (this.cancelled) { restore(); return null; }

      // Phase 2: Frame-by-frame video capture
      // Force pixel ratio to 1 so the GPU canvas matches export dimensions
      // exactly (prevents Retina 2x scaling from doubling the resolution).
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

      for (let frame = 0; frame < totalFrames; frame++) {
        if (this.cancelled) { restore(); return null; }

        const time = frame / fps;
        onProgress({ phase: "rendering", frame, total: totalFrames });

        playback.seek(time);

        // Advance GIF anchor textures to the composition time
        renderer.seekAnchorGifsToTime(time);

        // Seek video anchor textures to the correct frame before rendering
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

        await this.exporter.addVideoFrame(time);
      }

      // Phase 3: Finalize
      onProgress({ phase: "finalizing", frame: totalFrames, total: totalFrames });
      const blob = await this.exporter.finalize();

      restore();
      if (this.cancelled) return null;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = fileName?.replace(/\.[^.]+$/, "") ?? "export";
      a.download = `${baseName}-export.mp4`;
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
