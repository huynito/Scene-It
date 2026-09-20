# Scene It — Project Status

## Stack
Next.js 14 (App Router) / TypeScript / PlayCanvas 2.16 (WebGPU) / React Context / Tailwind CSS / mediabunny (WebCodecs video encoding)

## UI Themes
Six skeuomorphic UI themes, each with fully custom CSS, icons, and layout behavior:
- **Scene It** (default) — dark zinc/teal minimal
- **sceneit.exe** (Win95) — pixel-perfect MS Paint aesthetic with raised/sunken bevels, 16-color palette, pixel-art SVG icons
- **scene it.mp3** (Winamp) — free-floating resizable windows over a Milkdrop visualizer background, brushed chrome bevels, spectrum analyzer, DSEG7 LCD clock, Media Library sidebar, Player/Playlist split
- **xX_sCeNeIt_Xx** (AIM/XP) — Windows XP Luna titlebars, AIM buddy list with chat window, emoji picker, authentic sounds, XP Display Properties dialog, taskbar with Start button
- **scēnit** (scenit) — bold teal/pink neo-brutalist floating panels with animated starburst decorations
- **(SCII)n_it** (sciin_it) — CGA terminal aesthetic with health-bar sliders and amber-on-black palette

## Architecture
Three-layer design:
- **State Layer** (`lib/scene-context.tsx`) — React Context holding all scene state, actions, and refs
- **3D Rendering Layer** (`lib/renderers/playcanvas.ts`) — PlayCanvas WebGPU renderer implementing the `SplatRenderer` interface
- **Bridge Layer** (`components/PlyCanvas.tsx`) — connects React state to the renderer via refs

## Version Control & Deployment
Hosted on GitHub Enterprise Server (`ghe.oculus-rep.com`).

**Deployment**: GitHub Pages via `deploy.sh` script. Static export (`output: "export"` in `next.config.js`) produces an `out/` directory with pure static files. Two-tier architecture: app on GitHub Pages (via `NEXT_PUBLIC_BASE_PATH`), large scene assets (PLY/GLB, 180–300+ MB each) uploaded to GHE Releases via `upload-assets.sh` and served via `NEXT_PUBLIC_ASSET_BASE_URL`.

**Dev mode**: `NEXT_PUBLIC_DEV_MODE=true` in `.env.local` (gitignored) enables drag-and-drop scene loading, depth mesh alignment tools, occlusion controls, and collision guardrail UI. Production builds show only the pre-authored scene selector with dev tools hidden.

## Key Systems

### Camera Path System
Keyframes with Catmull-Rom and linear splines, cubic Bezier evaluation, easing functions. Supports partial keying (`keyedChannels`), baked paths, and LookAt events (lock and glance modes). All yaw interpolation uses `shortestAngleLerp`.

### Walk Style Automation (`lib/walk-style.ts`)
Generates camera paths with biomechanical motion (Grieve & Gear 1966). Two-axis preset system (style x speed). Arc-length parameterization for consistent speed. Supports convert-to-walk from manually keyframed paths.

### Render Pipeline — "Direct+" Mode
MSAA 4x, TAA disabled, sharpening disabled, HDR render targets, dithering. Single unified render mode — no user-facing toggle.

### FOV Mask System
AR-representative field-of-view overlay. Five custom render layers enforce compositing order. SDF-based rounded-rectangle shaders (GLSL + WGSL). Dedicated stroke layer renders independently of mask feathering.

### Video Export Pipeline
WebCodecs/mediabunny for H.264+AAC in MP4. Frame-by-frame capture with warm-up frames. GIF seeking via per-frame duration arrays. Save/restore pattern for renderer state.

### Scene Anchors
Media anchors (image/GIF/video) and null anchors. Billboard modes, entrance/exit animations, leashing. FOV clipping via post-anchor masking quad (not shader chunks).

## Known Limitations / Future Work

- **Walk path rotation smoothness on converted paths**: Camera turns can feel abrupt when source keyframes capture large rotations with few keyframes. Multiple approaches attempted but none felt natural. Deferred.
- **TAA and media anchor sharpness**: TAA temporal accumulation (if re-enabled) causes slight softness on anchor media. Currently disabled in Direct+ mode.
