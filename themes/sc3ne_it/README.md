# sc3ne_it — cyberpunk amber-orange (hidden)

Dark cyberpunk terminal with amber-orange accents and a CRT scanline overlay. Currently hidden from the theme picker but kept in the registry.

## Status

This theme is **excluded from `UI_THEMES`** in [../index.ts](../index.ts) and does not appear in the theme picker. It was superseded by [sciin_it](../sciin_it/) (the CGA terminal aesthetic), but the bundle is preserved in case it's revived. See `.cursor/rules/conscious-decisions.mdc` for the rationale.

## Identity

Synthwave/cyberpunk: deep brown-black surfaces, amber-orange accents (`#ff9500`), Share Tech Mono typeface, CRT scanline pseudo-element overlay on the entire viewport. Suggests a 1980s computer terminal viewed through analog CRT glass.

## Tokens

Defined in [tokens.ts](tokens.ts) — the `THEME_CYBERPUNK` object.

| Token | Value | Notes |
|---|---|---|
| `sfBase` | `#050403` | Near-black with warm tint |
| `sfPrimary` | `#080604` | Slightly lifted, still very dark |
| `sfRaised` | `#241b12` | Amber-tinted brown |
| `sfBorder` | `#d26414` | Bright amber border |
| `sfBorderSecondary` | `#aa4b0a` | Darker amber |
| `txPrimary` | `#fff5d2` | Warm cream |
| `txSecondary` | `#ffc850` | Bright amber |
| `txMuted` | `#c8a028` | Dimmer amber |
| `txFaint` | `#8c6e1e` | Olive-amber |
| `ac300/400/500/600` | `#ffc867`, `#ff9500`, `#cc7700`, `#995900` | Amber-orange scale |
| `borderRadius` | `2px` | Sharp corners with very subtle softening |
| `panelShadow` | warm amber glow | `0 0 20px rgba(255,149,0,.08)` |
| `glow` | `rgba(255,149,0,.6)` | Used by tutorial pulse and other glow effects |

## Typography

| Use | Family | Source |
|---|---|---|
| UI | Share Tech Mono | Google Fonts |
| Mono | Share Tech Mono | Google Fonts |

UI and mono are intentionally the same — every character is fixed-width, reinforcing the terminal aesthetic. Falls back to JetBrains Mono / Fira Code if Share Tech Mono is unavailable.

A secondary set of "cyberpunk fonts" (`CYBERPUNK_FONTS` in [tokens.ts](tokens.ts)) was made available for an in-app font picker but is not currently surfaced.

## Iconography

Lucide React icons. No bespoke icon set.

## Capabilities

| Capability | Value |
|---|---|
| `layoutShell` | `stacked` |
| `iconStyle` | `lucide` |
| `checkboxStyle` | `default` |
| `sliderStyle` | `default` |
| `sectionHeaderStyle` | `default` |
| `isSkeuomorphic` | `false` |
| `anchorPalette` | `hsl` |
| Everything else | `false` / default |

The theme is purely a token + CSS overlay swap. No bespoke shells, no behavioral divergences.

## CSS distinctives

[decorations.css](decorations.css) (244 lines) layers on:

- A full-screen CRT scanline pseudo-element via `[data-theme="sc3ne_it"]::after`
- Amber border colors on panels, sliders, scrollbars
- Subtle amber glow on focus/hover states
- Tone-mapped dark backgrounds with warm-shifted shadows

## Shell components

None.

## Assets inventory

None. Share Tech Mono loads from Google Fonts.

## Cascade pitfalls

None specific. The CRT scanline overlay uses `position: fixed; pointer-events: none;` and shouldn't interfere with input handling.

## Lifting to another project

Trivial — same procedure as the default theme.

```bash
cp -r themes/sc3ne_it/              DEST/themes/sc3ne_it/
cp    themes/_shared/tokens.ts      DEST/themes/_shared/tokens.ts
cp    themes/_shared/capabilities.ts DEST/themes/_shared/capabilities.ts
```

Then at app startup:

```ts
import { applyUITheme, THEME_CYBERPUNK } from "@/themes";
applyUITheme(THEME_CYBERPUNK);
```

Plus:

```css
@import "themes/sc3ne_it/decorations.css";
```

And `<link>` Share Tech Mono from Google Fonts. Zero asset bytes added.

## Reviving the theme

To re-expose it in the theme picker, add `THEME_CYBERPUNK` to the `UI_THEMES` array in [../index.ts](../index.ts). No other changes needed.
