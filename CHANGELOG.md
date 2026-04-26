# Changelog

Player-facing change log. The in-game overlay (Shift+C) parses this file at
load time, splitting on `## ` version headings.

## v0.1.2-#56 (in progress)
- Fix: title screen reads the released version from CHANGELOG.md
  instead of a hardcoded literal — was stuck on v0.1.0 even after
  the v0.1.1 cut.
- Fix: sim batch mode (#43) now calls applyDelivery(0) between runs.
  Was missing W1 supplies on every run after the first, producing
  bogus 0% win rates.
- Balance: laser DPS 40 → 25 (felt OP in playtest).
- Balance: radar detectRange 180 → 130 (a single radar no longer
  covers the entire playable map; meaningful but partial coverage).
- Fix: laser overheat now actually triggers in play (#52). Heat
  used to decay 1:1 the moment a target died, so it reset between
  every drone and never reached the overheat threshold. Heat now
  persists across kills within a wave, forcing the laser to stop
  and recharge under sustained pressure. A small heat/cooldown
  bar above the laser shows current state. Heat resets at wave
  end. Also fixes a latent bug where the laser muzzle never
  showed its firing flare (read the wrong field).
- Balance: laser overheatTime 3000ms → 4500ms — playtest felt
  over-corrected with the fix above; this gives the beam ~50%
  more on-target time before the recharge gate.
- End screen: numeric SCORE and letter GRADE (S/A/B/C/D/F) now
  surfaced alongside the existing stats so a run feels graded, not
  just won/lost. Score weights and grade thresholds live in
  config.js → scoring (#55).

## v0.1.1 — 2026-04-26
- Sim harness: live sidebar event log during a run; batch mode runs 10
  sims back-to-back at 60x with no render and exports CSV (#43)
- Fix: click coords respect `object-fit: contain` letterbox so the
  palette and other targets are reachable on non-16:9 windows
- Backdrop: auto-grid during prep, auto-image during attack; manual
  B-key override wins for the current phase only (#45)
- Changelog overlay: Shift+C surfaces what changed (#46)
- Briefings: waves 2-5 expanded into two-page commander briefings
  matching wave 1's tone — timestamp opening, situational beat,
  stakes, command voice. Dynamic intel/defense prefix still prepends
  to page 0 (#34)
- Pause: Space toggles pause during a live run (#12). Briefing
  dismissal still gets first dibs on Space, so the player can read
  before pausing.
- Briefings: every wave now ends with an INTEL FORECAST page tagging
  each upcoming drone group HIGH / MED / LOW based on prior-wave
  recon. HIGH gives precise counts; MED hedges with ~; LOW just says
  "maybe" + "(unconfirmed)". Color-coded green / amber / grey (#11)
- Wave timer: each wave now hard-caps at 60 s (waves 1-2) or 90 s
  (waves 3-5). Spawning stops 5 s before the cap; surviving drones
  are cleared when the cap hits so the wave doesn't bleed into prep
  (#49)
- Intel/response readout moved into the briefing's INTEL FORECAST
  page (was a separate wave-start banner — playtesters preferred
  having all intel in one place). Page now shows: INTEL LEAKED
  tier, predicted ENEMY RESPONSE multiplier from current defense
  count (updates live as you place), optional flavor line, then
  the per-drone forecast (#36)
- Named waves: PROBE / PRESSURE / STRIKE / HEAVY / SATURATION,
  each with a one-line descriptor. Names show on the INTEL
  FORECAST page header and on the bottom-right HUD during the
  active phase (replaces "INCOMING") (#8)
- Radar / detection layer (#6): drones outside any defense's detect
  bubble render as a faint blip (no full sprite) and CAN'T be
  targeted. New "Radar" defense (sensing-only, no engagement,
  detectRange=180 px) extends coverage. Each existing defense uses
  its engage range as innate detect range; RF Jammer is the
  exception with detectRange=110 (RF-DF realism). Radar deliveries
  arrive on waves 1 and 3; trickle pool now includes radar.
  Hotkey: 5 / Y.
- Repair: click a placed defense (without selecting a defense in the
  palette) to consume 1 of the matching inventory type and restore
  1 HP. A green ring pulses on success. Lets capped supplies (RF
  caps at 5 etc.) heal damaged turrets instead of stockpiling (#40).
- Sidebar HUD: live INTEL ticker (current wave's accumulated recon)
  with NONE/LOW/MED/HIGH tier color, plus DEF count and live enemy-
  response multiplier (×1.0…×3.2). Player can see the inputs to the
  next-wave difficulty curve at a glance, not only in the briefing
  (#32)
- ISR-driven OWA pathing (#48):
  · ISR records which observed structures had RF Jammer coverage.
    Next wave's OWA targets observed-uncovered first, falling back
    to observed-covered then any.
  · ISR also records per-lane time spent jammed. Lanes that ate ≥6 s
    of jamming get a bonus OWA push next wave, pinned to that lane
    (count ≈ jammed-seconds / 2, capped at 8). Heavy RF makes a lane
    a known hotspot — Red Cell commits OWA at the jam-shadow.
- Interceptor ammo: each launcher carries a finite magazine (6
  missiles). Empty interceptors stop firing until the next wave
  reloads them automatically. Missile pips on the icon step-dim as
  the magazine depletes (3 → 2 → 1 → 0 lit). Forces real layering
  with laser / HPM at the saturation wave (#7)
- Bridges fragile: a named bridge counts as functional only if every
  tile of it is still alive. Damaging any tile takes the whole bridge
  offline for delivery, so multi-tile spans (GW, Queensboro, etc.)
  no longer absorb damage silently — one hit takes the whole supply
  route down.
- Critical structures now have gameplay consequences when destroyed
  (#10):
  · Power Substation → next deliveries arrive at half supply
  · Comms Tower → RF Jammers operate at 70% range
  · City Hall → no new commander briefings
  · UN HQ → INTEL FORECAST page hidden (intel sharing offline)
  · Water Plant → +50% casualty lethality (stacks with Hospital)
  · Federal Reserve → financial-tile damage doubles

## v0.1.0
- Initial release: Manhattan map, intel loop, commander briefings,
  performance-tuned endings, help overlay
