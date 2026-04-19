# Drone Defense — Design Doc

## Design thesis

**The game teaches that no single counter-drone system wins alone, and the defender's real problem is cost-exchange.**

Two ideas sit at the center of modern C-UAS doctrine:

1. **Layered defense.** Every class of defense (soft-kill, hard-kill kinetic, directed energy, HPM) has drone types it handles well and drone types it can't touch. Real C-UAS architectures layer complementary systems so that something always works. No silver bullet exists — and the game should not let the player believe otherwise.
2. **Cost-exchange.** A $500 drone striking a $100K interceptor is a defender's loss even when the defender wins tactically. The player's economic tension models the single most discussed problem in real-world C-UAS: the asymmetry between attacker and defender cost per engagement. Directed energy (lasers, HPM) exists because it's the only class of effector that wins the math at scale.

Every mechanic in this document serves one or both of these ideas. If a mechanic doesn't support them, it probably doesn't belong in v1.

---

## Overview

Real-time tower defense. Player is a tactical commander protecting the city from coordinated drone attacks using real-world-inspired counter-UAS (C-UAS) technology.

## Experience goals

The game should feel:
- **Strategic but accessible** — decisions matter, but the player isn't drowning in options
- **Grounded in real-world technology** — defenses and drones are recognizable from real C-UAS doctrine, not sci-fi
- **Tense and reactive** — waves escalate, player adapts
- **Empowering** — every placement feels like a meaningful decision under pressure

## Player role

The player is a tactical commander, not a unit on the ground. They:
- Place defenses on a top-down tactical map
- Manage a limited resource budget
- Watch waves unfold and respond in real time
- Do **not** directly control defenses mid-combat — defenses auto-fire once placed

Placement is the primary strategic decision; manual ability activation is deferred to v2.

## Game view

- Top-down tactical map of the city (stylized, doesn't need to be geographically accurate)
- Clean command-center UI with:
  - Resource counter
  - Wave indicator + countdown to next wave
  - Defense selection palette
  - Range preview when placing a defense
  - Threat indicators on incoming drones

Full visual specification in `STYLE.md`.

---

## Drone types

All three use real DoD/doctrinal names. See `CONCEPTS.md` for the mission-type analysis that informs each behavior and `TERMINOLOGY.md` for full vocabulary.

### ISR Drone (Intelligence, Surveillance, Reconnaissance)

Small quadcopter-class platform, Group 1 sUAS, ISR role. Carries sensors, not weapons.

- **Speed:** medium
- **HP:** low
- **Control mode:** FPV / operator-controlled (needs C2 link to function)
- **Behavior:** flies a scouting path; on contact may temporarily disable a nearby defense
- **Primary counter:** RF Jammer (breaks the C2 link)

### OWA Drone (One-Way Attack)

Loitering munition / kamikaze. Group 1, preprogrammed target. Think Shahed-class or FPV strike drone.

- **Speed:** high
- **HP:** low
- **Control mode:** preprogrammed, GNSS-guided terminal
- **Behavior:** flies directly at a designated critical structure, self-destructs on contact
- **Primary counter:** Interceptor or Laser. RF Jammer is *less effective* against OWA drones mid-commit — they follow a preprogrammed path and don't depend on a live operator link. This matchup is a direct teaching moment about real soft-kill limitations.

### Payload-Delivery Drone

Group 2 sUAS, heavier platform, payload-carrying. Analog: larger fixed-wing or heavy multirotor.

- **Speed:** slow
- **HP:** high (armored)
- **Control mode:** preprogrammed, GNSS-guided
- **Behavior:** flies to a target point, drops payload for area damage to any critical structure in range
- **Primary counter:** Laser or HPM. Interceptor works but is cost-inefficient given armor.

### Drones deferred to v2

Stealth drones, fiber-optic-controlled drones, fully autonomous drones. Each is covered in `HORIZON.md` with the design rationale for adding them later. Not in v1.

---

## Wave progression

Five waves, designed to teach the layered-defense thesis through escalation. Each wave introduces or scales a threat that the previous defense set struggles with.

1. **Wave 1:** ISR only. Teaches placement and soft-kill mechanics.
2. **Wave 2:** ISR scaled up. Teaches range and coverage planning.
3. **Wave 3:** ISR + OWA mix. Player discovers RF Jammer doesn't stop OWA drones — forced to buy Interceptors.
4. **Wave 4:** OWA + Payload-Delivery. Armored targets require Laser or HPM; pure Interceptor defense struggles.
5. **Wave 5:** All three types, saturation volume. Player needs the full layered stack; HPM becomes valuable for crowd control.

This escalation is the design thesis in playable form — each wave creates a gap that a new defense class fills.

---

## Defenses

Four defenses covering soft-kill, hard-kill kinetic, and directed energy (both laser and HPM). Each models a real C-UAS effector category. See `TERMINOLOGY.md` for the soft-kill vs. hard-kill distinction and `HORIZON.md` for the current state of real systems.

### RF Jammer — soft-kill, electronic warfare

Disrupts the drone's command-and-control link in an area. Slows or disables drones that depend on a live operator connection.

- **Strong vs.** ISR Drones (operator-dependent)
- **Weak vs.** OWA Drones (preprogrammed, no live link once committed)
- **Weak vs.** Payload-Delivery Drones (armored comms, preprogrammed)
- **Cost:** low
- **Effect:** area slow/disable while drone is in range

### Interceptor System — hard-kill, kinetic

Launches a physical interceptor to kinetically defeat a drone. Real analogs: Coyote, SkyWall, Anduril Roadrunner.

- **Strong vs.** OWA Drones, Payload-Delivery Drones
- **Weak vs.** ISR Drones (overkill, cooldown wasted on low-value targets)
- **Cost:** medium
- **Effect:** single-target shot with cooldown between engagements
- **Cost-exchange note:** this is the expensive-per-shot defense. It wins tactically but loses economically if overused against swarms.

### Directed Energy / Laser (HEL) — hard-kill, directed energy

High-Energy Laser. Continuous precision beam with sustained damage. Real analogs: Iron Beam, DE M-SHORAD.

- **Strong vs.** Payload-Delivery Drones (burns through armor), OWA Drones
- **Weak vs.** ISR Drones (inefficient for low-HP, fast-moving targets)
- **Cost:** high deployment, low per-shot
- **Effect:** continuous fire while target is in range and laser isn't overheated
- **Limitation:** thermal management — overheats after sustained fire, must cool down
- **Cost-exchange note:** expensive to deploy but nearly free per shot. Wins against Payload-Delivery and sustained engagements.

### HPM — High-Power Microwave (directed energy, one-to-many)

Area-effect electromagnetic interference that damages drone electronics across a wide cone. Real analog: Epirus Leonidas (demonstrated 49-drone swarm defeat in Sept 2025; first directed-energy defeat of a fiber-optic drone in Dec 2025). This is the current frontier of real C-UAS and the defender's answer to swarm saturation.

- **Strong vs.** any drone type in a saturation / swarm scenario — electronics don't care about control mode
- **Weak vs.** single high-HP targets (one pulse, then recharge; not efficient against a lone armored drone)
- **Cost:** highest deployment cost
- **Effect:** wide cone area-of-effect pulse, affects all drones in the cone simultaneously
- **Limitation:** long recharge between pulses; line-of-sight; limited firing arc (not 360°)
- **Cost-exchange note:** pennies per kill when hitting multiple drones. The only defense that scales favorably against swarms — its entire reason to exist.

### Defense matchup summary

| | ISR | OWA | Payload-Delivery |
|---|---|---|---|
| **RF Jammer** | Strong | Weak | Weak |
| **Interceptor** | Weak | Strong | Strong |
| **Laser (HEL)** | Weak | Strong | Strong |
| **HPM** | Area — effective in groups | Area — effective in groups | Area — effective in groups |

The teaching point: no single row of this table handles all three drone types well. The player must combine rows.

---

## Core mechanics

- **Placement:** click a defense in the palette, click a valid map tile to place. Placement zones are pre-defined (not every tile is valid).
- **Economy:** start with a fixed budget. Earn small amounts per drone destroyed (scaled by drone class). Earn a larger bonus at the end of each wave.
- **Wave pacing:** short prep phase between waves — player places/repositions defenses. Wave runs in real time once started.
- **System interactions:** drone/defense matchups matter. Player success depends on reading incoming wave composition and building the right mix.
- **No mid-combat controls:** defenses auto-fire. The player's decisions are all in placement and economy.

## Win / lose conditions

- **Win:** survive all 5 waves with at least one critical structure intact
- **Lose:** all critical structures destroyed

Critical structures are fixed points on the map — power station, comms hub, city hall. Three of them for v1. Each has HP. OWA drones damage on contact; Payload-Delivery drones damage in area on payload drop.

---

## Prototype scope (v1)

- Single city map
- 3 drone types (ISR, OWA, Payload-Delivery)
- 4 defenses (RF Jammer, Interceptor, Laser, HPM)
- 3 critical structures
- 5 waves
- 5–10 minute session
- No progression, no menus beyond start/restart

## Deferred to v2+

See `HORIZON.md` Part 4 for the prioritized backlog. Short list of top candidates:

- Fiber-optic drone type (immune to RF jamming)
- Autonomous drone type (immune to all soft-kill)
- Sensor tower defense (detection-range mechanic)
- Drone netting (cheap physical barrier)
- Goose-flock swarm waves (heterogeneous coordinated waves)
- Stealth drones and GPS Spoofer defense

These exist in research form and in `HORIZON.md`. Don't build them in v1.
