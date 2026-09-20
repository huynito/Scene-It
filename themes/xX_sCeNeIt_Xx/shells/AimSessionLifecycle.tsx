"use client";

import { useEffect, useRef } from "react";
import { useAimSounds, playGoodbyeNow } from "@/themes/xX_sCeNeIt_Xx/sounds";

/**
 * AIM session sound lifecycle. Mounted as a child of XPDesktopLayout so
 * its presence is gated on the AIM theme being active.
 *
 * - On first mount: plays the AOL "welcome" sound.
 * - On unmount: schedules the "goodbye" sound on a 100ms timer. Strict
 *   Mode's double-mount cancels the timer on remount, so the goodbye only
 *   actually fires when the layout truly unmounts (i.e. the user switches
 *   away from AIM).
 *
 * Renders nothing.
 */
export default function AimSessionLifecycle() {
  const { playWelcome } = useAimSounds();
  const hasWelcomedRef = useRef(false);
  const goodbyeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (goodbyeTimerRef.current) {
      clearTimeout(goodbyeTimerRef.current);
      goodbyeTimerRef.current = undefined;
    }
    if (!hasWelcomedRef.current) {
      playWelcome();
      hasWelcomedRef.current = true;
    }
    return () => {
      goodbyeTimerRef.current = setTimeout(() => {
        playGoodbyeNow();
      }, 100);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
