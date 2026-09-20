"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { getStepsForMode, markTutorialCompleted } from "@/lib/tutorial";

interface Props {
  onClose: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type GlowPhase = "hidden" | "revealing" | "resting";

function getTargetRect(selector: string): SpotlightRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const REVEAL_MS = 250;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function glowShadow(rgb: string): string {
  return `inset 0 0 0 1.5px rgb(${rgb} / 0.6), 0 0 12px 2px rgb(${rgb} / 0.15)`;
}

export default function TutorialOverlay({ onClose }: Props) {
  const { userModeId, actions } = useScene();
  const [stepIdx, setStepIdx] = useState(0);
  const [spotRects, setSpotRects] = useState<SpotlightRect[]>([]);
  const [glowPhase, setGlowPhase] = useState<GlowPhase>("hidden");
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = getStepsForMode(userModeId);
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  const updateSpotlight = useCallback(() => {
    if (!step) return;
    const rects = step.targetSelectors
      .map((sel) => getTargetRect(sel))
      .filter((r): r is SpotlightRect => r !== null);
    setSpotRects(rects);
  }, [step]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    return () => window.removeEventListener("resize", updateSpotlight);
  }, [updateSpotlight]);

  useEffect(() => {
    actions.setTutorialSectionId(step?.sectionId ?? null);
    const id = requestAnimationFrame(() => updateSpotlight());
    return () => cancelAnimationFrame(id);
  }, [step, actions, updateSpotlight]);

  useEffect(() => {
    setGlowPhase("hidden");

    cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setGlowPhase("revealing");
        timerRef.current = setTimeout(() => {
          setGlowPhase("resting");
        }, REVEAL_MS);
      });
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stepIdx]);

  useEffect(() => {
    const root = document.documentElement;
    const acKeys = ["--ac-300", "--ac-400", "--ac-500", "--ac-600"] as const;
    const saved = acKeys.map((k) => [k, root.style.getPropertyValue(k)] as const);
    root.style.setProperty("--ac-300", "161 161 170", "important");
    root.style.setProperty("--ac-400", "113 113 122", "important");
    root.style.setProperty("--ac-500", "82 82 91", "important");
    root.style.setProperty("--ac-600", "63 63 70", "important");

    return () => {
      saved.forEach(([k, v]) => {
        if (v) root.style.setProperty(k, v);
        else root.style.removeProperty(k);
      });
    };
  }, []);

  useEffect(() => {
    if (!step) return;
    const rgb = step.glowColor;
    const elements = step.targetSelectors
      .map((sel) => document.querySelector(sel))
      .filter((el): el is Element => el !== null);

    const tintedChildren: HTMLElement[] = [];

    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.dataset.tutorialActive = "";
      htmlEl.style.setProperty("--tut-glow", rgb);

      const isSection = htmlEl.hasAttribute("data-section-id");
      const containsSection = !!htmlEl.querySelector("[data-section-id]");
      if (!isSection && !containsSection) {
        htmlEl.querySelectorAll<HTMLElement>("button, svg").forEach((child) => {
          child.style.setProperty("color", `rgb(${rgb})`);
          tintedChildren.push(child);
        });
      }
    });

    return () => {
      elements.forEach((el) => {
        delete (el as HTMLElement).dataset.tutorialActive;
        (el as HTMLElement).style.removeProperty("--tut-glow");
      });
      tintedChildren.forEach((child) => {
        child.style.removeProperty("color");
      });
    };
  }, [step]);

  const close = useCallback(() => {
    actions.setTutorialSectionId(null);
    markTutorialCompleted();
    onClose();
  }, [actions, onClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (isLast) close();
          else setStepIdx((i) => i + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          setStepIdx((i) => Math.max(0, i - 1));
          break;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, isLast]);

  const handleNext = () => {
    if (isLast) close();
    else setStepIdx((i) => i + 1);
  };

  const handlePrev = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  const rgb = step?.glowColor ?? "45 212 191";
  const shadow = glowShadow(rgb);

  const glowStyleForRect = (rect: SpotlightRect): React.CSSProperties => {
    const pos: React.CSSProperties = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      transformOrigin: "center",
      willChange: "opacity, transform",
      boxShadow: shadow,
      "--tut-glow": rgb,
    } as React.CSSProperties;

    switch (glowPhase) {
      case "hidden":
        return { ...pos, opacity: 0, transform: "scale(1.015)", transition: "none" };
      case "revealing":
        return {
          ...pos,
          opacity: 1,
          transform: "scale(1)",
          transition: `opacity ${REVEAL_MS}ms ${EASE}, transform ${REVEAL_MS}ms ${EASE}`,
        };
      case "resting":
        return { ...pos, opacity: 1, transform: "scale(1)" };
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={close}>
      {/* Dim overlay with SVG mask -- supports multiple cutouts */}
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <mask id="tut-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotRects.map((r, i) => (
              <rect
                key={i}
                x={r.left}
                y={r.top}
                width={r.width}
                height={r.height}
                fill="black"
                rx="8"
              />
            ))}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.75)"
          mask="url(#tut-mask)"
        />
      </svg>

      {/* Glow rings -- one per target, opacity crossfade + subtle scale */}
      {spotRects.map((rect, i) => (
        <div
          key={i}
          className={`pointer-events-none absolute rounded-lg${
            glowPhase === "resting" ? " animate-tutorial-pulse" : ""
          }`}
          style={glowStyleForRect(rect)}
        />
      ))}

      {/* Tooltip card -- fixed center */}
      <div
        className="absolute left-1/2 bottom-[40%] flex -translate-x-1/2 flex-col gap-3 rounded-xl border bg-surface-raised p-4 shadow-xl"
        style={{ width: 360, borderColor: "rgb(60 60 66)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div key={stepIdx} className="animate-fade-in flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-content-primary">
              {step?.title}
            </h3>
            <button
              onClick={close}
              className="rounded p-0.5 text-content-faint hover:bg-surface-border hover:text-content-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-[12px] leading-relaxed text-content-secondary">
            {step?.description}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] tabular-nums text-content-faint">
            {stepIdx + 1} / {steps.length}
          </span>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-content-secondary transition-colors hover:bg-surface-border"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-medium text-white transition-colors"
              style={{ backgroundColor: `rgb(${rgb})` }}
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
