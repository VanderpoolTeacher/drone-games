# Tuning Pass — Design

**Date:** 2026-04-21
**Status:** Approved via brainstorm
**Issues:** [#1](https://github.com/VanderpoolTeacher/drone-games/issues/1) (difficulty), [#15](https://github.com/VanderpoolTeacher/drone-games/issues/15) (waves too short)
**Scope:** Balance pass — longer active phases, slower drones with more HP, wave-run variability (count + interval jitter + corridor randomization), tightened economy.

---

## Design thesis alignment

From `DESIGN.md` design thesis:
- *Layered defense* — slower drones and tougher Payloads push the player toward matchup-aware placements instead of stacking one defense.
- *Cost-exchange* — tighter economy makes each placement decision meaningful; the player has to choose between more cheap jammers vs. fewer expensive lasers.

From `DESIGN.md` wave progression: each wave teaches a lesson. The tuning pass preserves wave identity (Probe, Pressure, Strike, Heavy, Saturation) while making each wave last long enough for the lesson to land and the music to play out.

---

## Session shape

| | Prep | Active (target) |
|---|---|---|
| Wave 1 — Probe | 20 s | ~90 s |
| Wave 2 — Pressure | 20 s | ~95 s |
| Wave 3 — Strike | 20 s | ~100 s |
| Wave 4 — Heavy | 20 s | ~110 s |
| Wave 5 — Saturation | 20 s | ~120 s |
| **Total** | 100 s prep | ~9.3 min active |

Total full run ≈ **~11–12 minutes**.

`CONFIG.prepTimeBetweenWaves`: 15000 → **20000**.

---

## Drone stats

| Drone | Field | Current | New |
|---|---|---|---|
| isr | speed | 60 | **45** |
| isr | hp | 20 | 20 |
| owa | speed | 140 | **100** |
| owa | hp | 15 | **25** |
| payloadDelivery | speed | 30 | **25** |
| payloadDelivery | hp | 120 | **160** |

Rationale:
- **ISR slower** — defenses have time to visibly engage; trails read better.
- **OWA slower + tougher** — Interceptors can't one-shot; commit line is readable; still fastest and most threatening.
- **Payload slower + tougher** — Laser burn-through becomes a meaningful time window instead of a 1-second zap.

---

## Wave compositions

All entries in `CONFIG.waves[i].drones` change. Each group has a `spawnDelayMs` offset (new field, defaults 0) so we can start groups mid-wave.

```js
waves: [
  // Wave 1 — Probe (90s)
  {
    drones: [
      { type: 'isr', count: 15, spawnInterval: 5500, spawnDelayMs: 0 },
    ],
    briefing: "...",     // unchanged
    portrait: 'neutral',
  },

  // Wave 2 — Pressure (95s)
  {
    drones: [
      { type: 'isr', count: 20, spawnInterval: 4500, spawnDelayMs: 0 },
    ],
    briefing: "...",
    portrait: 'neutral',
  },

  // Wave 3 — Strike (100s)
  {
    drones: [
      { type: 'isr', count: 12, spawnInterval: 6000, spawnDelayMs: 0 },
      { type: 'owa', count: 10, spawnInterval: 8000, spawnDelayMs: 10000 },
    ],
    briefing: "...",
    portrait: 'stern',
  },

  // Wave 4 — Heavy (110s)
  {
    drones: [
      { type: 'owa', count: 12, spawnInterval: 8000, spawnDelayMs: 0 },
      { type: 'payloadDelivery', count: 6, spawnInterval: 15000, spawnDelayMs: 20000 },
    ],
    briefing: "...",
    portrait: 'stern',
  },

  // Wave 5 — Saturation (120s)
  {
    drones: [
      { type: 'isr', count: 18, spawnInterval: 5000, spawnDelayMs: 0 },
      { type: 'owa', count: 20, spawnInterval: 5000, spawnDelayMs: 0 },
      { type: 'payloadDelivery', count: 7, spawnInterval: 12000, spawnDelayMs: 5000 },
    ],
    briefing: "...",
    portrait: 'angry',
  },
],
```

`briefing` and `portrait` fields unchanged.

---

## Variability

Applied fresh at every `prep → active` transition in `src/game/wave.js` when `spawnProgress` is built.

### Count jitter

Each group's `count` = `base + randInt(-2, +2)` with a floor of 1.

### Interval jitter

Each *individual* spawn's timing uses `effectiveInterval = spawnInterval * (0.85 + Math.random() * 0.3)`. That's ±15 % wobble. Applied per-spawn (not per-group) so timing feels organic.

To make it per-spawn, `spawnProgress` groups store `spawnInterval` and on each spawn compute the jittered delay for the *next* spawn:

```js
while (p.timerMs >= p.currentDelay && p.spawned < p.count) {
  spawnDrone(state, p.type);
  p.spawned += 1;
  p.timerMs -= p.currentDelay;
  p.currentDelay = jitter(p.spawnInterval);
}
```

Where `jitter(ms) = ms * (0.85 + Math.random() * 0.3)`.

### Group start delay

New `spawnDelayMs` field on each group. Group doesn't start spawning until `p.timerMs >= spawnDelayMs`. Used to offset wave-3 OWA (starts 10 s in) and wave-4 Payload (starts 20 s in).

### Corridor randomization

`src/game/drones.js`: change corridor selection in `spawnDrone` from round-robin (uses `state.spawnRotation`) to random. `state.spawnRotation` field can stay for backwards-compat but is no longer read — remove it.

```js
export function spawnDrone(state, type) {
  const corridors = MAP.corridors[type];
  if (!corridors || corridors.length === 0) return null;

  const corridorIdx = Math.floor(Math.random() * corridors.length);
  // …rest unchanged
}
```

Each drone independently picks a corridor. Cluster spawns from the same wave group will naturally scatter across edges.

---

## Structure / damage

| | Current | New |
|---|---|---|
| `CONFIG.structures.maxHP` | 100 | **120** |
| `CONFIG.structures.damageFromOWAStrike` | 30 | **25** |
| `CONFIG.structures.damageFromPayloadDrop` | 60 | **50** |

More drones hit structures per run, so slight reductions keep the game from ending in 2 bad contacts. HP bump gives the player more room to recover from a single leaked wave.

This also affects the alarm/hit thresholds already in `structures.js`:
- `HIT_HEAVY_FRAC = 0.25` means hits ≥ 30 (25 % of 120) trigger heavy SFX. Current OWA=25 no longer triggers heavy, Payload=50 still does. That's the intended new feel — OWA hits are "thuds", Payload is "boom".
- `ALARM_HP_FRAC = 0.5` means alarm starts at HP < 60. Unchanged logic.

---

## Economy

| | Current | New |
|---|---|---|
| `CONFIG.startingResources` | 400 | **350** |
| `CONFIG.resourcesPerWaveBonus` | 200 | **150** |
| `CONFIG.resourcesPerDroneKill.isr` | 10 | **8** |
| `CONFIG.resourcesPerDroneKill.owa` | 15 | **12** |
| `CONFIG.resourcesPerDroneKill.payloadDelivery` | 35 | **30** |

Defense costs unchanged (`rfJammer 50 / interceptor 100 / laser 200 / hpm 300`).

Expected starting scenarios with new numbers:
- Wave 1 opening: 350 resources = 1 Laser + 1 Jammer + 50 left, OR 3 Interceptors + 50, OR 7 Jammers.
- Post-wave-1 kill income (≈15 ISR × 8) = 120 plus 150 bonus = 270 earned. Total heading into wave 2 ≈ 620 - starting defenses cost.
- Over 5 waves, total kill + bonus income is lower than before, so a "one defense of every class" loadout is hard to assemble without careful play.

---

## File layout

| File | Action | Responsibility |
|---|---|---|
| `src/config.js` | Modify | All the numbers above |
| `src/game/wave.js` | Modify | Honor `spawnDelayMs` + per-spawn interval jitter + count jitter when building `spawnProgress` |
| `src/game/drones.js` | Modify | Random corridor selection in `spawnDrone` |
| `src/game/state.js` | Modify | Remove now-unused `spawnRotation` field + its reset lines |

No new files. No sfx/music/briefing changes.

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve`, run a full session. Stopwatch active phases:
   - Wave 1 ≈ 90 s, Wave 5 ≈ 120 s.
2. Play two back-to-back full runs — drone counts and corridor choices visibly differ between runs.
3. Drones visibly traverse longer; Laser-on-Payload engagements last 3+ seconds.
4. With starting 350 resources, can't afford every defense class on turn 1.
5. Structure HP bar (when #7 lands later) shows sensible degradation — single OWA strikes no longer cross the "big hit" threshold, Payload still does.
6. Music tracks finish at least one full loop of the "active" track during most waves 2-5.
7. No console errors. No runtime regressions.

---

## Out of scope

- New drone / defense types.
- Adaptive difficulty (escalate on repeated wins).
- Per-run seed + replay.
- Player-facing difficulty toggle.
- Rebalancing defenses (they're untouched; only counter-drone curve changes).

---

## Risks / open items

- **Tuning feel is subjective.** These are first-pass numbers; expect a follow-up pass after the first external playtest.
- **90 s wave 1 may feel slow for first-time players.** If playtest flags this, reduce wave 1 to 60 s (8-10 ISR instead of 15) before shipping.
- **`randInt(-2, +2)` on small counts risks going to 1 — e.g. wave-4 Payload base 6 rolling to 4 is a big swing.** Acceptable for v1; if the variance feels too aggressive, clamp `count = max(base-1, base+rand(-2,+2))`.
- **Removing `spawnRotation` is a visible state change.** If any other code reads that field, those sites break. Spec implementation must grep before deleting.
