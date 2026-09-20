"use client";

import { useEffect, useState } from "react";
import {
  W95HeaderViewport,
  W95HeaderFolder,
  W95HeaderNetwork,
  W95HeaderClapperboard,
  W95HeaderComputer,
  W95HeaderClock,
  W95HeaderMap,
  W95StartFlag,
} from "@/themes/win95/icons";

const TASKBAR_ITEMS = [
  { label: "Viewport", Icon: W95HeaderViewport },
  { label: "Media Library", Icon: W95HeaderFolder },
  { label: "Playlist", Icon: W95HeaderFolder },
  { label: "Paths", Icon: W95HeaderNetwork },
  { label: "Timeline", Icon: W95HeaderClapperboard },
  { label: "Settings", Icon: W95HeaderComputer },
  { label: "Floorplan", Icon: W95HeaderMap },
];

export default function Win95Taskbar() {
  const [clockTime, setClockTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    };
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="win95-toolbar win95-taskbar flex shrink-0 items-center border-x border-y border-surface-border bg-surface-primary/95 px-1 py-1">
      <button className="win95-start-btn flex items-center gap-1.5 px-2 py-1 mr-2 font-bold text-[12px]">
        <W95StartFlag size={16} />
        Start
      </button>

      <div className="win95-taskbar-divider mr-1" />

      <div className="flex items-center gap-0.5 flex-1 min-w-0">
        {TASKBAR_ITEMS.map(({ label, Icon }) => (
          <button key={label} className="win95-taskbar-item flex items-center gap-1 px-2 py-0.5 text-[11px] truncate">
            <Icon size={16} className="win95-icon-multi shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      <div className="win95-taskbar-divider ml-1" />
      <div className="win95-taskbar-clock flex items-center gap-1.5 px-2 text-[11px] tabular-nums">
        <W95HeaderClock size={16} className="win95-icon-multi shrink-0" />
        {clockTime}
      </div>
    </div>
  );
}
