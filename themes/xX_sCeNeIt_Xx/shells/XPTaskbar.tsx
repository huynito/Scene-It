"use client";

import { useEffect, useState } from "react";
import { useWindowManager } from "@/themes/xX_sCeNeIt_Xx/window-manager";
import { AimXPStartFlag } from "@/themes/xX_sCeNeIt_Xx/icons";

function Clock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTime(
        d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      );
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  return <span className="xp-taskbar-clock">{time}</span>;
}

export default function XPTaskbar() {
  const { windows, focusedId, focusWindow, restoreWindow, minimizeWindow } = useWindowManager();

  const handleClick = (id: string, minimized: boolean) => {
    if (minimized) {
      restoreWindow(id);
    } else if (focusedId === id) {
      minimizeWindow(id);
    } else {
      focusWindow(id);
    }
  };

  return (
    <div className="xp-taskbar">
      <button className="xp-start-btn">
        <AimXPStartFlag />
        <span>start</span>
      </button>

      <div className="xp-taskbar-windows">
        {windows.map((w) => (
          <button
            key={w.id}
            data-taskbar-id={w.id}
            className={`xp-taskbar-btn ${!w.minimized ? "active" : ""} ${w.id === focusedId && !w.minimized ? "focused" : ""} ${w.minimized ? "minimized" : ""}`}
            onClick={() => handleClick(w.id, w.minimized)}
            title={w.title}
          >
            {w.icon && (
              <img
                src={w.icon}
                width={16}
                height={16}
                className="xp-taskbar-btn-icon"
                draggable={false}
                alt=""
              />
            )}
            <span className="xp-taskbar-btn-label">{w.title}</span>
          </button>
        ))}
      </div>

      <div className="xp-system-tray">
        <Clock />
      </div>
    </div>
  );
}
