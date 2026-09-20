"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Pen, Move, Footprints } from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import { useScene } from "@/lib/scene-context";
import Panel from "@/components/ui/Panel";
import CollapsibleSection from "@/components/viewer/panels/CollapsibleSection";
import { getAccentHex } from "@/themes";
import { W95_BUCKET_CURSOR_URL, W95_ERASER_CURSOR_URL } from "@/themes/win95/icons";
import { Win95Minimap } from "@/themes/win95/shells";
import {
  addKeyframe,
  createPath,
  samplePathPositions,
  evaluatePath,
} from "@/lib/camera-path";
import { pointInPolygon } from "@/lib/collision";
import { MapQuestMinimapShell } from "@/themes/xX_sCeNeIt_Xx/shells";

type Tool = "edit" | "pen" | "walk";
type PaintTool = Tool | "bucket" | "eraser";
const WIN95_CHECKER_FILL = "__checker__";

export type MinimapTool = Tool;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const WIN95_PAINT_CONTRAST_MAP: Record<string, string> = {
  "#000000": "#ffffff",
  "#808080": "#00ffff",
  "#800000": "#ffff00",
  "#808000": "#0000ff",
  "#008000": "#ff00ff",
  "#008080": "#ff8080",
  "#000080": "#ffff80",
  "#800080": "#80ff80",
  "#808040": "#80c0ff",
  "#004040": "#ffff80",
  "#ffffff": "#000000",
  "#c0c0c0": "#800000",
  "#ff0000": "#000080",
  "#ffff00": "#800000",
  "#00ff00": "#800080",
  "#00ffff": "#800000",
  "#0000ff": "#ffff00",
  "#ff00ff": "#008000",
  "#ffff80": "#000080",
  "#00ff80": "#800040",
};

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getWin95ContrastColors(fillColor: string) {
  const contrast = WIN95_PAINT_CONTRAST_MAP[fillColor.toLowerCase()] ?? (
    relativeLuminance(fillColor) < 0.35 ? "#ffffff" : "#000000"
  );
  const glow = relativeLuminance(contrast) < 0.35 ? "#404040" : "#dfdfdf";
  return {
    path: contrast,
    pathGlow: glow,
    label: contrast,
    endpointFill: fillColor,
    camera: contrast,
    playback: contrast,
  };
}

const WIN95_CHECKER_CELL_SIZE = 8;
const WIN95_CHECKER_LIGHT = "#ffffff";
const WIN95_CHECKER_DARK = "#c0c0c0";

function drawWin95Checkerboard(ctx: CanvasRenderingContext2D, width: number, height: number) {
  for (let y = 0; y < height; y += WIN95_CHECKER_CELL_SIZE) {
    for (let x = 0; x < width; x += WIN95_CHECKER_CELL_SIZE) {
      const isLight = ((x / WIN95_CHECKER_CELL_SIZE) + (y / WIN95_CHECKER_CELL_SIZE)) % 2 === 0;
      ctx.fillStyle = isLight ? WIN95_CHECKER_LIGHT : WIN95_CHECKER_DARK;
      ctx.fillRect(x, y, WIN95_CHECKER_CELL_SIZE, WIN95_CHECKER_CELL_SIZE);
    }
  }
}

interface MinimapViewProps {
  desktopMode?: boolean;
  onToolButtons?: (buttons: React.ReactNode) => void;
  externalTool?: Tool;
  onExternalToolChange?: (t: Tool) => void;
}

export default function MinimapView({ desktopMode, onToolButtons, externalTool, onExternalToolChange }: MinimapViewProps = {}) {
  const { paths, activePathId, playbackState, activePreset, capturedBoundary, walkWaypoints, sceneOrigin, actions, refs } =
    useScene();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const floorplanImgRef = useRef<HTMLImageElement | null>(null);
  const spaceHeldRef = useRef(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [internalTool, setInternalTool] = useState<PaintTool>("edit");
  const tool: PaintTool = externalTool ?? internalTool;
  const setTool = (t: PaintTool) => {
    if (onExternalToolChange && (t === "edit" || t === "pen" || t === "walk")) {
      onExternalToolChange(t);
    } else {
      setInternalTool(t);
    }
  };
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const cap = useThemeCapabilities();
  const isWin95Minimap = cap.iconStyle === "win95-pixel";
  const isSciin = cap.usesTextControls;
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isAim = cap.layoutShell === "xp-desktop";
  const isCyberpunk = cap.id === "sc3ne_it";
  const [pan, setPan] = useState(() => {
    if (activePreset?.collisionPolygons?.length && sceneOrigin) {
      const cos = Math.cos(-sceneOrigin.yaw);
      const sin = Math.sin(-sceneOrigin.yaw);
      let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
      for (const poly of activePreset.collisionPolygons) {
        for (const pt of poly.points) {
          const dx = pt.x - sceneOrigin.position.x;
          const dz = pt.z - sceneOrigin.position.z;
          const rx = dx * cos - dz * sin;
          const ry = dx * sin + dz * cos;
          if (rx < rMinX) rMinX = rx;
          if (rx > rMaxX) rMaxX = rx;
          if (ry < rMinY) rMinY = ry;
          if (ry > rMaxY) rMaxY = ry;
        }
      }
      return { x: (rMinX + rMaxX) / 2, y: (rMinY + rMaxY) / 2 };
    }
    if (activePreset?.initialCamera && sceneOrigin) {
      const { x, z } = activePreset.initialCamera.position;
      const cos = Math.cos(-sceneOrigin.yaw);
      const sin = Math.sin(-sceneOrigin.yaw);
      const dx = x - sceneOrigin.position.x;
      const dz = z - sceneOrigin.position.z;
      return { x: dx * cos - dz * sin, y: dx * sin + dz * cos };
    }
    return { x: 0, y: 0 };
  });
  const fitZoomRef = useRef(150);
  const maxZoomRef = useRef(750);
  const [zoom, setZoom] = useState(150);
  const [floorplanLoaded, setFloorplanLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [selectedPaintColor, setSelectedPaintColor] = useState("#000000");
  const [mapFillColor, setMapFillColor] = useState(WIN95_CHECKER_FILL);
  const effectiveWin95FillColor =
    mapFillColor === WIN95_CHECKER_FILL ? WIN95_CHECKER_DARK : mapFillColor;
  const contrastPreviewColor = getWin95ContrastColors(selectedPaintColor).path;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activePath = paths.find((p) => p.id === activePathId);
  const keyframes = activePath?.keyframes ?? [];

  const [camPos, setCamPos] = useState<{ x: number; y: number; z: number } | null>(null);
  const lastCamRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const hasAutocenteredRef = useRef(false);
  const needsFitRef = useRef(true);

  useEffect(() => {
    needsFitRef.current = true;
  }, [activePreset]);

  useEffect(() => {
    if (!activePreset || !needsFitRef.current) return;
    if (canvasSize.w === 0 || canvasSize.h === 0) return;
    needsFitRef.current = false;
    hasAutocenteredRef.current = true;

    if (activePreset.collisionPolygons?.length) {
      const cos = Math.cos(-sceneOrigin.yaw);
      const sin = Math.sin(-sceneOrigin.yaw);
      let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
      for (const poly of activePreset.collisionPolygons) {
        for (const pt of poly.points) {
          const dx = pt.x - sceneOrigin.position.x;
          const dz = pt.z - sceneOrigin.position.z;
          const rx = dx * cos - dz * sin;
          const ry = dx * sin + dz * cos;
          if (rx < rMinX) rMinX = rx;
          if (rx > rMaxX) rMaxX = rx;
          if (ry < rMinY) rMinY = ry;
          if (ry > rMaxY) rMaxY = ry;
        }
      }
      setPan({ x: (rMinX + rMaxX) / 2, y: (rMinY + rMaxY) / 2 });

      const extentX = Math.max(rMaxX - rMinX, 0.5);
      const extentY = Math.max(rMaxY - rMinY, 0.5);
      const fit = Math.min(canvasSize.w / extentX, canvasSize.h / extentY) * 0.75;
      fitZoomRef.current = fit;
      maxZoomRef.current = fit * 5;
      setZoom(fit);
    } else if (activePreset.initialCamera) {
      const { x, z } = activePreset.initialCamera.position;
      const cos = Math.cos(-sceneOrigin.yaw);
      const sin = Math.sin(-sceneOrigin.yaw);
      const dx = x - sceneOrigin.position.x;
      const dz = z - sceneOrigin.position.z;
      setPan({ x: dx * cos - dz * sin, y: dx * sin + dz * cos });
    }
  }, [activePreset, sceneOrigin, canvasSize.w, canvasSize.h]);

  useEffect(() => {
    const THRESHOLD = 0.005;
    const id = setInterval(() => {
      const data = refs.addKeyframeAtCamera.current?.();
      if (!data) return;
      const { x, y, z } = data.position;
      const prev = lastCamRef.current;
      if (!prev || Math.abs(x - prev.x) > THRESHOLD || Math.abs(y - prev.y) > THRESHOLD || Math.abs(z - prev.z) > THRESHOLD) {
        lastCamRef.current = { x, y, z };
        setCamPos({ x, y, z });
        if (!hasAutocenteredRef.current) {
          hasAutocenteredRef.current = true;
          const cos = Math.cos(-sceneOrigin.yaw);
          const sin = Math.sin(-sceneOrigin.yaw);
          const dx = x - sceneOrigin.position.x;
          const dz = z - sceneOrigin.position.z;
          setPan({ x: dx * cos - dz * sin, y: dx * sin + dz * cos });
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, [refs, sceneOrigin]);

  useEffect(() => {
    if (!activePreset?.floorplanUrl) {
      floorplanImgRef.current = null;
      setFloorplanLoaded(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      floorplanImgRef.current = img;
      setFloorplanLoaded(true);
    };
    img.onerror = () => {
      floorplanImgRef.current = null;
      setFloorplanLoaded(false);
    };
    img.src = activePreset.floorplanUrl;
  }, [activePreset?.floorplanUrl]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const el = e.target as HTMLElement;
        if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && !el.isContentEditable) e.preventDefault();
        spaceHeldRef.current = true; setSpaceDown(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const el = e.target as HTMLElement;
        if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && !el.isContentEditable) e.preventDefault();
        spaceHeldRef.current = false; setSpaceDown(false);
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  useEffect(() => {
    if (walkWaypoints.length >= 2) {
      actions.autoGenerateWalkFromWaypoints();
    }
  }, [walkWaypoints, actions]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.code === "Escape" && tool === "walk" && walkWaypoints.length > 0) {
        actions.finalizeWalkWaypoints();
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [tool, walkWaypoints.length, actions]);

  const worldToCanvas = useCallback(
    (wx: number, wz: number, cw: number, ch: number) => {
      const cos = Math.cos(-sceneOrigin.yaw);
      const sin = Math.sin(-sceneOrigin.yaw);
      const dx = wx - sceneOrigin.position.x;
      const dz = wz - sceneOrigin.position.z;
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      const cx = cw / 2 + (rx - pan.x) * zoom;
      const cy = ch / 2 - (rz - pan.y) * zoom;
      if (isWin95Minimap) {
        return { cx: Math.round(cx), cy: Math.round(cy) };
      }
      return { cx, cy };
    },
    [pan, zoom, sceneOrigin, isWin95Minimap]
  );

  const canvasToWorld = useCallback(
    (cx: number, cy: number, cw: number, ch: number) => {
      const rx = (cx - cw / 2) / zoom + pan.x;
      const rz = -(cy - ch / 2) / zoom + pan.y;
      const cos = Math.cos(sceneOrigin.yaw);
      const sin = Math.sin(sceneOrigin.yaw);
      const wx = rx * cos - rz * sin + sceneOrigin.position.x;
      const wz = rx * sin + rz * cos + sceneOrigin.position.z;
      return { wx, wz };
    },
    [pan, zoom, sceneOrigin]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isWin95Canvas = isWin95Minimap;
    const cc = cap.canvasColors;
    const win95ContrastColors = getWin95ContrastColors(effectiveWin95FillColor);
    const dpr = isWin95Canvas ? 1 : (window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = !isWin95Canvas;
    const cw = rect.width;
    const ch = rect.height;

    ctx.clearRect(0, 0, cw, ch);
    if (isWin95Canvas) {
      if (mapFillColor === WIN95_CHECKER_FILL) {
        drawWin95Checkerboard(ctx, cw, ch);
      } else {
        ctx.fillStyle = mapFillColor;
        ctx.fillRect(0, 0, cw, ch);
      }
    } else if (isSciin) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, cw, ch);
    } else if (isCyberpunk) {
      ctx.fillStyle = "#030308";
      ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.fillStyle = cc.bg;
      ctx.fillRect(0, 0, cw, ch);
    }

    if (isWinamp) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      for (let dy = 0; dy < ch; dy += 3) {
        for (let dx = 0; dx < cw; dx += 3) {
          ctx.beginPath();
          ctx.arc(dx + 0.5, dy + 0.5, 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const fpImg = floorplanImgRef.current;
    if (fpImg && activePreset?.floorplanTransform) {
      const t = activePreset.floorplanTransform;
      const imgWorldW = fpImg.width * t.scale;
      const imgWorldH = fpImg.height * t.scale;

      const topLeft = worldToCanvas(t.offsetX, t.offsetZ + imgWorldH, cw, ch);
      const canvasW = imgWorldW * zoom;
      const canvasH = imgWorldH * zoom;

      ctx.save();
      if (t.rotation !== 0) {
        const centerCx = topLeft.cx + canvasW / 2;
        const centerCy = topLeft.cy + canvasH / 2;
        ctx.translate(centerCx, centerCy);
        ctx.rotate((-t.rotation * Math.PI) / 180);
        ctx.translate(-centerCx, -centerCy);
      }
      ctx.globalAlpha = 0.6;
      ctx.drawImage(fpImg, topLeft.cx, topLeft.cy, canvasW, canvasH);
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (!isWin95Canvas) {
      const gridStep = zoom >= 40 ? 1 : zoom >= 20 ? 2 : 5;
      const startWx =
        Math.floor((pan.x - cw / 2 / zoom) / gridStep) * gridStep;
      const endWx = Math.ceil((pan.x + cw / 2 / zoom) / gridStep) * gridStep;
      const startWz =
        Math.floor((pan.y - ch / 2 / zoom) / gridStep) * gridStep;
      const endWz = Math.ceil((pan.y + ch / 2 / zoom) / gridStep) * gridStep;

      if (isSciin) {
        ctx.font = "bold 13px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const subStep = gridStep / 2;
        const subStartWx = Math.floor((pan.x - cw / 2 / zoom) / subStep) * subStep;
        const subEndWx = Math.ceil((pan.x + cw / 2 / zoom) / subStep) * subStep;
        const subStartWz = Math.floor((pan.y - ch / 2 / zoom) / subStep) * subStep;
        const subEndWz = Math.ceil((pan.y + ch / 2 / zoom) / subStep) * subStep;
        ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
        for (let x = subStartWx; x <= subEndWx; x += subStep) {
          for (let z = subStartWz; z <= subEndWz; z += subStep) {
            const onMajor = Math.abs(x % gridStep) < 0.001 && Math.abs(z % gridStep) < 0.001;
            if (onMajor) continue;
            const { cx, cy } = worldToCanvas(x, z, cw, ch);
            ctx.fillText("·", cx, cy);
          }
        }
        for (let x = startWx; x <= endWx; x += gridStep) {
          for (let z = startWz; z <= endWz; z += gridStep) {
            const { cx, cy } = worldToCanvas(x, z, cw, ch);
            const isAxis = x === 0 || z === 0;
            ctx.fillStyle = isAxis
              ? "rgba(0, 255, 0, 0.7)"
              : "rgba(0, 255, 0, 0.35)";
            ctx.fillText("+", cx, cy);
          }
        }
      } else if (isCyberpunk) {
        ctx.save();
        ctx.shadowColor = "rgba(255,149,0,0.3)";
        ctx.shadowBlur = 4;
        ctx.strokeStyle = "rgba(255,149,0,0.12)";
        ctx.lineWidth = 0.5;
        for (let x = startWx; x <= endWx; x += gridStep) {
          const { cx } = worldToCanvas(x, 0, cw, ch);
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx, ch);
          ctx.stroke();
        }
        for (let z = startWz; z <= endWz; z += gridStep) {
          const { cy } = worldToCanvas(0, z, cw, ch);
          ctx.beginPath();
          ctx.moveTo(0, cy);
          ctx.lineTo(cw, cy);
          ctx.stroke();
        }

        ctx.strokeStyle = "rgba(255,149,0,0.4)";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 8;
        const { cx: axisCx } = worldToCanvas(0, 0, cw, ch);
        const { cy: axisCy } = worldToCanvas(0, 0, cw, ch);
        ctx.beginPath(); ctx.moveTo(axisCx, 0); ctx.lineTo(axisCx, ch); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, axisCy); ctx.lineTo(cw, axisCy); ctx.stroke();
        ctx.restore();

        const edgeGrad = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
        edgeGrad.addColorStop(0, "transparent");
        edgeGrad.addColorStop(1, "rgba(255,149,0,0.04)");
        ctx.fillStyle = edgeGrad;
        ctx.fillRect(0, 0, cw, ch);
      } else {
        ctx.strokeStyle = cc.grid;
        ctx.lineWidth = 0.5;
        for (let x = startWx; x <= endWx; x += gridStep) {
          const { cx } = worldToCanvas(x, 0, cw, ch);
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx, ch);
          ctx.stroke();
        }
        for (let z = startWz; z <= endWz; z += gridStep) {
          const { cy } = worldToCanvas(0, z, cw, ch);
          ctx.beginPath();
          ctx.moveTo(0, cy);
          ctx.lineTo(cw, cy);
          ctx.stroke();
        }
      }
    }

    if (activePreset?.collisionPolygons) {
      for (const poly of activePreset.collisionPolygons) {
        if (poly.points.length < 2) continue;
        if (poly.type === "obstacle") continue;
        ctx.strokeStyle = isSciin ? "#FF0000" : cc.collisionStroke;
        ctx.lineWidth = isWin95Canvas ? 2 : 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        const first = worldToCanvas(poly.points[0].x, poly.points[0].z, cw, ch);
        ctx.moveTo(first.cx, first.cy);
        for (let i = 1; i < poly.points.length; i++) {
          const p = worldToCanvas(poly.points[i].x, poly.points[i].z, cw, ch);
          ctx.lineTo(p.cx, p.cy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isSciin ? "rgba(255, 0, 0, 0.05)" : cc.collisionFill;
        ctx.fill();
      }
    }

    if (capturedBoundary.length > 0) {
      ctx.strokeStyle = isSciin ? "#FFFF00" : "#f59e0b";
      ctx.lineWidth = isWin95Canvas ? 2 : 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      const bp0 = worldToCanvas(capturedBoundary[0].x, capturedBoundary[0].z, cw, ch);
      ctx.moveTo(bp0.cx, bp0.cy);
      for (let i = 1; i < capturedBoundary.length; i++) {
        const bp = worldToCanvas(capturedBoundary[i].x, capturedBoundary[i].z, cw, ch);
        ctx.lineTo(bp.cx, bp.cy);
      }
      if (capturedBoundary.length >= 3) {
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = isSciin ? "rgba(255, 255, 0, 0.05)" : "rgba(245, 158, 11, 0.05)";
        ctx.fill();
      } else {
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isSciin) {
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#FFFF00";
        for (const pt of capturedBoundary) {
          const { cx, cy } = worldToCanvas(pt.x, pt.z, cw, ch);
          ctx.fillText("#", cx, cy);
        }
      } else {
        for (const pt of capturedBoundary) {
          const { cx, cy } = worldToCanvas(pt.x, pt.z, cw, ch);
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#f59e0b";
          ctx.fill();
          ctx.strokeStyle = "#78350f";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    const brand500 = getAccentHex("500");
    const brand800 = getAccentHex("600");

    if (walkWaypoints.length > 0) {
      ctx.strokeStyle = isSciin ? "#FFFF00" : cc.walkStroke;
      ctx.lineWidth = isWin95Canvas ? 2 : 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const wp0 = worldToCanvas(walkWaypoints[0].x, walkWaypoints[0].z, cw, ch);
      ctx.moveTo(wp0.cx, wp0.cy);
      for (let i = 1; i < walkWaypoints.length; i++) {
        const wp = worldToCanvas(walkWaypoints[i].x, walkWaypoints[i].z, cw, ch);
        ctx.lineTo(wp.cx, wp.cy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      if (isSciin) {
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#FFFF00";
        for (let i = 0; i < walkWaypoints.length; i++) {
          const wp = worldToCanvas(walkWaypoints[i].x, walkWaypoints[i].z, cw, ch);
          ctx.fillText(`${i + 1}`, wp.cx, wp.cy);
        }
      } else {
        for (let i = 0; i < walkWaypoints.length; i++) {
          const wp = worldToCanvas(walkWaypoints[i].x, walkWaypoints[i].z, cw, ch);
          ctx.fillStyle = cc.walkStroke;
          ctx.fillRect(wp.cx - 5, wp.cy - 5, 10, 10);
          ctx.fillStyle = brand800;
          ctx.font = "10px system-ui";
          ctx.fillText(`${i + 1}`, wp.cx + 8, wp.cy + 3);
        }
      }
    }
    const brand400 = getAccentHex("400");

    if (activePath && activePath.keyframes.length >= 2) {
      const pts = samplePathPositions(activePath, 200);
      if (pts.length > 1) {
        const drawPathStroke = () => {
          ctx.beginPath();
          const first = worldToCanvas(pts[0].x, pts[0].z, cw, ch);
          ctx.moveTo(first.cx, first.cy);
          for (let i = 1; i < pts.length; i++) {
            const p = worldToCanvas(pts[i].x, pts[i].z, cw, ch);
            ctx.lineTo(p.cx, p.cy);
          }
          ctx.stroke();
        };

        if (isCyberpunk) {
          ctx.save();
          ctx.strokeStyle = brand400;
          ctx.lineWidth = 6;
          ctx.globalAlpha = 0.15;
          ctx.shadowColor = brand400;
          ctx.shadowBlur = 12;
          drawPathStroke();
          ctx.restore();
        }

        if (isSciin) {
          ctx.strokeStyle = "#00FFFF";
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 4]);
          drawPathStroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = cc.penStroke;
          ctx.lineWidth = 2;
          drawPathStroke();
        }

        if (isSciin) {
          ctx.font = "bold 12px 'Courier New', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#00FFFF";
          for (const pt of [pts[0], pts[pts.length - 1]]) {
            const { cx, cy } = worldToCanvas(pt.x, pt.z, cw, ch);
            ctx.fillText("X", cx, cy);
          }
        } else {
          for (const pt of [pts[0], pts[pts.length - 1]]) {
            const { cx, cy } = worldToCanvas(pt.x, pt.z, cw, ch);
            ctx.fillStyle = cc.endpointFill;
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.fill();

            if (isCyberpunk) {
              ctx.save();
              ctx.shadowColor = brand400;
              ctx.shadowBlur = 10;
            }
            ctx.strokeStyle = cc.penStroke;
            ctx.lineWidth = isWin95Canvas ? 2 : 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.stroke();
            if (isCyberpunk) ctx.restore();
          }
        }
      }
    } else if (keyframes.length === 1) {
      const s = worldToCanvas(keyframes[0].position.x, keyframes[0].position.z, cw, ch);
      if (isSciin) {
        ctx.font = "bold 12px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#00FFFF";
        ctx.fillText("*", s.cx, s.cy);
      } else {
        if (isCyberpunk) {
          ctx.save();
          ctx.shadowColor = brand400;
          ctx.shadowBlur = 10;
        }
        ctx.fillStyle = cc.penStroke;
        ctx.beginPath();
        ctx.arc(s.cx, s.cy, 4, 0, Math.PI * 2);
        ctx.fill();
        if (isCyberpunk) ctx.restore();
      }
    }

    const camData = refs.addKeyframeAtCamera.current?.();
    if (camData) {
      const { cx, cy } = worldToCanvas(
        camData.position.x,
        camData.position.z,
        cw,
        ch
      );
      if (isSciin) {
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#FFFF00";
        ctx.fillText("@", cx, cy);
      } else {
        if (isCyberpunk) {
          ctx.save();
          ctx.shadowColor = cc.cameraDot;
          ctx.shadowBlur = 10;
        }
        ctx.fillStyle = cc.cameraDot;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
        if (isCyberpunk) ctx.restore();
      }
    }

    if (playbackState.isPlaying && activePath) {
      const sample = evaluatePath(activePath, playbackState.currentTime);
      if (sample) {
        const { cx, cy } = worldToCanvas(
          sample.position.x,
          sample.position.z,
          cw,
          ch
        );
        if (isSciin) {
          ctx.font = "bold 12px 'Courier New', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#FF00FF";
          ctx.fillText(">", cx, cy);
        } else {
          if (isCyberpunk) {
            ctx.save();
            ctx.shadowColor = cc.playbackRing;
            ctx.shadowBlur = 12;
          }
          ctx.strokeStyle = cc.playbackRing;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.stroke();
          if (isCyberpunk) ctx.restore();
        }
      }
    }

  });

  const startPanDrag = (e: React.PointerEvent) => {
    setIsPanning(true);
    const startPan = { ...pan };
    const startX = e.clientX;
    const startY = e.clientY;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      setPan({
        x: startPan.x - (ev.clientX - startX) / zoom,
        y: startPan.y + (ev.clientY - startY) / zoom,
      });
    };
    const onUp = () => {
      setIsPanning(false);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (spaceHeldRef.current) {
      e.preventDefault();
      refs.spaceDraggedRef.current = true;
      startPanDrag(e);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cw = rect.width;
    const ch = rect.height;

    if (tool === "bucket") {
      setMapFillColor(selectedPaintColor);
      return;
    }

    if (tool === "eraser") {
      setMapFillColor(WIN95_CHECKER_FILL);
      return;
    }

    if (tool === "walk") {
      const { wx, wz } = canvasToWorld(mx, my, cw, ch);
      if (activePreset?.collisionPolygons?.length) {
        const inside = activePreset.collisionPolygons.some(
          (poly) => poly.type !== "obstacle" && pointInPolygon(wx, wz, poly.points)
        );
        if (!inside) return;
      }
      const camData = refs.addKeyframeAtCamera.current?.();
      const y = camData?.position.y ?? 0;
      actions.pushUndo();
      actions.setWalkWaypoints((prev) => [...prev, { x: wx, y, z: wz }]);
      return;
    }

    if (tool === "pen") {
      const { wx, wz } = canvasToWorld(mx, my, cw, ch);
      if (activePreset?.collisionPolygons?.length) {
        const inside = activePreset.collisionPolygons.some(
          (poly) => poly.type !== "obstacle" && pointInPolygon(wx, wz, poly.points)
        );
        if (!inside) return;
      }
      const camData = refs.addKeyframeAtCamera.current?.();
      const y = camData?.position.y ?? 0;
      actions.pushUndo();
      if (!activePath) {
        const p = createPath();
        const updated = addKeyframe(p, { x: wx, y, z: wz }, 0, 0);
        actions.setPaths((prev) => [...prev, updated]);
        actions.setActivePathId(updated.id);
      } else {
        const updated = addKeyframe(activePath, { x: wx, y, z: wz }, 0, 0);
        actions.setPaths((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
      }
      return;
    }

    let closest = -1;
    let closestDist = Infinity;
    for (let i = 0; i < keyframes.length; i++) {
      const { cx, cy } = worldToCanvas(
        keyframes[i].position.x,
        keyframes[i].position.z,
        cw,
        ch
      );
      const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
      if (dist < 10 && dist < closestDist) {
        closest = i;
        closestDist = dist;
      }
    }

    if (closest >= 0) {
      actions.pushUndo();
      setDragIdx(closest);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      startPanDrag(e);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragIdx == null || !activePath) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { wx, wz } = canvasToWorld(mx, my, rect.width, rect.height);

    if (activePreset?.collisionPolygons?.length) {
      const inside = activePreset.collisionPolygons.some(
        (poly) => poly.type !== "obstacle" && pointInPolygon(wx, wz, poly.points)
      );
      if (!inside) return;
    }

    actions.setPaths((prev) =>
      prev.map((p) =>
        p.id !== activePathId
          ? p
          : {
              ...p,
              keyframes: p.keyframes.map((k, i) =>
                i === dragIdx
                  ? { ...k, position: { ...k.position, x: wx, z: wz } }
                  : k
              ),
            }
      )
    );
  };

  const handlePointerUp = () => {
    setDragIdx(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY > 0 ? 0.985 : 1.015;
    setZoom((z) => Math.max(5, Math.min(maxZoomRef.current, z * factor)));
  };

  const toolLabel = tool.toUpperCase();
  const toolButtons = (
    <div className="transport-group flex items-center gap-1">
      <button
        onClick={() => setTool("edit")}
        data-floorplan-tool="edit"
        className={`${isAim ? "aim-floorplan-tool" : isWinamp ? "winamp-titlebar-btn winamp-tool-btn" : "rounded p-1"} transition-colors ${
          tool === "edit"
            ? isAim ? "aim-floorplan-tool-active" : isWinamp ? "winamp-tool-active" : "bg-surface-raised text-accent-400"
            : "text-content-muted hover:text-content-primary"
        }`}
        title="Edit mode"
      >
        <ThemeIcon icon={Move} className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTool("pen")}
        data-floorplan-tool="pen"
        className={`${isAim ? "aim-floorplan-tool" : isWinamp ? "winamp-titlebar-btn winamp-tool-btn" : "rounded p-1"} transition-colors ${
          tool === "pen"
            ? isAim ? "aim-floorplan-tool-active" : isWinamp ? "winamp-tool-active" : "bg-surface-raised text-accent-400"
            : "text-content-muted hover:text-content-primary"
        }`}
        title="Pen tool — click to add waypoints"
      >
        <ThemeIcon icon={Pen} className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTool("walk")}
        data-floorplan-tool="walk"
        className={`${isAim ? "aim-floorplan-tool" : isWinamp ? "winamp-titlebar-btn winamp-tool-btn" : "rounded p-1"} transition-colors ${
          tool === "walk"
            ? isAim ? "aim-floorplan-tool-active" : isWinamp ? "winamp-tool-active" : "bg-surface-raised text-accent-400"
            : "text-content-muted hover:text-content-primary"
        }`}
        title="Walk tool — place waypoints then generate walk path"
      >
        <ThemeIcon icon={Footprints} className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  useEffect(() => {
    if (desktopMode && onToolButtons) onToolButtons(null);
  });

  const toolCursor = isWin95Minimap
    ? tool === "bucket" ? `url(${W95_BUCKET_CURSOR_URL}) 1 14, pointer`
    : tool === "eraser" ? `url(${W95_ERASER_CURSOR_URL}) 8 14, pointer`
    : tool === "edit" ? "default"
    : tool === "walk" ? "pointer"
    : "crosshair"
    : tool === "edit" ? "default"
    : tool === "walk" ? "pointer"
    : "crosshair";

  const canvasCursor = isPanning ? "grabbing" : spaceDown ? "grab" : toolCursor;
  const canvasCursorClass = isPanning ? "cursor-grabbing" : spaceDown ? "cursor-grab"
    : tool === "edit" ? "cursor-default" : tool === "walk" ? "cursor-pointer" : "cursor-crosshair";

  const canvasEl = (
    <canvas
      ref={canvasRef}
      className={`${desktopMode ? "h-full" : isWin95Minimap ? "" : "h-56"} w-full ${isWin95Minimap ? "" : canvasCursorClass}`}
      style={isWin95Minimap ? { imageRendering: "pixelated", height: 194, cursor: canvasCursor } : desktopMode ? { imageRendering: "pixelated" } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    />
  );

  const panStep = 1.5 / Math.max(zoom, 1);

  if (desktopMode) {
    return (
      <MapQuestMinimapShell
        tool={tool as Tool}
        setTool={(t) => setTool(t)}
        zoom={zoom}
        setZoom={setZoom}
        panStep={panStep}
        setPan={setPan}
        recenter={() => setPan({ x: 0, y: 0 })}
        maxZoom={maxZoomRef.current}
        containerRef={containerRef}
        canvasEl={canvasEl}
      />
    );
  }

  if (isWin95Minimap) {
    return (
      <Win95Minimap
        tool={tool}
        setTool={setTool}
        selectedPaintColor={selectedPaintColor}
        setSelectedPaintColor={setSelectedPaintColor}
        contrastPreviewColor={contrastPreviewColor}
        containerRef={containerRef}
        canvasEl={canvasEl}
      />
    );
  }

  if (isWinamp) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div ref={containerRef} className="winamp-minimap-container flex flex-1 flex-col min-h-0 overflow-hidden">
          <canvas
            ref={canvasRef}
            className={`w-full flex-1 min-h-0 ${canvasCursorClass}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          />
        </div>
        <div className="winamp-minimap-footer" />
      </div>
    );
  }

  return (
    <Panel ref={containerRef} className="win95-window flex h-full flex-col animate-slide-up">
      <CollapsibleSection
        title="Floorplan"
        collapsible={false}
        bare
        icon={undefined}
        actionButtons={isSciin ? undefined : toolButtons}
        contentClassName={`win95-canvas-border${isWin95Minimap || isSciin ? " min-h-0 flex-1" : ""}`}
      >
        {isSciin ? (
          <div className="sciin-minimap-shell relative h-full w-full overflow-hidden">
            <canvas
              ref={canvasRef}
              className={`h-full w-full ${canvasCursorClass}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
            />
            <div className="sciin-minimap-readout absolute left-[10px] right-[10px] top-[16px] flex items-center justify-between">
              <span className="pointer-events-none">[MAP:{floorplanLoaded ? "FLOOR" : "GRID"}]</span>
              <span
                className="cursor-pointer"
                onClick={() => {
                  const tools: Tool[] = ["edit", "pen", "walk"];
                  const idx = tools.indexOf(tool as Tool);
                  setTool(tools[(idx + 1) % tools.length]);
                }}
              >[TOOL:<span style={{ color: tool === "edit" ? "#FFFF00" : tool === "pen" ? "#00FF00" : "#2A2AFF" }}>{toolLabel}</span>]</span>
            </div>
            <div className="sciin-minimap-readout pointer-events-none absolute left-[10px] right-[10px] bottom-0 flex flex-col">
              <div className="flex items-center">
                <span>[PTS:{keyframes.length}|WLK:{walkWaypoints.length}]</span>
              </div>
              <div className="flex items-center justify-between">
                <span>[X:<span style={{ color: "#00FF00" }}>{camPos ? camPos.x.toFixed(2) : "-.--"}</span> Y:<span style={{ color: "#FFFF00" }}>{camPos ? camPos.y.toFixed(2) : "-.--"}</span> Z:<span style={{ color: "#FF00FF" }}>{camPos ? camPos.z.toFixed(2) : "-.--"}</span>]</span>
                <span>[ZOOM:{Math.round(zoom)}]</span>
              </div>
            </div>
          </div>
        ) : (
          canvasEl
        )}
      </CollapsibleSection>
    </Panel>
  );
}
