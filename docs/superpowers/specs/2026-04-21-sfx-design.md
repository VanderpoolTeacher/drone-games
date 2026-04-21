# SFX (Web Audio Synth) — Design

**Date:** 2026-04-21
**Status:** Approved via brainstorm
**Issue:** [#13](https://github.com/VanderpoolTeacher/drone-games/issues/13)
**Scope:** 11 synthesized sound effects via Web Audio API, binary mute toggle, no assets.

---

## Design thesis alignment

From `STYLE.md` and `CLAUDE.md`: retro arcade aesthetic. Pixel art, bold colors, CRT vibes — "early-90s arcade cabinet meets modern command console." Synthesized square/saw/noise-based SFX fit that frame natively; sampled SFX tend to pull the game toward "generic mobile." The synth route also keeps the repo asset-free and license-free.

From `DESIGN.md`: each defense should feel distinct. Per-defense audio (interceptor blip, laser hum, HPM whump, RF hiss) reinforces the layered-defense teaching by making the matchup *audible*.

---

## Architecture

### Modules

- **`src/audio/sfx.js`** (new) — owns the single `AudioContext`, master `GainNode`, muted flag (persisted to `localStorage`), and all per-sound synthesis functions. Public API: `playSfx(name)`, `startSfx(name, id)`, `stopSfx(id)`, `toggleMute()`, `isMuted()`.
- **`src/ui/muteIcon.js`** (new) — 8×8 speaker glyph in the top chrome. Public API: `renderMuteIcon(ctx)`, `muteIconClickHit(vx, vy)` (returns `true` if consumed).

### Wiring

- `src/main.js` imports, renders mute icon after chrome, checks `muteIconClickHit` in the click handler before `briefingClickHit`, binds `M` keydown to `toggleMute`, and fires `playSfx('uiClick')` on any consumed click (palette, placement, restart).
- `src/game/defenses.js`, `src/game/drones.js`, `src/game/structures.js`, `src/game/wave.js` call `playSfx` / `startSfx` / `stopSfx` at the appropriate state transitions.

### AudioContext lifecycle

Browsers block audio until a user gesture. The context is created lazily on the first `playSfx` / `startSfx` call — guaranteed to be inside a click or keydown handler because the first sound is `uiClick`.

---

## Mute model

- Single module-scope `GainNode` (the "master gain") sits between every per-sound node graph and `audioContext.destination`.
- `toggleMute()` flips `audioContext === null ? ...` or sets `masterGain.gain.value = muted ? 0 : 1`. No ramp — users expect instant mute.
- State persisted synchronously to `localStorage['droneDefense.muted']` (string `'1'` or `'0'`). Read once at module load; defaults to unmuted.
- `M` keydown toggles it globally. Mute icon click toggles it via the canvas click path.

---

## Sound definitions (11 total)

All envelopes use linear or exponential gain ramps via `GainNode`. Durations are the full "tail to zero" time.

### One-shots (9)

| Name | Nodes | Params | Duration |
|---|---|---|---|
| `uiClick` | square osc | 800 Hz, gain 0 → 0.3 → 0 linear | 50 ms |
| `interceptorLaunch` | white-noise buffer + sine osc | Noise gain 0.2, sine 200 → 800 Hz linear sweep, exp decay | 150 ms |
| `droneKill` | white noise + sine | Noise 0.3 exp decay, sine 80 Hz amp 0.4 exp decay | 250 ms |
| `laserOverheat` | 2 square osc | Both 1200 Hz, triggered 80 ms apart, each 40 ms with linear envelope | 200 ms total |
| `hpmPulse` | sine 60 Hz + sine 200 Hz | Both exp decay from 0.5; 200 Hz decays faster (300 ms), 60 Hz longer (500 ms) | 500 ms |
| `structureDestroyed` | white noise + sine + pink noise | Noise 0.5 exp decay 300 ms, sine 40 Hz 0.5 exp decay 600 ms, pink-noise crackle layer 200 ms | 700 ms |
| `waveStart` | 3× square osc | C5/E5/G5 (523/659/784 Hz), 80 ms each sequential, gain 0.25 | 260 ms |
| `win` | 4× square osc | C5/E5/G5/C6 (523/659/784/1047 Hz), 100 ms each sequential, gain 0.25 | 420 ms |
| `lose` | sawtooth osc | Start 220 Hz (A3), linear glide to 175 Hz (F3) over 800 ms, gain 0.3 exp decay | 800 ms |

### Continuous (2 — `startSfx` / `stopSfx`)

| Name | Nodes | Params |
|---|---|---|
| `laserFire` | sawtooth osc + LFO on gain | 220 Hz, master gain 0.2, lowpass filter 2000 Hz, 8 Hz LFO on gain for subtle wobble |
| `rfJam` | pink-noise buffer source + LFO on gain | Looped 1 s noise buffer through bandpass 800–1200 Hz, gain 0.15, 3 Hz LFO on gain |

Continuous nodes stored in a `Map<string, { nodes... }>` keyed by the caller's id string. `startSfx` is idempotent (returns if id already exists). `stopSfx` ramps `gain.value` to 0 over 30 ms (avoids click/pop), then disconnects and deletes the entry.

---

## API

```js
// sfx.js public API
export function playSfx(name)            // one-shot
export function startSfx(name, id)       // continuous — id must be unique and stable while playing
export function stopSfx(id)              // no-op if id unknown
export function toggleMute()             // flips master gain + persists
export function isMuted()                // returns boolean
```

`playSfx` with an unknown name is a no-op with `console.warn('[sfx] unknown sound: ' + name)`. Same for `startSfx`.

---

## Trigger sites

| Event | File | Sound |
|---|---|---|
| Any click consumed by palette / placement / restart | `src/main.js` | `playSfx('uiClick')` |
| Projectile spawned | `src/game/defenses.js` (interceptor fire path) | `playSfx('interceptorLaunch')` |
| Drone dies (any cause) | `src/game/drones.js` (kill path) | `playSfx('droneKill')` |
| Laser enters `firing` state | `src/game/defenses.js` | `startSfx('laserFire', 'laser-' + d.id)` |
| Laser leaves `firing` state (to `cold` or `overheated`) | `src/game/defenses.js` | `stopSfx('laser-' + d.id)` |
| Laser transitions `firing → overheated` | `src/game/defenses.js` | `playSfx('laserOverheat')` |
| HPM fires a pulse | `src/game/defenses.js` | `playSfx('hpmPulse')` |
| RF Jammer has ≥1 drone in range this frame (transition from 0) | `src/game/defenses.js` | `startSfx('rfJam', 'rf-' + d.id)` |
| RF Jammer has 0 drones in range (transition from ≥1) | `src/game/defenses.js` | `stopSfx('rf-' + d.id)` |
| Structure HP crosses to 0 | `src/game/structures.js` | `playSfx('structureDestroyed')` |
| All structures destroyed (`loseFlag` becomes true) | `src/game/structures.js` | `playSfx('lose')` |
| Wave transitions `prep → active` | `src/game/wave.js` | `playSfx('waveStart')` |
| Final wave cleared (`winFlag` becomes true) | `src/game/wave.js` | `playSfx('win')` |

Continuous sounds need **transition detection**: the defense update loop must track the previous-frame state (laser firing/not, RF jam active/not) and fire start/stop only on the flip. Each defense object gets a `prevSfxState` field (simple boolean or enum) added to its per-instance state; initialized when `placeDefense` creates it.

---

## Mute icon

- Rendered by `renderMuteIcon(ctx)` at `(CONFIG.virtualWidth - 12, 8)` (4-px inset from top-right of top chrome). 8×8 px glyph.
- Unmuted glyph: 4×6 speaker cone (filled `accentWhite`) + 3 sound-wave arcs right of the cone (2-px lines).
- Muted glyph: same speaker cone + a diagonal red strike-through bar (`threatRed`, 1px thick, corner-to-corner of the 8×8 box).
- Hit rect: 12×12, inset 2 px around the glyph (generous to ease clicking at display scale).
- Rendered AFTER `renderChrome` so it sits on top of the top bar. Rendered BEFORE `renderBriefing` / overlays.

---

## Edge cases

- **Rapid fire:** player selecting/deselecting palette fast produces many `uiClick` calls. Each creates a fresh one-shot — trivial cost. No rate-limiting.
- **Many simultaneous drone kills** (wave 5 saturation): up to ~20 `droneKill` one-shots in a few frames. Each is ~250ms with 2 nodes; total ~40 nodes alive for a quarter second. Web Audio handles hundreds of concurrent nodes comfortably.
- **Continuous sound leaks:** a defense destroyed mid-firing must call `stopSfx(id)` to clean up. (No defense destruction path exists in v1 — they can't be removed. If removal is added later, hook `stopSfx` there.)
- **Laser enters overheated while firing:** state transition fires `laserOverheat` one-shot AND calls `stopSfx('laser-' + id)` because `firing → overheated` is a "leaves firing" transition. Both sounds play in the same frame; ordering: stop first, then play one-shot.
- **localStorage unavailable** (private mode, SecurityError): catch and silently default to unmuted. Mute state lost on reload; not a blocker.
- **Autoplay block on first frame:** no sound is triggered from the render loop. All first-sound paths run from user gestures (click / keydown). No AudioContext `resume()` dance needed.

---

## Verification

Manual per `CLAUDE.md:61`. No automated tests.

1. `npx serve`, load page. No sound on idle — AudioContext not created yet.
2. Click anywhere — first `uiClick` plays (50ms square blip).
3. Start wave 1 — hear `waveStart` (3-note alert) at `prep → active`.
4. Place interceptor, let it fire — each shot plays `interceptorLaunch`; each drone death plays `droneKill`.
5. Place laser, let it fire continuously — hear `laserFire` hum for duration. Stop firing → silence. Overheat → `laserOverheat` beeps, hum stops.
6. Place HPM, wait for pulse — `hpmPulse` thump.
7. Place RF Jammer with drones in range — hear `rfJam` hiss. Drones leave range — silence.
8. Let a structure die — `structureDestroyed` boom.
9. Let all structures die — `lose` stinger; DEFENSE FAILED overlay.
10. Win run → `win` arpeggio.
11. Press `M` — all audio mutes instantly. Mute icon shows strike-through. Press again — unmutes.
12. Click mute icon — same behavior.
13. Reload page — mute state preserved.
14. Open DevTools → no `unknown sound` warnings. No errors.

---

## Out of scope

- Volume slider / granular volume (binary mute only).
- Drone buzz looped per drone (complex mix; noise risk).
- Structure-hit one-shot (every contact would clutter).
- Wave-cleared chime (redundant with next `waveStart`).
- Spatial / positional audio panning.
- Music integration (issue #14, separate).
- Unit tests (no test harness exists).

---

## Risks / open items

- **Sound tuning is subjective.** These synth sketches will need playtest iteration. Each sound is a ~15–30 line function — tuning is cheap.
- **Laser-overheat race:** the spec requires `firing → overheated` to fire *both* `stopSfx('laser-…')` and `playSfx('laserOverheat')` in the correct order. Implementer must be careful to not double-call on subsequent frames.
- **RF jam transition is frame-sensitive:** the "0 → ≥1 drones in range" flip happens in the jam-apply path. Needs a stable "is-jamming-this-frame" observation across frames. Risk: implementation bug causing flicker start/stop as drones hover at range edge. Mitigation: add a small debounce (e.g., ≥2 frames of zero before stopping). Spec-level note, not required for v1.
