"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { CHANGELOG } from "@/lib/changelog";

const TYPE_LABEL: Record<string, { text: string; color: string }> = {
  new:      { text: "NEW",      color: "text-accent-400" },
  fix:      { text: "FIX",      color: "text-red-400" },
  improved: { text: "IMPROVED", color: "text-blue-400" },
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
}

export default function ChangelogPill() {
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        pillRef.current && !pillRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (CHANGELOG.length === 0) return null;

  return (
    <>
      <button
        ref={pillRef}
        onClick={() => setOpen((v) => !v)}
        className="absolute bottom-5 right-5 z-10 flex items-center gap-1.5 rounded-full border border-surface-border-secondary bg-surface-primary/80 px-3 py-1.5 text-[11px] text-content-muted backdrop-blur-sm transition-colors hover:border-accent-500/40 hover:text-content-primary"
      >
        <Sparkles className="h-3 w-3" />
        What&apos;s New
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute bottom-14 right-5 z-20 w-72 max-h-80 overflow-y-auto rounded-lg border border-surface-border-secondary bg-surface-raised p-4 shadow-lg scrollbar-thin"
        >
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-content-primary uppercase">
            What&apos;s New
          </h3>
          <div className="flex flex-col gap-4">
            {CHANGELOG.map((entry) => (
              <div key={entry.date}>
                <div className="mb-1.5 text-[10px] font-medium text-content-muted">
                  {formatDate(entry.date)}
                </div>
                <ul className="flex flex-col gap-1">
                  {entry.items.map((item, i) => {
                    const badge = TYPE_LABEL[item.type] ?? TYPE_LABEL.new;
                    return (
                      <li key={i} className="flex gap-2 text-[11px] leading-relaxed">
                        <span className={`shrink-0 font-bold ${badge.color}`}>
                          {badge.text}
                        </span>
                        <span className="text-content-secondary">{item.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
