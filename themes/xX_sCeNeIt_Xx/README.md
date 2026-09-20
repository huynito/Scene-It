# xX_sCeNeIt_Xx — AOL Instant Messenger / Windows XP Luna

The complete AOL Instant Messenger + Windows XP Luna Blue chrome experience. XP Bliss desktop wallpaper, blue Luna gradient titlebars, AIM "Buddy List" reskin of the anchor sidebar, animated AIM emoticon picker, AIM sound effects on every interaction, draggable+resizable XP-style floating windows, AIM "warning level" status bar, send-as-instant-message viewport metaphor.

The wildest theme in the codebase. The id `xX_sCeNeIt_Xx` mirrors the AIM screen-name conventions of the era.

## Identity

The XP/AIM era of personal computing transposed onto a 3D scene editor. Anchors become "buddies" in an AIM Buddy List sidebar. The viewport is rendered inside an AIM chat window between two animated avatar buddies. There's a formatting toolbar above the chat input. There's an emoji picker with 16 animated AIM emoticons. There's a "Free Icons & More" link. There's an XP taskbar at the bottom with a Start button and a clock. The whole thing sits on top of the Bliss wallpaper.

Sound effects play on every meaningful interaction:
- New anchor: door-open
- Delete anchor: door-slam
- Add media: I-just-got-mail
- Path playback start: I'm-typing
- App load: AIM "Welcome!"
- App close: AIM "Goodbye!"

## Tokens

Defined in [tokens.ts](tokens.ts) — the `THEME_AIM` object.

| Token | Value | Notes |
|---|---|---|
| `sfBase` | `#3A6EA5` | XP Luna desktop blue |
| `sfPrimary` | `#ECE9D8` | XP "Bliss" cream — the standard control panel surface |
| `sfRaised` | `#FFFFFF` | White lift state |
| `sfBorder` | `#7F9DB9` | XP medium-blue border |
| `sfBorderSecondary` | `#ADB2B5` | Mid-gray border |
| `txPrimary` | `#000000` | Black text on cream |
| `txSecondary` | `#333333` | Slightly lifted |
| `txMuted` | `#666666` | Mid-gray |
| `txFaint` | `#999999` | Faint state |
| `ac300/400/500/600` | `#4A90D9`, `#2266BB`, `#0055CC`, `#003D99` | XP/AIM blue accent scale |
| `borderRadius` | `3px` | Subtle XP-era softening |
| `panelShadow` | layered drop shadow | Standard XP window shadow |
| `glow` | `transparent` | No glow |

## Typography

| Use | Family | Source |
|---|---|---|
| UI | Tahoma | Self-hosted in `public/fonts/aim/tahoma.ttf` + bold variant; loaded via `@font-face` at the top of [decorations.css](decorations.css) |
| Mono | Courier New | OS-native |

Tahoma is the authentic XP/AIM UI font. The Winamp theme also references `public/fonts/aim/` for Tahoma since both eras shared the font; if lifting only Winamp you'd want to relocate Tahoma into a winamp-specific path.

## Iconography

[icons.tsx](icons.tsx) — entirely PNG-based, served from `public/icons/aim/`. ~84 PNGs total covering:

- **Standard 16x16 icons** for the icon dispatcher (`AIM_ICON_MAP`): play, pause, plus, X, palette, film, crosshair, chevrons, copy, check, circle, shield, etc. Rendered with `imageRendering: pixelated` for that authentic 96 DPI bitmap feel.
- **Header 32x32 icons** (`AIM_HEADER_ICON_MAP`): buddy, folder, computer, solitaire, paint, mesh — for section headers.
- **AIM-specific icons**: `AimRunningMan`, `AimBuddyOnline/Away/Offline`, `AimSendMan`, `AimWarn`, `AimBlock`, `AimExpressions`, `AimGames`, `AimVideo`, `AimTalk`, `AimGetInfo`, `AimAddBuddy`, `AimResetCamera`, `AimTrash`, `AimCloseX`.

A subset of icons (`AimWarn`, `AimBlock`, `AimExpressions`, `AimSendMan`, etc.) gets `imageRendering: auto` instead of `pixelated` because they were rendered at higher resolution and need anti-aliasing to look right — the `shouldSmoothAimIcon()` function in [icons.tsx](icons.tsx) flags these.

Plus 16 animated AIM emoticons (smiling, winking, money-mouth, embarrassed, etc.) in `public/icons/aim/emoji/`, used in the chat input emoji picker rendered in [app/page.tsx](../../app/page.tsx).

## Sounds

[sounds.ts](sounds.ts) defines `useAimSounds()` which gates all sound playback to the active theme:

| Sound | When |
|---|---|
| `welcome.wav` | App load (AIM "Welcome!") |
| `goodbye.wav` | App close (AIM "Goodbye!") |
| `dooropen.wav` | Add anchor / open buddy info |
| `doorslam.wav` | Delete anchor |
| `imsend.wav` | Path playback start |
| `imrcv.wav` / `newmail.wav` | Receive UI event |
| `gotmail.wav` | Add media |
| `filedone.wav` | Export complete |
| `moo.wav` | Used as easter-egg sound |

15 WAV files in total, served from `public/sounds/`.

## Capabilities

| Capability | Value | Effect |
|---|---|---|
| `layoutShell` | `xp-desktop` | Triggers `<XPDesktopLayout>` early-return in [app/page.tsx](../../app/page.tsx) |
| `iconStyle` | `aim-png` | `<ThemeIcon>` looks up `AIM_ICON_MAP` (or `AIM_HEADER_ICON_MAP` if `header` prop set) |
| `checkboxStyle` | `aim-toggle` | Rounded XP-style toggle with blue checkmark |
| `sliderStyle` | `default` | XP-styled via CSS |
| `sectionHeaderStyle` | `aim-titlebar` | Section headers render as XP titlebar gradient strips |
| `isSkeuomorphic` | `true` | Triggers shared "skeuomorphic" branches in `PathPanel`, etc. |
| `hasSounds` | `true` | All AIM sound effects fire on UI events |
| `anchorPalette` | `xp-paint` | Anchors cycle through the XP Paint palette |

## Primitives

- `ThemeToggle` renders a rounded XP toggle with a blue check SVG inside (capability `aim-toggle`)
- `ThemeIcon` consults `AIM_ICON_MAP` (or `_HEADER_` variant)
- All buttons get the XP raised gradient via `[data-theme="xX_sCeNeIt_Xx"] button`

## Shell components

[shells/index.ts](shells/index.ts) exports the full XP/AIM shell suite, all bundle-local:

- [`XPDesktop`](shells/XPDesktop.tsx) — top-level layout with `WindowManagerProvider`, Bliss wallpaper, taskbar
- [`XPTaskbar`](shells/XPTaskbar.tsx) — the bottom Start-button + clock taskbar
- [`FloatingWindow`](shells/FloatingWindow.tsx) — XP-styled draggable+resizable+min/max/close window
- [`AIMBuddyList`](shells/AIMBuddyList.tsx) — AIM Buddy List reskin of the anchor sidebar with category sections, online/away/offline status, "warning level" status bar, expandable buddy info popovers
- [`AIMBuddyInfo`](shells/AIMBuddyInfo.tsx) — per-buddy info popover (anchor metadata, target/leash status)
- [`AIMPreferences`](shells/AIMPreferences.tsx) — tabbed preferences dialog in the AIM style
- [`MapQuestMinimapShell`](shells/MapQuestMinimapShell.tsx) — MapQuest-themed minimap chrome (header logo, edit/pen/walk tool buttons, directional pad, +/- zoom, status bar). Wraps the parent's canvas + state.
- [`AimEmojiPicker`](shells/AimEmojiPicker.tsx) — 16-emoji popover for the chat input that inserts an `<img>` into the contentEditable via `execCommand`
- [`AimSessionLifecycle`](shells/AimSessionLifecycle.tsx) — invisible component that plays the AIM "Welcome!" sound on mount and "Goodbye!" on unmount. Mounted as a child of `XPDesktop` so it activates only when the AIM layout is in use.

Plus the [window-manager.tsx](window-manager.tsx) — a separate window manager from Winamp's, with focus-bring-to-front and minimize tray (the original XP/AIM model).

## Assets inventory

| Asset | Location | Count / size |
|---|---|---|
| AIM PNG icons | `public/icons/aim/` | ~84 PNGs (includes the XP titlebar flag, MapQuest logo, login banner, etc.) |
| AIM emoji animations | `public/icons/aim/emoji/` | 16 animated PNGs |
| AIM sound effects | `public/sounds/aim/` | 15 WAVs (~308 KB total) |
| Buddy avatars | `public/avatars/buddy-a/` + `buddy-b/` | 32 animated GIFs (~184 KB total) |
| XP Bliss wallpaper | `public/xp-bliss.png`, `xp-bliss-hires.jpg` | ~few hundred KB |
| Tahoma fonts | `public/fonts/aim/tahoma.ttf` + `tahoma-bold.ttf` | ~700 KB |

Total weight: ~1.5-2 MB — substantial because of the audio + animated assets.

## Cascade pitfalls

None unique to this theme that would break other components. The XP-styled buttons and inputs use specificity rather than `!important`, so contextual overrides work as expected.

The XP Desktop layout is a complete early-return path in `app/page.tsx` (line ~588) — if you're adding a new top-level UI element, consider whether it needs to appear in the XP Desktop layout too.

## Lifting to another project

The bundle is now self-contained. The lift unit:

```bash
cp -r themes/xX_sCeNeIt_Xx/         DEST/themes/xX_sCeNeIt_Xx/
cp -r public/icons/aim/             DEST/public/icons/aim/      # ~84 icons + emoji subfolder
cp -r public/fonts/aim/             DEST/public/fonts/aim/      # tahoma + tahoma-bold
cp -r public/sounds/aim/            DEST/public/sounds/aim/     # 15 WAVs
cp -r public/avatars/               DEST/public/avatars/        # 32 GIFs
cp    public/xp-bliss.png           DEST/public/                # wallpaper (and -hires.jpg if used)
cp    themes/_shared/tokens.ts      DEST/themes/_shared/tokens.ts
cp    themes/_shared/capabilities.ts DEST/themes/_shared/capabilities.ts
cp    themes/_shared/anchor-colors.ts DEST/themes/_shared/anchor-colors.ts  # for xp-paint palette
```

Then at app startup:

```ts
import { applyUITheme, THEME_AIM } from "@/themes";
applyUITheme(THEME_AIM);
```

And ensure your global stylesheet includes the bundle's decorations:

```css
@import "themes/xX_sCeNeIt_Xx/decorations.css";
```

What you get:
- Tokens (XP Luna blue + cream)
- 84 PNG icons + 16 emoji + Tahoma `@font-face`
- 15 AIM sound effects (gated by `useAimSounds()` on `cap.id === "xX_sCeNeIt_Xx"`)
- All XP/AIM shells: `XPDesktop`, `XPTaskbar`, `FloatingWindow`, `AIMBuddyList`, `AIMBuddyInfo`, `AIMPreferences`, `MapQuestMinimapShell`, `AimEmojiPicker`, `AimSessionLifecycle`
- Window manager (focus-bring-to-front + minimize tray)

Hardest part of integration is `AIMBuddyList` and the chat window in `app/page.tsx` — both heavily reference scene state (anchors as buddies, paths as conversation threads). For non-viewer apps, lift `XPDesktop` + `XPTaskbar` + `FloatingWindow` as the windowing system and write your own application content inside the floating windows.
