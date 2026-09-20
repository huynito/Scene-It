# default — "Scene It"

Modern dark UI with zinc surfaces and a teal accent. The baseline theme — clean, calm, content-focused. Inspired by zinc/teal Tailwind palettes and contemporary creative tools.

## Identity

Quiet, recessive, content-first. The interface gets out of the way so the gaussian splat scene takes the foreground. Dark backgrounds reduce eye fatigue during long editing sessions. Teal as the accent reads as both technical and approachable.

## Tokens

Defined in [tokens.ts](tokens.ts) — the `THEME_DEFAULT` object.

| Token | Value | Notes |
|---|---|---|
| `sfBase` | `#09090b` | Deepest surface (zinc-950) — body background |
| `sfPrimary` | `#18181b` | Standard panel surface (zinc-900) |
| `sfRaised` | `#27272a` | Elevated surface (zinc-800) — controls, hover states |
| `sfBorder` | `#27272a` | Standard borders (zinc-800) |
| `sfBorderSecondary` | `#3f3f46` | Brighter borders (zinc-700) |
| `txPrimary` | `#f4f4f5` | Primary text (zinc-100) |
| `txSecondary` | `#a1a1aa` | Secondary text (zinc-400) |
| `txMuted` | `#71717a` | Muted/disabled (zinc-500) |
| `txFaint` | `#52525b` | Very low contrast (zinc-600) |
| `ac300/400/500/600` | `#5eead4`, `#2dd4bf`, `#14b8a6`, `#0d9488` | Teal scale (Tailwind teal-300..600) |
| `borderRadius` | `8px` | Soft rounded corners |
| `panelShadow` | layered drop shadow | Subtle depth |
| `glow` | `transparent` | No glow effect |

## Typography

| Use | Family | Source |
|---|---|---|
| UI | Inter | Google Fonts (loaded in [app/layout.tsx](../../app/layout.tsx)) |
| Mono | system stack — `ui-monospace`, SF Mono, Menlo, Consolas | OS-native |

Inter is a clean geometric sans suited to small UI text. The mono stack falls back to whatever the user's OS provides — no custom mono font is loaded for the default theme.

## Iconography

Lucide React icons rendered as outline SVGs at 16px. No custom icon set — `<ThemeIcon icon={Plus} />` falls through to the original Lucide component.

## Capabilities

| Capability | Value |
|---|---|
| `layoutShell` | `stacked` |
| `iconStyle` | `lucide` |
| `checkboxStyle` | `default` (rounded pill toggle) |
| `sliderStyle` | `default` |
| `sectionHeaderStyle` | `default` (uppercase tracking-wider with top border) |
| `isSkeuomorphic` | `false` |
| `usesTextControls` | `false` |
| `hasSounds` | `false` |
| `hasMilkdropBackground` | `false` |
| `hasTutorial` | `true` (only theme that triggers the tutorial overlay) |
| `anchorPalette` | `hsl` (hue-spaced color picker) |

## Primitives

All standard primitives apply unchanged: `Button`, `Panel`, `IconButton`, `Slider`, `ThemeToggle`, `SectionHeader`, `ThemeIcon`. They consume the token-driven Tailwind utilities and adapt automatically.

## Shell components

None. Default uses the standard flex column layout in [app/page.tsx](../../app/page.tsx) and shares the layout with `win95` and `sciin_it`.

## Assets inventory

None — Inter loads from Google Fonts, mono stack is OS-native, icons are from `lucide-react`. Total weight added by this theme: zero asset bytes.

## Cascade pitfalls

None specific to this theme. The default theme also adds two text-size consolidation rules in `decorations.css`:

```css
[data-theme="default"] [class*="text-\[11px\]"] { font-size: 12px; }
[data-theme="default"] [class*="text-\[9px\]"]  { font-size: 10px; }
```

Aim is to consolidate the type scale to 8/10/12/14 px steps.

## Lifting to another project

Trivial. This is the baseline of the design system — no assets, no shells, just tokens.

```bash
cp -r themes/default/               DEST/themes/default/
cp    themes/_shared/tokens.ts      DEST/themes/_shared/tokens.ts
cp    themes/_shared/capabilities.ts DEST/themes/_shared/capabilities.ts
```

Then at app startup:

```ts
import { applyUITheme, THEME_DEFAULT } from "@/themes";
applyUITheme(THEME_DEFAULT);
```

Plus:

```css
@import "themes/default/decorations.css";
```

And add the Tailwind preset for the token-to-utility bridge (mirror [tailwind.config.ts](../../tailwind.config.ts) lines 11-37) plus a `<link>` to Google Fonts for Inter.

Total weight added: zero asset bytes.
