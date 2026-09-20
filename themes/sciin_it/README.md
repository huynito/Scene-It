# sciin_it — "(SCII)n_it"

CGA / DOS terminal aesthetic. Pure ASCII glyphs as icons, monospace everywhere, hash-character borders, snap-to-dot sliders, bracket-text controls. The interface as if it were rendered in 80x25 text mode on an IBM 5150.

## Identity

Roguelike / text-mode UI. Every interactive element renders as a typed character: `[X]` for checkboxes, `[ANCHOR]` for action buttons, `▶` for play, `≡` for menus. The CGA color palette (cyan, magenta, yellow, green) is reserved for active/highlighted state. The look reads as both retro and minimal — there's almost no rendered chrome, just text and characters.

## Tokens

Defined in [tokens.ts](tokens.ts) — the `THEME_SCIIN_IT` object.

| Token | Value | Notes |
|---|---|---|
| `sfBase` | `#0a0a12` | Near-black with cool tint |
| `sfPrimary` | `#10101a` | Slightly lifted dark navy |
| `sfRaised` | `#16161e` | Standard control surface |
| `sfBorder` | `#c8c8dc` | Light gray (high contrast against dark bg) |
| `sfBorderSecondary` | `#8c8ca0` | Mid gray |
| `txPrimary` | `#e8e8e8` | Bright white |
| `txSecondary` | `#d8d8d8` | Slightly dimmer |
| `txMuted` | `#c8c8c8` | Mid gray text |
| `txFaint` | `#b0b0b0` | Faintest text |
| `ac300/400/500/600` | `#FFFF55`, `#FFFF00`, `#cccc00`, `#FFFF00` | CGA bright yellow |
| `borderRadius` | `0px` | All corners are square — text mode has no rounding |
| `panelShadow` | `none` | No depth, just outlines |
| `glow` | `transparent` | No glow |

CGA accent palette (used for anchor colors, channel toggles, syntax highlighting in the UI) lives in [_shared/anchor-colors.ts](../_shared/anchor-colors.ts) as `CGA_PALETTE`:

```
cyan    #00FFFF    yellow    #FFFF55
green   #00FF00    light cyan #55FFFF
yellow  #FFFF00    light green #55FF55
magenta #FF00FF    light red  #FF5555
red     #FF0000    light magenta #FF55FF
blue    #2A2AFF    white      #FFFFFF
```

Custom CSS variables in [decorations.css](decorations.css) expose these as `--rl-cyan`, `--rl-magenta`, `--rl-yellow`, etc., for inline color overrides on text and key indicators.

## Typography

| Use | Family | Source |
|---|---|---|
| UI | Courier New / Courier | OS-native |
| Mono | Courier New / Courier | OS-native |

Strictly monospaced. No custom font is loaded — the OS-native Courier is used so character grid alignment is consistent across platforms.

## Iconography

Pure ASCII / Unicode glyphs in [icons.tsx](icons.tsx). The `ASCII_ICON_MAP` maps Lucide icon names to typed characters:

| Lucide | ASCII |
|---|---|
| `Play` | `▶` |
| `Pause` | `‖` |
| `Square` | `■` |
| `SkipBack` / `SkipForward` | `\|◀` / `▶\|` |
| `Settings` / `Menu` | `≡` |
| `X` / `Trash2` | `×` |
| `Check` | `✓` |
| `Plus` / `Minus` | `+` / `-` |
| `MapPin` | `⊕` |
| `Crosshair` | `+` |
| `Footprints` | `⌇` |
| `Camera` | `◎` |
| `Music` | `♪` |
| `Diamond` | `◆` |
| `Volume2` | `♪)` |
| `Info` | `(i)` |

Rendered inline as `<span>` with `font-family: 'Courier New', monospace` so they sit on the same baseline as text. Total: 60+ mappings.

## Capabilities

| Capability | Value | Effect |
|---|---|---|
| `layoutShell` | `stacked` | Shares flex column layout with default + win95 |
| `iconStyle` | `ascii` | `ThemeIcon` renders `<span>{glyph}</span>` |
| `checkboxStyle` | `sciin-bracket` | `[X]` / `[ ]` text toggle |
| `sliderStyle` | `sciin-snap` | Continuous range that snaps to 25 dot positions |
| `sectionHeaderStyle` | `sciin-terminal` | `── HEADER ──────────` ASCII rule |
| `isSkeuomorphic` | `false` | No bevels |
| `usesTextControls` | `true` | Drives bracket-text controls and KeyHints arrow glyphs (`^`/`<`/`v`/`>`) |
| `hasViewportHUD` | `true` | Camera coords overlaid on viewport `[X:0.42 Y:1.20 Z:-3.14]` |
| `hasSteppedScroll` | `true` | Side panels use stepped scroll behavior (rather than smooth) |
| `anchorPalette` | `cga` | Anchors cycle through CGA_PALETTE |

## Primitives

- `ThemeToggle` renders bracket-text `[X]`/`[ ]` (capability `sciin-bracket`)
- `Slider` snaps to 25 dot positions via `--sciin-dots` CSS background
- `SectionHeader` renders the `── HEADER ────────` ASCII rule pattern
- `ThemeIcon` looks up glyph in `ASCII_ICON_MAP`
- `KeyHints` uses `^`/`<`/`v`/`>` instead of `▲`/`◀`/`▼`/`▶` for arrow keys

## Shell components

[shells/index.ts](shells/index.ts) re-exports:
- `HashBorder` (from [components/ui/HashBorder.tsx](../../components/ui/HashBorder.tsx)) — renders rows/columns of `#` characters that decorate panel boundaries
- `CycleSelect` (from [components/ui/CycleSelect.tsx](../../components/ui/CycleSelect.tsx)) — bracket-style cycler `[VALUE ↻]` for enum properties

The `sciin-viewport-hud` overlay (camera coordinates rendered as a typed-text strip across the top of the viewport) is implemented inline in [app/page.tsx](../../app/page.tsx).

## Assets inventory

None. The theme is pure CSS + Unicode glyphs. Total weight: zero asset bytes.

## Cascade pitfalls

None unique to this theme. The Courier font fallback is OS-native, so character widths may vary slightly between macOS, Windows, and Linux — but the differences are imperceptible at typical UI sizes.

## Lifting to another project

Easy — pure CSS + glyph mapping. No fonts, no images, no sounds.

```bash
cp -r themes/sciin_it/              DEST/themes/sciin_it/
cp    components/ui/HashBorder.tsx  DEST/themes/sciin_it/shells/HashBorder.tsx        # currently lives in components/
cp    components/ui/CycleSelect.tsx DEST/themes/sciin_it/shells/CycleSelect.tsx       # currently lives in components/
cp    themes/_shared/tokens.ts      DEST/themes/_shared/tokens.ts
cp    themes/_shared/capabilities.ts DEST/themes/_shared/capabilities.ts
cp    themes/_shared/anchor-colors.ts DEST/themes/_shared/anchor-colors.ts            # for cga palette
```

Then at app startup:

```ts
import { applyUITheme, THEME_SCIIN_IT } from "@/themes";
applyUITheme(THEME_SCIIN_IT);
```

Plus:

```css
@import "themes/sciin_it/decorations.css";
```

What you get:
- Tokens (CGA terminal palette, courier, no border radius)
- 70+ ASCII/Unicode icon mappings (`ASCII_ICON_MAP`)
- `HashBorder` and `CycleSelect` shells

This is one of the most portable themes in the codebase — no custom fonts, no PNGs, no sounds, no bespoke window managers. Total weight added: zero asset bytes.
