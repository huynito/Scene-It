import { useCallback, useRef } from "react";
import { useThemeId } from "@/themes/_shared/hooks/useThemeId";
import { publicUrl } from "@/lib/utils";

const audioCache = new Map<string, HTMLAudioElement>();

export function playSoundRaw(src: string, volume = 0.4) {
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audioCache.set(src, audio);
  }
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

const LOUD = 0.3;
const QUIET = 1.0;

/**
 * Standalone (non-hook) sign-off sound, used from cleanup effects where
 * the active theme may already be transitioning away from AIM (so the
 * useAimSounds() guard would no-op). The XPDesktopLayout calls this on
 * unmount to fire the goodbye regardless of the in-flight theme switch.
 */
export function playGoodbyeNow() {
  playSoundRaw(publicUrl("/sounds/aim/goodbye.wav"), QUIET);
}

export function useAimSounds() {
  const themeId = useThemeId();
  const isAim = themeId === "xX_sCeNeIt_Xx";
  const enabled = useRef(isAim);
  enabled.current = isAim;

  const guard = useCallback((fn: () => void) => {
    if (enabled.current) fn();
  }, []);

  const playDoorOpen = useCallback(() => guard(() => playSoundRaw(publicUrl("/sounds/aim/dooropen.wav"), LOUD)), [guard]);
  const playDoorClose = useCallback(() => guard(() => playSoundRaw(publicUrl("/sounds/aim/doorslam.wav"), LOUD)), [guard]);
  const playImSend = useCallback(() => guard(() => playSoundRaw(publicUrl("/sounds/aim/imsend.wav"), LOUD)), [guard]);
  const playImReceive = useCallback(() => guard(() => playSoundRaw(publicUrl("/sounds/aim/newmail.wav"), LOUD)), [guard]);
  const playReceive = useCallback(() => guard(() => playSoundRaw(publicUrl("/sounds/aim/gotmail.wav"), QUIET)), [guard]);
  const playWelcome = useCallback(() => guard(() => playSoundRaw(publicUrl("/sounds/aim/welcome.wav"), QUIET)), [guard]);
  const playGoodbye = useCallback(() => guard(() => playSoundRaw(publicUrl("/sounds/aim/goodbye.wav"), QUIET)), [guard]);
  const playFileDone = useCallback(() => guard(() => playSoundRaw(publicUrl("/sounds/aim/filedone.wav"), QUIET)), [guard]);
  const playMoo = useCallback(() => guard(() => playSoundRaw(publicUrl("/sounds/aim/moo.wav"), LOUD)), [guard]);

  return {
    playDoorOpen, playDoorClose, playImSend, playImReceive, playReceive,
    playWelcome, playGoodbye, playFileDone, playMoo,
  };
}
