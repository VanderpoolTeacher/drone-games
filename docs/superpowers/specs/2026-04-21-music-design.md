# Background Music — Design

**Date:** 2026-04-21
**Status:** Approved via brainstorm
**Issue:** [#14](https://github.com/VanderpoolTeacher/drone-games/issues/14)
**Scope:** Phase-driven background music — unique track per wave-prep and wave-active phase + win/lose stingers, 500ms crossfade, shared mute with SFX.

---

## Design thesis alignment

From `STYLE.md` / `CLAUDE.md`: retro arcade, command-center vibe. The 13 hand-authored tracks carry that tone directly; the job of this feature is to schedule them cleanly around gameplay phases.

From `DESIGN.md` wave progression: each wave should *feel* distinct. Pairing a unique prep + active track per wave is the simplest way to make that escalation audible.

---

## Architecture

- **`src/audio/music.js`** (new) owns: the track playlist (one `HTMLAudioElement` per key, created lazily on first use), a map of per-track `GainNode`s for crossfade automation, a single `musicGain` node, and the `updateMusic(state)` frame driver.
- Routing: each track's `MediaElementAudioSourceNode` → its own `GainNode` → `musicGain` → the existing `masterGain` from `sfx.js` → `audioContext.destination`.
- Mute via the existing `M` / speaker icon toggles `masterGain` → 0, silencing both SFX and music together. No separate music mute in v1.
- `musicGain.gain.value = CONFIG.music.volume` (default 0.4) — music sits under SFX at full gain.

### Streaming vs. decoded

Tracks are loaded via `HTMLAudioElement.src`, which streams from disk via `npx serve`. This keeps memory low (~5MB of mp3 per track vs. ~50MB decoded PCM). `createMediaElementSource` wraps the element into a node that routes through the standard Web Audio graph, so crossfade automation still works.

`audio.loop = true` on each element — native looping with no seam work required.

### Lazy element creation

Tracks are NOT preloaded. The element for key `'Fortress Beat'` is created the first time `playTrack('Fortress Beat')` is called. Cached in a `Map<key, { audio, source, gain }>` so subsequent calls reuse the same element.

First-time load introduces a brief delay (browser must fetch + decode enough of the mp3 to start playback). Acceptable for a 15-second prep phase; empirically mp3s start within 200–400ms on local serve.

---

## Crossfade

On `playTrack(newKey)`:

1. If `newKey === currentKey` → no-op.
2. Else:
   - If a current track exists: fade its `GainNode` from current value → 0 over 500ms (linear ramp). Schedule a `pause()` at `now + 500ms` via `setTimeout` so it stops cleanly without audible cut. Also schedule reset of `audio.currentTime = 0` after pause so next replay starts from the top.
   - Create-or-reuse the new track's element + nodes. If it's the first time: `new Audio()`, `createMediaElementSource`, new `GainNode`, wire graph, `play()`. If already cached: rewire is not needed, just `play()` (it had been paused + rewound earlier).
   - Set the new track's gain to 0, then ramp 0 → 1 over 500ms.
3. Update `currentKey`.

All ramps use `linearRampToValueAtTime`.

---

## Track mapping

Authored in `CONFIG.music` (new block in `src/config.js`):

```js
music: {
  waves: [
    { prep: 'Barbed Lullaby',    active: 'Barricade Pulse' },    // Wave 1
    { prep: 'Fortress Rations',  active: 'Fortress Beat' },      // Wave 2
    { prep: 'Barricade Static',  active: 'Determined Forces' },  // Wave 3
    { prep: 'Steel Rations',     active: 'Marching Forth' },     // Wave 4
    { prep: 'Welded Bastion',    active: 'Steel Hero' },         // Wave 5
  ],
  win: 'Avenged',
  lose: 'Fallen Not Forgotten',
  volume: 0.4,
  crossfadeMs: 500,
}
```

Bench (unused in v1, kept for future tuning): `Fortress Static`.

`src/audio/music.js` resolves a track key (e.g., `'Fortress Beat'`) to its file path: `./src/music/${key}.mp3`.

---

## Driver: `updateMusic(state)`

Single entry point called once per frame from `src/main.js`. No scattered triggers across game modules. Logic:

```js
export function updateMusic(state) {
  const key = musicKeyForState(state);
  if (key === null) return;           // no key yet (e.g., pre-first-click)
  if (key === currentKey) return;     // already playing the right track
  playTrack(key);
}

function musicKeyForState(state) {
  if (state.loseFlag) return CONFIG.music.lose;
  if (state.winFlag) return CONFIG.music.win;
  const entry = CONFIG.music.waves[state.wave.number - 1];
  if (!entry) return null;
  if (state.wave.phase === 'prep')    return entry.prep;
  if (state.wave.phase === 'active')  return entry.active;
  if (state.wave.phase === 'won')     return CONFIG.music.win;  // defensive
  return null;
}
```

Transitions happen automatically as `state.wave.phase` / `state.wave.number` / `state.loseFlag` / `state.winFlag` change. No manual triggers in `wave.js` / `structures.js` / etc.

---

## Autoplay policy

Browsers block audio until a user gesture. The AudioContext is already created on first SFX click (see `sfx.js`). Music playback can start as soon as the context exists — so `updateMusic` no-ops until `getCtx()` has been called at least once. First SFX fire (palette/placement click) unblocks music.

Concretely: `music.js` checks `audioContext?.state === 'running'` before calling `play()` on any element. Skip silently otherwise; next frame retries.

---

## Module API

```js
// music.js public API
export function updateMusic(state)      // called once per frame
export function stopMusic()             // pauses + unloads current track
export function setMusicVolume(v)       // 0..1 — updates musicGain.gain
```

Plus `sfx.js` must expose its `masterGain` + `getCtx` (either via new exports or a shared internal helper) so `music.js` can hook into the same graph.

---

## File layout

| File | Action |
|---|---|
| `src/audio/music.js` | Create |
| `src/audio/sfx.js` | Modify — export `getAudioContext()` + `getMasterGain()` so music can plug in |
| `src/config.js` | Modify — add `music` block |
| `src/main.js` | Modify — import `updateMusic`, call it once per frame |

No changes to `index.html`. The 13 mp3s are already in `src/music/` (untracked); this branch commits them.

---

## Verification

Manual per `CLAUDE.md:61`. No automated tests.

1. `npx serve -l 3000`. Open page. Silent at rest (no audio until first click).
2. Click palette → SFX plays, and wave-1 prep track ("Barbed Lullaby") fades in ~500ms.
3. Wait out prep timer → track crossfades to wave-1 active ("Barricade Pulse") at `prep → active`.
4. Finish wave 1 → crossfade to wave-2 prep ("Fortress Rations"). Continue through all 5 waves observing each prep/active pair matches the mapping.
5. Win wave 5 → crossfade to "Avenged". Overlay shows CITY HELD with Warden subtitle.
6. Restart, let city fall → crossfade to "Fallen Not Forgotten". Overlay shows DEFENSE FAILED.
7. Press `M` → music mutes with SFX instantly.
8. Press `M` again → resumes.
9. Reload → mute state preserved; music starts again on first click.
10. DevTools Network tab: first wave-1 prep track streams from `./src/music/Barbed Lullaby.mp3`. No 404s. No console errors.
11. CPU / FPS stays at 60 during crossfade.

---

## Out of scope

- Separate music volume slider / separate music mute.
- Stem-based layering (cross-fading stems within a track).
- Random playlist / shuffle.
- Dedicated "cleared wave" chime between active and next prep (goes straight to next prep track).
- Preloading with progress indicator.
- LFS for the mp3s — 13 × ~3–5MB ≈ 45MB, under GitHub's per-file limit and fine for a prototype repo.

---

## Risks / open items

- **50MB of mp3s in the repo.** Acceptable for a class prototype but not a long-term pattern. Flag in DECISIONS; don't add more audio without revisiting.
- **Reset mid-track doesn't flush the audio graph.** `resetGameState` returns to wave-1 prep; `musicKeyForState` will return the wave-1 prep key; `playTrack` no-ops if that track was already playing, but crossfades if not. Behavior is correct but subtle — note in code.
- **Track name → filename contains spaces.** `encodeURI` will be used at load time so the URL is valid.
- **Autoplay edge case** — if `AudioContext.state` remains `'suspended'` after the first click (rare; Safari edge cases), music never starts. Mitigation: call `audioContext.resume()` inside `updateMusic` if state is `'suspended'` but `audioContext` exists. One extra line.
