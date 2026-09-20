# scenit — "scēnit"

Neubrutalist UI: vibrant teal background, white floating panels with hard 4px black drop shadows, magenta accents, hand-drawn animated SVG decorations (starbursts, squiggles). The theme leans into thick black borders and oversized type.

## Identity

Confident, playful, design-magazine. Think Pentagram-meets-bedroom-coder. Every panel is a paper card on a green grid. Pink-magenta as the active accent reads as bold and decisive — there's no muted state. The handful of animated SVG starbursts and squiggles scattered across the layout add a deliberate hand-crafted tone that contrasts with the otherwise utilitarian editor.

## Tokens

Defined in [tokens.ts](tokens.ts) — the `THEME_SCENIT` object.

| Token | Value | Notes |
|---|---|---|
| `sfBase` | `#00E5CC` | Vivid teal page background |
| `sfPrimary` | `#FFFFFF` | White panel surface |
| `sfRaised` | `#E0FAF6` | Slightly tinted lift state |
| `sfBorder` | `#222222` | Hard black borders |
| `sfBorderSecondary` | `#FF006E` | Magenta accent border |
| `txPrimary` | `#1A3038` | Near-black text on white |
| `txSecondary` | `#2D5058` | Slightly lighter |
| `txMuted` | `#6B9098` | Muted teal-gray |
| `txFaint` | `#A0BCC4` | Faint state |
| `ac300/400/500/600` | `#FF5C9E`, `#FF006E`, `#D4005C`, `#AA004A` | Magenta scale |
| `borderRadius` | `0px` | Hard square corners |
| `panelShadow` | `4px 0 0 #222, 0 4px 0 #222, 4px 4px 0 #222` | Stacked hard offset shadow (no blur) |
| `glow` | `transparent` | No glow |

The page is laid out as a CSS Grid (`scenit-main-grid`) over a green grid-paper background. Each panel is a white card with the stacked hard shadow.

A "highlight mode" feature (`scenit-hl-mode`) lets users toggle between two color schemes for section accents — `cross` (rotating across categories) and `tonal` (within-category color shifts). Stored in `localStorage` as `scenit-hl-mode`. Implemented via `applyScenitHlMode()` in [tokens.ts](tokens.ts).

## Typography

| Use | Family | Source |
|---|---|---|
| UI | Outfit (default), user-selectable | Google Fonts |
| Mono | Space Mono | Google Fonts |

Scenit is the only theme with a user-facing font picker (`SCENIT_FONTS` in [tokens.ts](tokens.ts)):
- Space Grotesk
- Syne
- Outfit (default)
- Bricolage Grotesque
- Archivo Black
- Bebas Neue

Mono picker (`SCENIT_MONO_FONTS`):
- Space Mono
- Azeret Mono
- JetBrains Mono

Selection persists to `localStorage` as `gsv-scenit-font` and is applied via `applyScenitFont()`.

## Iconography

Lucide React icons. No bespoke icon set — the theme uses standard SVG icons since they read clearly against the light backgrounds.

## Capabilities

| Capability | Value |
|---|---|
| `layoutShell` | `scenit-grid` |
| `iconStyle` | `lucide` |
| `checkboxStyle` | `default` |
| `sliderStyle` | `default` |
| `sectionHeaderStyle` | `scenit-collapsible` |
| `isSkeuomorphic` | `false` |
| `anchorPalette` | `hsl` |

## Primitives

Standard primitives. The theme relies almost entirely on Layer A tokens + Layer B CSS for its identity. Section headers in `CollapsibleSection` get the `scenit-collapsible` styling — a chunky title bar with the magenta accent.

## Shell components

[shells/index.ts](shells/index.ts) re-exports:

- `ScenitDecorations` (from [components/ui/ScenitDecorations.tsx](../../components/ui/ScenitDecorations.tsx)) — programmatically generated animated SVG starbursts and squiggles, draggable. ~520 lines of bespoke SVG with morph + spin animations
- `ScenItViewportHeader` (from [components/viewer/ScenItViewportHeader.tsx](../../components/viewer/ScenItViewportHeader.tsx)) — header chrome above the viewport in scenit's grid layout

## Assets inventory

None bundled — fonts load from Google Fonts. Total weight added: zero asset bytes (the SVG decorations are inline).

## Cascade pitfalls

The grid layout uses absolute panel positioning via CSS Grid named areas (`scenit-main-grid`). Adding a new top-level panel requires updating the grid template in [decorations.css](decorations.css). The animated SVG decorations are draggable — keep their `pointer-events: auto` if you want users to be able to move them, otherwise set `none`.

## Lifting to another project

Moderately easy. The bundle is self-contained except that `ScenitDecorations.tsx` and `ScenItViewportHeader.tsx` still live in `components/` (they were never moved into `themes/scenit/shells/`).

```bash
cp -r themes/scenit/                DEST/themes/scenit/
cp    components/ui/ScenitDecorations.tsx DEST/themes/scenit/shells/ScenitDecorations.tsx
cp    components/viewer/ScenItViewportHeader.tsx DEST/themes/scenit/shells/ScenItViewportHeader.tsx
cp    themes/_shared/tokens.ts      DEST/themes/_shared/tokens.ts
cp    themes/_shared/capabilities.ts DEST/themes/_shared/capabilities.ts
```

Then at app startup:

```ts
import { applyUITheme, THEME_SCENIT, applyScenitFont, loadSavedScenitFont, applyScenitHlMode, loadSavedScenitHlMode } from "@/themes";
applyUITheme(THEME_SCENIT);
applyScenitFont(loadSavedScenitFont());
applyScenitHlMode(loadSavedScenitHlMode());
```

Plus:

```css
@import "themes/scenit/decorations.css";
```

And `<link>` the Google Fonts you want available in the picker (Outfit, Space Mono, plus any of the alternates listed under Typography).

What you get:
- Tokens (vivid teal, magenta accents, hard offset shadow)
- User-facing font picker + highlight-mode picker (state in localStorage)
- `ScenitDecorations` (animated SVG starbursts + squiggles, fully self-contained, draggable)
- `ScenItViewportHeader` (header chrome above the viewport in scenit's grid layout)

The grid layout (`scenit-main-grid` in `decorations.css`) is application-specific — you'll define your own grid template. The bones (tokens + offset-shadow panel style + grid background) are very portable.
