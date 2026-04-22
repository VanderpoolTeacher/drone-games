# Start Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a title/briefing screen on page load — Warden-at-podium backdrop, blinking "INCOMING DRONE ATTACK" headline, bottom-up scrolling mission briefing, "PRESS ANY KEY TO START" prompt. Any input (except mute) starts the game.

**Architecture:** A new `gameState.screenPhase` field ('start' | 'playing') gates all gameplay updates. Page load sets `'start'`; the first non-mute user input flips to `'playing'` and normal gameplay begins. A new `src/ui/startScreen.js` renders the title screen, preloads the podium image, and does the scroll math. Music module picks up a `'start'` phase via `musicKeyForState` and plays the bench track `Fortress Static`.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas 2D, Web Audio. No build, no test harness. Manual browser verification per `CLAUDE.md:61`.

**Spec reference:** `docs/superpowers/specs/2026-04-21-start-screen-design.md`

---

## File layout

| File | Action | Responsibility |
|------|--------|----------------|
| `src/ui/startScreen.js` | Create | Portrait cache; render backdrop/headline/crawl/prompt; scroll math |
| `src/game/state.js` | Modify | Add `screenPhase: 'start'` field; don't reset it in `resetGameState` (one-shot per page load) |
| `src/config.js` | Modify | Add `music.title: 'Fortress Static'` |
| `src/audio/music.js` | Modify | `musicKeyForState` handles the `'start'` phase |
| `src/main.js` | Modify | Gate gameplay update block on `screenPhase === 'playing'`; render start screen before overlays; input handlers flip phase on any non-mute click/keydown while `screenPhase === 'start'` |

No changes to `index.html`. Podium image already committed at `src/images/commander-warden-podium.png`.

---

## Task 1: State + config plumbing

**Files:**
- Modify: `src/game/state.js`
- Modify: `src/config.js`

- [ ] **Step 1: Add `screenPhase` to `gameState`**

In `src/game/state.js`, find the `gameState` object. Immediately after the existing `winFlag: false,` line and before the `briefing:` sub-block, insert:

```js
  screenPhase: 'start',
```

The section becomes:

```js
  winFlag: false,
  screenPhase: 'start',
  briefing: {
    phase: 'idle',
    visibleMs: 0,
    expandedOnce: false,
    activeBriefingIndex: -1,
  },
```

- [ ] **Step 2: Do NOT reset `screenPhase` in `resetGameState`**

Leave `resetGameState()` untouched regarding screenPhase — after a lose/win, restart should go straight to wave 1 prep, NOT back to the start screen. The initial `'start'` value is set only once per page load, when the module first loads.

(This is a deliberate non-change. Grep `resetGameState` in state.js to confirm no line touches `screenPhase`; if one somehow does, remove it.)

- [ ] **Step 3: Add `music.title` to CONFIG**

In `src/config.js`, locate the `music` block. Replace the existing block with the title field added:

```js
  music: {
    waves: [
      { prep: 'Barbed Lullaby',    active: 'Barricade Pulse' },    // Wave 1
      { prep: 'Fortress Rations',  active: 'Fortress Beat' },      // Wave 2
      { prep: 'Barricade Static',  active: 'Determined Forces' },  // Wave 3
      { prep: 'Steel Rations',     active: 'Marching Forth' },     // Wave 4
      { prep: 'Welded Bastion',    active: 'Steel Hero' },         // Wave 5
    ],
    title: 'Fortress Static',
    win: 'Avenged',
    lose: 'Fallen Not Forgotten',
    volume: 0.4,
    crossfadeMs: 500,
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/game/state.js src/config.js
git commit -m "Task 1: screenPhase state field + music.title config"
```

---

## Task 2: Music — handle `'start'` phase

**Files:**
- Modify: `src/audio/music.js`

- [ ] **Step 1: Extend `musicKeyForState`**

Open `src/audio/music.js`. Find the `musicKeyForState(state)` function. Add a new branch at the TOP of the function that returns the title track when the game is on the start screen:

```js
function musicKeyForState(state) {
  if (state.screenPhase === 'start') return CONFIG.music.title;
  if (state.loseFlag) return CONFIG.music.lose;
  if (state.winFlag) return CONFIG.music.win;
  const entry = CONFIG.music.waves[state.wave.number - 1];
  if (!entry) return null;
  if (state.wave.phase === 'prep')   return entry.prep;
  if (state.wave.phase === 'active') return entry.active;
  if (state.wave.phase === 'won')    return CONFIG.music.win;
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/audio/music.js
git commit -m "Task 2: music handles 'start' phase → title track"
```

---

## Task 3: Create `src/ui/startScreen.js`

**Files:**
- Create: `src/ui/startScreen.js`

The module preloads the podium image, computes scroll offset each frame, and renders backdrop → headline → scrolling brief → prompt. Its render function no-ops when `state.screenPhase !== 'start'`.

- [ ] **Step 1: Create the file**

Write exactly this to `src/ui/startScreen.js`:

```js
import { CONFIG } from '../config.js';

const IMG_PATH = './src/images/commander-warden-podium.png';
const portrait = new Image();
portrait.src = IMG_PATH;

const BRIEF_LINES = [
  '>> BRIEFING FOLLOWS <<',
  '',
  'Red Cell has activated coordinated drone',
  'operations against the city.',
  '',
  'Sensor returns indicate multi-class UAS —',
  'ISR surveillance, OWA one-way attack,',
  'armored Payload-Delivery.',
  '',
  'Your defenses are the only thing between',
  'the city and catastrophic loss.',
  '',
  'Hold the line, Watchfloor.',
  '',
  '>> GOOD LUCK <<',
];

const SCROLL_SPEED_PX_PER_S = 15;
const LINE_HEIGHT = 12;
const TEXT_BAND_TOP = 56;
const TEXT_BAND_BOTTOM = 214;
const TEXT_SIZE = 8;

let scrollStartMs = null;

function drawBackdrop(ctx) {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  if (portrait.complete && portrait.naturalWidth > 0) {
    const srcW = portrait.naturalWidth;
    const srcH = portrait.naturalHeight;
    const destH = CONFIG.virtualHeight;
    const destW = Math.round(destH * srcW / srcH);
    const destX = Math.round((CONFIG.virtualWidth - destW) / 2);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(portrait, destX, 0, destW, destH);
    ctx.globalAlpha = 1.0;
  }
}

function drawHeadline(ctx, tMs) {
  const blink = Math.floor(tMs / 250) % 2 === 0;
  if (!blink) return;
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.threatRed;
  ctx.fillText('INCOMING DRONE ATTACK', CONFIG.virtualWidth / 2, 24);
}

function drawScrollingBrief(ctx, tMs) {
  if (scrollStartMs === null) scrollStartMs = tMs;

  const totalTextH = BRIEF_LINES.length * LINE_HEIGHT;
  const bandH = TEXT_BAND_BOTTOM - TEXT_BAND_TOP;
  const loopLen = totalTextH + bandH;   // pixels of travel before looping

  const offset = ((tMs - scrollStartMs) * SCROLL_SPEED_PX_PER_S / 1000) % loopLen;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, TEXT_BAND_TOP, CONFIG.virtualWidth, bandH);
  ctx.clip();

  ctx.font = TEXT_SIZE + 'px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.accentWhite;

  // Line i starts at y = (band bottom) - offset + i * lineHeight
  // so offset = 0 puts line 0 at the band bottom (off-screen-low).
  const startY = TEXT_BAND_BOTTOM - offset;
  for (let i = 0; i < BRIEF_LINES.length; i++) {
    const y = startY + i * LINE_HEIGHT;
    if (y + LINE_HEIGHT < TEXT_BAND_TOP) continue;
    if (y > TEXT_BAND_BOTTOM) continue;
    ctx.fillText(BRIEF_LINES[i], CONFIG.virtualWidth / 2, y);
  }

  ctx.restore();
}

function drawPrompt(ctx, tMs) {
  const blink = Math.floor(tMs / 250) % 2 === 0;
  if (!blink) return;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText('PRESS ANY KEY TO START', CONFIG.virtualWidth / 2, 252);
}

export function renderStartScreen(ctx, state, tMs) {
  if (state.screenPhase !== 'start') return;
  ctx.save();
  drawBackdrop(ctx);
  drawHeadline(ctx, tMs);
  drawScrollingBrief(ctx, tMs);
  drawPrompt(ctx, tMs);
  ctx.restore();
}
```

Scroll math note: `offset` cycles 0..`loopLen`. At offset=0, line 0 sits at y=TEXT_BAND_BOTTOM (off the bottom of the visible band). As offset grows, lines climb upward. When offset reaches loopLen, line N-1 has passed above TEXT_BAND_TOP and line 0 is about to reappear at the bottom — the modulo wraps cleanly.

- [ ] **Step 2: Commit**

```bash
git add src/ui/startScreen.js
git commit -m "Task 3: startScreen.js — podium backdrop, headline, scroll crawl, prompt"
```

---

## Task 4: Main.js wiring — gate gameplay, render start, handle input

**Files:**
- Modify: `src/main.js`

Four changes to `src/main.js`.

- [ ] **Step 1: Add the import**

Find the existing `import { updateMusic } from './audio/music.js';` line. Immediately after it, add:

```js
import { renderStartScreen } from './ui/startScreen.js';
```

- [ ] **Step 2: Gate the gameplay update block**

The current update section inside `frame(tMs)` is:

```js
  if (!gameState.loseFlag && !gameState.winFlag) {
    applyJamEffects(gameState);
    updateDrones(gameState, dt);
    updateDefenses(gameState, dt);
    updateProjectiles(gameState, dt);
    updateWave(gameState, dt);
    updateBriefing(gameState, dt);
  }
  updateStructures(gameState);
  updateExplosions(gameState, dt);
  updateMusic(gameState);
```

Change the top condition so no gameplay updates run while on the start screen. `updateStructures`, `updateExplosions`, and `updateMusic` stay outside (music must run to pick up the `'start'` → `'playing'` crossfade). The block becomes:

```js
  if (gameState.screenPhase === 'playing' && !gameState.loseFlag && !gameState.winFlag) {
    applyJamEffects(gameState);
    updateDrones(gameState, dt);
    updateDefenses(gameState, dt);
    updateProjectiles(gameState, dt);
    updateWave(gameState, dt);
    updateBriefing(gameState, dt);
  }
  updateStructures(gameState);
  updateExplosions(gameState, dt);
  updateMusic(gameState);
```

- [ ] **Step 3: Render the start screen**

Render the start screen as the last thing before `renderCRT(ctx);`. The existing render list ends:

```js
  renderLoseOverlay(ctx, gameState);
  renderWinOverlay(ctx, gameState);
  renderCRT(ctx);
```

Insert `renderStartScreen(ctx, gameState, tMs);` between `renderWinOverlay` and `renderCRT`:

```js
  renderLoseOverlay(ctx, gameState);
  renderWinOverlay(ctx, gameState);
  renderStartScreen(ctx, gameState, tMs);
  renderCRT(ctx);
```

The start screen sits above overlays (harmless — `renderStartScreen` early-returns when `screenPhase !== 'start'`, and overlays only render on lose/win which implies the player already started). CRT remains last.

- [ ] **Step 4: Rewrite click handler to flip phase on start screen**

Find the click handler (starts with `canvas.addEventListener('click', e => {`). Replace the ENTIRE handler with:

```js
canvas.addEventListener('click', e => {
  if (gameState.loseFlag || gameState.winFlag) {
    resetGameState();
    playSfx('uiClick');
    return;
  }
  const [vx, vy] = toVirtual(e);

  if (muteIconClickHit(vx, vy)) {
    toggleMute();
    return;
  }

  if (gameState.screenPhase === 'start') {
    gameState.screenPhase = 'playing';
    return;
  }

  if (briefingClickHit(gameState, vx, vy)) return;

  const paletteHit = paletteHitTest(vx, vy);
  if (paletteHit) {
    gameState.placementMode =
      gameState.placementMode?.type === paletteHit.type
        ? null
        : paletteHit.type === 'hpm'
          ? { type: 'hpm', facingRad: -Math.PI / 2 }
          : { type: paletteHit.type };
    collapseBriefing(gameState);
    playSfx('uiClick');
    return;
  }

  if (!gameState.placementMode) return;
  const tile = mapHitTest(vx, vy);
  if (!tile || !isValidZone(gameState, tile)) return;
  placeDefense(gameState, gameState.placementMode.type, tile, gameState.placementMode.facingRad ?? 0);
  gameState.placementMode = null;
  playSfx('uiClick');
});
```

The mute-icon check runs BEFORE the start-screen phase flip so the user can mute on the start screen without accidentally starting the game.

- [ ] **Step 5: Rewrite keydown handler to flip phase on start screen**

Find the current `window.addEventListener('keydown', ...)`. Replace the ENTIRE handler with:

```js
window.addEventListener('keydown', e => {
  if (e.key === 'm' || e.key === 'M') {
    toggleMute();
    return;
  }
  if (gameState.screenPhase === 'start') {
    gameState.screenPhase = 'playing';
    return;
  }
  if (e.key === 'Escape') gameState.placementMode = null;
  if ((gameState.loseFlag || gameState.winFlag) && (e.key === ' ' || e.key === 'Enter')) {
    resetGameState();
    e.preventDefault();
  }
});
```

Ordering:
- `M` always mutes (never flips phase).
- Any other key during `'start'` → flip phase.
- Escape / Space / Enter only processed in `'playing'` phase.

- [ ] **Step 6: Manual browser verify**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games"
pkill -f "npx serve" 2>/dev/null
npx serve -l 3000 &
sleep 2
```

Open http://localhost:3000/. Check:

1. **Fresh load:** start screen appears. Warden-podium backdrop fills the canvas at ~45% alpha. "INCOMING DRONE ATTACK" blinks red at the top. Briefing text crawls upward from the bottom. "PRESS ANY KEY TO START" blinks amber at the bottom.
2. **Prep timer doesn't tick** — the palette's wave HUD still shows `NEXT 0:15` (or `0:20` with new tuning) without counting down.
3. **Click mute icon** → mute toggles but game does NOT start; start screen stays visible.
4. **Press M** → same thing; mute toggles, game stays on start screen.
5. **Press any other key (e.g. Space)** → start screen disappears; wave 1 prep visible; Warden briefing bubble appears; music crossfades from Fortress Static to Barbed Lullaby.
6. **Lose a run** → restart goes straight to wave 1 prep, NOT back to the start screen.
7. **Win a run** → same; restart goes to wave 1 prep.
8. **Reload page** → start screen comes back (fresh page-load re-initializes `screenPhase = 'start'`).
9. **Wait ~30s on start screen** → scroll loops (last line disappears above the top, first line re-appears at the bottom).
10. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "Task 4: wire start screen — phase gating, render, input handlers"
```

---

## Task 5: Docs — DECISIONS / TODO / PLAYTESTS

**Files:**
- Modify: `DECISIONS.md`
- Modify: `TODO.md`
- Modify: `PLAYTESTS.md`

- [ ] **Step 1: Append start-screen entries to `DECISIONS.md`**

Open `DECISIONS.md`. Append at the end using the flat `YYYY-MM-DD — sentence` style:

```markdown

2026-04-21 — Start screen uses commander-warden-podium.png as a full-canvas backdrop at 45% alpha. Blinking red "INCOMING DRONE ATTACK" headline + amber "PRESS ANY KEY TO START" prompt + bottom-up scrolling mission brief.

2026-04-21 — `gameState.screenPhase` ('start' → 'playing') gates the entire gameplay update block. Initial page load starts at 'start'; first non-mute input flips to 'playing'. Restart after win/lose goes directly to wave 1 prep — start screen is one-shot per page load only.

2026-04-21 — Title track promoted from bench: `Fortress Static` plays on the start screen, crossfades to wave 1 prep track (Barbed Lullaby) when the player presses start. Because audio is blocked pre-gesture AND the gesture flips phase, the title track is effectively silent — acceptable for v1.

2026-04-21 — Mute icon hit-test runs BEFORE the start-screen phase flip so the user can silence audio on the start screen without accidentally starting the game. Same applies to `M` key.
```

- [ ] **Step 2: Update `TODO.md`**

Open `TODO.md`. Find the line:

```markdown
- [ ] Class writeup draft
```

Immediately before it, insert:

```markdown
- [x] Start screen — podium backdrop + scrolling brief (issue #16)
```

- [ ] **Step 3: Append session entry to `PLAYTESTS.md`**

Open `PLAYTESTS.md`. Insert a new session at the top, directly after the `<!-- First playtest goes below. ... -->` comment and before the next `## YYYY-MM-DD` block:

```markdown
## 2026-04-21 — solo (Start screen)

**Build:** feat/start-screen — podium backdrop + scrolling briefing + phase-gated gameplay
**Session length:** ~5 min UX check
**Result:** N/A (feature pass)

### What happened
- Fresh page load shows Warden-at-podium with the scrolling brief and blinking prompts.
- Any key / click (except mute) starts the game cleanly; music crossfades from title to wave 1 prep.
- Restart after win/lose skips the start screen as designed.

### What worked
- Podium image at 45% alpha reads as "command center backdrop" without overpowering the text.
- Two-second blink cycle on INCOMING DRONE ATTACK + PRESS ANY KEY matches the amber-chevron cadence used in prep telegraphs.
- Bottom-up crawl loops without a visible seam (padded blank lines at the ends of BRIEF_LINES help this).

### What felt off
- Title-track-is-silent edge case feels odd in theory but is invisible in practice (player clicks before hearing silence).
- If the player lingers on start screen >30s and hears Fortress Static loop, the transition to Barbed Lullaby works cleanly.

### Questions raised
- Should the scroll speed slow down on the final "GOOD LUCK" line so it lingers? Deferred to later polish.
- Should restart loop back to the start screen on every N-th game to re-set tone? Probably not — players want to jump in.
```

- [ ] **Step 4: Commit**

```bash
git add DECISIONS.md TODO.md PLAYTESTS.md
git commit -m "Task 5: start-screen docs — decisions, todo, playtest entry"
```

---

## Self-review checklist (controller runs before hand-off)

1. **Spec coverage**
   - `screenPhase` state field → Task 1 ✓
   - `music.title` config → Task 1 ✓
   - Music handles `'start'` phase → Task 2 ✓
   - Portrait backdrop at 45 % alpha, full canvas → Task 3 `drawBackdrop` ✓
   - Blinking headline → Task 3 `drawHeadline` ✓
   - Bottom-up scrolling brief with loop → Task 3 `drawScrollingBrief` ✓
   - Blinking prompt → Task 3 `drawPrompt` ✓
   - `renderStartScreen` early-returns when not `'start'` → Task 3 ✓
   - Gameplay update gated on `'playing'` → Task 4 Step 2 ✓
   - Start screen rendered before CRT → Task 4 Step 3 ✓
   - Click handler: mute before phase flip → Task 4 Step 4 ✓
   - Keydown: M before phase flip → Task 4 Step 5 ✓
   - Restart skips start screen → Task 1 Step 2 (resetGameState doesn't touch screenPhase) ✓
   - Docs → Task 5 ✓

2. **Type consistency**
   - `gameState.screenPhase` values: only `'start'` and `'playing'` used. Defined in Task 1 Step 1; read in Tasks 2, 3, 4.
   - `CONFIG.music.title` defined in Task 1 Step 3; consumed in Task 2 Step 1.
   - `renderStartScreen(ctx, state, tMs)` signature consistent between Task 3 export and Task 4 call site.

3. **Placeholder scan** — no TBD / TODO / "similar to" / vague-handling placeholders.

4. **Logic audit (scroll loop, Task 3):**
   - `offset` ∈ [0, `loopLen`) where `loopLen = totalTextH + bandH`.
   - At `offset = 0`: line 0 is at `y = TEXT_BAND_BOTTOM` (just off the bottom edge). No lines visible yet.
   - At `offset = totalTextH`: line 0 is at `y = TEXT_BAND_BOTTOM - totalTextH` (fully above the band for short briefs, partially visible for long ones). Line N-1 is at `y = TEXT_BAND_BOTTOM`.
   - At `offset = loopLen`: line N-1 has just passed above `TEXT_BAND_TOP`; modulo wraps to 0 and line 0 reappears at the bottom. ✓
