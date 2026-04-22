# Drones Attack Defenses — Design

**Date:** 2026-04-21
**Status:** Approved via brainstorm
**Issue:** [#17](https://github.com/VanderpoolTeacher/drone-games/issues/17)
**Scope:** All three drone types can now interact with defenses. OWA retargets opportunistically and kills via contact; Payload AoE damages defenses in drop radius; ISR temporarily disables defenses while in range.

---

## Design thesis alignment

From `DESIGN.md`: layered defense + cost-exchange. Making defenses mortal pushes the player into real layered play — a single laser can't hold the east corridor forever because wave 5 OWA will pick it off, so the player needs backup defenses, backup positions, and interceptor support for the laser itself.

From `CONCEPTS.md`: in real C-UAS, adversary drones absolutely prioritize sensors, jammers, and effectors. The current "defenses are invincible" model breaks realism.

---

## Defense HP

Add `hp` to each `CONFIG.defenses.*` entry:

| Defense | HP |
|---|---|
| RF Jammer | 1 |
| Interceptor | 2 |
| Laser | 3 |
| HPM | 3 |

Each placed instance stores current `hp` on the defense object (initialized to `cfg.hp` in `placeDefense`).

When `hp <= 0`:
1. Push explosion at defense position into `state.explosions`.
2. Call `stopSfx('laser-' + d.id)` / `stopSfx('rf-' + d.id)` if applicable to cut any continuous audio cleanly.
3. Play `playSfx('structureDestroyed')` — biggest impact SFX we have.
4. Remove from `state.defenses` via `state.defenses = state.defenses.filter(def => def.hp > 0)` at end of `updateDefenses`.
5. **No resource refund.**

---

## Damage sources

### OWA contact

| Source | Damage to defense |
|---|---|
| Direct OWA contact | 1 |

OWA retargets opportunistically:

During `cruise` phase, each `updateOwa` tick scans `state.defenses` for the nearest defense within `CONFIG.combat.owaEngageRange = 60` px. If one is found:

- Set `d.targetDefenseId = nearest.id`.
- Switch to a new phase `'terminalDefense'` (parallel to existing `'terminal'` which targets structures).
- Fly straight at the defense at OWA speed; on arrival (within `OWA_ARRIVAL_PX` = 8) apply 1 dmg to defense + push explosion + `d.phase = 'done'`.

If `targetDefenseId` references a defense that no longer exists in `state.defenses` (destroyed by another drone, another attacker got there first), fall back to `'terminal'` with the authored `targetId` structure.

OWA currently in `'terminal'` phase (already committed to a structure) does NOT re-scan — once committed, they finish their run.

### Payload AoE

Existing `updatePayload` drop path iterates `MAP.structures` within `PAYLOAD_AOE_RADIUS = 48` px. Extend to also iterate `state.defenses`: defenses within the radius take `CONFIG.combat.payloadDefenseDamage = 2` damage.

### ISR soft-kill (disable)

ISR drones don't damage defenses, but they suppress them. Per frame, each defense checks: is any live ISR drone within `CONFIG.combat.isrDisableRange = 36` px? If yes, the defense is "disabled" for that frame and its firing/jam logic is skipped.

Implementation is stateless:
```js
function isDisabledByIsr(state, def) {
  for (const d of state.drones) {
    if (d.type !== 'isr' || d.hp <= 0 || d.phase === 'done') continue;
    const dx = d.x - def.x;
    const dy = d.y - def.y;
    if (dx * dx + dy * dy <= CONFIG.combat.isrDisableRange ** 2) return true;
  }
  return false;
}
```

Called at the top of each defense's branch in `updateDefenses`. If true:
- Skip shot / pulse / jam logic.
- Stop any continuous sound: `stopSfx('laser-' + d.id)` (if laserFiring) and `stopSfx('rf-' + d.id)` (if rfJamming). Clear the flags so the state machine resumes cleanly when the ISR leaves.

---

## Config additions

New `CONFIG.combat` block:

```js
combat: {
  owaEngageRange: 60,
  isrDisableRange: 36,
  owaDefenseDamage: 1,
  payloadDefenseDamage: 2,
},
```

`hp` field added to each defense entry in `CONFIG.defenses`.

---

## Visual feedback

### HP segments

When `d.hp < cfg.hp` (damaged but alive), render a thin bar above the defense:
- Position: `(d.x - DEFENSE_SIZE/2, d.y - DEFENSE_SIZE/2 - 4)`.
- Width: `DEFENSE_SIZE` (24 px). Segments: `cfg.hp` total; each segment = `floor(DEFENSE_SIZE / cfg.hp)` wide. 1-px gaps between segments.
- Height: 2 px.
- Filled: `friendlyCyan` for remaining HP; `gridLine` for lost HP (keeps the bar's total length visible for reading).
- Hidden at full HP to avoid HUD clutter.

### Disabled pulse

When `isDisabledByIsr(state, def)`:
- Render a 3×3 `threatViolet` square at `(floor(d.x) - 1, floor(d.y) - 1)` (center of the defense).
- Blink at 4 Hz via `Math.floor(tMs / 125) % 2`.

### Destruction FX

Reuse the existing `state.explosions.push({ x, y, frame: 0, frameTimer: 0 })`. No new explosion sprite.

---

## Targeting precedence (summary)

Existing defense targeting logic (Interceptor, Laser) continues to pick the drone closest to a structure. No change — defenses target drones as before.

New drone-attacks-defense logic is purely from the **drone side**: drones choose whether to engage defenses or continue to structures.

---

## File layout

| File | Action |
|---|---|
| `src/config.js` | Modify — add `hp` to each defense, add `combat` block |
| `src/game/defenses.js` | Modify — `placeDefense` init `hp`; death check + removal; HP bar + disable pulse render; `isDisabledByIsr` gate at top of each defense branch |
| `src/game/drones.js` | Modify — OWA range-scan + `terminalDefense` phase; Payload AoE iterates defenses too |

No new files. No changes to main.js, state.js, or UI modules outside defenses.

---

## Verification

Manual per `CLAUDE.md:61`.

1. Start a run. Place an RF Jammer near the north corridor. Let an ISR drone pass within ~36 px. Jammer shows pulsing violet center and stops jamming (tooltip / structure speed multipliers confirm). ISR leaves → jammer resumes.

2. Place an Interceptor. Let a single OWA drone come straight at it. Interceptor fires, kills OWA well before contact. Confirm: no defense damage.

3. Place a Laser near the east corridor. Spawn multiple OWAs. If the Laser doesn't kill an OWA in time, OWA retargets Laser (cruise → terminalDefense), contacts, explosion, Laser loses 1 HP. HP bar visible after first hit (2 segments filled, 1 empty). Second hit → 1 segment. Third hit → explosion, Laser gone.

4. Place an HPM and a Jammer within 48 px of a Payload drop point. Let the Payload drop. Both defenses take 2 dmg — Jammer (1 HP) dies instantly; HPM (3 HP) loses 2, shows 1 segment remaining.

5. Play wave 5. Expect some defenses lost by end. Confirm SFX fires (`structureDestroyed`) on defense death; no console errors from leaked continuous sounds.

6. Tooltips still work on defenses that have taken damage (hover shows matchup info; follow-up issue may add HP to tooltip).

---

## Out of scope

- Defense HP shown in tooltip.
- Repair / healing.
- Resource refund on destruction.
- Per-defense destruction SFX variants.
- ISR disable persistence after leaving range.
- Drones prioritizing defenses over structures at wave-start (opportunistic only — OWA still committed to a structure target at spawn).

---

## Risks / open items

- **OWA range-scan every frame is O(drones × defenses).** Wave 5 has ~45 drones and maybe 6-10 defenses. 300-450 distance checks per frame. Trivial. Skip if it's a concern.
- **Continuous-sound leaks** — if the ISR disable clears `laserFiring`/`rfJamming` flags but doesn't call `stopSfx`, audio keeps playing. Must call `stopSfx` AND clear the flag whenever the disable kicks in; otherwise the state machine won't `startSfx` on resume.
- **OWA that chose a defense, then defense dies** — must fall back gracefully. Spec handles this.
- **Defense removal mid-frame** — `state.defenses = state.defenses.filter(...)` rebuilds the array. If a defense is referenced elsewhere this frame (e.g., by a projectile's `defenseId`), the reference may dangle. No such references exist today, but verify during implementation.
- **Laser sprite on final HP** — currently no visual difference between full-HP and 1-HP laser other than the new bar. If playtest flags this as confusing, add smoke or sprite tinting in a follow-up.
