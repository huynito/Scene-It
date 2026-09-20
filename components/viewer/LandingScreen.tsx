"use client";

import { Upload } from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { SCENE_PRESETS } from "@/lib/scene-preset";
import SceneSelector from "./SceneSelector";
import ChangelogPill from "./ChangelogPill";

export default function LandingScreen() {
  const { error, fileInputKey, actions } = useScene();
  const hasPresets = SCENE_PRESETS.length > 0;

  return (
    <div className="landing-screen relative flex h-full w-full flex-col items-center overflow-y-auto px-6 py-12">
      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8">
        <h1 className="landing-screen-title-row text-3xl font-semibold tracking-tight text-content-primary">
          Scene It
        </h1>

        <div className="flex items-center gap-3">
          <div className="h-px w-12 bg-surface-raised" />
          <span className="text-xs text-content-faint">
            {hasPresets ? "Choose a scene" : "Load a scene"}
          </span>
          <div className="h-px w-12 bg-surface-raised" />
        </div>

        {hasPresets && <SceneSelector />}

        {hasPresets && (
          <div className="landing-screen-divider flex items-center gap-3">
            <div className="h-px w-16 bg-surface-raised" />
            <span className="text-xs text-content-faint">or load your own</span>
            <div className="h-px w-16 bg-surface-raised" />
          </div>
        )}

        <label className="landing-upload-area group flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border bg-surface-primary/50 px-6 py-3 transition-all hover:border-surface-border-secondary hover:bg-surface-primary">
          <Upload className="landing-upload-icon h-4 w-4 text-content-muted transition-colors group-hover:text-content-primary" />
          <span className="landing-upload-title text-xs text-content-secondary group-hover:text-content-primary">
            Click to browse or drag and drop
          </span>
          <input
            key={fileInputKey}
            type="file"
            accept=".ply"
            onChange={actions.handleFileInput}
            className="hidden"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      <ChangelogPill />
    </div>
  );
}
