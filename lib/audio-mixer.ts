import type { SceneAnchor, MediaLibraryItem } from "./scene-context";

const SAMPLE_RATE = 48000;

export interface MixOptions {
  anchors: SceneAnchor[];
  mediaLibrary: MediaLibraryItem[];
  compDuration: number;
  backgroundMusicFile?: File | null;
}

export async function mixAudio(opts: MixOptions): Promise<AudioBuffer | null> {
  const { anchors, mediaLibrary, compDuration, backgroundMusicFile } = opts;

  const videoAnchors = anchors.filter(
    (a) => a.mediaType === "video" && a.mediaUrl
  );

  const libByUrl = new Map(mediaLibrary.map((m) => [m.url, m]));

  const decodedTracks: {
    buffer: AudioBuffer;
    startTime: number;
    duration: number;
  }[] = [];

  const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });

  for (const anchor of videoAnchors) {
    const item = libByUrl.get(anchor.mediaUrl!);
    if (!item?.file) continue;

    try {
      const arrayBuffer = await item.file.arrayBuffer();
      const decoded = await tempCtx.decodeAudioData(arrayBuffer);
      const startTime = anchor.appearAt ?? 0;
      const endTime = anchor.disappearAt ?? compDuration;
      decodedTracks.push({
        buffer: decoded,
        startTime,
        duration: endTime - startTime,
      });
    } catch {
      // Video has no audio track or unsupported format
    }
  }

  let bgBuffer: AudioBuffer | null = null;
  if (backgroundMusicFile) {
    try {
      const arrayBuffer = await backgroundMusicFile.arrayBuffer();
      bgBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    } catch {
      // Unsupported audio format
    }
  }

  await tempCtx.close();

  if (decodedTracks.length === 0 && !bgBuffer) return null;

  const totalSamples = Math.ceil(compDuration * SAMPLE_RATE);
  const offlineCtx = new OfflineAudioContext(2, totalSamples, SAMPLE_RATE);

  for (const track of decodedTracks) {
    const source = offlineCtx.createBufferSource();
    source.buffer = track.buffer;
    source.connect(offlineCtx.destination);
    source.start(track.startTime, 0, track.duration);
  }

  if (bgBuffer) {
    const source = offlineCtx.createBufferSource();
    source.buffer = bgBuffer;
    source.loop = bgBuffer.duration < compDuration;
    source.connect(offlineCtx.destination);
    source.start(0, 0, compDuration);
  }

  return offlineCtx.startRendering();
}

export { SAMPLE_RATE };
