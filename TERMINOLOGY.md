# Drone Defense: NYC — Terminology Reference

Real-world DoD and C-UAS doctrine that informs the game's vocabulary. Use this when writing any player-facing text: UI labels, tooltips, briefings, codex entries. When in doubt, use the real term.

**Rule of thumb:** if a real concept maps cleanly onto a game element, use the real name. If game mechanics deviate from reality, flag it. The game is a prototype, not a simulator — some abstraction is fine.

---

## Core acronyms (use freely in-game)

| Term | Meaning |
|---|---|
| UAS | Uncrewed Aircraft System — aircraft plus control station and data link |
| UAV | Uncrewed Aerial Vehicle — just the aircraft |
| sUAS | Small UAS — Groups 1–3 per DoD |
| C-UAS (CUAS) | Counter-UAS — systems that detect/defeat hostile drones |
| ISR | Intelligence, Surveillance, Reconnaissance |
| OWA | One-Way Attack (drone) — aka kamikaze, loitering munition |
| ROE | Rules of Engagement |
| EW | Electronic Warfare |
| DEW | Directed Energy Weapon |
| HEL | High-Energy Laser |
| HPM | High-Power Microwave |
| GNSS | Global Navigation Satellite System (GPS, GLONASS, Galileo, BeiDou) |
| EO/IR | Electro-Optical / Infrared |
| RF | Radio Frequency |
| C2 | Command and Control |
| IFPC-HPM | Indirect Fire Protection Capability — High-Power Microwave (US Army program) |

---

## DoD UAS Group classification

DoD categorizes UAS into five groups by max gross takeoff weight, operating altitude, and airspeed. Classification is set by the highest attribute. Source: Joint Publication 3-30 "Joint Air Operations."

| Group | Weight | Altitude | Speed | Examples |
|---|---|---|---|---|
| **Group 1** | < 20 lbs | < 1,200 ft AGL | < 100 kts | RQ-11 Raven, commercial quadcopters |
| **Group 2** | 21–55 lbs | < 3,500 ft AGL | < 250 kts | ScanEagle, RQ-21 Blackjack |
| **Group 3** | < 1,320 lbs | < 18,000 ft MSL | < 250 kts | RQ-7 Shadow, MQ-1C Gray Eagle |
| **Group 4** | > 1,320 lbs | < 18,000 ft MSL | any | MQ-1 Predator, MQ-9 Reaper |
| **Group 5** | > 1,320 lbs | > 18,000 ft MSL | any | RQ-4 Global Hawk, MQ-4C Triton |

Groups 1–3 are classified as **sUAS** and are the realistic threat surface for a city-defense scenario.

### Mapping to v1 drone types

In-game names use real doctrinal terminology:

| Game drone | Real classification | Notes |
|---|---|---|
| **ISR Drone** | Group 1 sUAS, ISR role | Small quadcopter-class, EO/IR payload, commercial-derived |
| **OWA Drone** | Group 1 OWA / loitering munition | One-way attack, preprogrammed or operator-guided terminal strike |
| **Payload-Delivery Drone** | Group 2 sUAS, payload role | Larger fixed-wing or heavy multirotor, armored, payload-capable |

Stealth drones (deferred to v2) would be Group 3 with low-observable features. Fiber-optic and fully autonomous drones are also deferred — see `HORIZON.md`.

---

## The C-UAS Kill Chain (F2T2EA → DTID)

The canonical military targeting cycle is **Find, Fix, Track, Target, Engage, Assess (F2T2EA)**. For C-UAS specifically, this is often simplified to **Detect, Track, Identify, Defeat (DTID)** — used in Marine Corps CUAS doctrine and DHS processing chains.

Stages, in order:

1. **Detect** — discover the drone exists (radar, RF, acoustic, EO/IR sensors)
2. **Track** — maintain real-time positional awareness, predict trajectory
3. **Identify / Classify** — friend, foe, neutral; drone type; payload assessment
4. **Decide** — apply ROE, select effector, authorize engagement
5. **Engage / Defeat** — apply soft-kill or hard-kill effect
6. **Assess** — battle damage assessment; re-engage if needed

**In-game framing:** the player operates at "Decide" and "Engage" — detection, tracking, and identification are abstracted (drones appear on the map). References to the kill chain belong in briefings and tooltips: *"Sensors have detected inbound Group 1 UAS — authorize engagement?"*

---

## Soft-kill vs. Hard-kill

Fundamental C-UAS distinction. Use these terms in defense-palette tooltips.

### Soft-kill (non-kinetic, electronic warfare)
Disrupts the drone without physically destroying it. Preferred where collateral damage is a concern — cities, critical infrastructure.

- **RF jamming** — floods the drone's C2 link with noise. Drone loses operator control; often hovers, returns home, or crashes.
- **GNSS jamming / denial** — jams GPS/GLONASS/Galileo/BeiDou signals; drone loses position reference.
- **GNSS spoofing** — *feeds false* positioning signals, allowing redirection. Distinct from jamming.
- **Protocol takeover** — exploits the drone's control protocol to seize command.

### Hard-kill (kinetic)
Physically destroys or captures the drone. Higher collateral risk.

- **Interceptor UAS** — defender drone nets or rams target. Real: Coyote, Anduril Roadrunner.
- **Airburst / proximity munitions** — rounds detonating near the target.
- **Guns / guided projectiles** — conventional kinetic.

### Directed Energy (DEW) — the middle path
Not classically "kinetic" but physically destructive. Increasingly treated as its own C-UAS category because of cost-exchange implications.

- **High-Energy Laser (HEL)** — continuous precision beam, sustained damage. Real: Iron Beam, DE M-SHORAD.
- **High-Power Microwave (HPM)** — electromagnetic pulse that damages drone electronics across a wide area. One-to-many capability — downs multiple drones per pulse. Real: Epirus Leonidas (IFPC-HPM program).

### Mapping to v1 defenses

| Game defense | Category | Real analog |
|---|---|---|
| **RF Jammer** | Soft-kill — C2 link jamming | DroneBuster, DroneDefender |
| **Interceptor** | Hard-kill — interceptor UAS / net launcher | Coyote, SkyWall, Roadrunner |
| **Laser (HEL)** | Directed Energy — sustained beam | Iron Beam, DE M-SHORAD |
| **HPM** | Directed Energy — area-effect microwave | Epirus Leonidas, IFPC-HPM |

The v1 defense set intentionally covers all three real categories (soft-kill + kinetic + directed energy) so the player experiences the full layered defense doctrine. See `DESIGN.md` design thesis for why.

---

## Sensors (how detection actually works)

The map display in-game abstracts detection, but for codex/briefing flavor, the real sensor types are:

- **Radar** — all-weather, wide-area; struggles with the "low-slow-small" problem at short ranges
- **RF sensors** — passively monitor spectrum for C2 links and Remote ID beacons; can also locate the operator
- **EO/IR (cameras)** — visible-light and infrared; the only sensor that provides **positive visual identification** required for kinetic engagement under most ROEs
- **Acoustic** — microphone arrays; short range but useful in quiet environments
- **Sensor fusion** — combining multiple modalities into a unified track picture; the modern standard

Real cueing flow: RF or radar first detects, EO/IR confirms visually, operator authorizes engagement.

---

## Operational concepts worth using

Terms that add texture to briefings, dialogue, and codex entries:

- **Low-slow-small (LSS)** — industry shorthand for the hardest targets: small drones flying low and slow. This entire game is about LSS threats.
- **Swarm** — multiple coordinated drones; breaks single-shooter defenses. The canonical driver for HPM development.
- **Attritable** — drones designed to be cheap enough to lose
- **COTS** — Commercial Off-The-Shelf; the weaponized consumer drone threat
- **Kill web** — modern distributed kill chain where multiple drones/sensors share roles
- **Cost-exchange** — the defender's dilemma: a $500 drone vs. a $100K interceptor. Central to the game's design thesis (see `DESIGN.md`).
- **Sensor-to-shooter timeline** — time from detection to engagement
- **One-to-many** — the key differentiator for HPM and saturation-capable effectors
- **C2 link** — the command-and-control radio link between drone and operator
- **BVLOS / VLOS** — Beyond / Visual Line of Sight

---

## Suggested in-game copy examples

Use these as style references for Claude Code when generating UI strings:

**Drone detection alert:**
> "Contact: Group 1 sUAS, bearing 045, inbound. RF signature consistent with ISR profile."

**Defense tooltip — RF Jammer:**
> "Soft-kill effector. Disrupts C2 link via RF jamming; drones in range lose operator control. Effective against ISR platforms. Minimal effect against preprogrammed OWA drones once committed to terminal approach."

**Defense tooltip — Interceptor:**
> "Hard-kill effector. Launches interceptor UAS to kinetically defeat target. Effective against Group 1–2 threats. Cooldown between engagements."

**Defense tooltip — Directed Energy (Laser):**
> "Directed Energy — High-Energy Laser. Engages via sustained beam. Low cost-per-shot; effective against armored platforms. Thermal management limits sustained fire."

**Defense tooltip — HPM:**
> "Directed Energy — High-Power Microwave. Weaponized electromagnetic interference across a wide cone; one-to-many area effect. Defeats drones regardless of control mode. Long recharge between pulses. Pennies per kill against swarms."

**Wave-incoming briefing:**
> "Wave 3 inbound. Multi-vector approach detected. Expect ISR assets followed by OWA swarm. Stand by for engagement authorization."

**Commander dialogue tone:** clipped, factual, military cadence. No sci-fi jargon, no "terminators" or "death drones" — real doctrine vocabulary only.

---

## Sources (for class writeup)

- Joint Publication 3-30, *Joint Air Operations* — DoD UAS group classification
- Congressional Research Service, "Defense Primer: Categories of Uncrewed Aircraft Systems" (congress.gov)
- *Air Force Small-Unmanned Aircraft Systems Guide* — sUAS identification reference
- DHS C-UAS processing chain documentation
- MDPI, "System Analysis of Counter Unmanned Aerial Systems Kill Chain in an Operational Environment" (2021)
- CSIS Missile Defense Project, *Countering Uncrewed Aerial Systems: Air Defense by and for the Joint Force*
- The War Quants, "Counter-UAS Primer" (2025)
- Epirus press releases and Leonidas documentation (2025–2026) — HPM specifics
- Dedrone, "Counter-Drone Comprehensive Guide"
- FAA AIM Chapter 11 — UAS regulatory context

Cross-check any claim before putting it in a class writeup — these are starting points, not final citations.
