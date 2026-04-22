# Tuning Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a balance pass that extends each active phase to 90–120s, slows drones (with compensating HP bumps), adds per-run variability (count + interval jitter + random corridor selection), and tightens the player economy.

**Architecture:** Most work is config changes in `src/config.js`. Two logic touches: (1) `src/game/wave.js` builds `spawnProgress` with jittered counts + honors a new `spawnDelayMs` group offset + applies per-spawn interval jitter; (2) `src/game/drones.js` picks corridors at random instead of round-robin; the now-unused `state.spawnRotation` field is removed from `src/game/state.js`.

**Tech Stack:** Vanilla JS ES modules, no build, no test harness. Manual browser verification per `CLAUDE.md:61`.

**Spec reference:** `docs/superpowers/specs/2026-04-21-tuning-pass-design.md`

---

## File layout

| File | Action | Responsibility |
|------|--------|----------------|
| `src/config.js` | Modify | All tuning numbers + wave compositions with new `spawnDelayMs` per-group field |
| `src/game/wave.js` | Modify | Honor `spawnDelayMs`; count jitter `±2` at wave start; per-spawn interval jitter `±15%` |
| `src/game/drones.js` | Modify | Random corridor selection in `spawnDrone` (was round-robin) |
| `src/game/state.js` | Modify | Remove now-unused `spawnRotation` field + its resets |

---

## Task 1: Config — drone stats, waves, structures, economy, prep time

**Files:**
- Modify: `src/config.js`

Several atomic numbers + wave-composition rewrite. All changes are in `src/config.js`.

### Step 1: Drone stats

- [ ] **Change `drones.isr.speed` 60 → 45**

In `src/config.js`, locate the `isr` drone block (currently around lines 35–43). Change:

```js
    isr: {
      displayName: 'ISR Drone',
      classification: 'Group 1 sUAS, ISR',
      controlMode: 'fpv',
      hp: 20,
      speed: 60,
      size: 16,
    },
```

to:

```js
    isr: {
      displayName: 'ISR Drone',
      classification: 'Group 1 sUAS, ISR',
      controlMode: 'fpv',
      hp: 20,
      speed: 45,
      size: 16,
    },
```

- [ ] **Change `drones.owa.speed` 140 → 100 and `drones.owa.hp` 15 → 25**

Locate the `owa` block. Change:

```js
    owa: {
      displayName: 'OWA Drone',
      classification: 'Group 1 OWA / loitering munition',
      controlMode: 'preprogrammed',
      hp: 15,
      speed: 140,
      size: 16,
    },
```

to:

```js
    owa: {
      displayName: 'OWA Drone',
      classification: 'Group 1 OWA / loitering munition',
      controlMode: 'preprogrammed',
      hp: 25,
      speed: 100,
      size: 16,
    },
```

- [ ] **Change `drones.payloadDelivery.speed` 30 → 25 and `drones.payloadDelivery.hp` 120 → 160**

Locate the `payloadDelivery` block. Change:

```js
    payloadDelivery: {
      displayName: 'Payload-Delivery Drone',
      classification: 'Group 2 sUAS, payload role',
      controlMode: 'preprogrammed',
      hp: 120,
      speed: 30,
      size: 16,
    },
```

to:

```js
    payloadDelivery: {
      displayName: 'Payload-Delivery Drone',
      classification: 'Group 2 sUAS, payload role',
      controlMode: 'preprogrammed',
      hp: 160,
      speed: 25,
      size: 16,
    },
```

### Step 2: Wave compositions (rewrite all 5)

- [ ] **Replace the entire `waves: [ ... ]` array** (currently lines ~125–170)

Replace with the following. Each wave gets a new `spawnDelayMs` field per drone group (defaults to 0 when missing — wave.js will handle both shapes). Briefings + portraits are preserved verbatim:

```js
  waves: [
    // Wave 1 — Probe (90s active target). ISR only; longer cadence.
    {
      drones: [
        { type: 'isr', count: 15, spawnInterval: 5500, spawnDelayMs: 0 },
      ],
      briefing: "First watch. ISR only — no teeth on 'em, just eyes. Get an RF jammer up north; that breaks their link. Easy start. You got this.",
      portrait: 'neutral',
    },
    // Wave 2 — Pressure (95s). More ISR, tighter cadence.
    {
      drones: [
        { type: 'isr', count: 20, spawnInterval: 4500, spawnDelayMs: 0 },
      ],
      briefing: "More ISR, heavier volume this time. Widen your jammer coverage. Don't let 'em slip past on the edges.",
      portrait: 'neutral',
    },
    // Wave 3 — Strike (100s). ISR + OWA mix; OWA starts 10s in.
    {
      drones: [
        { type: 'isr', count: 12, spawnInterval: 6000, spawnDelayMs: 0 },
        { type: 'owa', count: 10, spawnInterval: 8000, spawnDelayMs: 10000 },
      ],
      briefing: "They're mixing now. ISR north, OWA east. RF won't catch a committed OWA — it's preprogrammed, no link to kill. Interceptors east.",
      portrait: 'stern',
    },
    // Wave 4 — Heavy (110s). OWA first, Payload 20s in.
    {
      drones: [
        { type: 'owa', count: 12, spawnInterval: 8000, spawnDelayMs: 0 },
        { type: 'payloadDelivery', count: 6, spawnInterval: 15000, spawnDelayMs: 20000 },
      ],
      briefing: "Payload birds inbound west — armored, so interceptors'll chip but laser burns through fast. OWA's still pressing east; keep that corridor locked.",
      portrait: 'stern',
    },
    // Wave 5 — Saturation (120s). All three types; Payload waits 5s.
    {
      drones: [
        { type: 'isr', count: 18, spawnInterval: 5000, spawnDelayMs: 0 },
        { type: 'owa', count: 20, spawnInterval: 5000, spawnDelayMs: 0 },
        { type: 'payloadDelivery', count: 7, spawnInterval: 12000, spawnDelayMs: 5000 },
      ],
      briefing: "All of it. Saturation run — ISR, OWA, Payload, everything. You need the full stack. HPM earns its keep here. One pulse, many drones. Good luck, Watchfloor.",
      portrait: 'angry',
    },
  ],
```

### Step 3: Prep time, structures, economy

- [ ] **`CONFIG.prepTimeBetweenWaves` 15000 → 20000**

Change the line (currently around line 161):

```js
  prepTimeBetweenWaves: 15000,       // ms — player gets 15s between waves
```

to:

```js
  prepTimeBetweenWaves: 20000,       // ms — 20s prep window between waves
```

- [ ] **Structures: `maxHP` 100 → 120; `damageFromOWAStrike` 30 → 25; `damageFromPayloadDrop` 60 → 50**

Locate the `structures` block (around lines 25–31). Change:

```js
  structures: {
    count: 3,
    maxHP: 100,
    damageFromOWAStrike: 30,       // kamikaze contact
    damageFromPayloadDrop: 60,     // area-effect payload
  },
```

to:

```js
  structures: {
    count: 3,
    maxHP: 120,
    damageFromOWAStrike: 25,       // kamikaze contact
    damageFromPayloadDrop: 50,     // area-effect payload
  },
```

- [ ] **Economy: `startingResources`, `resourcesPerWaveBonus`, `resourcesPerDroneKill`**

Locate the Economy block (around lines 17–24). Change:

```js
  startingResources: 400,
  resourcesPerWaveBonus: 200,
  resourcesPerDroneKill: {
    isr: 10,
    owa: 15,
    payloadDelivery: 35,
  },
```

to:

```js
  startingResources: 350,
  resourcesPerWaveBonus: 150,
  resourcesPerDroneKill: {
    isr: 8,
    owa: 12,
    payloadDelivery: 30,
  },
```

### Step 4: Commit

- [ ] **Commit Task 1**

```bash
git add src/config.js
git commit -m "Task 1: config tuning — speeds/HP, wave comps with spawnDelayMs, structures, economy, 20s prep"
```

---

## Task 2: `wave.js` — count jitter, spawn delay, interval jitter

**Files:**
- Modify: `src/game/wave.js`

Replace the `updateWave` function so that when a wave transitions `prep → active`, each group gets a jittered `count`, respects `spawnDelayMs`, and jitters each individual spawn's interval by `±15%`.

- [ ] **Step 1: Replace `src/game/wave.js` contents**

Write this file:

```js
import { CONFIG } from '../config.js';
import { spawnDrone } from './drones.js';
import { playSfx, stopAllContinuous } from '../audio/sfx.js';

function jitterInterval(ms) {
  return ms * (0.85 + Math.random() * 0.3);   // ±15%
}

function jitterCount(base) {
  const delta = Math.floor(Math.random() * 5) - 2;   // -2..+2 inclusive
  return Math.max(1, base + delta);
}

export function updateWave(state, dt) {
  if (state.wave.phase === 'prep') {
    state.wave.prepMs -= dt * 1000;
    if (state.wave.prepMs <= 0) {
      state.wave.phase = 'active';
      state.wave.spawnProgress = CONFIG.waves[state.wave.number - 1].drones.map(d => ({
        type: d.type,
        count: jitterCount(d.count),
        spawnInterval: d.spawnInterval,
        spawnDelayMs: d.spawnDelayMs ?? 0,
        timerMs: 0,
        spawned: 0,
        currentDelay: jitterInterval(d.spawnInterval),
      }));
      playSfx('waveStart');
    }
    return;
  }

  if (state.wave.phase === 'active') {
    for (const p of state.wave.spawnProgress) {
      if (p.spawned >= p.count) continue;
      p.timerMs += dt * 1000;

      // Respect per-group start offset: don't spawn anything until
      // timerMs has ticked past spawnDelayMs.
      if (p.timerMs < p.spawnDelayMs) continue;

      // After the group starts, timerMs is measured from spawnDelayMs so
      // the first spawn fires roughly immediately at group start.
      const postStartMs = p.timerMs - p.spawnDelayMs;
      while (postStartMs >= p.currentDelay && p.spawned < p.count) {
        spawnDrone(state, p.type);
        p.spawned += 1;
        p.timerMs -= p.currentDelay;
        p.currentDelay = jitterInterval(p.spawnInterval);
      }
    }

    const allSpawned = state.wave.spawnProgress.every(p => p.spawned >= p.count);
    if (allSpawned && state.drones.length === 0) {
      if (state.wave.number < CONFIG.waves.length) {
        state.resources += CONFIG.resourcesPerWaveBonus;
        state.wave.number += 1;
        state.wave.phase = 'prep';
        state.wave.prepMs = CONFIG.prepTimeBetweenWaves;
        state.wave.spawnProgress = [];
      } else {
        // Final wave cleared — no bonus paid; winFlag fires instead.
        state.wave.phase = 'won';
        state.winFlag = true;
        stopAllContinuous();
        playSfx('win');
      }
    }
    return;
  }
}
```

Notes on the change:
- `spawnInterval` is the AUTHORED base. Each ACTUAL spawn uses `currentDelay` which is freshly jittered after every spawn.
- `jitterCount(d.count)` → integer in `[max(1, d.count-2), d.count+2]`.
- `spawnDelayMs` is the lead-in before a group starts producing drones. Defaults to 0 via `?? 0` for wave-1/2 groups where the field is present with value 0, and also for any legacy config without the field at all.
- Control flow fix: we subtract `p.currentDelay` from `timerMs` after spawning (not from `postStartMs`) because `timerMs` is the authoritative ticker — `postStartMs` is a derived read.

Wait: the `while (postStartMs >= p.currentDelay …)` loop as written above will only evaluate `postStartMs` once at loop entry, then `p.currentDelay` and `timerMs` mutate inside. That's a bug. Re-derive `postStartMs` each iteration:

Replace the while loop body with this re-derivation pattern. The corrected `active` branch looks like:

```js
  if (state.wave.phase === 'active') {
    for (const p of state.wave.spawnProgress) {
      if (p.spawned >= p.count) continue;
      p.timerMs += dt * 1000;
      if (p.timerMs < p.spawnDelayMs) continue;

      while (p.spawned < p.count && (p.timerMs - p.spawnDelayMs) >= p.currentDelay) {
        spawnDrone(state, p.type);
        p.spawned += 1;
        p.timerMs -= p.currentDelay;
        p.currentDelay = jitterInterval(p.spawnInterval);
      }
    }

    // …rest unchanged
  }
```

That's the correct body. Use it. Discard the earlier `postStartMs` local variable; inline it in the loop condition.

- [ ] **Step 2: Manual verify**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games"
pkill -f "npx serve" 2>/dev/null
npx serve -l 3000 &
sleep 2
```

Open `http://localhost:3000/`.

1. Let wave 1 play. Expected: ISR drones spawn over ~80–90 seconds. Spawn timing should feel organic (not clockwork).
2. Force-play to wave 3. OWA drones should start appearing ~10 s into the active phase, not immediately at phase start.
3. Play two runs back-to-back. Count of ISR drones in wave 1 should vary — one run might have 13, the next 17.
4. No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/wave.js
git commit -m "Task 2: wave.js — count jitter, spawnDelayMs, per-spawn interval jitter"
```

---

## Task 3: `drones.js` random corridor + remove `state.spawnRotation`

**Files:**
- Modify: `src/game/drones.js`
- Modify: `src/game/state.js`

- [ ] **Step 1: Grep for `spawnRotation` references**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games"
grep -n "spawnRotation" src/**/*.js
```

Expected matches:
- `src/game/drones.js` — in `spawnDrone` (the round-robin read/write)
- `src/game/state.js` — in the state object + `resetGameState`

No other files should reference it.

- [ ] **Step 2: Modify `spawnDrone` in `src/game/drones.js`**

Locate the function (currently lines 13–46). Replace the corridor-selection lines:

```js
  const corridorIdx = state.spawnRotation[type] % corridors.length;
  state.spawnRotation[type] = (state.spawnRotation[type] + 1) % corridors.length;
```

with:

```js
  const corridorIdx = Math.floor(Math.random() * corridors.length);
```

The rest of the function is unchanged.

- [ ] **Step 3: Remove `spawnRotation` from `src/game/state.js`**

Locate the `gameState` object (around lines 10–39). Remove this line:

```js
  spawnRotation: { isr: 0, owa: 0, payloadDelivery: 0 },
```

Locate `resetGameState` (around lines 41–72). Remove these three lines:

```js
  gameState.spawnRotation.isr = 0;
  gameState.spawnRotation.owa = 0;
  gameState.spawnRotation.payloadDelivery = 0;
```

- [ ] **Step 4: Manual verify**

Reload `http://localhost:3000/`. Play wave 1 twice. Corridor choice for each ISR drone should visibly scatter across the authored edges, not cycle sequentially. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/drones.js src/game/state.js
git commit -m "Task 3: random corridor selection; drop now-unused state.spawnRotation"
```

---

## Task 4: Docs

**Files:**
- Modify: `DECISIONS.md`
- Modify: `TODO.md`
- Modify: `PLAYTESTS.md`

- [ ] **Step 1: Append tuning entries to `DECISIONS.md`**

Open `DECISIONS.md`. Append at the end using the existing flat `YYYY-MM-DD — sentence` style:

```markdown

2026-04-21 — Tuning pass #1. Target session length 11–12 min. Each active phase extended to 90–120s to give defenses time to visibly engage and let music tracks play through.

2026-04-21 — Drone speeds reduced across the board (ISR 60→45, OWA 140→100, Payload 30→25). OWA HP 15→25 and Payload HP 120→160 compensate — Interceptors no longer one-shot OWA; Laser burn-through on Payload is a real time window.

2026-04-21 — Wave compositions now include a per-group `spawnDelayMs` field so later drone types enter mid-wave (wave-3 OWA at +10s, wave-4 Payload at +20s, wave-5 Payload at +5s). Tells a tactical story inside a single wave instead of dumping everything at once.

2026-04-21 — Wave variability: each wave rolls count ±2 per drone group at `prep → active`, plus ±15% per-spawn interval jitter, plus random (not round-robin) corridor selection. Same wave identity (Probe, Pressure, Strike, Heavy, Saturation), different run-to-run feel.

2026-04-21 — Economy tightened: start 400→350, wave bonus 200→150, kill rewards ISR 10→8 / OWA 15→12 / Payload 35→30. Forces real allocation choices; can't afford one of every defense class on turn 1.

2026-04-21 — Structure maxHP 100→120; OWA strike damage 30→25; Payload drop damage 60→50. More drones hit per run, so per-hit damage drops to keep the game from collapsing on a single leak.

2026-04-21 — `state.spawnRotation` removed (was round-robin corridor index). No longer used; random corridor selection in spawnDrone supersedes it.
```

- [ ] **Step 2: Flip Step 8 in `TODO.md` to done-ish**

Open `TODO.md`. Find the line:

```markdown
- [ ] Step 8: tuning pass — balance via playtesting
```

Replace with:

```markdown
- [~] Step 8: tuning pass — first pass shipped (issues #1, #15); expect follow-up after external playtest
```

- [ ] **Step 3: Append session entry to `PLAYTESTS.md`**

Open `PLAYTESTS.md`. Insert a new session at the top (newest-first convention), directly after the `<!-- First playtest goes below. ... -->` comment and before the next `## YYYY-MM-DD` block:

```markdown
## 2026-04-21 — solo (Tuning pass #1)

**Build:** feat/tuning-pass — 90-120s active phases, slower/tougher drones, wave variability, tighter economy
**Session length:** ~12 min full run
**Result:** N/A (feature pass; needs real external playtest to validate difficulty)

### What happened
- All 5 waves ran ~90-120s as targeted. Music tracks played through at least one full listen each.
- Wave-3 OWA and wave-4 Payload enter mid-wave feels right — pushes player to re-read the threat.
- Two back-to-back runs had noticeably different drone counts per wave.

### What worked
- Slower drones make laser/interceptor engagements visibly play out. Big readability improvement.
- Corridor randomization means defense placements that covered one edge last run can leak next run. Forces adaptive play.
- Tighter opening hand (350 starting resources) makes the first palette decision meaningful.

### What felt off
- Wave 1 at 90s might still feel long for first-time players — monitor in external playtest.
- Count jitter ±2 on small base counts (wave-4 Payload base 6) can swing to 4 — big variance on a key threat. Consider tightening to ±1 for small groups.
- Slower OWA feels a bit too slow at 100 px/s — may need a small bump to preserve the "scary urgency" feel.

### Questions raised
- Should count jitter be clamped to a minimum percentage (e.g. at least 75% of base) instead of ±2 absolute?
- Should Payload drop damage 50 be reduced further, or is HP 120 enough to absorb a single hit?
```

- [ ] **Step 4: Commit**

```bash
git add DECISIONS.md TODO.md PLAYTESTS.md
git commit -m "Task 4: tuning pass docs — decisions, todo partial, playtest entry"
```

---

## Self-review checklist (controller runs before hand-off)

1. **Spec coverage**
   - Prep time 20s → Task 1 Step 3 ✓
   - All drone stat changes (ISR/OWA/Payload speed + HP) → Task 1 Step 1 ✓
   - All 5 wave compositions with spawnDelayMs → Task 1 Step 2 ✓
   - Structure HP + damage changes → Task 1 Step 3 ✓
   - Economy changes → Task 1 Step 3 ✓
   - Count jitter at prep→active → Task 2 Step 1 ✓
   - Per-spawn interval jitter → Task 2 Step 1 ✓
   - spawnDelayMs honored → Task 2 Step 1 ✓
   - Random corridor selection → Task 3 Step 2 ✓
   - Remove spawnRotation → Task 3 Step 3 ✓
   - Docs → Task 4 ✓

2. **Type consistency**
   - `spawnProgress` entries keep fields `{type, count, spawnInterval, spawnDelayMs, timerMs, spawned, currentDelay}` across Task 2.
   - `CONFIG.waves[i].drones[j]` gains a `spawnDelayMs` field in Task 1 Step 2 and is consumed in Task 2 Step 1 via `d.spawnDelayMs ?? 0`.
   - Helpers `jitterInterval(ms)` and `jitterCount(base)` defined once in Task 2 Step 1 and used consistently.

3. **Placeholder scan** — no TBD / TODO / "similar to" / vague-handling placeholders.

4. **Logic audit** (Task 2 critical path):
   - `p.timerMs < p.spawnDelayMs` — group hasn't started yet → continue.
   - `while (p.spawned < p.count && (p.timerMs - p.spawnDelayMs) >= p.currentDelay)` — re-derives the "post-start" check each iteration.
   - On spawn: `p.timerMs -= p.currentDelay` consumes exactly one jittered interval. `p.currentDelay = jitterInterval(p.spawnInterval)` rolls the next wait. This keeps authored `spawnInterval` as the base, with independent jitter per spawn.
