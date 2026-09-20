import { GIFEncoder, quantize } from "gifenc";

export interface GifEncoderOptions {
  width: number;
  height: number;
  fps: number;
}

const PALETTE_THUMB_W = 128;
const PALETTE_THUMB_H = 72;

export interface GifExporter {
  addFrame(canvas: HTMLCanvasElement, palette: number[][]): void;
  finalize(): Blob;
  cancel(): void;
}

export function downsampleForPalette(source: HTMLCanvasElement): Uint8ClampedArray {
  const thumb = document.createElement("canvas");
  thumb.width = PALETTE_THUMB_W;
  thumb.height = PALETTE_THUMB_H;
  const ctx = thumb.getContext("2d", { alpha: false, willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, PALETTE_THUMB_W, PALETTE_THUMB_H);
  return ctx.getImageData(0, 0, PALETTE_THUMB_W, PALETTE_THUMB_H).data;
}

export function buildGlobalPalette(
  samples: Uint8ClampedArray[],
  maxColors: number
): number[][] {
  let totalLen = 0;
  for (const s of samples) totalLen += s.length;
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const s of samples) {
    combined.set(s, offset);
    offset += s.length;
  }
  return quantize(combined, maxColors);
}

/* prettier-ignore */
const BAYER8x8 = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

const BAYER_SPREAD = 32;
const CUBE_BITS = 5;
const CUBE_SIZE = 1 << CUBE_BITS;
const CUBE_SHIFT = 8 - CUBE_BITS;

function buildColorCube(palette: number[][]): Uint8Array {
  const cube = new Uint8Array(CUBE_SIZE * CUBE_SIZE * CUBE_SIZE);
  for (let ri = 0; ri < CUBE_SIZE; ri++) {
    const r = (ri << CUBE_SHIFT) | (1 << (CUBE_SHIFT - 1));
    for (let gi = 0; gi < CUBE_SIZE; gi++) {
      const g = (gi << CUBE_SHIFT) | (1 << (CUBE_SHIFT - 1));
      for (let bi = 0; bi < CUBE_SIZE; bi++) {
        const b = (bi << CUBE_SHIFT) | (1 << (CUBE_SHIFT - 1));
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let p = 0; p < palette.length; p++) {
          const pr = palette[p][0], pg = palette[p][1], pb = palette[p][2];
          const dist = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
          if (dist < bestDist) { bestDist = dist; bestIdx = p; }
        }
        cube[(ri * CUBE_SIZE + gi) * CUBE_SIZE + bi] = bestIdx;
      }
    }
  }
  return cube;
}

function applyBayerDither(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  palette: number[][],
  cube: Uint8Array,
): Uint8Array {
  const len = width * height;
  const out = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    const threshold = (BAYER8x8[((i / width | 0) & 7) * 8 + (i % width & 7)] / 64 - 0.5) * BAYER_SPREAD;
    const off = i << 2;
    const r = Math.max(0, Math.min(255, rgba[off] + threshold));
    const g = Math.max(0, Math.min(255, rgba[off + 1] + threshold));
    const b = Math.max(0, Math.min(255, rgba[off + 2] + threshold));
    out[i] = cube[((r >> CUBE_SHIFT) * CUBE_SIZE + (g >> CUBE_SHIFT)) * CUBE_SIZE + (b >> CUBE_SHIFT)];
  }

  return out;
}

export function createGifExporter(options: GifEncoderOptions): GifExporter {
  const { width, height, fps } = options;

  const delay = Math.round(1000 / fps);
  const encoder = GIFEncoder();
  let cancelled = false;
  let cube: Uint8Array | null = null;

  return {
    addFrame(canvas: HTMLCanvasElement, palette: number[][]) {
      if (cancelled) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const { data } = ctx.getImageData(0, 0, width, height);

      if (!cube) cube = buildColorCube(palette);
      const index = applyBayerDither(data, width, height, palette, cube);

      encoder.writeFrame(index, width, height, {
        palette,
        delay,
        dispose: 1,
      });
    },

    finalize(): Blob {
      encoder.finish();
      const bytes = encoder.bytes();
      const buf = (bytes.buffer as ArrayBuffer).slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return new Blob([buf], { type: "image/gif" });
    },

    cancel() {
      cancelled = true;
    },
  };
}
