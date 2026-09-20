"use client";

import { useThemeCapabilities } from "@/themes";

interface SectionHeaderProps {
  children: React.ReactNode;
}

export default function SectionHeader({ children }: SectionHeaderProps) {
  const cap = useThemeCapabilities();

  if (cap.sectionHeaderStyle === "sciin-terminal") {
    return (
      <h3
        className="flex items-center gap-0 text-xs font-medium uppercase text-content-muted"
        style={{ fontFamily: "'Courier New', Courier, monospace", letterSpacing: "0.15em", height: 20 }}
      >
        <span style={{ color: "var(--section-accent, rgb(var(--ac-400)))", marginRight: 6, opacity: 0.5 }}>──</span>
        <span style={{ color: "var(--section-accent, rgb(var(--ac-400)))", flexShrink: 0 }}>{children}</span>
        <span style={{ color: "var(--section-accent, rgb(var(--ac-400)))", marginLeft: 6, flex: 1, overflow: "hidden", whiteSpace: "nowrap", opacity: 0.5 }}>
          {"─".repeat(40)}
        </span>
      </h3>
    );
  }

  return (
    <h3 className="mb-3 mt-4 border-t border-surface-border pt-4 text-xs font-medium uppercase tracking-wider text-content-muted">
      {children}
    </h3>
  );
}
