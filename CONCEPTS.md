# Drone Operating Concepts

How drones actually operate in the real world, and what each concept means for the game. Companion to `TERMINOLOGY.md` — terminology is *what things are called*, this is *how they work*.

**How to use this doc:** when designing drone behavior, reference the real concept it's modeled on. When a concept suggests a mechanic we haven't implemented, it goes in "Gameplay implications" and may end up in `HORIZON.md` Part 4 for v2+. The goal isn't simulation; it's that every mechanic has a real-world referent the player can learn from.

---

## 1. Mission types (what drones are sent to do)

Drone missions fall into a few categories, and real operations usually chain them. Our v1 drone roster maps directly onto three of them.

### ISR — Intelligence, Surveillance, Reconnaissance
Primary payload is **sensors**, not weapons. The drone's job is to see, record, and transmit. EO/IR cameras, synthetic aperture radar, signals intelligence packages.

- Usually first in, to establish the target picture
- Persistent, loiters at standoff distance
- Feeds targeting data to strike assets — the "find/fix/track" side of the kill chain

**In-game (v1):** the **ISR Drone**. Value to the attacker is information, not damage. On contact, can temporarily disable a nearby defense.

**Gameplay implications for v2+:** ISR drones that complete a pass could *reveal defense positions to the next wave*, making destroying them strategically valuable beyond their point bounty. Filed in `HORIZON.md` as kill-web handoff.

### OWA — One-Way Attack / Loitering Munition
Munition-carrying drone designed to crash into its target. Kamikaze. Includes FPV drones, Shahed-series, Switchblade, Lancet.

- Cheap, attritable, usually GNSS-guided or operator-flown terminal
- Preprogrammed target means it's **often immune to RF jamming once committed** — no operator to disconnect from
- "Loitering" variants orbit before committing

**In-game (v1):** the **OWA Drone**. Key realism touch — RF Jammer is less effective against OWA drones mid-commit. This is directly encoded in `config.js` effectiveness values.

**Gameplay implications for v2+:** a loiter phase before terminal commit could add tension — player sees the threat but must react before it locks on. Filed for later.

### Payload delivery / strike
Larger drones carrying detachable munitions. Drops payload at target point rather than self-destructing. Group 2+ platforms.

- Slower, more armored, higher-value target
- Payload may be explosive, chemical, or electronic effect

**In-game (v1):** the **Payload-Delivery Drone**. Drops payload at target location for area damage.

### Electronic Warfare (EW) drones
Drones whose payload is a jammer, spoofer, or signal decoy. Disrupt the *defender's* systems rather than striking directly.

**Gameplay implications for v2+:** a drone type that temporarily disables a defense in its range. Maps to real PLA "goose flock" concept. Filed in `HORIZON.md`.

### Decoys
Cheap drones designed to trigger defenses and waste interceptor ammunition. Classic cost-exchange tactic — directly relevant to this game's design thesis.

**Gameplay implications for v2+:** a drone type with 0 HP, 0 damage, that costs the defender a defense cooldown or interceptor shot. Creates real tactical tension. Filed.

---

## 2. Control modes (how drones get their orders)

Understanding the control mode tells you what will and won't work against a drone. This is the most actionable section for defense balance.

### Manual / FPV (First-Person View)
Operator actively flies the drone via video downlink and control uplink.

- **Vulnerable to:** RF jamming (breaks C2), RF detection (signal betrays pilot location)
- **Behavior when jammed:** loses control, hovers, or crashes

### Preprogrammed / GNSS waypoint
Flight path loaded before launch. Shahed-136, older loitering munitions. "Dumb swarms" at scale.

- **Vulnerable to:** GNSS spoofing (feed false position), GNSS jamming (loses positioning)
- **Not vulnerable to:** RF jamming of comms — there may be no comms to jam after launch
- **Behavior when GNSS denied:** depends on fallback — cheap drones fail, sophisticated ones dead-reckon via INS

### Autonomous / AI-driven
Onboard computer vision and decision-making. Finds and engages without operator input. Kargu-2-class, Skyborg-class.

- **Vulnerable to:** directed energy (lasers, HPM), visual deception, kinetic
- **Not vulnerable to:** RF jamming, GNSS denial
- **This is the hardest target category** — soft-kill mostly doesn't apply

### Fiber-optic controlled
Physical fiber-optic cable from drone to operator. Ukrainian/Russian FPV drones. Immune to jamming *and* RF detection.

- **Vulnerable to:** kinetic, directed energy (especially HPM)
- **Not vulnerable to:** any RF-based defense

### Tethered
Physical cable to controller. Mostly irrelevant to an attack scenario.

### Control mode → v1 drone matchups

| Drone | Control mode (in-game) | Soft-kill vulnerable? | Why |
|---|---|---|---|
| ISR Drone | FPV / operator-controlled | Yes, very | Needs live C2 link for sensor feed to matter |
| OWA Drone | Preprogrammed OWA | Partial — only before commit | GNSS-guided, no operator in terminal loop |
| Payload-Delivery Drone | Preprogrammed, GNSS | Yes, to GNSS spoofing | Needs precise positioning to drop accurately |

This is what `config.js` encodes in `effectivenessVs` for each defense.

---

## 3. Swarm behavior

A swarm isn't just "many drones." DoD and NATO don't have one agreed definition, but consistent features include:

- **Coordination** between drones (they share info, adapt to each other)
- **Distributed / decentralized control** — no single operator per drone
- **Self-healing** — losing individuals doesn't break the group
- **Emergent behavior** from simple per-drone rules

PLA doctrine distinguishes useful sub-concepts:

- **Bee swarm (蜂群战):** decentralized saturation attack — many cheap drones overwhelm by numbers. Pure cost-exchange.
- **Goose flock (雁群战):** heterogeneous swarm with specialized roles — ISR, EW, kinetic strike coordinated.
- **Mothership warfare:** larger drone (or ship/aircraft) launches and controls smaller drones. Jiu Tian concept.

### Why swarms beat single-shooter defenses

- Defender has N interceptors; attacker sends N+1 drones
- Attrition tolerance — swarm completes mission despite losses
- Sensor-to-shooter timeline is limited; swarm exceeds processing rate
- Decoys waste best defenses

**This is the entire reason HPM exists in v1.** HPM's one-to-many area effect is the real-world answer to swarm saturation. Wave 5 is designed to force the player into the HPM mechanic for exactly this reason.

**Gameplay implications for v2+:**
- Explicit "goose flock" waves with coordinated roles (ISR scouts ahead of OWA strikers that target whichever structure is least defended). Filed in `HORIZON.md`.
- A single-frame area-of-effect answer (HPM) needs meaningful limitations or it trivializes everything else. Current v1 constraints: cone not circle, long recharge, LOS-only, high deployment cost. Watch this during tuning.

---

## 4. The kill web (distributed targeting cycle)

Traditional kill chain: one drone finds, fixes, tracks, engages, assesses. Modern reality: roles distribute across multiple drones.

Example sequence:
1. ISR quadcopter finds target
2. Relay drone maintains comms and fixes position
3. FPV or OWA drone launches to engage
4. Second ISR asset confirms battle damage

Called a **kill web** because it's networked, not linear. Lose one node, another takes its role.

**Gameplay implications:** the kill web is the strategic argument for why ISR drones matter in the game even though they don't directly damage. They *enable* the rest. Breaking the chain early (kill the ISR drone before it completes) disrupts everything behind it.

A v2 mechanic: ISR drones that escape the player's defenses increase the accuracy or effectiveness of the next wave. Kill them and the attacker goes in blind. Filed.

---

## 5. The low-slow-small (LSS) problem

Small drones are hard to detect because they are:
- **Low** — under radar horizon, masked by terrain and buildings
- **Slow** — Doppler filters reject them as clutter (birds, wind)
- **Small** — minimal radar cross-section, limited thermal/acoustic signature

This is why real C-UAS uses sensor fusion: no single sensor catches all LSS threats.

**Gameplay implications for v2+:** our game abstracts detection (drones appear on the map). A future "detection layer" would add real depth — a radar tower that reveals drones at range, or stealth drones that only appear within close radius unless a sensor is nearby. Filed.

---

## 6. Cost-exchange: the central design thesis

**This is arguably the single most important concept in modern C-UAS and is a core pillar of this game's design (see `DESIGN.md` design thesis).**

**The problem:** a $500 commercial drone, or $20K Shahed, attacks a target worth millions. The defender's interceptor costs $100K–$450K per shot. Even winning tactically, the defender loses economically.

Real numbers (open sources):
- IRIS-T SAM: ~$450K per shot
- Shahed-136 OWA drone: ~$20K
- Commercial FPV drone: $500–$2,000
- High-energy laser shot: ~$1–$10 (electricity only)
- HPM pulse: pennies per kill against multiple drones

This is why directed energy (HEL + HPM) is the hottest area in real C-UAS: they're the only effector classes that win the cost-exchange math at scale.

### How v1 defenses express the cost-exchange problem

| Defense | Deployment cost | Per-shot cost | Best use |
|---|---|---|---|
| RF Jammer | Low | Effectively free (area effect) | Swat down cheap ISR drones cheaply |
| Interceptor | Medium | High (one-target, cooldown) | When you need a guaranteed single-target kill |
| Laser (HEL) | High | Very low | Sustained engagement, armored targets |
| HPM | Highest | Pennies-per-kill when hitting multiple | Swarms — one pulse downs many |

The player implicitly answers every wave: *"Am I spending more per kill than the attacker is spending per drone?"* This is genuinely the real problem, and it's worth naming explicitly in tooltips, briefings, and the class writeup.

---

## 7. Operating environment factors

Real drone operations are shaped heavily by environment. For a city-defense game:

### Urban environment
- Buildings create **shadow zones** where drones hide from line-of-sight sensors
- Radar clutter is severe
- Acoustic sensors struggle with traffic noise
- Collateral damage constraints are extreme; kinetic defenses risk civilian harm
- GNSS multipath errors degrade precision

### Contested / denied environment
- EW from both sides jams each other
- GNSS unreliable — drones fall back to INS, visual nav, or fail
- Communications degraded — favors autonomous drones

**Gameplay implications for v2+:**
- Buildings as line-of-sight blockers for laser/HPM (RF Jammer wouldn't care)
- Collateral damage penalties for kinetic defenses firing near structures
- Both filed in `HORIZON.md` — don't add until core loop is solid

---

## 8. Summary: concepts → v1 mechanics

Every mechanic in v1 traces to a real concept:

| Concept | V1 mechanic |
|---|---|
| ISR mission role | ISR Drone type |
| OWA / loitering munition | OWA Drone type |
| Payload delivery | Payload-Delivery Drone type |
| FPV / operator-controlled | ISR is C2-dependent; RF Jammer strong against it |
| Preprogrammed terminal | OWA ignores RF Jammer mid-commit |
| Soft-kill EW | RF Jammer |
| Hard-kill kinetic | Interceptor |
| High-Energy Laser (DEW) | Laser defense, with overheat |
| High-Power Microwave (DEW, one-to-many) | HPM defense, cone area effect |
| Cost-exchange | Economy — different defense classes win different math |
| Swarm saturation | Wave 5 composition, answered by HPM |
| Layered defense doctrine | Four-defense roster covering all three real categories |

Concepts not yet mapped into mechanics (stealth, fiber-optic, autonomous, decoys, kill web, sensor fusion, LOS) are the v2+ backlog in `HORIZON.md` Part 4.

---

## Sources

- The War Quants, *Counter-UAS Primer* (2025)
- CNAS, *Countering the Swarm* (2025)
- CNA, *PRC Concepts for UAV Swarms in Future Warfare* (2025)
- Air University / CASI, *PLA Concepts of UAV Swarms and Manned/Unmanned Teaming* (2025)
- Army University Press, *Defining Swarm* (2025)
- Defense Security Monitor, *Drone Wars: Developments in Drone Swarm Technology* (2025)
- Sentrycs, *Drone Swarm* glossary (2026)
- Drone-Warfare.com, *Counter-UAS 101* (2024)
- MDPI, *System Analysis of Counter Unmanned Aerial Systems Kill Chain* (2021)
- Epirus press releases and Leonidas documentation (2025–2026)

Starting points, not final citations.
