"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useScene } from "@/lib/scene-context";
import { useThemeCapabilities } from "@/themes";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Slider from "@/components/ui/Slider";
import ScrubInput from "../ScrubInput";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export default function CameraPanel() {
  const { fov, moveSpeed, lockY, sceneOrigin, dofEnabled, dofFocusDistance, dofFocusRange, dofBlurRadius, actions, refs } = useScene();
  const cap = useThemeCapabilities();
  const isWinamp = cap.layoutShell === "winamp-desktop";
  const isSciin = cap.usesTextControls;

  const [camRelPos, setCamRelPos] = useState({ x: 0, y: 0, z: 0 });
  const [camPitch, setCamPitch] = useState(0);
  const [camRelYaw, setCamRelYaw] = useState(0);
  const camDirtyRef = useRef(false);

  const originYawDeg = sceneOrigin.yaw * RAD_TO_DEG;

  const toRelPos = useCallback(
    (world: { x: number; y: number; z: number }) => {
      const dx = world.x - sceneOrigin.position.x;
      const dz = world.z - sceneOrigin.position.z;
      const cos = Math.cos(-sceneOrigin.yaw);
      const sin = Math.sin(-sceneOrigin.yaw);
      return {
        x: dx * cos - dz * sin,
        y: world.y - sceneOrigin.eyeHeight,
        z: dx * sin + dz * cos,
      };
    },
    [sceneOrigin],
  );

  const toWorldPos = useCallback(
    (rel: { x: number; y: number; z: number }) => {
      const cos = Math.cos(sceneOrigin.yaw);
      const sin = Math.sin(sceneOrigin.yaw);
      return {
        x: rel.x * cos - rel.z * sin + sceneOrigin.position.x,
        y: rel.y + sceneOrigin.eyeHeight,
        z: rel.x * sin + rel.z * cos + sceneOrigin.position.z,
      };
    },
    [sceneOrigin],
  );

  useEffect(() => {
    let running = true;
    const poll = () => {
      if (!running) return;
      if (!camDirtyRef.current) {
        const state = refs.getCameraState.current?.();
        if (state) {
          setCamRelPos(toRelPos(state.position));
          setCamPitch(state.pitch * RAD_TO_DEG);
          setCamRelYaw(-(state.yaw * RAD_TO_DEG - originYawDeg));
        }
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
    return () => { running = false; };
  }, [refs.getCameraState, toRelPos, originYawDeg]);

  const handleCamPosChange = useCallback(
    (axis: "x" | "y" | "z", v: number) => {
      camDirtyRef.current = true;
      const next = { ...camRelPos, [axis]: v };
      setCamRelPos(next);
      refs.setCameraPosition.current?.(toWorldPos(next));
      setTimeout(() => { camDirtyRef.current = false; }, 100);
    },
    [camRelPos, refs.setCameraPosition, toWorldPos],
  );

  const handleCamPitchChange = useCallback(
    (v: number) => {
      camDirtyRef.current = true;
      setCamPitch(v);
      refs.setCameraRotation.current?.(v * DEG_TO_RAD, (camRelYaw + originYawDeg) * DEG_TO_RAD);
      setTimeout(() => { camDirtyRef.current = false; }, 100);
    },
    [camRelYaw, originYawDeg, refs.setCameraRotation],
  );

  const handleCamYawChange = useCallback(
    (v: number) => {
      camDirtyRef.current = true;
      setCamRelYaw(v);
      refs.setCameraRotation.current?.(camPitch * DEG_TO_RAD, (-v + originYawDeg) * DEG_TO_RAD);
      setTimeout(() => { camDirtyRef.current = false; }, 100);
    },
    [camPitch, originYawDeg, refs.setCameraRotation],
  );

  return (
    <div className={`flex flex-col ${isSciin ? "gap-0" : "gap-2"}`}>
      <span className={`${isSciin ? "mb-1" : ""} ${isWinamp ? "winamp-label" : "text-[10px] text-content-muted"}`}>Position</span>
      {isWinamp ? (
        <div className="flex flex-col gap-3">
          {(["x", "y", "z"] as const).map((axis) => (
            <ScrubInput key={`cp-${axis}`} label={axis.toUpperCase()} value={camRelPos[axis]} step={0.01} decimals={3} onChangeStart={actions.pushUndo} onChange={(v) => handleCamPosChange(axis, v)} />
          ))}
        </div>
      ) : (
        (["x", "y", "z"] as const).map((axis) => {
          const axisColor = isSciin
            ? axis === "x" ? "var(--rl-green)" : axis === "y" ? "var(--rl-yellow)" : "var(--rl-magenta)"
            : undefined;
          return (
            <ScrubInput key={`cp-${axis}`} label={axis.toUpperCase()} value={camRelPos[axis]} step={0.01} decimals={3} color={axisColor} onChangeStart={actions.pushUndo} onChange={(v) => handleCamPosChange(axis, v)} />
          );
        })
      )}

      {isSciin ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-content-primary">Lock Y Height</span>
          <ThemeToggle checked={lockY} onChange={actions.setLockY} />
        </div>
      ) : (
        <label className={`${isWinamp ? "mt-0 gap-2.5" : "mt-1 gap-1.5"} flex cursor-pointer items-center ${isWinamp ? "winamp-label" : "text-[11px] text-content-primary"}`}>
          <input
            type="checkbox"
            checked={lockY}
            onChange={(e) => actions.setLockY(e.target.checked)}
            className={isWinamp ? "" : "accent-accent-500"}
          />
          Lock Y height
        </label>
      )}

      <span className={`${isWinamp ? "-mt-1" : "mt-2"} ${isSciin ? "mb-1" : ""} ${isWinamp ? "winamp-label" : "text-[10px] text-content-muted"}`}>Rotation</span>
      <div className={isWinamp ? "winamp-rotation-fields flex flex-col gap-3" : "flex flex-col gap-1.5"}>
        <ScrubInput
          label="X"
          value={camRelYaw}
          step={0.5}
          decimals={1}
          color={isSciin ? "var(--rl-green)" : undefined}
          onChangeStart={actions.pushUndo}
          onChange={handleCamYawChange}
        />
        <ScrubInput
          label="Y"
          value={camPitch}
          step={0.5}
          min={-90}
          max={90}
          decimals={1}
          color={isSciin ? "var(--rl-yellow)" : undefined}
          onChangeStart={actions.pushUndo}
          onChange={handleCamPitchChange}
        />
      </div>

      {isWinamp ? (
        <div className="winamp-camera-sliders mt-2">
          <div className="flex flex-row gap-3">
            <div className="flex-1 min-w-0">
              <Slider label="FOV" value={fov} min={24} max={48} step={1} onChange={actions.setFov} onChangeStart={actions.pushUndo} />
            </div>
            <div className="flex-1 min-w-0">
              <Slider label="Speed" value={moveSpeed} min={0.1} max={1} step={0.1} onChange={actions.setMoveSpeed} onChangeStart={actions.pushUndo} />
            </div>
          </div>
          <div className="winamp-dof-section">
            <div className="winamp-dof-header">
              <span className="winamp-label">Depth of Field</span>
              <div className="winamp-eq-pl-tray">
                <button className={`winamp-eq-pl-btn${!dofEnabled ? " active" : ""}`} onClick={() => actions.setDofEnabled(false)}>OFF</button>
                <button className={`winamp-eq-pl-btn${dofEnabled ? " active" : ""}`} onClick={() => actions.setDofEnabled(true)}>ON</button>
              </div>
            </div>
            {dofEnabled && (
              <div className="winamp-dof-sliders flex flex-col gap-3">
                <Slider label="Distance" value={dofFocusDistance} min={0.1} max={3} step={0.1} onChange={actions.setDofFocusDistance} />
                <Slider label="Aperture" value={dofFocusRange} min={0.5} max={16} step={0.5} onChange={actions.setDofFocusRange} />
                <Slider label="Bokeh" value={dofBlurRadius} min={1} max={25} step={0.5} onChange={actions.setDofBlurRadius} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`mt-2 flex flex-col ${isSciin ? "gap-4" : "gap-1"}`}>
          <div>
            <Slider
              label="Field of View"
              value={fov}
              min={24}
              max={48}
              step={1}
              format={(v) => `${v}°`}
              onChange={actions.setFov}
              onChangeStart={actions.pushUndo}
              valueColor={isSciin ? "var(--rl-cyan)" : undefined}
            />
          </div>
          <div className={isSciin ? "" : "mt-4"}>
            <Slider
              label="Move Speed"
              value={moveSpeed}
              min={0.1}
              max={1}
              step={0.1}
              onChange={actions.setMoveSpeed}
              onChangeStart={actions.pushUndo}
            />
          </div>
        </div>
      )}

      {isSciin ? (
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-content-primary">Depth of Field</span>
            <ThemeToggle checked={dofEnabled} onChange={actions.setDofEnabled} />
          </div>
          <div className={`mt-2 flex flex-col gap-4 ${!dofEnabled ? "pointer-events-none opacity-40" : ""}`}>
            <Slider label="Focus Distance" value={dofFocusDistance} min={0.1} max={3} step={0.1} format={(v) => `${v.toFixed(1)}m`} onChange={actions.setDofFocusDistance} thumbClass="sciin-thumb-cyan" />
            <Slider label="Aperture" value={dofFocusRange} min={0.5} max={16} step={0.5} format={(v) => `f/${v.toFixed(1)}`} onChange={actions.setDofFocusRange} thumbClass="sciin-thumb-cyan" />
            <Slider label="Bokeh Amount" value={dofBlurRadius} min={1} max={25} step={0.5} format={(v) => `${v.toFixed(1)}`} onChange={actions.setDofBlurRadius} thumbClass="sciin-thumb-cyan" />
          </div>
        </div>
      ) : !isWinamp && (
        <fieldset className="win95-group-box mt-4 rounded-md border border-surface-border p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-content-primary">Depth of Field</span>
            <ThemeToggle checked={dofEnabled} onChange={actions.setDofEnabled} />
          </div>
          <div className={`mt-2 flex flex-col gap-2 ${!dofEnabled ? "pointer-events-none opacity-40" : ""}`}>
            <Slider label="Focus Distance" value={dofFocusDistance} min={0.1} max={3} step={0.1} format={(v) => `${v.toFixed(1)}m`} onChange={actions.setDofFocusDistance} />
            <Slider label="Aperture" value={dofFocusRange} min={0.5} max={16} step={0.5} format={(v) => `f/${v.toFixed(1)}`} onChange={actions.setDofFocusRange} />
            <Slider label="Bokeh Amount" value={dofBlurRadius} min={1} max={25} step={0.5} format={(v) => `${v.toFixed(1)}`} onChange={actions.setDofBlurRadius} />
          </div>
        </fieldset>
      )}
    </div>
  );
}
