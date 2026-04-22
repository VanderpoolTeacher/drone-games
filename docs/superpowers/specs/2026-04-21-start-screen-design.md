# Start Screen — Design

**Date:** 2026-04-21
**Status:** Approved via brainstorm
**Issue:** [#16](https://github.com/VanderpoolTeacher/drone-games/issues/16)
**Scope:** Title / briefing screen on page load — full-canvas Warden-at-podium backdrop, blinking "INCOMING DRONE ATTACK" headline, bottom-up scrolling mission brief, "PRESS ANY KEY TO START" prompt. Any input starts the game.

---

## Design thesis alignment

From `DESIGN.md`: player is a tactical commander. Starting the game mid-briefing from a two-star general sets the fiction immediately — the player isn't "playing a tower defense", they're "receiving orders."

From `STYLE.md`: retro arcade + command-center vibe. A full-canvas briefing screen with large red attack text and amber "press start" prompt hits the arcade-cabinet opening-attract note while the podium portrait establishes tone.

---

## Layout (480 × 270 virtual)

### Backdrop

- `src/images/commander-warden-podium.png` (source 1402×1122) drawn to fill the full canvas at natural aspect ratio. Canvas is 480×270 (aspect 16:9), source is ~5:4 — draw at `(cx - w/2, 0)` cover-fit: `h = 270`, `w = round(270 * 1402/1122) ≈ 337`, centered.
- Alpha: 45 %. Drawn over a pre-fill of `bgDark` so the rest of the canvas isn't transparent.
- `imageSmoothingEnabled = false` — pixelated scaling matches the retro aesthetic.

### Headline

- Text: `INCOMING DRONE ATTACK`
- Position: center-x, y = 24 (top chrome + margin)
- Font: 16 px Press Start 2P
- Color: `CONFIG.colors.threatRed`
- Blink: 2 Hz (50% duty) via `Math.floor(tMs / 250) % 2`

### Scrolling brief

Bottom-up crawl. Text area:
- x range: 40 .. 440 (400 px wide)
- y range: 56 .. 214 (158 px tall)
- Text column centered horizontally, word-wrapped

Content (as one authored string; line breaks significant):

```
>> BRIEFING FOLLOWS <<

Red Cell has activated coordinated drone
operations against the city.

Sensor returns indicate multi-class UAS —
ISR surveillance, OWA one-way attack,
armored Payload-Delivery.

Your defenses are the only thing between
the city and catastrophic loss.

Hold the line, Watchfloor.

>> GOOD LUCK <<
```

Rendering:
- Font: 8 px Press Start 2P
- Color: `CONFIG.colors.accentWhite`
- Line height: 12 px
- Scroll speed: 15 px/s upward
- Text starts fully off the bottom (`y = 214` at `tMs = 0`)
- Crops drawn rendering to the `[56, 214]` vertical band via `ctx.save()` + `ctx.rect` + `ctx.clip()` so text fades cleanly at the band edges (no hard rectangle jump)
- When the LAST line passes above y = 56, reset `scrollBaseMs` so the crawl loops. The loop wrap is intentional — players arriving mid-scroll see the full briefing on a subsequent cycle.

### Prompt footer

- Text: `PRESS ANY KEY TO START`
- Position: center-x, y = 252
- Font: 8 px Press Start 2P
- Color: `CONFIG.colors.alertAmber`
- Blink: 2 Hz, same as headline

### Mute icon

- Still rendered on start screen (top-right corner at existing position) so `M` hotkey is discoverable.

### CRT overlay

- `renderCRT(ctx)` still runs last — scanlines + vignette cover the start screen too, unified look.

---

## Behavior

### Screen phases

New `gameState.screenPhase` field with two values: `'start'` (initial) and `'playing'` (after first input).

`resetGameState()` resets gameplay state but preserves `screenPhase` at whatever it currently is — the start screen is a one-time welcome on fresh page load. After a lose/win → restart, the player returns to wave 1 prep directly, not back to the start screen.

### Input

While `screenPhase === 'start'`:
- Any click anywhere on the canvas → transition to `'playing'`.
- Any keydown (except `M` mute, which still works in place) → transition to `'playing'`.
- Mute icon click → mute toggle only; does NOT start the game. (Edge case: user wants to mute before clicking-to-start.)

While `screenPhase === 'playing'`:
- Existing input handlers run unchanged.

### Transition

On any start-screen input that isn't the mute icon:
1. Set `gameState.screenPhase = 'playing'`.
2. Existing music key derivation picks up the phase change; music crossfades from title track to wave-1 prep track (Barbed Lullaby) over 500 ms.
3. Start screen render is suppressed. Gameplay renders.

No fade-to-black transition in v1 — the music crossfade is the audible transition; the visual cut is acceptable because both states are dark-on-dark. A fade is YAGNI for a prototype.

### Gameplay gating while on start screen

- `updateWave` runs normally but wave 1 prep countdown DOES NOT tick down. Gate inside `updateWave`: `if (state.screenPhase !== 'playing') return;`
- `updateDrones`, `updateDefenses`, `updateProjectiles`, `updateBriefing`, `updateStructures`, `updateExplosions`, `applyJamEffects` — gated the same way. Simplest: wrap all of them in the existing `if (!loseFlag && !winFlag)` block with an extra `state.screenPhase === 'playing'` check.
- Briefing bubble does NOT appear on start screen — it's suppressed by the screenPhase gate above, so wave-1's briefing fires on the first frame of `'playing'` (its natural trigger via `updateBriefing`).

### Music

`src/audio/music.js` — `musicKeyForState` extended:

```js
function musicKeyForState(state) {
  if (state.screenPhase === 'start') return CONFIG.music.title;
  // …existing branches unchanged
}
```

`CONFIG.music.title = 'Fortress Static'` — promotes the bench track. Crossfades to wave-1-prep track when phase flips.

---

## Rendering

New `src/ui/startScreen.js` module, mirroring the `src/ui/briefing.js` pattern (preloaded image + state-guarded render).

API:
```js
export function renderStartScreen(ctx, state, tMs)  // no-op when screenPhase !== 'start'
export function startScreenInputConsumed(state)     // helper main.js can call to flip phase
```

`renderStartScreen` early-returns when `state.screenPhase !== 'start'`. Otherwise renders backdrop → headline → scrolling brief → prompt.

Scroll offset computed as `offsetPx = (tMs - startedAtMs) * 15 / 1000`. `startedAtMs` is cached module-side on first render. Text block height H = lines × 12 px; when offsetPx exceeds H + (214 - 56) = H + 158, reset `startedAtMs` so the crawl loops.

Portrait image loaded via `new Image()` at module init, same pattern as briefing.js.

---

## File layout

| File | Action | Responsibility |
|---|---|---|
| `src/ui/startScreen.js` | Create | Render + state-guarded update; portrait cache; scroll math |
| `src/game/state.js` | Modify | Add `screenPhase: 'start'` field + reset-preserving logic |
| `src/main.js` | Modify | Gate gameplay update block on `screenPhase === 'playing'`; add click + keydown handlers that flip phase (except mute icon); render the start screen before briefing |
| `src/config.js` | Modify | Add `music.title` pointing at `'Fortress Static'` |
| `src/audio/music.js` | Modify | `musicKeyForState` handles `'start'` phase |

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve`, load page. Start screen appears: Warden backdrop, red blinking headline, amber blinking prompt, brief begins crawling up from the bottom.
2. Title music ("Fortress Static") plays after first user interaction (click or key).
3. Click anywhere → start screen disappears, wave 1 prep briefing appears, music crossfades to Barbed Lullaby. Prep countdown begins ticking.
4. Press any key (e.g. space) instead → same behavior.
5. Reload page — start screen comes back, fresh.
6. Play to lose — restart lands at wave 1 prep, NOT start screen.
7. Play to win — restart lands at wave 1 prep, NOT start screen.
8. `M` during start screen → mutes music; icon shows strike-through; clicking `M` does not start the game.
9. Clicking the mute icon during start screen → mutes only; does not start the game.
10. Scroll loops: wait ~30 s on start screen; brief text loops back from bottom.
11. No console errors.

---

## Out of scope

- Fade-to-black transition.
- Logo / game-title text (the Warden + threat text IS the title).
- "How to play" controls overlay (briefing covers onboarding at wave 1).
- Settings menu.
- Start screen on every restart (explicitly one-shot per page load).
- Credits.
- Perspective-tilted Star Wars crawl (straight vertical scroll only).

---

## Risks / open items

- **Portrait image not native pixel art** — `imageSmoothingEnabled = false` at 337×270 target gives a stylized pixelated look. Might need minor tuning if it reads as "broken" rather than "retro."
- **First gesture also triggers audio context resume** — same code path as existing `wakeAudio` window listener. Ordering matters: mute-icon hit-test must run BEFORE the generic "start game" flip, or the player can't mute without starting the game.
- **Scroll loop edge** — if the crawl looks awkward on loop (last line disappears, first line re-appears with a gap), consider padding the brief with extra blank lines at top + bottom. Defer to observed behavior.
