# Victory + Game-Over Screens — Design

**Date:** 2026-04-22
**Status:** Approved via brainstorm
**Issues:** [#19](https://github.com/VanderpoolTeacher/drone-games/issues/19), [#20](https://github.com/VanderpoolTeacher/drone-games/issues/20)
**Scope:** Replace the minimal `CITY HELD` / `DEFENSE FAILED` scrim overlays with dedicated full-canvas end screens — Liberty backdrops, blinking red/green headline, extended Warden monologue, blinking restart prompt.

---

## Design thesis alignment

From `DESIGN.md`: player is a tactical commander. The end screens finalize the emotional arc — win = held the line; lose = lost the city. A Liberty silhouette carries both states because the statue represents what was defended.

From `STYLE.md`: retro command-center aesthetic. Static full-canvas image + headline + paragraph + prompt mirrors the start screen template so the three narrative screens form a trilogy.

---

## Architecture

One new module `src/ui/endScreen.js` with a single export `renderEndScreen(ctx, state, tMs)`. It early-returns unless `state.winFlag || state.loseFlag`. Branches on which flag is true and reads the corresponding entry from `CONFIG.endScreens`.

Existing `src/ui/winOverlay.js` and `src/ui/loseOverlay.js` are **deleted outright**. The new module supersedes both.

Liberty images load lazily via `new Image()` at module init (same pattern as `startScreen.js` / `briefing.js`).

---

## Layout (480 × 270)

- **Backdrop:** full-canvas Liberty image at 55 % alpha over `bgDark`. Cover-fit: height = 270, width = `round(270 × srcW / srcH)`, centered horizontally (`drawImage` with `imageSmoothingEnabled = false` — pixelated scaling preserves the retro look).
- **Headline:** `CITY HELD` or `DEFENSE FAILED`, 16 px Press Start 2P, centered, y = 36, color per state (`successGreen` / `threatRed`). Blinks at 2 Hz to mirror start-screen cadence.
- **Body:** 8 px Press Start 2P, `accentWhite`, word-wrapped to a 360 px column centered at x = 240 px. Line height 11 px. Vertically centered between headline and prompt (roughly y = 90 to y = 230).
- **Prompt:** `PRESS ANY KEY TO RESTART`, 8 px, `alertAmber`, y = 252, 2 Hz blink.
- **CRT** still renders last, as ever.

Word-wrap: reuse the pattern from `briefing.js` (`wrapLines` via `ctx.measureText`), but authored body is pre-split into paragraphs — each paragraph wraps independently, and blank lines between paragraphs insert a full line-height gap.

---

## Content

Authored in `CONFIG.endScreens`:

```js
endScreens: {
  win: {
    image: './src/images/statue-of-liberty.png',
    headline: 'CITY HELD',
    headlineColor: 'successGreen',
    body: [
      "City held. Against everything they threw, you kept the lights on.",
      "",
      "Red Cell will remember this name. The watchfloor never sleeps — get some rest.",
      "",
      "You earned it.",
    ],
  },
  lose: {
    image: './src/images/statue-of-liberty-post-attack.png',
    headline: 'DEFENSE FAILED',
    headlineColor: 'threatRed',
    body: [
      "They got through. Structures down, city dark.",
      "",
      "Debriefs hurt, but we learn — the ones who didn't come home taught us more than a hundred clean runs.",
      "",
      "Fall back, regroup. We go again.",
    ],
  },
},
```

`body` is an array of paragraphs. Empty strings render as blank lines (paragraph break). Renderer wraps each paragraph independently.

---

## Existing config changes

Delete these fields from `CONFIG.warden` — they're now superseded:
- `warden.win` (string) — replaced by `endScreens.win.body`
- `warden.winPortrait` (string) — no portrait on end screen, backdrop carries the image
- `warden.lose` (string) — replaced by `endScreens.lose.body`
- `warden.losePortrait` (string) — same rationale

Remaining `warden` block: just `autoCollapseMs` (still used by briefings).

---

## Behavior

- On the first frame with `winFlag` or `loseFlag` true, `renderEndScreen` kicks in.
- Existing input handlers already reset on win/lose:
  - Click: `if (gameState.loseFlag || gameState.winFlag) { resetGameState(); playSfx('uiClick'); return; }` — unchanged.
  - Keydown: space / enter trigger reset — unchanged.
  - Keydown: any other key on win/lose → already resets via the existing branch order (after mute and screenPhase checks). Need to broaden so ANY key not intercepted by mute/screen triggers reset. Current handler only handles space/enter explicitly; extend so any non-mute key also resets when `winFlag || loseFlag`.
- `resetGameState()` already preserves the `screenPhase = 'playing'` path (start screen doesn't re-trigger per existing design).
- Music already routes `loseFlag`/`winFlag` to the correct tracks via `musicKeyForState`.

### Keydown adjustment

`src/main.js` current keydown:
```js
if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
if (gameState.screenPhase === 'idle') { … }
if (gameState.screenPhase === 'start') { … }
if (e.key === 'Escape') gameState.placementMode = null;
if ((gameState.loseFlag || gameState.winFlag) && (e.key === ' ' || e.key === 'Enter')) { resetGameState(); e.preventDefault(); }
```

Change the last line from `(e.key === ' ' || e.key === 'Enter')` to any key (any non-intercepted keydown resets after win/lose). The existing mute and screenPhase gates already prevent M and pre-playing keys from firing this branch.

---

## File layout

| File | Action |
|---|---|
| `src/ui/endScreen.js` | Create |
| `src/ui/winOverlay.js` | Delete |
| `src/ui/loseOverlay.js` | Delete |
| `src/config.js` | Modify — add `endScreens` block; drop the four `warden` fields |
| `src/main.js` | Modify — swap overlay imports + render calls for one `renderEndScreen`; broaden win/lose-any-key reset |

---

## Verification

Manual per `CLAUDE.md:61`.

1. Win a full run (cheese through with a full loadout). Expected: full-canvas intact-Liberty backdrop, green blinking `CITY HELD`, Warden win paragraph, amber blinking `PRESS ANY KEY TO RESTART`.
2. Press any key → wave 1 prep.
3. Deliberately lose (no defenses placed). Expected: post-attack Liberty backdrop, red blinking headline, Warden lose paragraph.
4. Press space / enter / click / any key → restart.
5. `M` during end screens toggles mute without restarting.
6. CRT scanlines cover the end screens cleanly.
7. No console errors or missing-export warnings from the deleted overlay modules.

---

## Out of scope

- Per-run dynamic text ("you lost Power Substation first", "you beat it in 11 min 02 s").
- Animated transition / fade-in.
- Replay summary (waves survived, drones killed).
- Share-to-Twitter button.
- Separate portrait in a corner (backdrop is the image).

---

## Risks / open items

- **Liberty images are 2552×1864 / 3038×2280 PNGs** — on-the-fly scaling to 270-tall with `imageSmoothingEnabled = false` is crisp but the file-size is non-trivial on first load. Acceptable for a prototype.
- **Deleting winOverlay.js / loseOverlay.js** removes the existing imports from main.js. Must update `src/main.js` to drop `renderLoseOverlay` / `renderWinOverlay` and add `renderEndScreen`. If any other module still imports those, the delete will hard-fail — grep before removing.
- **End screens lose the black scrim** of the current overlays. Text sits directly on the 55 %-alpha backdrop. If readability suffers, bump alpha up or add a 50 % `bgDark` scrim behind just the text column.
