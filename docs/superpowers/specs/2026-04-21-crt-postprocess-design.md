# CRT Post-Process Design — Drone Defense

**Date:** 2026-04-21
**Status:** Approved via brainstorm
**Scope:** A single final-pass canvas overlay that adds retro CRT feel: horizontal scanlines + radial vignette. Drawn after everything else including win/lose overlays.

## Out of scope

- Chromatic aberration (STYLE.md marks as optional; skip for MVP)
- Screen curvature (forbidden by STYLE.md — hurts readability)
- Heavy bloom (forbidden)
- Per-frame moving noise (forbidden — distracting)
- CSS-filter alternative (picked canvas-based for pixel-grid alignment)
- Settings toggle for enable/disable (one config constant would be nice but out of scope for v1)

---

## Design thesis alignment

From STYLE.md core principles:
- "Retro arcade aesthetic. Pixel art, bold colors, CRT vibes. Think early-90s arcade cabinet meets modern command console."
- "Subtle — enhances mood without obscuring gameplay."

The CRT pass is the final step that closes the visual loop. Low-cost implementation; high aesthetic ROI.

---

## Architecture

Single new module `src/ui/crt.js` with one exported function `renderCRT(ctx)`. Called last in `main.js` `frame()` — after win/lose overlays, after everything. No state, no dependencies beyond CONFIG.

### File layout

```
src/
  main.js          MODIFIED — import renderCRT, call last in frame()
  ui/
    crt.js         NEW — renderCRT(ctx) draws scanlines + vignette
DECISIONS.md        MODIFIED — log CRT decisions
TODO.md             MODIFIED — check off Step 9 (partial — CRT done, real sprites still pending)
PLAYTESTS.md        MODIFIED — session entry
```

---

## Rendering

### Constants (in `src/ui/crt.js`)

```js
const SCANLINE_ALPHA = 0.15;
const SCANLINE_SPACING = 2;          // px between scanline tops
const VIGNETTE_CORNER_ALPHA = 0.20;
```

### renderCRT implementation

```js
import { CONFIG } from '../config.js';

const SCANLINE_ALPHA = 0.15;
const SCANLINE_SPACING = 2;
const VIGNETTE_CORNER_ALPHA = 0.20;

export function renderCRT(ctx) {
  const w = CONFIG.virtualWidth;
  const h = CONFIG.virtualHeight;

  ctx.save();

  // Scanlines: 1-pixel-tall horizontal strips at every other row
  ctx.globalAlpha = SCANLINE_ALPHA;
  ctx.fillStyle = CONFIG.colors.bgDark;
  for (let y = 0; y < h; y += SCANLINE_SPACING) {
    ctx.fillRect(0, y, w, 1);
  }

  // Vignette: radial gradient from transparent center to bgDark at corners
  const centerX = w / 2;
  const centerY = h / 2;
  const innerRadius = Math.min(centerX, centerY) * 0.5;   // center stays clear
  const outerRadius = Math.hypot(centerX, centerY);        // reach corners
  const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  gradient.addColorStop(0, 'rgba(13, 27, 42, 0)');         // bgDark at 0 alpha
  gradient.addColorStop(1, `rgba(13, 27, 42, ${VIGNETTE_CORNER_ALPHA})`);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}
```

Notes:
- `ctx.save()/restore()` wraps the full function to avoid leaking `globalAlpha` / `fillStyle` state (same pattern established in loseOverlay/winOverlay final-review fix).
- Vignette hex `#0d1b2a` (bgDark) is duplicated in the `rgba()` string because gradient stops require RGBA strings, not named palette refs. Not a style-guide violation — it's a derived representation.
- Scanlines use `ctx.fillRect` per-row; at 270 rows × 60fps = 16,200 rect calls/sec — trivial.

---

## Integration

### main.js imports

Add below existing ui imports:

```js
import { renderCRT } from './ui/crt.js';
```

### main.js render order

Current end of `frame(tMs)`:

```js
renderWinOverlay(ctx, gameState);
```

Add:

```js
renderWinOverlay(ctx, gameState);
renderCRT(ctx);
```

CRT is the absolute last thing rendered per frame.

---

## Render-order rationale

STYLE.md: "Apply as final overlay."

Two ways to read "final":
1. After all gameplay but BEFORE win/lose overlays → overlay text renders over the CRT effect, looks crisper.
2. After everything including overlays → scanlines + vignette cover overlays too, unified look.

Going with **(2)** per the STYLE.md phrasing. At 15% scanline alpha and 20% vignette corner alpha, overlay text remains readable. If playtest reveals readability issues, flipping to (1) is a single-line move in `main.js`.

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve`, load page. Entire viewport now has subtle horizontal scanlines and a dark vignette at the corners.
2. Scanlines should be barely noticeable on bright elements (amber charge bars, cyan defense sprites, white text) — enough to read as "CRT" without obscuring detail.
3. Vignette should darken the four corners of the canvas but keep the center clean — no halo around the map region, no hard edge.
4. Prep phase: chevrons still visible, icons still readable.
5. Active phase: drones, projectiles, beams, explosions all legible.
6. Win/lose overlays: CITY HELD / DEFENSE FAILED text remains crisp and legible under the CRT pass.
7. No performance regression: FPS should stay at 60 on a reasonable browser.
8. No console errors.

---

## Queued doc updates

- `DECISIONS.md` — log: CRT as final canvas pass (not CSS filter); scanline alpha 0.15 at 2 px spacing; vignette alpha 0.20 at corners via radial gradient; bgDark as the scrim color for both; CRT renders AFTER overlays (overlay text at 16 px Press Start 2P stays readable).
- `TODO.md` — flip Step 9 to partial complete; note real sprites + sounds still pending.
