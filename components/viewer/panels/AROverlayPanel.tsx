"use client";

import { Info } from "lucide-react";
import ThemeIcon from "@/components/ui/ThemeIcon";
import { useThemeCapabilities } from "@/themes";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useScene } from "@/lib/scene-context";
import Slider from "@/components/ui/Slider";

export default function AROverlayPanel() {
  const { dim, blur, showFovFrame, showFovStroke, fovFeather, depthMeshLoaded, depthMeshVisible, actions, refs } = useScene();
  const cap = useThemeCapabilities();
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isSciin = cap.usesTextControls;
  const isAim = cap.layoutShell === "xp-desktop";

  return (
    <div className="flex flex-col gap-4">
      {!isWinamp && !isSciin && (
        <span
          className="inline-flex items-center gap-2 text-[9px] text-content-faint cursor-help"
          title="Controls how the 3D scene blends with real-world content. Dim darkens and Blur defocuses the Gaussian background. Media overlays are not affected."
        >
          <ThemeIcon icon={Info} className="h-6 w-6 flex-shrink-0" />
          AR overlay info
        </span>
      )}

      {isSciin ? (
        <>
          <Slider
            label="Background Dim"
            value={dim}
            min={0}
            max={100}
            step={1}
            onChange={actions.setDim}
            onChangeStart={actions.pushUndo}
            thumbClass="sciin-thumb-green"
          />
          <Slider
            label="Background Blur"
            value={blur}
            min={0}
            max={100}
            step={1}
            onChange={actions.setBlur}
            onChangeStart={actions.pushUndo}
            thumbClass="sciin-thumb-green"
          />
          {depthMeshLoaded && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-primary">Occlude UI</span>
              <ThemeToggle
                checked={depthMeshVisible}
                onChange={(v) => {
                  actions.setDepthMeshVisible(v);
                  refs.setDepthMeshVisible.current?.(v);
                }}
              />
            </div>
          )}
        </>
      ) : isWinamp ? (
        <>
          <Slider
            label="BG Dim"
            value={dim}
            min={0}
            max={100}
            step={1}
            onChange={actions.setDim}
            onChangeStart={actions.pushUndo}
          />
          <Slider
            label="BG Blur"
            value={blur}
            min={0}
            max={100}
            step={1}
            onChange={actions.setBlur}
            onChangeStart={actions.pushUndo}
          />
          {depthMeshLoaded && (
            <label className="mt-0 gap-2.5 flex cursor-pointer items-center winamp-label">
              <input
                type="checkbox"
                checked={depthMeshVisible}
                onChange={(e) => {
                  actions.setDepthMeshVisible(e.target.checked);
                  refs.setDepthMeshVisible.current?.(e.target.checked);
                }}
              />
              Occlude UI
            </label>
          )}
        </>
      ) : (
        <>
          <Slider
            label="Background Dim"
            value={dim}
            min={0}
            max={100}
            step={1}
            onChange={actions.setDim}
            onChangeStart={actions.pushUndo}
          />
          <Slider
            label="Background Blur"
            value={blur}
            min={0}
            max={100}
            step={1}
            onChange={actions.setBlur}
            onChangeStart={actions.pushUndo}
          />
          {depthMeshLoaded && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-primary">Occlude UI</span>
              <ThemeToggle
                checked={depthMeshVisible}
                onChange={(v) => {
                  actions.setDepthMeshVisible(v);
                  refs.setDepthMeshVisible.current?.(v);
                }}
              />
            </div>
          )}
        </>
      )}

      {/* FOV Frame */}
      {isSciin ? (
        <div className="mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-content-primary">FOV Mask</span>
            <ThemeToggle checked={showFovFrame} onChange={actions.setShowFovFrame} />
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-content-muted">
            Clips anchors to the device FOV (46°×38°).
          </p>
          <div className={`mt-2 flex flex-col gap-4 ${!showFovFrame ? "pointer-events-none opacity-40" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-primary">Show Outline</span>
              <ThemeToggle checked={showFovStroke} onChange={actions.setShowFovStroke} />
            </div>
            <Slider
              label="Edge Feather"
              value={fovFeather}
              min={0}
              max={100}
              step={1}
              onChange={actions.setFovFeather}
              onChangeStart={actions.pushUndo}
              thumbClass="sciin-thumb-green"
            />
          </div>
        </div>
      ) : isWinamp ? (
        <div className="winamp-ar-fov-zone">
          <div className="winamp-ar-fov-toggles">
            <div className="winamp-ar-fov-toggle-group">
              <span className="winamp-label">FOV</span>
              <div className="winamp-eq-pl-tray">
                <button
                  className={`winamp-eq-pl-btn${!showFovFrame ? " active" : ""}`}
                  onClick={() => actions.setShowFovFrame(false)}
                >
                  OFF
                </button>
                <button
                  className={`winamp-eq-pl-btn${showFovFrame ? " active" : ""}`}
                  onClick={() => actions.setShowFovFrame(true)}
                >
                  ON
                </button>
              </div>
            </div>
            <div className={`winamp-ar-fov-toggle-group ${!showFovFrame ? "pointer-events-none opacity-40" : ""}`}>
              <span className="winamp-label">Outline</span>
              <div className="winamp-eq-pl-tray">
                <button
                  className={`winamp-eq-pl-btn${!showFovStroke ? " active" : ""}`}
                  onClick={() => actions.setShowFovStroke(false)}
                >
                  OFF
                </button>
                <button
                  className={`winamp-eq-pl-btn${showFovStroke ? " active" : ""}`}
                  onClick={() => actions.setShowFovStroke(true)}
                >
                  ON
                </button>
              </div>
            </div>
          </div>
          <div className={`flex flex-col gap-3 ${!showFovFrame ? "pointer-events-none opacity-40" : ""}`}>
            <Slider
              label="Feather"
              value={fovFeather}
              min={0}
              max={100}
              step={1}
              onChange={actions.setFovFeather}
              onChangeStart={actions.pushUndo}
            />
          </div>
        </div>
      ) : (
        <fieldset className={isAim ? "xp-group-box" : "win95-group-box mt-1 rounded-md border border-surface-border p-2.5"}>
          {isAim && <legend className="xp-group-box-label">FOV Mask</legend>}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-content-primary">
              FOV Mask
            </span>
            <ThemeToggle checked={showFovFrame} onChange={actions.setShowFovFrame} />
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-content-muted">
            Clips anchors to the device FOV (46°×38°).
          </p>
          <div className={`mt-2 flex flex-col gap-2 ${!showFovFrame ? "pointer-events-none opacity-40" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-content-primary">Show Outline</span>
              <ThemeToggle checked={showFovStroke} onChange={actions.setShowFovStroke} />
            </div>
            <Slider
              label="Edge Feather"
              value={fovFeather}
              min={0}
              max={100}
              step={1}
              onChange={actions.setFovFeather}
              onChangeStart={actions.pushUndo}
            />
          </div>
        </fieldset>
      )}
    </div>
  );
}
