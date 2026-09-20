# winamp — "scene it.mp3"

Winamp 5 brushed-metal media-player chrome over a Milkdrop visualizer background. Free-floating draggable+dockable windows, navy LCD displays, custom SVG curved tab modules, vertical sliders for the post-processing EQ, DSEG7 7-segment LCD font for time displays. The interface as a multi-window media player from 2003 that happens to also display gaussian splats.

## Identity

The complete Winamp 5 visual vocabulary: brushed-metal gradient panels (`#cdd0d8 → #b3b8c3`), 6-layer inset bevels, navy LCD recessed displays, "tab module" curved chrome with SVG-rendered curve frames, vertical EQ-style sliders, the 7-segment LCD font on time displays, and the looping Milkdrop visualizer mp4 as the desktop background. Windows are free-floating, draggable, dockable into vertical groups (the original Winamp docking model).

## Tokens

Defined in [tokens.ts](tokens.ts) — the `THEME_WINAMP` object.

| Token | Value | Notes |
|---|---|---|
| `sfBase` | `#747987` | Brushed steel base |
| `sfPrimary` | `#b3b8c3` | Standard panel surface |
| `sfRaised` | `#cdd0d8` | Highlight side of bevels |
| `sfBorder` | `#4a4f58` | Dark navy border |
| `sfBorderSecondary` | `#90939b` | Lighter mid-gray |
| `txPrimary` | `#1a1c22` | Near-black for max readability on light panels |
| `txSecondary` | `#3a3e48` | Slightly lifted |
| `txMuted` | `#5a5e68` | Mid-gray |
| `txFaint` | `#7a7e88` | Faint label text |
| `ac300/400/500/600` | `#9cb4d8`, `#7894c0`, `#5474a0`, `#3e5a84` | Cool blue scale (LCD glow + active-button highlight) |
| `borderRadius` | `2px` | Subtly softened |
| `panelShadow` | 6-layer inset bevel | The classic Winamp brushed-metal raised look |
| `glow` | `transparent` | No glow |

## Typography

| Use | Family | Source |
|---|---|---|
| UI | Tahoma | References `public/fonts/aim/tahoma.ttf` (the AIM bundle owns the `@font-face` declaration; both bundles use the same Tahoma font files) |
| Mono / display | DSEG7Modern (7-segment LCD font) | Self-hosted in `public/fonts/winamp/DSEG7Classic-Regular.woff2`; loaded via `@font-face` at the top of [decorations.css](decorations.css) |

Tahoma is the authentic Winamp UI font. The DSEG7 7-segment LCD font is reserved for time displays (`00:00:00` ticking on the player panel and timeline) — it gives the navy LCDs their authentic 1990s alarm-clock appearance.

Note on Tahoma: this bundle does not declare its own `@font-face` for Tahoma. It assumes either the AIM bundle is loaded alongside (which declares Tahoma from `/fonts/aim/`) or the host system has Tahoma installed. If lifting Winamp standalone into another project, also lift `public/fonts/aim/tahoma*.ttf` and the Tahoma `@font-face` block (which currently lives at the top of `themes/xX_sCeNeIt_Xx/decorations.css`).

## Iconography

[icons.tsx](icons.tsx) — all inline SVG with opacity-shaded paths for the chrome bevel feel:
- `WampPlay`, `WampPause`, `WampStepBack`, `WampStepForward`, `WampSkipBack`, `WampSkipForward` — transport controls
- `WampPlus`, `WampX`, `WampUpload`, `WampTrash`, `WampPalette`, `WampRepeat`, `WampRotateCcw`
- `WampBox`, `WampCrosshair`, `WampFilm`, `WampImage`, `WampChevronDown`, `WampArrowRight`

All icons use `viewBox="0 0 16 16"` with `shapeRendering="crispEdges"`, drawn pixel-aligned. Total: ~19 icons, single map `WINAMP_ICON_MAP`.

## Capabilities

| Capability | Value | Effect |
|---|---|---|
| `layoutShell` | `winamp-desktop` | Triggers `<WinampDesktop>` early-return in [app/page.tsx](../../app/page.tsx) |
| `iconStyle` | `winamp-svg` | `<ThemeIcon>` looks up `WINAMP_ICON_MAP` |
| `checkboxStyle` | `winamp-toggle` | Pill-style toggle with `winamp-toggle` + `winamp-toggle-knob` classes |
| `sliderStyle` | `default` | Vertical Winamp slider for EQ uses inline branch in `Slider.tsx` (capability `winamp-vertical` could be added) |
| `sectionHeaderStyle` | `winamp-groove` | Embossed groove headers; bare `tabStyle` panels use the SVG tab module instead |
| `isSkeuomorphic` | `false` | Chrome is metallic, not Win95-bevel skeuomorphic |
| `hasMilkdropBackground` | `true` | Renders looping `winamp-visualizer.mp4` behind everything |
| `anchorPalette` | `hsl` | Standard hue-spaced palette |

## Primitives

- All buttons get the metallic gradient and inset shadows via `[data-theme="winamp"] button`
- All SVGs get a subtle drop-shadow filter via `[data-theme="winamp"] svg`
- Inputs get the navy-LCD background via `[data-theme="winamp"] input/select` (with `!important` — overriding requires `!important`)
- `Slider` has a special vertical layout for the post-processing EQ panel
- `ScrubInput` (timeline scrub field) gets the navy-LCD `winamp-scrub-field` styling

## Shell components

[shells/index.ts](shells/index.ts) re-exports the full Winamp shell suite, all from `components/`:
- `WinampDesktop` — top-level layout with `WinampWindowManagerProvider`, Milkdrop background, all floating windows
- `WinampFloatingWindow` — draggable+dockable+resizable window with bare-mode chrome stripping
- `CollapsibleSection` — handles 5 different section header styles; the winamp tab-module style is a 459-line SVG rendering with measured-width geometry (see `.cursor/rules/winamp-tab-chrome-layers.mdc`)
- `MilkdropBackground` — the looping mp4 visualizer

Plus the [window-manager.tsx](window-manager.tsx) — a separate window manager from XP/AIM, with vertical docking groups (the original Winamp model).

Other shell components (in `components/viewer/panels/`):
- `WinampPlayerPanel` — the player chrome with LCD seek bar, transport, spectrum analyzer simulation
- `WinampPlaylistWindow` — playlist for media library tracks
- `MediaLibraryWindow` — Winamp media library reskin of the asset browser
- `WinampAnchorDetail` — per-anchor detail floating window

## Assets inventory

| Asset | Location | Count / size |
|---|---|---|
| Tahoma font | `public/fonts/aim/tahoma.ttf` + `tahoma-bold.ttf` (shared with AIM bundle) | ~700 KB total |
| DSEG7 LCD font | `public/fonts/winamp/DSEG7Classic-Regular.woff2` | ~30 KB |
| Milkdrop visualizer | `public/video/winamp-visualizer.mp4` | ~12 MB looping mp4 |

Total weight: ~12 MB, dominated by the Milkdrop video.

## Cascade pitfalls

- `[data-theme="winamp"] button` applies the metallic gradient and box-shadow to ALL buttons. Ghost/transparent buttons need explicit overrides.
- `[data-theme="winamp"] svg` adds a drop-shadow filter to ALL SVGs. Data-visualization SVGs may need `filter: none`.
- `[data-theme="winamp"] input/select` forces the dark navy background with `!important`. Contextual overrides require `!important`.
- The CollapsibleSection tab module measures DOM width via ResizeObserver — CSS-only changes to the `.winamp-folder-tab` padding require a full page reload to retrigger measurement (see `.cursor/rules/winamp-tab-chrome-layers.mdc`).

## Lifting to another project

The bundle is mostly self-contained, with one cross-bundle font dependency (Tahoma — see Typography note above).

```bash
cp -r themes/winamp/                DEST/themes/winamp/
cp -r public/fonts/winamp/          DEST/public/fonts/winamp/    # DSEG7 LCD font
cp -r public/fonts/aim/             DEST/public/fonts/aim/       # Tahoma (shared with AIM bundle)
cp -r public/video/                 DEST/public/video/           # Milkdrop visualizer mp4
cp    themes/_shared/tokens.ts      DEST/themes/_shared/tokens.ts
cp    themes/_shared/capabilities.ts DEST/themes/_shared/capabilities.ts
```

If lifting Winamp without AIM, also extract the Tahoma `@font-face` block from `themes/xX_sCeNeIt_Xx/decorations.css` (top of file) and add it to the top of the lifted Winamp `decorations.css`.

Then at app startup:

```ts
import { applyUITheme, THEME_WINAMP } from "@/themes";
applyUITheme(THEME_WINAMP);
```

Plus:

```css
@import "themes/winamp/decorations.css";
```

What you get:
- Tokens (brushed steel + navy LCD)
- ~19 SVG icons (`WINAMP_ICON_MAP`) + DSEG7 LCD font
- Full Winamp shells: `WinampDesktop`, `WinampFloatingWindow`, `MilkdropBackground`, `CollapsibleSection` (with the SVG tab-module variant), plus the panel-specific shells in `components/viewer/panels/Winamp*`
- Window manager (vertical docking groups, the original Winamp model)

WinampDesktop hardcodes viewer-specific window IDs (`viewport`, `media-library`, `player`, `playlist-list`, `paths`, `camera`, `ar-overlay`, `post-proc`, `timeline`) — for a different application, parameterize that map. The CollapsibleSection tab-module is reusable but tightly tied to this codebase's panel system; lifting requires rewriting the host components.

See [.cursor/rules/winamp-panel-layers.mdc](../../.cursor/rules/winamp-panel-layers.mdc), [winamp-tab-chrome-layers.mdc](../../.cursor/rules/winamp-tab-chrome-layers.mdc), and [winamp-player-notch-layers.mdc](../../.cursor/rules/winamp-player-notch-layers.mdc) for in-depth visual layer documentation.
