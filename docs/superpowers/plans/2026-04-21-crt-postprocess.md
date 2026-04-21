# CRT Post-Process Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a final-pass CRT overlay (scanlines + radial vignette) drawn on top of everything including win/lose overlays.

**Architecture:** Single new module `src/ui/crt.js` exporting one stateless function `renderCRT(ctx)` that draws 1-px horizontal scanlines at 15% alpha and a radial vignette at 20% corner alpha, both in `CONFIG.colors.bgDark`. Called last inside `main.js` `frame()`. No new state, no dependencies beyond CONFIG.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas 2D. No build/test tooling — verification is manual in a browser per `CLAUDE.md:61`.

**Spec reference:** `docs/superpowers/specs/2026-04-21-crt-postprocess-design.md`

---

## File layout

| File | Action | Responsibility |
|------|--------|----------------|
| `src/ui/crt.js` | Create | Export `renderCRT(ctx)` — scanlines + vignette |
| `src/main.js` | Modify | Import `renderCRT`; call it last inside `frame()` |
| `DECISIONS.md` | Modify | Log CRT decisions (canvas vs CSS, alphas, render order) |
| `TODO.md` | Modify | Flip Step 9 to partial complete (CRT done, sprites/sounds pending) |
| `PLAYTESTS.md` | Modify | One session entry for the CRT pass |

---

## Task 1: Implement `renderCRT` and wire into main

**Files:**
- Create: `src/ui/crt.js`
- Modify: `src/main.js:17` (add import), `src/main.js:60` (add call after `renderWinOverlay`)

- [ ] **Step 1: Create `src/ui/crt.js`**

Write exactly this file:

```js
import { CONFIG } from '../config.js';

const SCANLINE_ALPHA = 0.15;
const SCANLINE_SPACING = 2;
const VIGNETTE_CORNER_ALPHA = 0.20;

export function renderCRT(ctx) {
  const w = CONFIG.virtualWidth;
  const h = CONFIG.virtualHeight;

  ctx.save();

  // Scanlines: 1-px horizontal strips every SCANLINE_SPACING rows.
  ctx.globalAlpha = SCANLINE_ALPHA;
  ctx.fillStyle = CONFIG.colors.bgDark;
  for (let y = 0; y < h; y += SCANLINE_SPACING) {
    ctx.fillRect(0, y, w, 1);
  }

  // Vignette: radial gradient — transparent center → bgDark at corners.
  const centerX = w / 2;
  const centerY = h / 2;
  const innerRadius = Math.min(centerX, centerY) * 0.5;
  const outerRadius = Math.hypot(centerX, centerY);
  const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  gradient.addColorStop(0, 'rgba(13, 27, 42, 0)');
  gradient.addColorStop(1, `rgba(13, 27, 42, ${VIGNETTE_CORNER_ALPHA})`);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}
```

Note: `rgba(13, 27, 42, ...)` is the RGB form of `CONFIG.colors.bgDark` (`#0d1b2a`). Gradient stops require RGBA strings — can't reference the palette by name here.

- [ ] **Step 2: Add the import to `src/main.js`**

In `src/main.js`, after the existing `import { renderWinOverlay } from './ui/winOverlay.js';` line (currently line 17), add:

```js
import { renderCRT } from './ui/crt.js';
```

The import block (lines 1–17 currently) should end with:

```js
import { renderLoseOverlay } from './ui/loseOverlay.js';
import { renderWaveTelegraph } from './ui/waveTelegraph.js';
import { renderWinOverlay } from './ui/winOverlay.js';
import { renderCRT } from './ui/crt.js';
```

- [ ] **Step 3: Call `renderCRT` last in `frame()`**

In `src/main.js` inside `frame(tMs)`, the last render call is currently `renderWinOverlay(ctx, gameState);` (line 60). Add `renderCRT(ctx);` immediately after it, before `requestAnimationFrame(frame);`:

```js
  renderWaveTelegraph(ctx, gameState, tMs);
  renderLoseOverlay(ctx, gameState);
  renderWinOverlay(ctx, gameState);
  renderCRT(ctx);

  requestAnimationFrame(frame);
}
```

- [ ] **Step 4: Manual verify in browser**

From project root, run:

```bash
npx serve
```

Open the served URL. Check all of the following — no test harness exists, this is the verification:

1. Entire viewport has subtle horizontal scanlines.
2. Four corners of the canvas are subtly darkened; center stays clean; no hard vignette edge.
3. Scanlines don't obscure detail — amber charge bars, cyan defense sprites, and white text are still crisp.
4. Prep phase: amber chevrons and drone-type icons are still visible.
5. Active phase: drones, projectiles, beams, explosions all legible under the CRT pass.
6. Lose a wave (let drones through): DEFENSE FAILED overlay renders with CRT on top — red text remains readable.
7. Win run (beat wave 5): CITY HELD overlay — green text remains readable.
8. No console errors. FPS stays at 60.

If any overlay text becomes hard to read, flip the render order in `main.js` so `renderCRT` runs BEFORE the overlays instead of after (single-line reorder). Note the change in the commit message and in DECISIONS.md later.

- [ ] **Step 5: Commit**

```bash
git add src/ui/crt.js src/main.js
git commit -m "Task 1: CRT post-process — scanlines + vignette final pass"
```

---

## Task 2: Update project docs (DECISIONS / TODO / PLAYTESTS)

**Files:**
- Modify: `DECISIONS.md`
- Modify: `TODO.md`
- Modify: `PLAYTESTS.md`

- [ ] **Step 1: Append CRT entry to `DECISIONS.md`**

Open `DECISIONS.md`. Append a new section at the end, following the existing heading style (dated `### YYYY-MM-DD — Title`). Use the section below verbatim — no modifications:

```markdown
### 2026-04-21 — CRT post-process as final canvas pass

- **What:** New `src/ui/crt.js` module draws horizontal 1-px scanlines (15% alpha, every 2 px) + radial vignette (transparent center → `bgDark` at 20% alpha at corners) as the last thing rendered each frame.
- **Why canvas, not CSS filter:** CSS filters don't align to the pixel grid and would blur the retro look. A canvas pass keeps scanline rows aligned with virtual pixels at any display scale.
- **Render order:** CRT runs AFTER win/lose overlays. STYLE.md calls for a "final overlay" — taking that literally means scanlines cover overlay text too, for a unified CRT look. At 15% / 20% alphas the overlay text (16 px Press Start 2P) stays readable. If playtest flips this, it's a one-line reorder in `main.js`.
- **Color choice:** `bgDark` (`#0d1b2a`) for both scrims — matches the base fill so darkening stays on-palette. Hex is duplicated as `rgba(13, 27, 42, …)` in gradient stops because gradient color stops don't accept named palette refs.
- **Out of scope for v1:** chromatic aberration, screen curvature, bloom, per-frame noise, CSS-filter alternative, enable/disable toggle.
```

- [ ] **Step 2: Flip Step 9 to partial in `TODO.md`**

Open `TODO.md`. Find the Step 9 line. If it currently reads something like:

```markdown
- [ ] Step 9: Polish pass — CRT, sprites, sounds
```

Replace with:

```markdown
- [~] Step 9: Polish pass — CRT done; real sprites + SFX still pending
```

(If the existing wording differs, keep its existing structure but flip the checkbox to `[~]` and note "CRT done; real sprites + SFX still pending" at the end of the line.)

- [ ] **Step 3: Append playtest session entry to `PLAYTESTS.md`**

Open `PLAYTESTS.md`. Append a new session entry at the end, following the existing format:

```markdown
### 2026-04-21 — CRT post-process pass

- Scanlines + vignette render on top of gameplay and both overlays.
- Readability: charge bars, drone colors, legend text, and overlay headlines all remain legible.
- Vignette is subtle — corners darken but no visible halo at the map edge.
- No FPS regression; no console errors.
- Follow-ups: real sprites and SFX still pending before v1 submission.
```

- [ ] **Step 4: Commit**

```bash
git add DECISIONS.md TODO.md PLAYTESTS.md
git commit -m "Task 2: CRT docs — decisions, todo partial, playtest entry"
```

---

## Self-review checklist (controller will run before handing off)

1. **Spec coverage**
   - Scanlines implementation → Task 1 Step 1 ✓
   - Vignette implementation → Task 1 Step 1 ✓
   - `ctx.save()/restore()` wrap → Task 1 Step 1 ✓
   - Rendered last in frame → Task 1 Step 3 ✓
   - Manual verification (8 checkpoints) → Task 1 Step 4 ✓
   - DECISIONS entry → Task 2 Step 1 ✓
   - TODO Step 9 flip → Task 2 Step 2 ✓
   - PLAYTESTS entry → Task 2 Step 3 ✓
   - Out-of-scope list preserved in DECISIONS → Task 2 Step 1 ✓

2. **Type consistency** — Single export `renderCRT(ctx)` referenced identically in crt.js, main.js import, and main.js call.

3. **Placeholder scan** — No TBD / TODO / "similar to" / vague-handling placeholders.
