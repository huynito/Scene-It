"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Play, Pause, Square, Volume2, VolumeX, Repeat, Repeat1 } from "lucide-react";
import { useScene } from "@/lib/scene-context";
import { MarqueeName } from "./AssetBrowser";

function LcdMarquee({ text }: { text: string }) {
  const spacer = "\u00A0\u00A0\u00A0\u00A0";
  return (
    <div className="winamp-lcd-marquee">
      <div className="winamp-lcd-marquee-inner">
        {text}{spacer}{text}{spacer}
      </div>
    </div>
  );
}

const BAR_COUNT = 39;
const FFT_SIZE = 256;
const DECAY = 0.88;

function WinampSpectrum({
  audioRef,
  active,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  active?: boolean;
}) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const heightsRef = useRef(new Float32Array(BAR_COUNT));
  const rafRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  const ensureAnalyser = useCallback(() => {
    if (ctxRef.current) return analyserRef.current;
    const audio = audioRef.current;
    if (!audio) return null;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      return analyser;
    } catch {
      return null;
    }
  }, [audioRef]);

  useEffect(() => {
    const analyser = ensureAnalyser();
    if (!analyser) return;

    if (active && ctxRef.current?.state === "suspended") {
      ctxRef.current.resume();
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    const heights = heightsRef.current;
    const usableBins = Math.floor(analyser.frequencyBinCount * 0.82);

    const tick = () => {
      const live =
        activeRef.current && ctxRef.current?.state === "running";

      if (live) {
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < BAR_COUNT; i++) {
          const t0 = Math.pow(i / BAR_COUNT, 1.4);
          const t1 = Math.pow((i + 1) / BAR_COUNT, 1.4);
          const s = Math.floor(t0 * usableBins);
          const e = Math.max(s + 1, Math.floor(t1 * usableBins));
          let sum = 0;
          for (let j = s; j < e; j++) sum += data[j];
          const avg = sum / (e - s) / 255;
          const boosted = Math.min(1, Math.pow(avg, 0.85) * 1.3);
          heights[i] = Math.max(heights[i] * 0.35, boosted);
        }
      } else {
        let alive = false;
        for (let i = 0; i < BAR_COUNT; i++) {
          heights[i] *= DECAY;
          if (heights[i] > 0.005) alive = true;
          else heights[i] = 0;
        }
        if (!alive) {
          for (let i = 0; i < BAR_COUNT; i++) {
            const el = barsRef.current[i];
            if (el) el.style.height = "0%";
          }
          return;
        }
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const el = barsRef.current[i];
        if (!el) continue;
        const pct = heights[i] * 100;
        el.style.height = pct < 1 ? "0%" : `${pct}%`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, ensureAnalyser]);

  return (
    <div className="winamp-spectrum">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className="winamp-spectrum-bar"
          style={{ animation: "none", height: "0%" }}
        />
      ))}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function WinampPlayerPanel() {
  const { playlist, currentTrackId, isAudioPlaying, actions } = useScene();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [muted, setMuted] = useState(false);
  const [loopTrack, setLoopTrack] = useState(false);
  const [repeatAll, setRepeatAll] = useState(false);

  const currentTrack = playlist.find((t) => t.id === currentTrackId);
  const trackIdx = currentTrack ? playlist.findIndex((t) => t.id === currentTrackId) + 1 : 0;

  const playPause = useCallback(() => {
    if (!currentTrack) {
      if (playlist.length > 0) {
        actions.setCurrentTrackId(playlist[0].id);
        actions.setIsAudioPlaying(true);
      }
      return;
    }
    actions.setIsAudioPlaying(!isAudioPlaying);
  }, [currentTrack, isAudioPlaying, playlist, actions]);

  const stop = useCallback(() => {
    actions.setIsAudioPlaying(false);
    if (audioRef.current) audioRef.current.currentTime = 0;
    setCurrentTime(0);
  }, [actions]);

  const skipPrev = useCallback(() => {
    if (playlist.length === 0) return;
    const idx = playlist.findIndex((t) => t.id === currentTrackId);
    const prevIdx = idx <= 0 ? playlist.length - 1 : idx - 1;
    actions.setCurrentTrackId(playlist[prevIdx].id);
    actions.setIsAudioPlaying(true);
  }, [playlist, currentTrackId, actions]);

  const skipNext = useCallback(() => {
    if (playlist.length === 0) return;
    const idx = playlist.findIndex((t) => t.id === currentTrackId);
    const nextIdx = idx >= playlist.length - 1 ? 0 : idx + 1;
    actions.setCurrentTrackId(playlist[nextIdx].id);
    actions.setIsAudioPlaying(true);
  }, [playlist, currentTrackId, actions]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = currentTrack.url;
    audio.volume = volume;
    if (isAudioPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentTrackId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isAudioPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isAudioPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
    audio.loop = loopTrack;
  }, [volume, muted, loopTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (loopTrack) {
        audio.currentTime = 0;
        audio.play();
        return;
      }
      const idx = playlist.findIndex((t) => t.id === currentTrackId);
      if (idx < playlist.length - 1) {
        actions.setCurrentTrackId(playlist[idx + 1].id);
        actions.setIsAudioPlaying(true);
      } else if (repeatAll) {
        actions.setCurrentTrackId(playlist[0].id);
        actions.setIsAudioPlaying(true);
      } else {
        actions.setIsAudioPlaying(false);
        setCurrentTime(0);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playlist, currentTrackId, actions, loopTrack, repeatAll]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  }, []);

  return (
    <div className="winamp-player-chrome flex flex-col gap-0">
      <audio ref={audioRef} preload="auto" />

      {/* Blue LCD display */}
      <div className="winamp-player-lcd">
        <div className="winamp-player-lcd-upper">
          <span className="winamp-player-lcd-time">{formatTime(currentTime)}</span>
          <div className="winamp-player-lcd-spectrum">
            <WinampSpectrum audioRef={audioRef} active={isAudioPlaying} />
          </div>
        </div>
        <div className="winamp-player-lcd-track">
          {currentTrack ? (
            <LcdMarquee text={currentTrack.name} />
          ) : (
            <span className="winamp-player-lcd-idle">No track</span>
          )}
        </div>
      </div>

      {/* Seek bar */}
      <div className="winamp-player-seek">
        <div className="slider-track-wrapper relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-border-secondary"
          />
        </div>
      </div>

      {/* Transport + Volume */}
      <div className="transport-controls winamp-player-transport">
        <div className="transport-group flex items-center gap-1">
          <button onClick={skipPrev} title="Previous">
            <svg className="h-[14px] w-[14px] -ml-px" viewBox="0 0 16 16" fill="currentColor"><polygon points="8,2 1,8 8,14" /><polygon points="15,2 8,8 15,14" /></svg>
          </button>
          <button onClick={() => { if (!currentTrack && playlist.length > 0) { actions.setCurrentTrackId(playlist[0].id); } actions.setIsAudioPlaying(true); }} title="Play">
            <Play className="h-3 w-3" />
          </button>
          <button onClick={() => actions.setIsAudioPlaying(false)} title="Pause">
            <Pause className="h-[13px] w-[13px]" />
          </button>
          <button onClick={stop} title="Stop">
            <Square className="h-2.5 w-2.5 ml-[2px]" />
          </button>
          <button onClick={skipNext} title="Next">
            <svg className="h-[14px] w-[14px]" viewBox="0 0 16 16" fill="currentColor"><polygon points="1,2 8,8 1,14" /><polygon points="8,2 15,8 8,14" /></svg>
          </button>
        </div>
      </div>

      <div className="winamp-player-vol-notch">
        <button
          className={`winamp-vol-mute-btn${muted ? "" : " active"}`}
          onClick={() => setMuted(!muted)}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-[10px] w-[10px]" /> : <Volume2 className="h-[10px] w-[10px]" />}
        </button>
        <div className="slider-track-wrapper relative flex flex-1 items-center"
             style={{ '--fill': `${volume * 100}%` } as React.CSSProperties}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-border-secondary"
          />
        </div>
      </div>

      <div className="winamp-player-notch-seam" aria-hidden="true" />
      <div className="winamp-player-notch-highlight" aria-hidden="true" />
      {/* Decorative chrome notches — SVG for precise gradient fill + selective outline strokes */}
      <svg className="winamp-player-notch-mid" aria-hidden="true"
           viewBox="-20 -1 175 27">
        <defs>
          <linearGradient id="wa-notch-mid" x1="0" y1="0" x2="0" y2="24"
                          gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F2F2F4" />
            <stop offset="25%" stopColor="#EDEFF8" />
            <stop offset="50%" stopColor="#DBDCE5" />
            <stop offset="75%" stopColor="#C3C8D4" />
            <stop offset="100%" stopColor="#B9BFCB" />
          </linearGradient>
        </defs>
        <path d="M -13 195 L -13 24 L -7 24 Q -2 24 -1 20 C 2 8 7 0 15 0 L 120 0 C 128 0 133 8 136 20 Q 137 24 142 24 L 142 195 Z"
              fill="url(#wa-notch-mid)" />
        <path d="M 0 19 C 3 9 8 1 16 1 L 119 1 C 127 1 132 9 135 19"
              fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <path d="M -13 24 L -7 24 Q -2 24 -1 20 C 2 8 7 0 15 0 L 120 0 C 128 0 133 8 136 20 Q 137 24 142 24"
              fill="none" stroke="rgba(0,0,20,0.65)" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <div className="winamp-player-notch-btm-buttons">
        <div className="winamp-notch-btn-group">
          <button
            className="winamp-vol-mute-btn"
            onClick={() => setLoopTrack(!loopTrack)}
            title="Loop track"
          >
            <svg className="h-[10px] w-[10px]" viewBox="0 0 24 24" fill="none" stroke="#1a1c22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <polygon points="22,1 22,9 14,9" fill="#1a1c22" stroke="none" />
              <polygon points="2,23 2,15 10,15" fill="#1a1c22" stroke="none" />
            </svg>
          </button>
          <input
            type="checkbox"
            checked={loopTrack}
            onChange={() => setLoopTrack(!loopTrack)}
            className="winamp-notch-indicator"
          />
        </div>
        <div className="winamp-notch-btn-group">
          <button
            className="winamp-vol-mute-btn"
            onClick={() => setRepeatAll(!repeatAll)}
            title="Repeat all"
          >
            <svg className="h-[10px] w-[10px]" viewBox="0 0 16 16" fill="none">
              <path d="M2 4 Q5 1 11 2.5" stroke="#1a1c22" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <polygon points="14,0.5 14,5.5 10,3" fill="#1a1c22" />
              <text x="0.5" y="14" fill="#1a1c22" style={{ fontSize: '9px', fontWeight: 900, fontFamily: 'Arial, sans-serif' }}>123</text>
            </svg>
          </button>
          <input
            type="checkbox"
            checked={repeatAll}
            onChange={() => setRepeatAll(!repeatAll)}
            className="winamp-notch-indicator"
          />
        </div>
      </div>
      <svg className="winamp-player-notch-btm" aria-hidden="true"
           viewBox="2 -3 118 39">
        <defs>
          <filter id="btm-blur"><feGaussianBlur stdDeviation="1" /></filter>
          <filter id="btm-blur2"><feGaussianBlur stdDeviation="2" /></filter>
          <linearGradient id="wa-notch-btm" x1="0" y1="-4" x2="0" y2="36"
                          gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EDEDF0" />
            <stop offset="27%" stopColor="#F2F2F5" />
            <stop offset="43%" stopColor="#DEDFE7" />
            <stop offset="59%" stopColor="#C9CED8" />
            <stop offset="69%" stopColor="#C2C8D3" />
            <stop offset="80%" stopColor="#B8BFCC" />
            <stop offset="87%" stopColor="#C1C7D2" />
            <stop offset="94%" stopColor="#DFE0E8" />
            <stop offset="100%" stopColor="#F3F3F6" />
          </linearGradient>
        </defs>
        <path d="M -8 136 L 6 36 C 26 30 14 -2 42 -2 L 120 -2 L 120 136 Z"
              fill="url(#wa-notch-btm)" />
        <path d="M 6 36 C 26 30 14 -2 42 -2 L 120 -2"
              fill="none" stroke="rgba(0,0,20,0.65)" strokeWidth="1" />
        <path d="M 7 35 C 27 29 15 -1 43 -1 L 119 -1"
              fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" filter="url(#btm-blur)" />
        <path d="M 119 -1 L 119 35"
              fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
