"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { WIN95_ICON_MAP, WIN95_HEADER_ICON_MAP } from "@/themes/win95/icons";
import { ASCII_ICON_MAP } from "@/themes/sciin_it/icons";
import { AIM_ICON_MAP, AIM_HEADER_ICON_MAP } from "@/themes/xX_sCeNeIt_Xx/icons";
import { WINAMP_ICON_MAP } from "@/themes/winamp/icons";
import { useThemeCapabilities } from "@/themes";

export { useThemeId } from "@/themes/_shared/hooks/useThemeId";

interface ThemeIconProps extends React.HTMLAttributes<SVGElement> {
  icon: LucideIcon;
  size?: number | string;
  strokeWidth?: number;
  header?: boolean;
}

export default function ThemeIcon({
  icon: LucideComponent,
  size = 16,
  strokeWidth,
  className,
  header,
  ...rest
}: ThemeIconProps) {
  const cap = useThemeCapabilities();
  const name = LucideComponent.displayName || "";

  if (cap.iconStyle === "ascii") {
    const glyph = ASCII_ICON_MAP[name];
    if (glyph) {
      return (
        <span
          className={className}
          style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: size, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
        >
          {glyph}
        </span>
      );
    }
  }

  if (cap.iconStyle === "win95-pixel") {
    if (header) {
      const HeaderComponent = WIN95_HEADER_ICON_MAP[name];
      if (HeaderComponent) {
        return <HeaderComponent size={16} className={className?.replace(/\b[hw]-\d+(\.\d+)?\b/g, "").trim() || undefined} {...(rest as React.SVGProps<SVGSVGElement>)} />;
      }
    }
    const Win95Component = WIN95_ICON_MAP[name];
    if (Win95Component) {
      return <Win95Component size={size} className={className} {...(rest as React.SVGProps<SVGSVGElement>)} />;
    }
  }

  if (cap.iconStyle === "aim-png") {
    if (header) {
      const HeaderComponent = AIM_HEADER_ICON_MAP[name];
      if (HeaderComponent) {
        return <HeaderComponent size={size} className={className} {...(rest as React.SVGProps<SVGSVGElement>)} />;
      }
    }
    const AimComponent = AIM_ICON_MAP[name];
    if (AimComponent) {
      return <AimComponent size={size} className={className} {...(rest as React.SVGProps<SVGSVGElement>)} />;
    }
  }

  if (cap.iconStyle === "winamp-svg") {
    const WinampComponent = WINAMP_ICON_MAP[name];
    if (WinampComponent) {
      return <WinampComponent size={size} className={className} {...(rest as React.SVGProps<SVGSVGElement>)} />;
    }
  }

  return <LucideComponent size={Number(size)} strokeWidth={strokeWidth} className={className} {...rest} />;
}
