"use client";

import { ArrowRight } from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { SCENE_PRESETS } from "@/lib/scene-preset";

export default function SceneSelector() {
  const { actions } = useScene();

  if (SCENE_PRESETS.length === 0) return null;

  return (
    <div className="scene-selector-grid grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
      {SCENE_PRESETS.map((preset) => {
        const disabled = !!preset.comingSoon;
        return (
          <button
            key={preset.id}
            onClick={disabled ? undefined : () => actions.loadPreset(preset)}
            disabled={disabled}
            className={`landing-scene-card group flex flex-col overflow-hidden rounded-2xl border text-left transition-all ${
              disabled
                ? "cursor-default border-surface-border/50 bg-surface-primary/30 opacity-60"
                : "border-surface-border bg-surface-primary/60 hover:border-accent-500/50 hover:bg-surface-primary hover:shadow-lg hover:shadow-accent-500/5"
            }`}
          >
            <div className="landing-scene-card-thumb relative h-44 w-full overflow-hidden bg-surface-raised/50">
              {preset.comingSoon ? (
                <div className="flex h-full w-full items-center justify-center bg-black" />
              ) : preset.thumbnail ? (
                <img
                  src={preset.thumbnail}
                  alt={preset.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-3xl text-content-faint">🏠</span>
                </div>
              )}
            </div>
            <div className="landing-scene-card-body flex items-center justify-between px-4 py-3.5">
              <div className="flex flex-col items-start gap-0.5">
                <span className="landing-scene-card-title text-sm font-semibold tracking-tight">
                  {preset.name}
                </span>
                {preset.description && (
                  <span className="landing-scene-card-description text-xs text-content-muted">
                    {preset.description}
                  </span>
                )}
              </div>
              {!disabled && (
                <ArrowRight className="landing-scene-card-arrow h-4 w-4 flex-shrink-0 text-content-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent-400" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
