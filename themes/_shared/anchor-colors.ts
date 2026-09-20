import { getCurrentThemeId } from "./tokens";

const ANCHOR_HUES = [0, 30, 45, 140, 170, 195, 220, 260, 290, 330];

const MS_PAINT_PALETTE = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#800000",
  "#008000",
  "#000080",
  "#808000",
  "#800080",
  "#008080",
  "#FF8000",
  "#0080FF",
];

export const CGA_PALETTE = [
  "#00FFFF", "#00FF00", "#FFFF00", "#FF00FF",
  "#FF0000", "#2A2AFF", "#FFFFFF", "#FFFF55",
  "#55FFFF", "#55FF55", "#FF5555", "#FF55FF",
];

const XP_PAINT_PALETTE = [
  "#CC0000",
  "#008800",
  "#0055CC",
  "#DD9900",
  "#CC00AA",
  "#0099CC",
  "#880000",
  "#006600",
  "#003399",
  "#886600",
  "#660088",
  "#006688",
  "#DD6600",
  "#3388DD",
];

export function anchorNumberFromId(id: string): number {
  const n = parseInt(id.split("-").pop() ?? "0", 10);
  return isNaN(n) ? 0 : n;
}

export function anchorColor(id: string): string {
  const num = anchorNumberFromId(id);
  if (typeof document !== "undefined") {
    const theme = getCurrentThemeId();
    if (theme === "win95") return MS_PAINT_PALETTE[num % MS_PAINT_PALETTE.length];
    if (theme === "sciin_it") return CGA_PALETTE[num % CGA_PALETTE.length];
    if (theme === "xX_sCeNeIt_Xx") return XP_PAINT_PALETTE[num % XP_PAINT_PALETTE.length];
  }
  return `hsl(${ANCHOR_HUES[num % ANCHOR_HUES.length]}, 60%, 55%)`;
}
