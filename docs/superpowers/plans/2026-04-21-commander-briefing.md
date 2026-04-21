# Commander Briefing (Warden) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pre-wave in-character briefings from "Warden" (portrait bust + speech bubble bottom-left), auto-collapsing to a re-expandable tab, plus one-line Warden subtitles on win/lose overlays.

**Architecture:** A single new module `src/ui/briefing.js` owns the portrait cache, speech-bubble drawing, auto-collapse timer, and click-hit test. A new `gameState.briefing` slice holds `{phase, visibleMs, expandedOnce, activeBriefingIndex}`. `updateBriefing()` detects new-wave prep entry by comparing `wave.number - 1` to the stored `activeBriefingIndex`, so no changes to `wave.js` are needed. Each briefing text + portrait key is authored in `CONFIG.waves[i]`. A lightweight validator logs a console warning if a briefing omits any drone type present in that wave.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas 2D. No build or test tooling — verification is manual in a browser per `CLAUDE.md:61`.

**Spec reference:** `docs/superpowers/specs/2026-04-21-commander-briefing-design.md`

---

## File layout

| File | Action | Responsibility |
|------|--------|----------------|
| `src/ui/briefing.js` | Create | Portrait cache, bubble/tab rendering, update timer, click-hit test |
| `src/config.js` | Modify | Add `briefing` + `portrait` field to each wave; add `warden` block; run `validateBriefings()` at load |
| `src/game/state.js` | Modify | Add `briefing` slice to `gameState` + reset in `resetGameState` |
| `src/main.js` | Modify | Call `updateBriefing` + `renderBriefing`; wire click handler |
| `src/ui/loseOverlay.js` | Modify | Render `CONFIG.warden.lose` subtitle under DEFENSE FAILED |
| `src/ui/winOverlay.js` | Modify | Render `CONFIG.warden.win` subtitle under CITY HELD |

No changes to `index.html` — portraits load imperatively via `new Image()` inside `briefing.js`.

---

## Task 1: Data model — config fields, warden block, drift validator

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Add `briefing` + `portrait` fields to each wave entry**

Replace the `waves: [ ... ]` block in `src/config.js` (currently lines 125–160) with:

```js
  // Waves — designed to teach layered-defense thesis through escalation
  // See DESIGN.md "Wave progression" for the teaching arc
  waves: [
    // Wave 1: ISR only — teach placement + soft-kill
    {
      drones: [
        { type: 'isr', count: 5, spawnInterval: 1500 },
      ],
      briefing: "First watch. ISR only — no teeth on 'em, just eyes. Get an RF jammer up north; that breaks their link. Easy start. You got this.",
      portrait: 'neutral',
    },
    // Wave 2: ISR scaled — teach range and coverage
    {
      drones: [
        { type: 'isr', count: 8, spawnInterval: 1200 },
      ],
      briefing: "More ISR, heavier volume this time. Widen your jammer coverage. Don't let 'em slip past on the edges.",
      portrait: 'neutral',
    },
    // Wave 3: RF Jammer breaks on OWA — forces Interceptor purchase
    {
      drones: [
        { type: 'isr', count: 6, spawnInterval: 1200 },
        { type: 'owa', count: 5, spawnInterval: 1800 },
      ],
      briefing: "They're mixing now. ISR north, OWA east. RF won't catch a committed OWA — it's preprogrammed, no link to kill. Interceptors east.",
      portrait: 'stern',
    },
    // Wave 4: Armor appears — forces Laser/HPM purchase
    {
      drones: [
        { type: 'owa', count: 8, spawnInterval: 1200 },
        { type: 'payloadDelivery', count: 3, spawnInterval: 3000 },
      ],
      briefing: "Payload birds inbound west. Those are armored — interceptors'll chip at 'em but laser burns through fast. Keep the east locked down too.",
      portrait: 'stern',
    },
    // Wave 5: Saturation — HPM becomes valuable for crowd control
    {
      drones: [
        { type: 'isr', count: 8, spawnInterval: 1000 },
        { type: 'owa', count: 12, spawnInterval: 800 },
        { type: 'payloadDelivery', count: 4, spawnInterval: 2500 },
      ],
      briefing: "All of it. Saturation run — ISR, OWA, Payload, everything. You need the full stack. HPM earns its keep here. One pulse, many drones. Good luck, Watchfloor.",
      portrait: 'angry',
    },
  ],
```

- [ ] **Step 2: Add the `warden` block**

Immediately after the line `prepTimeBetweenWaves: 15000, ...` (currently line 161), add:

```js
  warden: {
    win: "City held. Good work. Red Cell'll remember this one.",
    winPortrait: 'neutral',
    lose: "They got through. Debrief hurts, but we learn. Again.",
    losePortrait: 'bloody',
    autoCollapseMs: 8000,
  },
```

- [ ] **Step 3: Add the drift validator and call it at module load**

At the very end of `src/config.js`, after the closing `};` of the `CONFIG` object, add:

```js

// Drift check: each wave's briefing text must mention every drone type
// present in that wave. Shallow keyword search; warns on drift at boot.
function validateBriefings() {
  const keyword = { isr: 'ISR', owa: 'OWA', payloadDelivery: 'Payload' };
  for (let i = 0; i < CONFIG.waves.length; i++) {
    const w = CONFIG.waves[i];
    if (!w.briefing) continue;
    const types = new Set(w.drones.map(d => d.type));
    const missing = [];
    for (const t of types) {
      const kw = keyword[t];
      if (!kw) continue;
      if (!w.briefing.includes(kw)) missing.push(kw);
    }
    if (missing.length) {
      console.warn(`[briefing] wave ${i + 1} missing mention of: ${missing.join(', ')}`);
    }
  }
}

validateBriefings();
```

- [ ] **Step 4: Manually verify**

Run:
```bash
npx serve -l 3000
```

Open `http://localhost:3000` in a browser. Open DevTools console. Expected: no warnings.

Then temporarily remove "ISR" from wave 1's briefing text in `src/config.js`, save, reload. Expected console output:
```
[briefing] wave 1 missing mention of: ISR
```

Restore "ISR" before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/config.js
git commit -m "Task 1: wave briefing fields + warden block + drift validator"
```

---

## Task 2: Game state slice for briefing

**Files:**
- Modify: `src/game/state.js`

- [ ] **Step 1: Add briefing slice to `gameState`**

In `src/game/state.js`, add the `briefing` slice inside the `gameState` object definition (currently ends at line 33 with `winFlag: false,`). Insert immediately after `winFlag: false,` and before the closing brace:

```js
  briefing: {
    phase: 'idle',
    visibleMs: 0,
    expandedOnce: false,
    activeBriefingIndex: -1,
  },
```

The full `gameState` definition after this change ends with:

```js
  winFlag: false,
  briefing: {
    phase: 'idle',
    visibleMs: 0,
    expandedOnce: false,
    activeBriefingIndex: -1,
  },
};
```

- [ ] **Step 2: Reset briefing slice in `resetGameState`**

In `src/game/state.js`, at the end of `resetGameState()` (after `gameState.winFlag = false;` on line 61, before the closing `}`), add:

```js
  gameState.briefing.phase = 'idle';
  gameState.briefing.visibleMs = 0;
  gameState.briefing.expandedOnce = false;
  gameState.briefing.activeBriefingIndex = -1;
```

- [ ] **Step 3: Manually verify**

Reload `http://localhost:3000`. Open DevTools console:

```js
window.gameState  // should NOT exist — state isn't exposed globally
```

Instead, verify by adding a temporary `import { gameState } from './game/state.js'; window.__gs = gameState;` line in `main.js` (remove before commit), reload, then in console:

```js
window.__gs.briefing
// Expected: { phase: 'idle', visibleMs: 0, expandedOnce: false, activeBriefingIndex: -1 }
```

Remove the temporary exposure line before commit.

(If you'd rather skip the console check — the state addition is low-risk plumbing, and the next task will exercise it. Moving on is acceptable.)

- [ ] **Step 4: Commit**

```bash
git add src/game/state.js
git commit -m "Task 2: briefing state slice + reset"
```

---

## Task 3: Briefing module — portraits, rendering, update, click-hit

**Files:**
- Create: `src/ui/briefing.js`

- [ ] **Step 1: Create `src/ui/briefing.js` with portrait cache**

Write this file:

```js
import { CONFIG } from '../config.js';

const PORTRAIT_SIZE = 64;
const PORTRAIT_X = 4;
const PORTRAIT_Y = CONFIG.virtualHeight - 68;   // 202

const BUBBLE_X = 72;
const BUBBLE_Y = CONFIG.virtualHeight - 84;     // 186
const BUBBLE_W = 320;
const BUBBLE_H = 80;
const BUBBLE_PAD = 4;

const TAB_X = 4;
const TAB_Y = CONFIG.virtualHeight - 20;        // 250
const TAB_SIZE = 16;

const TEXT_SIZE = 8;
const TEXT_LINE_HEIGHT = 11;

const PATHS = {
  neutral: './src/images/commander-warden.png',
  stern:   './src/images/commander-warden-stern.png',
  angry:   './src/images/commander-warden-angry.png',
  bloody:  './src/images/commander-warden-bloody.png',
};

const PORTRAITS = {};
for (const key of Object.keys(PATHS)) {
  const img = new Image();
  img.src = PATHS[key];
  PORTRAITS[key] = img;
}

function currentPortraitKey(state) {
  const idx = state.briefing.activeBriefingIndex;
  if (idx < 0 || idx >= CONFIG.waves.length) return 'neutral';
  return CONFIG.waves[idx].portrait || 'neutral';
}

function currentBriefingText(state) {
  const idx = state.briefing.activeBriefingIndex;
  if (idx < 0 || idx >= CONFIG.waves.length) return '';
  return CONFIG.waves[idx].briefing || '';
}

// Word-wrap to a pixel width using ctx font metrics.
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? current + ' ' + w : w;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawPortrait(ctx, key, x, y, size) {
  const img = PORTRAITS[key];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = CONFIG.colors.gridLine;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = CONFIG.colors.accentWhite;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }
}

function drawBubble(ctx, state) {
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(BUBBLE_X, BUBBLE_Y, BUBBLE_W, BUBBLE_H);
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(BUBBLE_X + 0.5, BUBBLE_Y + 0.5, BUBBLE_W - 1, BUBBLE_H - 1);

  // Tail pointing left toward the portrait, at portrait head height (~y=210).
  const tailY = 210;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.beginPath();
  ctx.moveTo(BUBBLE_X, tailY - 3);
  ctx.lineTo(BUBBLE_X - 3, tailY);
  ctx.lineTo(BUBBLE_X, tailY + 3);
  ctx.closePath();
  ctx.fill();

  ctx.font = TEXT_SIZE + 'px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.accentWhite;

  const innerW = BUBBLE_W - BUBBLE_PAD * 2;
  const lines = wrapLines(ctx, currentBriefingText(state), innerW);
  let ty = BUBBLE_Y + BUBBLE_PAD;
  for (const line of lines) {
    ctx.fillText(line, BUBBLE_X + BUBBLE_PAD, ty);
    ty += TEXT_LINE_HEIGHT;
    if (ty > BUBBLE_Y + BUBBLE_H - TEXT_SIZE) break;
  }
}

function drawTab(ctx, state, tMs) {
  const key = currentPortraitKey(state);
  const img = PORTRAITS[key];

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(TAB_X, TAB_Y, TAB_SIZE, TAB_SIZE);

  if (img && img.complete && img.naturalWidth > 0) {
    // 14×14 center-crop of the face from the source image.
    const srcSize = Math.min(img.naturalWidth, img.naturalHeight) * 0.45;
    const srcX = (img.naturalWidth - srcSize) / 2;
    const srcY = img.naturalHeight * 0.1;
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, TAB_X + 1, TAB_Y + 1, 14, 14);
  } else {
    ctx.fillStyle = CONFIG.colors.gridLine;
    ctx.fillRect(TAB_X + 1, TAB_Y + 1, 14, 14);
  }

  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(TAB_X + 0.5, TAB_Y + 0.5, TAB_SIZE - 1, TAB_SIZE - 1);

  const blink = !state.briefing.expandedOnce && Math.floor(tMs / 250) % 2 === 0;
  if (state.briefing.expandedOnce || blink) {
    ctx.fillStyle = CONFIG.colors.alertAmber;
    ctx.fillRect(TAB_X + TAB_SIZE - 3, TAB_Y + 1, 2, 2);
  }
}

function pointInRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
}

export function updateBriefing(state, dt) {
  const waveIdx = state.wave.number - 1;
  if (state.wave.phase === 'prep' && state.briefing.activeBriefingIndex !== waveIdx) {
    state.briefing.phase = 'visible';
    state.briefing.visibleMs = 0;
    state.briefing.expandedOnce = false;
    state.briefing.activeBriefingIndex = waveIdx;
    return;
  }
  if (state.briefing.phase === 'visible') {
    state.briefing.visibleMs += dt * 1000;
    if (state.briefing.visibleMs >= CONFIG.warden.autoCollapseMs) {
      state.briefing.phase = 'tab';
    }
  }
}

export function renderBriefing(ctx, state, tMs) {
  if (state.loseFlag || state.winFlag) return;
  if (state.briefing.phase === 'idle') return;

  ctx.save();
  if (state.briefing.phase === 'visible') {
    drawPortrait(ctx, currentPortraitKey(state), PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE);
    drawBubble(ctx, state);
  } else if (state.briefing.phase === 'tab') {
    drawTab(ctx, state, tMs);
  }
  ctx.restore();
}

export function briefingClickHit(state, vx, vy) {
  if (state.loseFlag || state.winFlag) return false;
  if (state.briefing.phase === 'visible') {
    const inBubble = pointInRect(vx, vy, BUBBLE_X, BUBBLE_Y, BUBBLE_W, BUBBLE_H);
    const inPortrait = pointInRect(vx, vy, PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE);
    if (inBubble || inPortrait) {
      state.briefing.phase = 'tab';
      state.briefing.expandedOnce = true;
      return true;
    }
    return false;
  }
  if (state.briefing.phase === 'tab') {
    if (pointInRect(vx, vy, TAB_X, TAB_Y, TAB_SIZE, TAB_SIZE)) {
      state.briefing.phase = 'visible';
      state.briefing.visibleMs = 0;
      state.briefing.expandedOnce = true;
      return true;
    }
    return false;
  }
  return false;
}
```

Note: `updateBriefing` does NOT re-enter `visible` when returning from `tab` to the same wave — only on *new* wave prep (different `activeBriefingIndex`). Post-expand collapse is a manual click; no second auto-collapse. The tab's amber dot stops blinking once `expandedOnce = true` but stays solid as a persistent indicator.

- [ ] **Step 2: Commit (no integration yet — next task wires it in)**

```bash
git add src/ui/briefing.js
git commit -m "Task 3: briefing module — portrait cache, bubble/tab render, update, click"
```

---

## Task 4: Wire briefing into main.js loop + click handler

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add the import**

In `src/main.js`, immediately after the existing line `import { renderCRT } from './ui/crt.js';` (currently line 18), add:

```js
import { updateBriefing, renderBriefing, briefingClickHit } from './ui/briefing.js';
```

- [ ] **Step 2: Call `updateBriefing` in the update block**

In `src/main.js`, inside the `!gameState.loseFlag && !gameState.winFlag` update block (currently lines 36–42), add `updateBriefing` as the last call. The block becomes:

```js
  if (!gameState.loseFlag && !gameState.winFlag) {
    applyJamEffects(gameState);
    updateDrones(gameState, dt);
    updateDefenses(gameState, dt);
    updateProjectiles(gameState, dt);
    updateWave(gameState, dt);
    updateBriefing(gameState, dt);
  }
```

- [ ] **Step 3: Call `renderBriefing` in the render list**

In `src/main.js`, insert `renderBriefing(ctx, gameState, tMs);` immediately after `renderLegend(ctx);` and before `renderPlacement(ctx, gameState);` (currently lines 56–57). The render section becomes:

```js
  renderChrome(ctx);
  renderPalette(ctx, gameState);
  renderLegend(ctx);
  renderBriefing(ctx, gameState, tMs);
  renderPlacement(ctx, gameState);
  renderWaveTelegraph(ctx, gameState, tMs);
  renderLoseOverlay(ctx, gameState);
  renderWinOverlay(ctx, gameState);
  renderCRT(ctx);
```

Render order rationale: briefing draws below placement cursor so hover feedback is on top, but above palette so bubble obscures palette cleanly during `visible`. Overlays and CRT remain last.

- [ ] **Step 4: Wire click handling — briefing first, palette second**

In `src/main.js`, find the click handler (currently starting at line 84 with `canvas.addEventListener('click', e => {`). Add a `briefingClickHit` check after the lose/win reset branch and before the palette hit test. The handler becomes:

```js
canvas.addEventListener('click', e => {
  if (gameState.loseFlag || gameState.winFlag) {
    resetGameState();
    return;
  }
  const [vx, vy] = toVirtual(e);

  if (briefingClickHit(gameState, vx, vy)) return;

  const paletteHit = paletteHitTest(vx, vy);
  if (paletteHit) {
    gameState.placementMode =
      gameState.placementMode?.type === paletteHit.type
        ? null
        : paletteHit.type === 'hpm'
          ? { type: 'hpm', facingRad: -Math.PI / 2 }
          : { type: paletteHit.type };
    return;
  }

  if (!gameState.placementMode) return;
  const tile = mapHitTest(vx, vy);
  if (!tile || !isValidZone(gameState, tile)) return;
  placeDefense(gameState, gameState.placementMode.type, tile, gameState.placementMode.facingRad ?? 0);
  gameState.placementMode = null;
});
```

- [ ] **Step 5: Manually verify — wave 1 briefing flow**

Reload `http://localhost:3000`. Expected sequence:

1. Wave 1 prep starts → Warden bubble appears bottom-left with neutral portrait + the wave-1 onboarding/Intel text.
2. Prep countdown continues ticking in the palette HUD.
3. After ~8 seconds → bubble collapses to a small 16×16 tab at the bottom-left corner with a blinking amber dot.
4. Click tab → bubble re-expands; dot stops blinking (stays solid amber).
5. Click bubble → collapses to tab manually. Dot is solid.
6. Clicking inside the bubble area does NOT trigger a defense placement (briefing consumes the click).
7. Clicking on the palette still works (either manually collapse first or wait for auto-collapse, then click palette).

- [ ] **Step 6: Manually verify — wave transitions and endgame**

Let wave 1 complete. Expected:

1. Wave 2 prep starts → bubble re-appears with wave-2 text, neutral portrait, fresh 8s auto-collapse.
2. Continue through waves 3 (stern), 4 (stern), 5 (angry). Each prep loads a new briefing.
3. Let city fall in wave 5 → DEFENSE FAILED overlay appears; briefing bubble/tab disappears while the overlay is up.

Alternatively: use DevTools to force win by typing in console (after exposing state temporarily if needed) — or just play wave 5 with enough interceptors to win → CITY HELD overlay, briefing bubble/tab disappears.

No console errors. FPS stays at 60.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "Task 4: wire briefing update/render/click in main"
```

---

## Task 5: Win/lose overlay subtitles

**Files:**
- Modify: `src/ui/loseOverlay.js`
- Modify: `src/ui/winOverlay.js`

- [ ] **Step 1: Update `loseOverlay.js`**

Replace the full contents of `src/ui/loseOverlay.js` with:

```js
import { CONFIG } from '../config.js';

export function renderLoseOverlay(ctx, state) {
  if (!state.loseFlag) return;

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);
  ctx.globalAlpha = 1.0;

  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CONFIG.colors.threatRed;
  ctx.fillText('DEFENSE FAILED', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 - 20);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText(CONFIG.warden.lose, CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 4);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('CLICK TO RESTART', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 28);
  ctx.restore();
}
```

- [ ] **Step 2: Update `winOverlay.js`**

Replace the full contents of `src/ui/winOverlay.js` with:

```js
import { CONFIG } from '../config.js';

export function renderWinOverlay(ctx, state) {
  if (!state.winFlag) return;

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);
  ctx.globalAlpha = 1.0;

  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CONFIG.colors.successGreen;
  ctx.fillText('CITY HELD', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 - 20);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText(CONFIG.warden.win, CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 4);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('CLICK TO RESTART', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 28);
  ctx.restore();
}
```

Layout shift: the headline moved up 12 px (was `-8`, now `-20`), the Warden line sits at `+4`, and the restart hint moved down 12 px (was `+16`, now `+28`). Vertical spread is symmetric around center.

- [ ] **Step 3: Manually verify**

Reload `http://localhost:3000`. Force both endgame states:

1. Let all three structures die in wave 1 (stand around, don't place anything) → DEFENSE FAILED appears with Warden's lose subtitle centered below the headline, then CLICK TO RESTART below that.
2. Restart, then power through all 5 waves → CITY HELD with Warden's win subtitle in the same layout.

Text should be centered, readable, no clipping.

- [ ] **Step 4: Commit**

```bash
git add src/ui/loseOverlay.js src/ui/winOverlay.js
git commit -m "Task 5: Warden subtitle on win/lose overlays"
```

---

## Task 6: Docs — DECISIONS / TODO / PLAYTESTS

**Files:**
- Modify: `DECISIONS.md`
- Modify: `TODO.md`
- Modify: `PLAYTESTS.md`

- [ ] **Step 1: Append CRT-style dated entries to `DECISIONS.md`**

Open `DECISIONS.md`. Append at the end, following the flat `YYYY-MM-DD — sentence` pattern already used:

```markdown

2026-04-21 — Commander "Warden" introduced. Speech-bubble briefing bottom-left, 64×64 portrait (PNG, pixelated upscale), 320×80 bubble, auto-collapse to 16×16 tab after 8 s, tab persists across active phase and is click-to-re-expand. Briefing text co-located with drone defs in CONFIG.waves[i] to keep the Intel honest; boot-time keyword validator warns on drift.

2026-04-21 — Four portrait keys (neutral / stern / angry / bloody) authored per-wave and for win/lose. Progression: neutral (wave 1-2) → stern (3-4) → angry (5). Lose = bloody. Win = neutral. One-liner Warden subtitle on both overlays; portrait deferred on overlays for v1.

2026-04-21 — Briefing state transitions live entirely in updateBriefing (compares wave.number-1 to stored activeBriefingIndex during prep). No coupling to wave.js — boot, wave transitions, and reset all flow through the same reconciliation.
```

- [ ] **Step 2: Append a TODO item or update an existing line in `TODO.md`**

Open `TODO.md`. Under the `## Now` or `## Next` section (author's call — wherever narrative items live), add:

```markdown
- [x] Commander Warden briefings — pre-wave speech bubble + portraits, win/lose subtitles (issue #5)
```

- [ ] **Step 3: Append a session entry to `PLAYTESTS.md`**

Open `PLAYTESTS.md`. Insert a new session at the top (newest-first is the existing convention — check line 29 comment), directly after the comment and before the next `## YYYY-MM-DD` block:

```markdown
## 2026-04-21 — solo (Commander Warden briefings)

**Build:** feat/commander-briefing — src/ui/briefing.js + win/lose subtitles
**Session length:** ~10 min render/flow check
**Result:** N/A (feature pass)

### What happened
- Wave 1 prep loaded the onboarding briefing with neutral portrait.
- Auto-collapse fired at 8 s; tab stayed visible through active phase.
- Re-expand on tab click worked; second collapse was manual.
- Wave 3 stern / wave 5 angry portraits loaded correctly.
- Lose state showed Warden's bloody subtitle; win state showed neutral subtitle.

### What worked
- Bubble reads cleanly over the palette footprint; palette reveals cleanly after collapse.
- 64×64 pixelated portraits read as stylized in the retro aesthetic.
- Click-consume order (briefing → palette → map) prevents accidental defense placement under the bubble.

### What felt off
- Warden's advice can feel condescending if you already know the matchups. Candidate for tone tuning in a later playtest pass.
- Briefing eats ~300×80 during visible state — confirm it doesn't hide prep-phase threat chevrons once #4 (zoom-out) lands.

### Questions raised
- Should mid-wave reactive lines exist? (Deferred — scope creep for v1.)
- Confidence tags on Intel lines (issue #11) would pair well here.
```

- [ ] **Step 4: Commit**

```bash
git add DECISIONS.md TODO.md PLAYTESTS.md
git commit -m "Task 6: briefing docs — decisions, todo check, playtest entry"
```

---

## Self-review checklist (controller runs before hand-off)

1. **Spec coverage**
   - Character + voice → Task 1 Step 1 (briefing texts embody the voice) ✓
   - Layout (portrait, bubble, tab, tail, colors) → Task 3 Step 1 (geometry constants + draw functions) ✓
   - Behavior state machine → Task 3 Step 1 (`updateBriefing` + `briefingClickHit`) ✓
   - Wave-1 onboarding baked into briefing text → Task 1 Step 1 (wave 1 text) ✓
   - Endgame (win/lose) subtitles → Task 5 ✓
   - Render guard for overlays → Task 3 Step 1 (`renderBriefing` early-returns on loseFlag/winFlag) ✓
   - Config fields + warden block → Task 1 Steps 1-2 ✓
   - Drift validator → Task 1 Step 3 ✓
   - Portrait loading + fallback → Task 3 Step 1 ✓
   - File layout (6 files) → Tasks 1-5 ✓
   - Docs updates → Task 6 ✓

2. **Type consistency**
   - `briefing` slice fields (`phase`, `visibleMs`, `expandedOnce`, `activeBriefingIndex`) are referenced identically across state.js (Task 2), briefing.js (Task 3), and main.js (Task 4).
   - `CONFIG.warden.autoCollapseMs`, `CONFIG.warden.win`, `CONFIG.warden.lose` keys defined in Task 1 Step 2 and consumed in Tasks 3 and 5.
   - Portrait keys `neutral`/`stern`/`angry`/`bloody` defined in Task 3's `PATHS` dict and referenced by Task 1's per-wave `portrait` fields and warden block.

3. **Placeholder scan** — no TBD / TODO / "similar to Task N" / vague-handling placeholders in any step.
