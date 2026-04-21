# Commander Briefing (Warden) — Design

**Date:** 2026-04-21
**Status:** Approved via brainstorm
**Issue:** [#5](https://github.com/VanderpoolTeacher/drone-games/issues/5)
**Scope:** Pre-wave in-character briefings from a commander ("Warden") with a portrait bust + speech bubble, plus win/lose lines.

---

## Design thesis alignment

From `DESIGN.md`:
- "The game teaches that no single counter-drone system wins alone." — briefings surface the matchup reasoning in voice, so the lesson lands narratively instead of via tooltips alone.
- "Player is a tactical commander." — having *another* commander speak to you reinforces the chain-of-command framing and gives the player a voice to react against.

From `TERMINOLOGY.md`: Warden's language uses real doctrinal terms (ISR, OWA, Payload, RF jammer, interceptor, laser, HPM) to reinforce vocabulary already taught.

---

## Character

- **Callsign:** Warden. Two-star general, weathered, plain-spoken. Talks like a senior officer who's seen it.
- **Register:**
  - Short sentences. Never exclamation points.
  - Occasional dry humor.
  - No jargon the player hasn't met in-game.
  - Second-person address — "your jammer," "watch yourself." Never third person.
  - Earns trust by being right.

---

## Layout

All coordinates in virtual pixels (480×270).

- **Portrait:** 64×64, drawn at `(4, 270 - 68) = (4, 202)`. Source PNG rendered with `imageSmoothingEnabled = false` — crisp pixelation at scale.
- **Bubble:** `(72, 270 - 84) = (72, 186)`, size `320×80`.
  - Fill: `CONFIG.colors.bgDark` at 90% alpha.
  - Border: 1-px `CONFIG.colors.gridLine`.
  - Padding: 4 px inner.
  - **Tail:** 3-px filled triangle pointing from bubble-left toward portrait at head-height (`y ≈ 210`). Same fill/border as bubble.
- **Text:** `Press Start 2P`, 8 px, `CONFIG.colors.accentWhite`.
  - Line height: 11 px.
  - Word-wrap: manual, to bubble inner width (~312 px after padding + tail offset).
- **Collapsed tab:** 16×16 at same bottom-left corner `(4, 250)`.
  - 14×14 center-crop of the current portrait (face only, no hat/shoulders), drawn at 14×14.
  - 1-px `CONFIG.colors.gridLine` border.
  - A 2×2 `CONFIG.colors.alertAmber` dot in top-right of the tab, blinks at 2 Hz while a briefing is unread; solid once player has expanded it at least once.
- **Render order:** after `renderPalette`, before `renderLoseOverlay`/`renderWinOverlay`/`renderCRT`. Scanlines (CRT) cover the portrait for a unified look.

### Canvas edge adjustments

On small prep bubbles the existing `renderPalette` footprint (bottom 32 px) would collide with the bubble's lower edge. The bubble ends at `y = 266`, palette top is at `y = 270 - 32 = 238`. Overlap of 28 px.

**Resolution:** bubble renders OVER the palette during `visible` state. Palette interaction (click to select defense) continues to work — `briefingClickHit()` is checked first and consumes clicks inside the bubble rectangle before palette-hit-testing runs. Bubble disappears after auto-collapse, palette fully visible again.

---

## Behavior

### State

New state slice in `gameState`:

```js
briefing: {
  phase: 'idle',            // 'idle' | 'visible' | 'tab'
  visibleMs: 0,             // ms spent in 'visible' state
  expandedOnce: false,      // false until player has clicked the tab at least once
  activeBriefingIndex: -1,  // which CONFIG.waves[i].briefing is currently loaded; -1 = none
}
```

Reset by `resetGameState()` to the above default.

### Transitions

```
* (during prep, wave index changed)
  → visible       set phase='visible', visibleMs=0, expandedOnce=false, activeBriefingIndex=wave.number-1

visible
  → tab           when visibleMs >= CONFIG.warden.autoCollapseMs (8000)

tab
  → visible       on click inside tab rect (set expandedOnce=true; no auto-collapse second time)

visible (post-expand)
  → tab           on click inside bubble rect (manual collapse)

* → idle          on resetGameState() (full game reset; first frame after reset re-enters 'visible' via the prep detector)
```

All transitions live inside `updateBriefing` — it compares `wave.number - 1` to `briefing.activeBriefingIndex` during `prep` and re-seeds state when they differ. This handles boot, wave transitions, and post-reset uniformly without coupling to `wave.js`.

Briefing is *independent* of wave phase once shown — tab persists through `active` phase, disappears on `won`/`lose` overlays via render guard (see below).

### Wave-1 onboarding

No separate onboarding state. The wave-1 briefing text simply starts with a welcome/framing sentence, then transitions to threat Intel. Same bubble, one string. Slightly longer than other briefings is acceptable — word-wrap handles it.

### Endgame (win/lose)

Briefing bubble/tab is hidden while `state.loseFlag` or `state.winFlag` is true (render-time guard in `renderBriefing`). Instead:

- `renderLoseOverlay` renders `CONFIG.warden.lose` as an 8 px subtitle under `DEFENSE FAILED`, at `CONFIG.colors.accentWhite` color. Positioned ~12 px below the headline; uses existing 75% `bgDark` scrim.
- `renderWinOverlay` renders `CONFIG.warden.win` similarly under `CITY HELD`, using the same pattern.
- The "CLICK TO RESTART" hint moves down ~12 px to accommodate the new subtitle.

No portrait on the overlays in v1 (stay close to existing overlay style). Portrait key in config is still authored for future use.

### Prep timer

The prep timer is never paused by briefing state. Warden speaks; the clock keeps ticking. This keeps the design goal of decisions-under-pressure honest — reading the briefing costs time.

---

## Content model

### Config additions (`src/config.js`)

Extend each wave entry:

```js
{
  drones: [...],                            // existing
  briefing: "…prose text…",                 // NEW
  portrait: 'neutral' | 'stern' | 'angry',  // NEW — key into portraits dict
}
```

Add top-level `warden` block:

```js
warden: {
  win: "City held. Good work. Red Cell'll remember this one.",
  winPortrait: 'neutral',
  lose: "They got through. Debrief hurts, but we learn. Again.",
  losePortrait: 'bloody',
  autoCollapseMs: 8000,
}
```

### Draft briefing texts

Final wording is tunable, but these set the tone. Each one mentions every drone type present in the wave by its doctrinal name so the drift validator passes.

| Wave | Portrait | Briefing |
|---|---|---|
| 1 | neutral | First watch. ISR only — no teeth on 'em, just eyes. Get an RF jammer up north; that breaks their link. Easy start. You got this. |
| 2 | neutral | More ISR, heavier volume this time. Widen your jammer coverage. Don't let 'em slip past on the edges. |
| 3 | stern | They're mixing now. ISR north, OWA east. RF won't catch a committed OWA — it's preprogrammed, no link to kill. Interceptors east. |
| 4 | stern | Payload birds inbound west — armored, so interceptors'll chip but laser burns through fast. OWA's still pressing east; keep that corridor locked. |
| 5 | angry | All of it. Saturation run — ISR, OWA, Payload, everything. You need the full stack. HPM earns its keep here. One pulse, many drones. Good luck, Watchfloor. |

### Drift validator

At module load in `src/config.js`, after the export, run `validateBriefings()`:

- For each wave `i` in `CONFIG.waves`:
  - Collect unique `drones[j].type` values → expected set.
  - For each expected type, search `briefing` text (case-insensitive) for the type keyword.
    - Keyword map:
      - `ISR` → "ISR"
      - `OWA` → "OWA"
      - `Payload` → "Payload"
  - If any expected type is missing from the briefing text, `console.warn('[briefing] wave ' + (i+1) + ' missing mention of: ' + missing.join(', '))`.

Runs once at boot. Non-blocking — briefings render even if validator warns.

---

## Portrait loading

Single image cache in `src/ui/briefing.js`:

```js
const PORTRAITS = {};
const KEYS = ['neutral', 'stern', 'angry', 'bloody'];
const PATHS = {
  neutral: './src/images/commander-warden.png',
  stern:   './src/images/commander-warden-stern.png',
  angry:   './src/images/commander-warden-angry.png',
  bloody:  './src/images/commander-warden-bloody.png',
};

for (const key of KEYS) {
  const img = new Image();
  img.src = PATHS[key];
  PORTRAITS[key] = img;
}
```

- Image decode is async but HTMLImageElement is drawable as soon as `.src` is set; `drawImage` on an undecoded image is a no-op that produces no error. Cold-start first frame may miss the portrait; second frame onward has it. Acceptable — prep phase is 15 s.
- Fallback: if `PORTRAITS[key]` is missing or `.complete === false`, render a 64×64 `gridLine` rectangle with a 1-px `offWhite` border as a "portrait placeholder." This covers both boot race and missing-asset cases.

---

## Module API (`src/ui/briefing.js`)

```js
export function updateBriefing(state, dt) { … }
export function renderBriefing(ctx, state, tMs) { … }
export function briefingClickHit(state, vx, vy) { … }  // returns true if click consumed
```

- `updateBriefing` handles the `visible → tab` auto-collapse timer.
- `renderBriefing` no-ops if `state.loseFlag || state.winFlag || state.briefing.phase === 'idle'`.
- `briefingClickHit` returns true + mutates state when click lands inside the bubble (collapse) or tab (expand). Called first in `main.js` click handler before palette and placement hits.

---

## File layout

| File | Action | Responsibility |
|------|--------|----------------|
| `src/ui/briefing.js` | Create | update / render / click-hit logic; portrait cache |
| `src/config.js` | Modify | add `briefing` + `portrait` per wave; add `warden` block; add `validateBriefings()` call on load |
| `src/game/state.js` | Modify | add `briefing` slice to `gameState` + `resetGameState` |
| `src/main.js` | Modify | call `updateBriefing` in update block; call `renderBriefing` after palette, before overlays; wire `briefingClickHit` into click handler |
| `src/ui/loseOverlay.js` | Modify | render `CONFIG.warden.lose` as subtitle under DEFENSE FAILED |
| `src/ui/winOverlay.js` | Modify | render `CONFIG.warden.win` as subtitle under CITY HELD |

No changes to `index.html` (images are loaded imperatively via `new Image()` in `briefing.js`).

---

## Verification

Manual per `CLAUDE.md:61`. No automated tests.

1. `npx serve`, load page.
2. Wave 1 prep starts → Warden bubble appears bottom-left with neutral portrait + welcome/onboarding text. Prep timer ticks.
3. After ~8 s → bubble auto-collapses to tab with blinking amber dot.
4. Click tab → bubble re-expands, dot stops blinking, no auto-collapse.
5. Click bubble → collapses to tab manually.
6. Wave 1 goes active → tab stays visible in corner. Re-click still works.
7. Wave 2 prep → new briefing loads (still neutral, different text).
8. Wave 3 prep → stern portrait.
9. Wave 5 prep → angry portrait.
10. Let wave 5 succeed → CITY HELD overlay with Warden's win subtitle. Briefing bubble/tab hidden.
11. Restart → wave 1 briefing appears again (fresh state).
12. Intentionally break a briefing (delete "ISR" from wave-1 text in config) → reload → console warns `[briefing] wave 1 missing mention of: ISR`. Restore.
13. No console errors at steady state. FPS stays at 60.

---

## Out of scope

- Typewriter / character-by-character text animation (static block only).
- Mid-wave reactive commentary during `active` phase.
- Multiple commanders.
- Voice acting / audio stingers on briefing appearance.
- Confidence tags on Intel lines (covered by issue #11).
- Named waves ("SATURATION" etc., covered by issue #8).
- Portrait inside win/lose overlays (config field authored, render deferred).
- Briefing for pre-game title screen (no title screen exists in v1).

---

## Risks / open items

- **Portrait source is ~1400×1122 semi-realistic art.** Downscaled to 64×64 with nearest-neighbor it reads as stylized pixel art, but if readability suffers we may want to pre-downsample to a 128×128 PNG with a tuned algorithm and swap filenames. Defer until we see it running.
- **Warden's voice is teaching the matchups.** If the player already knows C-UAS, the advice reads condescending. Not fixable in v1 without branching copy; flag for playtest feedback.
- **Drift validator is keyword-based.** If a future wave used a misleading sentence ("OWA is NOT the threat here") it would pass the check. Acceptable for v1 — shallow keyword presence is the 80% fix.
