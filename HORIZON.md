# Horizon: Advanced & Emerging Drone Tech

Forward-looking doc covering what's on the edge of deployment or actively changing the threat/defense picture right now. Two purposes:

1. Roadmap of v2/v3 mechanics grounded in real 2025–2026 developments
2. Source material for the class writeup's "where this is heading" section

**Reading order:** builds on `CONCEPTS.md`. Read that first.

**Time horizon:** everything below is either deployed now (mostly in Ukraine), being procured by DoD, or in serious prototype stage. No speculative sci-fi — sources at the bottom all date 2024–2026.

**Relationship to v1:** v1 intentionally models the *current* real-world C-UAS stack, including HPM (via the Leonidas-class Direct Energy defense). This doc covers threats and tech beyond that baseline.

---

## Part 1: The attack side

### 1. Fiber-optic-guided drones

**The single biggest shift in the attack landscape in the last two years.** A drone controlled by a thin optical fiber spooled off the back, instead of radio. First fielded by Russia in spring 2024, now standard on both sides in Ukraine; Chinese PLA incorporating them; observed in Mali and Myanmar.

**Why they matter:**
- Completely immune to RF jamming — no radio link to attack
- Immune to GNSS spoofing/jamming — no GNSS needed
- Undetectable by RF sensors — no signal to see
- High-bandwidth, low-latency video feed
- Ranges now 25–50 km with specialized spools

**What breaks them:** kinetic (shotgun, net, interceptor), visual LOS detection, **directed energy / HPM**, physical barriers (Ukraine is installing 2,500 miles of drone netting along roads).

**Gameplay implications:**
- V1's RF Jammer reflects a pre-2024 threat assumption. A fiber-optic drone type in v2 would invalidate it entirely, forcing the player to lean on Interceptor, Laser, and HPM. Models the real arms race directly.
- V1 already has HPM, which is exactly the real-world answer to fiber-optic drones (Epirus demonstrated this in December 2025 — first directed-energy defeat of a fiber-optic UAS). So v2 fiber-optic drones wouldn't break the game; they'd redistribute which defenses the player relies on.
- Potential v2 companion defense: cheap, static, single-use "net" barrier. Directly models Ukrainian roadside netting.

### 2. AI-autonomous drones and computer-vision targeting

Drones running terrain recognition, target acquisition, and terminal guidance on onboard neural accelerators. No human pilot, no GNSS dependence, no RF link for final approach.

**Current state (2026):**
- Experimental autonomy deployed in Ukraine — drones lock targets, continue if signal cut
- Edge AI accelerators (tens to hundreds of TOPS) now fit on Group 1 drones
- Full autonomy estimated 2–3 years out by Ukrainian engineers for benign conditions; 10–15 years fully contested
- Pentagon Replicator program targeting thousands of autonomous drones; $13.4B requested FY2026 for autonomous systems

**What breaks them:** directed energy (fries electronics regardless of control mode), visual deception, kinetic. **Not** broken by: jamming, spoofing, comms denial.

**Gameplay implications:**
- V1's Laser and HPM defenses are the case for why directed energy matters — autonomous drones are the threat class they're built for.
- A v2 "autonomous" drone type would be defined by immunity to soft-kill. Forces reliance on Laser and HPM. Expensive drone (attacker economy), defender has no cheap answer — perfect cost-exchange pressure.

### 3. Drone swarms with distributed autonomy

Covered in `CONCEPTS.md`, but the 2026 update: real swarm coordination software being fielded commercially (Palladyne SwarmOS, SIRBAI, ZenaTech). Live demos of single-operator control over 100+ drones. Emergent behavior from local rules — self-healing, automatic role reassignment.

**The 2025 proof point:** Epirus Leonidas defeated a 49-drone swarm in one pulse at Camp Atterbury — meaning both sides of the arms race have publicly validated capabilities now. The same demo hit 61 of 61 drones across five scenarios (100% success).

**PLA operational concepts:**
- **Bee swarm (蜂群战):** pure saturation, numerical overwhelm
- **Goose flock (雁群战):** heterogeneous roles within a swarm — ISR, EW, strike coordinated
- **Mothership warfare:** large drone/ship launches and coordinates a smaller swarm (Jiu Tian — 10-ton UAV carrying up to 100 kamikaze drones)

**Gameplay implications:**
- V1 wave 5 is already a crude saturation attack. A goose-flock wave with role specialization (scouts that mark weak points for OWA drones following) would be a meaningful v2 upgrade.
- A mothership boss wave — a single slow, high-HP carrier drone that spawns smaller drones — would be a climactic v3 mechanic with a real-world referent.

### 4. Fiber-optic + autonomy hybrid

The logical next step, already in early deployment: fiber-optic drone running autonomous targeting once the pilot designates the objective. Immune to RF, immune to GNSS denial, capable of completing its mission even if the fiber is cut.

Approximately the worst-case threat for classical C-UAS. Only directed energy reliably works — which is why v1 includes both Laser and HPM.

### 5. Mesh-networked kill webs

Drones coordinating peer-to-peer without central control. Lose comms to operator, stay coordinated with neighbors. Pentagon's ORIENT program (Opportunistic Resilient Network Topology).

You can't kill a swarm by killing its operator or jamming command. Every drone is a node in the kill chain.

**Gameplay implications:** likely too complex for the prototype, but useful for the class writeup's "limitations of current C-UAS" section.

### 6. Long-range, low-cost OWA drones

The Shahed-136 class: ~$20K per drone, 1000+ km range, GNSS-guided, minimal radar signature. Designed explicitly to exploit cost-exchange against billion-dollar air defenses.

**Pentagon and NATO response:** the economic argument for directed energy (pennies per shot vs. $450K per IRIS-T missile) is the single loudest driver in current C-UAS procurement. It's the reason HPM exists in v1.

### 7. Anti-C-UAS drones (attackers that hunt defenders)

Drones built specifically to destroy sensors and defense platforms. Russian Lancet variants targeting Ukrainian air-defense radars. A future mechanic: a drone type whose job is to kill your defenses rather than your critical structures.

---

## Part 2: The defense side

### 1. High-Power Microwave (HPM) — included in v1

The newest frontier of real C-UAS, and a defense in v1 for exactly that reason. Full specifications in `DESIGN.md` and `config.js`. Key real-world facts:

**Epirus Leonidas** — the state of the art:
- Solid-state gallium nitride semiconductors (not old magnetron tubes)
- Software-defined waveforms, phased-array antenna
- Sept 2025 live demo: 49-drone swarm defeated with one pulse; 61-of-61 across scenarios (100%)
- Dec 2025: first EW-based defeat of a fiber-optic drone — HPM works regardless of control mode
- Software-defined no-fly zones protect friendly drones
- Low collateral — non-ionizing radiation, safe for humans
- "Pennies per kill"

**Current deployment:** US Army has six Leonidas prototypes (IFPC-HPM program); Marines have two. Some deployed to CENTCOM in early 2025 for real-world testing.

**Design tension for v1 tuning:** HPM can trivialize the game if too strong. Realistic constraints keep it balanced — and all of them are real:
- Line-of-sight only (can't shoot through buildings)
- Limited firing arc (cone, not 360°)
- Long recharge between pulses
- Highest deployment cost

Watch this during the tuning pass.

### 2. High-Energy Lasers (HEL) — included in v1 as the Laser defense

Iron Beam (Israel), DE M-SHORAD (US), various British and Chinese equivalents. All in "deployed prototype" phase as of 2026.

**Key tradeoffs (already modeled in v1):**
- Cost-per-shot: ~$1–$10 (electricity only)
- Thermal management limits sustained fire — v1 overheat mechanic
- Single-target at a time — vs. HPM's one-to-many
- Weather-affected (fog, dust scatter beam)
- LOS only

### 3. Interceptor drones — included in v1 as the Interceptor defense

Direction in 2026 is **cheap dedicated anti-drone drones**:
- **Coyote** (Raytheon): ~$100K tier, widely deployed
- **Anduril Roadrunner:** reusable — lands and reloads if unused
- **ZenaTech Interceptor P-1:** $5K single-use with AI swarm coordination
- **Ukrainian Stalker Striker Mini:** purpose-built against Shahed-class, 325 km/h, 25 km range

**Gameplay implications for v2+:**
- Cheap swarm launcher — fires multiple low-cost projectiles per salvo
- Reusable interceptor (Roadrunner-style) — returns if target killed by another defense. Rewards coordination.

### 4. AI-enabled C2 / sensor fusion

The biggest *doctrinal* shift, if not the most visible. 2026 real systems fuse radar, RF, EO/IR, and acoustic data into one track picture, with AI prioritizing by predicted intent.

**Examples:**
- **Anduril Lattice:** AI-driven C2 integrating sensors + effectors
- **Dedrone DroneTracker:** AI triaging drone threats from normal airspace clutter

**Gameplay implications for v2+:** already partially abstracted (map auto-detects drones). A "sensor tower" defense that extends detection range, or reveals stealth drones, maps directly to real architecture. Extended idea: detection range as a *resource* — fog of war unless covered by sensor towers. Players trade placement budget between sensors and effectors.

### 5. Physical barriers and passive defenses

The low-tech response that actually works. Ukraine installing 2,500 miles of drone netting along front-line roads. Simple nets tangle propellers on contact.

**Gameplay implications for v2+:**
- Cheap, static, single-use "net" defense. Specifically strong against fiber-optic drones.
- Structure hardening — armored upgrade state trading cost for HP.

### 6. Cyber takeover / protocol exploitation

Actively *seizing control* via exploits. Landing the drone where you want. Used by Lithuanian and Spanish authorities against contraband drones.

**Gameplay implications for v2/v3:** a "takeover" defense that *converts* drones to temporary allies. Unique mechanic, real-world grounded. Introduces a new verb (conversion) that complicates the game significantly — v3 territory.

### 7. Layered defense / defense-in-depth

The doctrinal consensus, not a specific technology: no single C-UAS system wins alone. Real defense architectures layer detection, soft-kill, multiple hard-kill options, and directed energy so that something works regardless of threat.

**This is the design thesis of the game.** V1 implements it explicitly: RF Jammer (soft-kill) + Interceptor (hard-kill kinetic) + Laser (DEW sustained) + HPM (DEW area). Every real C-UAS category is represented. See `DESIGN.md` design thesis.

---

## Part 3: The trend lines that matter

For the class writeup:

1. **Autonomy is winning.** Every control-mode assumption older than 2024 (RF control, GNSS guidance) is becoming obsolete. The attacker side is racing toward fully autonomous drones that can't be jammed or spoofed.

2. **The cost-exchange problem is driving everything on the defense side.** Directed energy (lasers + HPM) is the industry's answer because it's the only class of effector that wins economically at scale. Everything else is a stopgap.

3. **Fiber-optic drones broke classical EW.** The easiest, cheapest attacker answer to jamming was to just... not have a radio. It worked. The defender's response is HPM + physical barriers + better kinetic.

4. **Swarm is now operational, not theoretical.** Live demos of 49–130 drone coordinated operations in 2025. C-UAS that can't handle swarms is obsolete.

5. **Layered defense is the only viable doctrine.** No silver bullet exists or is coming. Real C-UAS architecture integrates detection + multiple effector types + AI-driven C2. **This is the game's design thesis.**

6. **The regulatory/authority problem is underrated.** Most C-UAS mitigation tech in the US is legally restricted to federal operators. Cities, airports, private critical infrastructure can detect but not engage. Policy gap, not a tech gap.

---

## Part 4: Prioritized v2/v3 backlog

Organized by (design value) / (implementation cost). Don't build any until v1 core loop plays well.

### High-value, moderate-effort (v2 candidates)

1. **Fiber-optic drone type** — immune to RF jamming; forces reliance on Interceptor/Laser/HPM. Directly models current real-world arms race.
2. **Autonomous drone type** — immune to all soft-kill. Only hard-kill + HPM works. Teaches the autonomy trend.
3. **Sensor tower defense** — extends detection range; enables fog-of-war layer.
4. **Drone netting** — cheap, static, single-use physical barrier. Strong against fiber-optic drones specifically.
5. **Stealth drone type (Group 3)** — requires sensor towers or advanced defenses to detect.

### High-value, high-effort (v3+)

6. **Goose-flock swarm waves** — heterogeneous roles within a single coordinated wave, with inter-drone buffs (scouts reveal weak points).
7. **Mothership boss wave** — slow high-HP carrier drone that spawns smaller drones.
8. **Reusable interceptor** — Roadrunner-style. Returns if unused. Rewards coordination.
9. **Decoy drones** — 0 HP, 0 damage; waste defender ammunition. Pure cost-exchange mechanic.
10. **GPS Spoofer defense** — redirect drones rather than destroy.
11. **Cyber takeover defense** — converts drones to temporary allies.
12. **EW drones** — enemy drones that temporarily disable defenses.

### Probably skip

13. Mesh-networked enemy AI (too complex to communicate in a 10-minute game)
14. ROE / positive-identification mechanic (adds friction playtests will hate)
15. Anti-C-UAS drones targeting defenses directly (breaks tower defense baseline assumption)

---

## Sources

All accessed April 2026 unless noted.

- IEEE Spectrum, *The Coming Drone-War Inflection in Ukraine* (March 2026)
- Atlantic Council, *Fiber-optic drones have emerged as critical kit for both Russia and Ukraine* (Feb 2026)
- Epirus press releases: 49-drone swarm demo (Sept 2025), fiber-optic defeat (Jan 2026)
- Epirus Leonidas Wikipedia entry (updated March 2026)
- Jerusalem Post, *Epirus: Bringing high-power microwave defense to the front* (Jan 2026)
- NPR, *Ukraine hangs anti-drone nets over roads* (March 2026)
- Lowy Institute, *Fibre-optic drones reshape Ukraine's technological war* (Aug 2025)
- Wikipedia, *Fiber optic drone* (Nov 2025)
- IDGA, *Embedded AI in Military Drones Is Redefining Autonomy and Operations* (Feb 2026)
- CNAS, *Countering the Swarm* (Sept 2025)
- CNA, *PRC Concepts for UAV Swarms in Future Warfare* (July 2025)
- PR Newswire, *Billions in Flight: AI and Autonomous Drone Technologies* (March 2026)
- Defense Security Monitor, *Drone Wars: Developments in Drone Swarm Technology* (Jan 2025)
- The Defense Post, *Epirus Demos First Directed-Energy Takedown of Jam-Proof Fiber-Optic Drone* (Jan 2026)
- DroneXL, *TechEx Stalker Fiber-Optic FPV Drones* (March 2026)

Starting points, not final citations. Field moves fast — anything older than 2024 on swarms, autonomy, or fiber-optic drones is likely stale.
