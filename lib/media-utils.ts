import type { MediaLibraryItem } from "./scene-context";

export function mediaTypeFromFile(file: File): "image" | "gif" | "video" | "audio" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type === "image/gif" || ext === "gif") return "gif";
  if (file.type.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext)) return "video";
  if (file.type.startsWith("audio/") || ["mp3", "wav", "ogg", "aac", "m4a", "flac", "wma"].includes(ext)) return "audio";
  return "image";
}

export function isAccepted(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/") ||
    ["jpg", "jpeg", "png", "webp", "gif", "avif", "mp4", "webm", "mov", "mp3", "wav", "ogg", "aac", "m4a", "flac", "wma"].includes(ext)
  );
}

function canvasToThumbnailUrl(canvas: HTMLCanvasElement): string {
  const MAX = 256;
  const scale = Math.min(1, MAX / Math.max(canvas.width, canvas.height));
  const w = Math.round(canvas.width * scale);
  const h = Math.round(canvas.height * scale);
  const thumb = document.createElement("canvas");
  thumb.width = w;
  thumb.height = h;
  const ctx = thumb.getContext("2d");
  if (ctx) ctx.drawImage(canvas, 0, 0, w, h);
  return thumb.toDataURL("image/jpeg", 0.8);
}

export async function buildLibraryItem(file: File): Promise<MediaLibraryItem> {
  const type = mediaTypeFromFile(file);
  const url = URL.createObjectURL(file);
  let aspectRatio = 1;
  let thumbnailUrl = url;
  let audioDuration: number | undefined;
  try {
    if (type === "audio") {
      thumbnailUrl = "";
      const audio = document.createElement("audio");
      audio.src = url;
      audio.preload = "metadata";
      await new Promise<void>((res) => {
        audio.onloadedmetadata = () => res();
        audio.onerror = () => res();
        setTimeout(res, 3000);
      });
      if (Number.isFinite(audio.duration)) audioDuration = audio.duration;
    } else if (type === "video") {
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.preload = "auto";
      await new Promise<void>((res) => {
        video.onloadeddata = () => res();
        video.onerror = () => res();
        setTimeout(res, 3000);
      });
      if (video.videoWidth && video.videoHeight) {
        aspectRatio = video.videoWidth / video.videoHeight;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          thumbnailUrl = canvasToThumbnailUrl(canvas);
        }
      }
    } else if (type === "gif") {
      const img = document.createElement("img");
      img.src = url;
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
        setTimeout(res, 2000);
      });
      if (img.naturalWidth && img.naturalHeight) {
        aspectRatio = img.naturalWidth / img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          thumbnailUrl = canvasToThumbnailUrl(canvas);
        }
      }
    } else {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width && bitmap.height) aspectRatio = bitmap.width / bitmap.height;
      bitmap.close();
    }
  } catch {}
  return {
    id: `ml-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name,
    url,
    thumbnailUrl,
    type,
    aspectRatio,
    file,
    ...(audioDuration !== undefined && { duration: audioDuration }),
  };
}
