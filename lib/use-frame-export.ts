"use client";

import { useState, useCallback } from "react";
import { useScene } from "./scene-context";
import { trackExport } from "./analytics";

const ASPECT = 16 / 9;

export function useFrameExport() {
  const { fileName, refs } = useScene();

  const [frameExportFormat, setFrameExportFormat] = useState<"png" | "jpeg" | null>(null);
  const [frameExportWidth, setFrameExportWidth] = useState(1920);

  const computedHeight = Math.round(frameExportWidth / ASPECT);

  const captureFrameAtSize = useCallback(async (format: "png" | "jpeg", w: number, h: number) => {
    const renderer = refs.getRenderer.current?.();
    if (!renderer) return;
    const savedPixelRatio = renderer.getMaxPixelRatio();
    renderer.prepareForCapture();
    renderer.setMaxPixelRatio(1);
    renderer.setAutoRender(false);
    renderer.resizeCanvas(w, h);
    try {
      renderer.requestSingleFrame();
      const bitmap = await renderer.grabFrame();

      const offscreen = document.createElement("canvas");
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const ext = format === "png" ? "png" : "jpg";
      offscreen.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(fileName ?? "frame").replace(/[^a-z0-9]/gi, "_")}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        trackExport(format === "png" ? "png" : "jpg", `${w}x${h}`);
      }, mimeType, 0.95);
    } finally {
      renderer.restoreAfterCapture();
      renderer.setMaxPixelRatio(savedPixelRatio);
      renderer.setAutoRender(true);
      renderer.restoreCanvasToViewport();
    }
  }, [refs, fileName]);

  const resetFrameExport = useCallback(() => {
    setFrameExportFormat(null);
  }, []);

  return {
    frameExportFormat,
    setFrameExportFormat,
    frameExportWidth,
    setFrameExportWidth,
    computedHeight,
    captureFrameAtSize,
    resetFrameExport,
  };
}
