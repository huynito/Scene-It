# win95 — "sceneit.exe"

Pixel-perfect Windows 95 skeuomorphism. Teal desktop, gray panels, raised/sunken bevels, Tahoma + W95FA pixel font, pixel-art icons, navy titlebars, hardcoded 13px font size on every element. The interface as if the gaussian splat editor shipped on a 1995 PC.

## Identity

Faithful reproduction of the Windows 95 chrome language. Every panel is a `.win95-window` with raised border bevels (white top/left, dark gray bottom/right). Every input is sunken (inverse bevels). Buttons depress on click. The titlebar gradient runs from `#000080` (navy) at the left to a slightly brighter blue at the right. Active windows have a brighter titlebar; inactive ones use a desaturated gray.

The hardcoded 13px font size and zero border-radius enforce the OS-uniform look — the application looks like a Win95 dialog box, not a "modern app with Win95 colors."

## Tokens

Defined in [tokens.ts](tokens.ts) — the `THEME_WIN95` object.

| Token | Value | Notes |
|---|---|---|
| `sfBase` | `#008080` | Classic Win95 teal desktop background |
| `sfPrimary` | `#c0c0c0` | Standard 3D face color (`COLOR_3DFACE`) |
| `sfRaised` | `#c0c0c0` | Same as primary — depth comes from bevels, not surface tint |
| `sfBorder` | `#808080` | Gray separator |
| `sfBorderSecondary` | `#a0a0a0` | Lighter gray |
| `txPrimary` | `#000000` | Pure black text |
| `txSecondary` | `#222222` | Near-black |
| `txMuted` | `#555555` | Mid-gray |
| `txFaint` | `#808080` | Disabled gray |
| `ac300/400/500/600` | `#4040ff`, `#0000ff`, `#000080`, `#000060` | Win95 blue accent (titlebar) |
| `borderRadius` | `0px` | Hard square corners — `*` selector forces this |
| `panelShadow` | `none` | Depth comes from CSS bevels, not drop shadows |
| `glow` | `transparent` | No glow |

## Typography

| Use | Family | Source |
|---|---|---|
| UI | W95FA pixel font, Tahoma fallback | Self-hosted in `public/fonts/w95fa/` (woff + woff2) |
| Mono | Courier New | OS-native |

W95FA is a public-domain pixel font that approximates the original MS Sans Serif bitmap face. Loaded via `@font-face` at the top of [decorations.css](decorations.css) (so the bundle is self-contained — no shared font file).

## Iconography

[icons.tsx](icons.tsx) — a mix of:
- **Inline SVG icons** (~30) for simple shapes (`W95Box`, `W95Plus`, `W95Play`, `W95Pause`, `W95ChevronDown`, etc.) drawn with `shapeRendering="crispEdges"` and pixel-aligned paths
- **PNG icons** (~50) for the multi-color skeuomorphic ones (`W95Upload`, `W95RotateCcw`, `W95Trash2`, `W95Pen`, `W95Move`, `W95Footprints`, etc.) — paired 16px and 32px versions for body vs header use, served from `public/icons/win95/` with `imageRendering: pixelated`

Two maps are exported:
- `WIN95_ICON_MAP` — keyed by Lucide name, used by `<ThemeIcon>` for body icons
- `WIN95_HEADER_ICON_MAP` — used when `<ThemeIcon header>` is set, returns the larger header variants

The `W95CloseGlyph` is a hand-drawn SVG of the 7×7 close X glyph from the title bar, faithful to the original bitmap.

A `W95_EXPLORER_ICON_POOL` provides 12 random icons for asset browser placeholders, drawn from the original Win95 control panel iconography.

## Capabilities

| Capability | Value | Effect |
|---|---|---|
| `layoutShell` | `stacked` | Shares flex column layout with default + sciin_it, but wraps viewport in `Win95ViewportChrome` |
| `iconStyle` | `win95-pixel` | `<ThemeIcon>` looks up `WIN95_ICON_MAP` (or `WIN95_HEADER_ICON_MAP` if `header` prop set) |
| `checkboxStyle` | `win95-button` | Pixel-art SVG checkmark on a sunken bevel |
| `sliderStyle` | `default` | Standard input range, styled by CSS |
| `sectionHeaderStyle` | `win95-titlebar` | Section headers render as title bars with icon + buttons |
| `isSkeuomorphic` | `true` | Triggers shared "skeuomorphic" branches in `PathPanel`, etc. |
| `anchorPalette` | `ms-paint` | Anchors cycle through MS Paint's primary 14-color palette |

## Primitives

- `ThemeToggle` renders an authentic Win95 checkbox: sunken bevel + pixel-art checkmark SVG
- `ThemeIcon` consults `WIN95_ICON_MAP` (or `_HEADER_` variant)
- All buttons get the gray `c0c0c0` raised bevel via `[data-theme="win95"] button` selector
- All scrollbars get pixel-art arrow buttons via WebKit pseudo-elements

## Shell components

[shells/index.ts](shells/index.ts) exports the full Win95 shell suite, all bundle-local:

- [`Win95ViewportChrome`](shells/Win95ViewportChrome.tsx) — wraps the PlyCanvas viewport in an authentic Win95 application window with menu bar, title bar, and toolbar
- [`Win95Taskbar`](shells/Win95Taskbar.tsx) — the bottom Start-button + taskbar-items + clock strip rendered when `cap.iconStyle === "win95-pixel"` (replaces the default toolbar)
- [`Win95Minimap`](shells/Win95Minimap.tsx) — the MS Paint floorplan window: title bar, menu bar, vertical paint toolbar (select/line/curve/bucket/eraser), color palette. Receives the canvas + tool/color state as props.

## Assets inventory

| Asset | Location | Count / size |
|---|---|---|
| Pixel-art PNG icons | `public/icons/win95/` | 87 PNGs (16px + 32px paired) |
| W95FA pixel font | `public/fonts/w95fa/` | woff (8 KB) + woff2 (4 KB) + OTF + license |

Total weight: ~1.1 MB icons + ~12 KB fonts = ~1.1 MB.

## Cascade pitfalls

These rules in [decorations.css](decorations.css) affect ALL elements site-wide when the theme is active. New components must respect them:

- `[data-theme="win95"] *` forces `font-size: 13px`, `font-weight: 500`, `border-radius: 0` on every element via `!important`. Components needing different sizes/weights must add explicit overrides.
- `[data-theme="win95"] svg` forces ALL SVGs to 16x16 and black. Non-icon SVGs (charts, canvases, overlays) must carry an opt-out class: `.win95-svg-exempt`, `.w-full`, `.pointer-events-none`, or be inside `.win95-inset`.
- `[data-theme="win95"] button` applies gray bg, black text, and `min-height: 26px` to every button. Invisible/ghost buttons need explicit overrides.
- `[data-theme="win95"] *` resets `scrollbar-width`/`scrollbar-color` to initial with `!important` (so WebKit pseudo-element scrollbars take precedence).

See [_shared/CASCADE_PITFALLS.md](../_shared/CASCADE_PITFALLS.md) for the canonical list.

## Lifting to another project

The bundle is now self-contained. The lift unit is literally these four directories:

```bash
cp -r themes/win95/                 DEST/themes/win95/
cp -r public/icons/win95/           DEST/public/icons/win95/
cp -r public/fonts/w95fa/           DEST/public/fonts/w95fa/
cp    themes/_shared/tokens.ts      DEST/themes/_shared/tokens.ts
cp    themes/_shared/capabilities.ts DEST/themes/_shared/capabilities.ts
```

Then at app startup:

```ts
import { applyUITheme, THEME_WIN95 } from "@/themes";
applyUITheme(THEME_WIN95);
```

And ensure your global stylesheet includes the bundle's decorations:

```css
@import "themes/win95/decorations.css";
```

What you get:
- Tokens (zinc-on-teal palette, no border radius, hard square corners)
- All 87 PNG icons + W95FA font registered via `@font-face`
- Full Win95 shells: `Win95ViewportChrome`, `Win95Taskbar`, `Win95Minimap`
- Pixel-art `WIN95_ICON_MAP` for the dispatcher

The shells assume a viewer-like host (scene context, toolbars). For unrelated apps, lift only the visual primitives + decorations and write your own chrome that consumes the icon library.
