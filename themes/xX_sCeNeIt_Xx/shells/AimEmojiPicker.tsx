"use client";

import type { RefObject } from "react";
import { AIM_EMOJI_PATHS, type AimEmojiName } from "@/themes/xX_sCeNeIt_Xx/icons";

const EMOJIS: { name: AimEmojiName; label: string }[] = [
  { name: "smiling", label: "Smiling :-)" },
  { name: "frowning", label: "Frowning :-(" },
  { name: "winking", label: "Winking ;-)" },
  { name: "tongue", label: "Tongue :-P" },
  { name: "surprised", label: "Surprised =-O" },
  { name: "kissing", label: "Kissing :-*" },
  { name: "yelling", label: "Yelling >:o" },
  { name: "cool", label: "Cool 8-)" },
  { name: "money-mouth", label: "Money-mouth :-$" },
  { name: "foot-in-mouth", label: "Foot-in-mouth :-!" },
  { name: "embarrassed", label: "Embarrassed :-[" },
  { name: "innocent", label: "Innocent O:-)" },
  { name: "undecided", label: "Undecided :-\\" },
  { name: "crying", label: "Crying :'(" },
  { name: "lips-sealed", label: "Lips-sealed :-X" },
  { name: "laughing", label: "Laughing :-D" },
];

interface AimEmojiPickerProps {
  open: boolean;
  onClose: () => void;
  /** ContentEditable element where the picker inserts an <img> via execCommand. */
  chatFieldRef: RefObject<HTMLDivElement>;
}

export default function AimEmojiPicker({ open, onClose, chatFieldRef }: AimEmojiPickerProps) {
  if (!open) return null;
  return (
    <>
      <div className="aim-emoji-backdrop" onClick={onClose} />
      <div className="aim-emoji-picker">
        {EMOJIS.map((e) => (
          <button
            key={e.name}
            title={e.label}
            onMouseDown={(ev) => {
              ev.preventDefault();
              const img = `<img src="${AIM_EMOJI_PATHS[e.name]}" alt="${e.label}" style="width:18px;height:18px;vertical-align:middle;image-rendering:pixelated;display:inline" />`;
              chatFieldRef.current?.focus();
              setTimeout(() => { document.execCommand("insertHTML", false, img); onClose(); }, 0);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={AIM_EMOJI_PATHS[e.name]} alt={e.label} draggable={false} />
          </button>
        ))}
      </div>
    </>
  );
}
