# Game Modes (Training + Campaign) — Design

**Date:** 2026-04-22
**Status:** Approved via brainstorm
**Issue:** [#23](https://github.com/VanderpoolTeacher/drone-games/issues/23)
**Scope:** Expose a Training mode alongside the current tuned Campaign. Start screen lets the player pick with `1` / `2` number keys. Training restores pre-tuning baseline (shorter, faster, easier); Campaign = current v1 tuning.

---

## Design thesis alignment

From `CLAUDE.md` working style: "tuning pass" is an ongoing activity. Shipping Campaign as the intended full experience while preserving a snappier Training version serves two use cases — dedicated players vs. class demo or first-timer onboarding — without forking the codebase.

From `DESIGN.md` v1 scope: 5 waves, one session. Both modes honor that shape; only tunables vary.

---

## Mode selection (start screen)

New prompt text during the scrolling-brief phase:

```
PRESS 1 TRAINING · 2 CAMPAIGN · ANY KEY CAMPAIGN
```

Input behavior while `screenPhase === 'start'`:

- `1` → `state.mode = 'training'`, `applyMode('training')`, phase → `'playing'`.
- `2` → `state.mode = 'campaign'`, `applyMode('campaign')`, phase → `'playing'`.
- Any other key / click → `state.mode` unchanged (default `'campaign'`), `applyMode('campaign')`, phase → `'playing'`.
- `M` / mute icon → toggles mute only, never advances phase.

During `screenPhase === 'idle'` (pre-scroll), first press still flips to `'start'` with no mode selection yet. Mode selection happens on the second press.

---

## Architecture: `CONFIG.modes` + `applyMode()`

All mode-specific tunables live under `CONFIG.modes.{campaign,training}`. An `applyMode(name)` function copies the chosen mode's values over the flat `CONFIG.*` fields. All existing game logic continues to read `CONFIG.waves`, `CONFIG.drones.isr.speed`, etc. — no read-site refactoring.

```js
function applyMode(name) {
  const src = CONFIG.modes[name];
  if (!src) return;
  CONFIG.waves = src.waves;
  CONFIG.drones.isr.speed = src.drones.isr.speed;
  CONFIG.drones.isr.hp = src.drones.isr.hp;
  CONFIG.drones.owa.speed = src.drones.owa.speed;
  CONFIG.drones.owa.hp = src.drones.owa.hp;
  CONFIG.drones.payloadDelivery.speed = src.drones.payloadDelivery.speed;
  CONFIG.drones.payloadDelivery.hp = src.drones.payloadDelivery.hp;
  CONFIG.structures.maxHP = src.structures.maxHP;
  CONFIG.structures.damageFromOWAStrike = src.structures.damageFromOWAStrike;
  CONFIG.structures.damageFromPayloadDrop = src.structures.damageFromPayloadDrop;
  CONFIG.startingResources = src.startingResources;
  CONFIG.resourcesPerWaveBonus = src.resourcesPerWaveBonus;
  CONFIG.resourcesPerDroneKill.isr = src.resourcesPerDroneKill.isr;
  CONFIG.resourcesPerDroneKill.owa = src.resourcesPerDroneKill.owa;
  CONFIG.resourcesPerDroneKill.payloadDelivery = src.resourcesPerDroneKill.payloadDelivery;
  CONFIG.prepTimeBetweenWaves = src.prepTimeBetweenWaves;
}
```

At module init (bottom of `config.js`), call `applyMode('campaign')` so CONFIG starts with Campaign values — existing behavior is preserved for any code path that reads CONFIG before the user picks a mode.

### Training overrides (pre-tuning baseline)

```js
training: {
  drones: {
    isr:             { speed: 60,  hp: 20  },
    owa:             { speed: 140, hp: 15  },
    payloadDelivery: { speed: 30,  hp: 120 },
  },
  structures: {
    maxHP: 100,
    damageFromOWAStrike: 30,
    damageFromPayloadDrop: 60,
  },
  startingResources: 400,
  resourcesPerWaveBonus: 200,
  resourcesPerDroneKill: { isr: 10, owa: 15, payloadDelivery: 35 },
  prepTimeBetweenWaves: 15000,
  waves: [
    { drones: [ { type: 'isr', count: 5, spawnInterval: 1500, spawnDelayMs: 0 } ],
      briefing: "First watch. ISR only — no teeth on 'em, just eyes. Get an RF jammer up north; that breaks their link. Easy start. You got this.",
      portrait: 'neutral' },
    { drones: [ { type: 'isr', count: 8, spawnInterval: 1200, spawnDelayMs: 0 } ],
      briefing: "More ISR, heavier volume this time. Widen your jammer coverage. Don't let 'em slip past on the edges.",
      portrait: 'neutral' },
    { drones: [
        { type: 'isr', count: 6, spawnInterval: 1200, spawnDelayMs: 0 },
        { type: 'owa', count: 5, spawnInterval: 1800, spawnDelayMs: 0 },
      ],
      briefing: "They're mixing now. ISR north, OWA east. RF won't catch a committed OWA — it's preprogrammed, no link to kill. Interceptors east.",
      portrait: 'stern' },
    { drones: [
        { type: 'owa', count: 8, spawnInterval: 1200, spawnDelayMs: 0 },
        { type: 'payloadDelivery', count: 3, spawnInterval: 3000, spawnDelayMs: 0 },
      ],
      briefing: "Payload birds inbound west — armored, so interceptors'll chip but laser burns through fast. OWA's still pressing east; keep that corridor locked.",
      portrait: 'stern' },
    { drones: [
        { type: 'isr', count: 8, spawnInterval: 1000, spawnDelayMs: 0 },
        { type: 'owa', count: 12, spawnInterval: 800, spawnDelayMs: 0 },
        { type: 'payloadDelivery', count: 4, spawnInterval: 2500, spawnDelayMs: 0 },
      ],
      briefing: "All of it. Saturation run — ISR, OWA, Payload, everything. You need the full stack. HPM earns its keep here. One pulse, many drones. Good luck, Watchfloor.",
      portrait: 'angry' },
  ],
},
```

Briefings re-use the existing Campaign copy — they still reference the right drone types and matchups; only counts differ.

### Campaign overrides (current tuned)

Identical structure, with the values currently in the flat CONFIG:

```js
campaign: {
  drones: {
    isr:             { speed: 45,  hp: 20  },
    owa:             { speed: 100, hp: 25  },
    payloadDelivery: { speed: 25,  hp: 160 },
  },
  structures: {
    maxHP: 120,
    damageFromOWAStrike: 25,
    damageFromPayloadDrop: 50,
  },
  startingResources: 350,
  resourcesPerWaveBonus: 150,
  resourcesPerDroneKill: { isr: 8, owa: 12, payloadDelivery: 30 },
  prepTimeBetweenWaves: 20000,
  waves: [ /* … current 5-wave Campaign array with briefings + portraits + spawnDelayMs */ ],
},
```

---

## State

- **`gameState.mode`** — string, default `'campaign'`. Set on start-screen selection. **Persists across `resetGameState`** — restarting keeps the chosen mode. Only a fresh page load resets to the default.
- **`resetGameState`** calls `applyMode(gameState.mode)` defensively so config stays fresh (guards against any future code path that mutated CONFIG mid-run).

---

## End screen headline

Append the mode tag to the existing headline:

- Win: `CITY HELD · TRAINING` or `CITY HELD · CAMPAIGN`
- Lose: `DEFENSE FAILED · TRAINING` or `DEFENSE FAILED · CAMPAIGN`

Single-line change in `endScreen.js`: compute the headline string at render time from `entry.headline + ' · ' + state.mode.toUpperCase()`.

---

## File layout

| File | Action |
|---|---|
| `src/config.js` | Modify — wrap tunables under `CONFIG.modes.{campaign,training}`; add `applyMode(name)`; call `applyMode('campaign')` at module init |
| `src/game/state.js` | Modify — add `mode: 'campaign'`; call `applyMode(mode)` in `resetGameState` |
| `src/ui/startScreen.js` | Modify — update prompt text during `'start'` phase |
| `src/main.js` | Modify — start-screen input (click + keydown) accepts `1`/`2` and sets `state.mode` + `applyMode()` before phase flip |
| `src/ui/endScreen.js` | Modify — append mode tag to headline |

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve`, fresh load. Start screen shows `PRESS 1 TRAINING · 2 CAMPAIGN · ANY KEY CAMPAIGN`.
2. Press `1` → Training run. Wave 1 starts quickly (15 s prep). Only 5 ISR. Total run ~4–5 minutes. End screen says `CITY HELD · TRAINING` or `DEFENSE FAILED · TRAINING`.
3. Press any key to restart → go back to Training (same wave count, same fast pacing).
4. Reload page → start screen again. Press `2` → Campaign. Long prep, escalating waves, ~12-minute run. End screen says `… · CAMPAIGN`.
5. Press a non-number key during mode selection → Campaign default.
6. `M` on start screen mutes but does NOT start the game.
7. No console errors.

---

## Out of scope

- Per-mode music tracks.
- Per-mode briefing copy.
- Per-mode end-screen monologues.
- Mode-specific start-screen visuals.
- "Endless" mode.
- Custom-difficulty sliders.
- Run-time mode switching.
- Persist mode in `localStorage`.

---

## Risks / open items

- **CONFIG is now mutable via `applyMode`.** Any code that reads `CONFIG.foo` while a mode switch is happening could see a half-applied state. In practice the only switch sites are start-screen → playing and resetGameState, both of which fire before any game frame runs. Low risk.
- **New fields in Campaign wave definitions (`spawnDelayMs`) don't exist in Training** because Training was authored without them. `updateWave` already handles `d.spawnDelayMs ?? 0`, so Training spawns at offset 0 naturally. Confirmed safe.
- **`applyMode` copies by reference for `waves` array.** If game logic ever mutated `CONFIG.waves[i].drones[...]` at runtime, both modes would share state. Today wave config is read-only at runtime, so this is fine — flag if ever changed.
