# Cross-Theme CSS Cascade Pitfalls

When adding new components or modifying existing ones, be aware of these theme-level rules that can cause regressions.

## Win95

- `[data-theme="win95"] *` forces `font-size: 13px`, `font-weight: 500`, and `border-radius: 0` on ALL elements via `!important`. New components needing different sizes/weights must add explicit overrides.
- `[data-theme="win95"] svg` forces ALL SVGs to 16x16 and black. Non-icon SVGs (charts, canvases, overlays) must carry an opt-out class: `.win95-svg-exempt`, `.w-full`, `.pointer-events-none`, or be inside `.win95-inset`. See the exemption rule in `themes/win95/decorations.css`.
- `[data-theme="win95"] button` applies gray bg, black text, and `min-height: 26px` to every button. Invisible/ghost buttons need explicit overrides.
- `[data-theme="win95"] *` resets `scrollbar-width`/`scrollbar-color` to initial with `!important` (for WebKit pseudo-element scrollbars).

## Winamp

- `[data-theme="winamp"] button` applies a metallic gradient and box-shadow to ALL buttons. Ghost/transparent buttons need overrides.
- `[data-theme="winamp"] svg` adds a drop-shadow filter to ALL SVGs. Data visualization SVGs may need `filter: none` overrides.
- `[data-theme="winamp"] input/select` forces dark navy background with `!important`. Contextual color overrides won't work without `!important`.

## All Themes

- `[class*="tracking-wider"]` is used as a proxy selector for section headers. Do NOT use the `tracking-wider` Tailwind class on non-header elements, as it will receive full title-bar styling (navy bg for Win95, dark gradient for Winamp).
- Canvas drawing colors (`MinimapView`, `GraphEditor`) are defined in per-theme lookup maps (`CANVAS_COLORS`, `GRAPH_COLORS`). Add entries for any new theme.
- Fonts are loaded via Google Fonts `<link>` in `app/layout.tsx`. Font stacks use literal font names (e.g. `'Inter'`), NOT `var(--font-inter)`.
