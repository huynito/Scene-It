import {
  Output,
  CanvasSource,
  AudioBufferSource,
  BufferTarget,
  Mp4OutputFormat,
} from "mediabunny";

export interface ExporterOptions {
  canvas: HTMLCanvasElement;
  fps: number;
  videoBitrate: number;
  hasAudio: boolean;
  audioSampleRate?: number;
  audioChannels?: number;
}

export interface Exporter {
  addVideoFrame(timestampSec: number): Promise<void>;
  addAudioBuffer(buffer: AudioBuffer): Promise<void>;
  finalize(): Promise<Blob>;
  cancel(): Promise<void>;
}

export function isExportSupported(): boolean {
  return typeof VideoEncoder !== "undefined";
}

export function createExporter(options: ExporterOptions): Exporter {
  const {
    canvas,
    fps,
    videoBitrate,
    hasAudio,
    audioSampleRate = 48000,
    audioChannels = 2,
  } = options;

  const frameDuration = 1 / fps;

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });

  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: videoBitrate,
    keyFrameInterval: 2,
    latencyMode: "quality",
    hardwareAcceleration: "prefer-hardware",
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  if (hasAudio) {
    audioSource = new AudioBufferSource({
      codec: "aac",
      bitrate: 128_000,
    });
    output.addAudioTrack(audioSource);
  }

  let started = false;

  return {
    async addVideoFrame(timestampSec: number) {
      if (!started) {
        await output.start();
        started = true;
      }
      await videoSource.add(timestampSec, frameDuration);
    },

    async addAudioBuffer(buffer: AudioBuffer) {
      if (!audioSource) return;
      if (!started) {
        await output.start();
        started = true;
      }
      await audioSource.add(buffer);
    },

    async finalize(): Promise<Blob> {
      videoSource.close();
      audioSource?.close();
      await output.finalize();
      return new Blob([target.buffer!], { type: "video/mp4" });
    },

    async cancel() {
      await output.cancel();
    },
  };
}
