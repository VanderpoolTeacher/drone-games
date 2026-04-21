// All tunable game values live here. If you're changing a number to
// playtest balance, change it in this file — not in the entity logic.
//
// Units: pixels for distance, milliseconds for time, integers for costs/HP.
//
// Drone and defense names use real DoD/C-UAS doctrine. See TERMINOLOGY.md.

export const CONFIG = {
  // Rendering
  virtualWidth: 480,
  virtualHeight: 270,
  targetFPS: 60,
  topBarHeight: 24,
  bottomPaletteHeight: 32,

  // Economy
  startingResources: 400,
  resourcesPerWaveBonus: 200,
  resourcesPerDroneKill: {
    isr: 10,
    owa: 15,
    payloadDelivery: 35,
  },

  // Critical structures
  structures: {
    count: 3,
    maxHP: 100,
    damageFromOWAStrike: 30,       // kamikaze contact
    damageFromPayloadDrop: 60,     // area-effect payload
  },

  // Drones — real DoD doctrinal roles
  drones: {
    // Group 1 sUAS, ISR role — small quadcopter-class, operator-controlled (FPV)
    isr: {
      displayName: 'ISR Drone',
      classification: 'Group 1 sUAS, ISR',
      controlMode: 'fpv',            // vulnerable to RF jamming
      hp: 20,
      speed: 60,                     // px per second
      size: 16,
    },
    // Group 1 OWA / loitering munition — Shahed-class, FPV strike
    owa: {
      displayName: 'OWA Drone',
      classification: 'Group 1 OWA / loitering munition',
      controlMode: 'preprogrammed',  // RF jamming less effective mid-commit
      hp: 15,
      speed: 140,
      size: 16,
    },
    // Group 2 sUAS, payload-carrying — fixed-wing or heavy multirotor
    payloadDelivery: {
      displayName: 'Payload-Delivery Drone',
      classification: 'Group 2 sUAS, payload role',
      controlMode: 'preprogrammed',
      hp: 120,
      speed: 30,
      size: 16,
    },
  },

  // Defenses — covers all three real C-UAS categories
  // (soft-kill, hard-kill kinetic, directed energy)
  defenses: {
    // Soft-kill electronic warfare — disrupts C2 link in area
    rfJammer: {
      displayName: 'RF Jammer',
      category: 'soft-kill',
      cost: 50,
      range: 80,
      effect: 'slow',
      slowFactor: 0.5,               // multiplies drone speed while in range
      // Strong vs ISR (FPV, C2-dependent); weak vs OWA (preprogrammed) and Payload (armored comms)
      effectivenessVs: { isr: 1.0, owa: 0.3, payloadDelivery: 0.2 },
      size: 24,
    },
    // Hard-kill kinetic — single-target interceptor with cooldown
    interceptor: {
      displayName: 'Interceptor',
      category: 'hard-kill kinetic',
      cost: 100,
      range: 100,
      damage: 30,
      cooldown: 1500,                // ms between shots
      projectileSpeed: 200,          // px/sec
      // Strong vs OWA and Payload; weak vs ISR (overkill, cooldown wasted)
      effectivenessVs: { isr: 0.5, owa: 1.0, payloadDelivery: 1.0 },
      size: 24,
    },
    // Directed Energy — High-Energy Laser (HEL). Sustained beam, thermal limit.
    laser: {
      displayName: 'Directed Energy (Laser)',
      category: 'directed energy — HEL',
      cost: 200,
      range: 120,
      dps: 40,                       // damage per second while firing
      overheatTime: 3000,            // ms of continuous fire before overheat
      cooldownTime: 2000,            // ms to recover from overheat
      // Strong vs Payload (burns armor) and OWA; weak vs ISR (inefficient)
      effectivenessVs: { isr: 0.3, owa: 1.0, payloadDelivery: 1.2 },
      size: 24,
    },
    // Directed Energy — High-Power Microwave. Area of effect, one-to-many.
    // Modeled on Epirus Leonidas (IFPC-HPM program).
    hpm: {
      displayName: 'HPM',
      category: 'directed energy — HPM',
      cost: 300,
      coneRange: 110,                // radial depth of the cone
      coneHalfAngleDeg: 35,          // total cone = 70°
      pulseDamage: 40,               // per-pulse damage to each drone in cone
      pulseCooldown: 4000,           // ms between pulses (long recharge)
      // Effective against all types in area — but shines when hitting multiple at once
      effectivenessVs: { isr: 1.0, owa: 1.0, payloadDelivery: 0.8 },
      size: 24,
      // Facing defaults to north when placed; future versions may allow rotation
      defaultFacingDeg: 270,         // 270° = facing up/north in screen coords
    },
  },

  // Waves — designed to teach layered-defense thesis through escalation
  // See DESIGN.md "Wave progression" for the teaching arc
  waves: [
    // Wave 1: ISR only — teach placement + soft-kill
    {
      drones: [
        { type: 'isr', count: 5, spawnInterval: 1500 },
      ],
    },
    // Wave 2: ISR scaled — teach range and coverage
    {
      drones: [
        { type: 'isr', count: 8, spawnInterval: 1200 },
      ],
    },
    // Wave 3: RF Jammer breaks on OWA — forces Interceptor purchase
    {
      drones: [
        { type: 'isr', count: 6, spawnInterval: 1200 },
        { type: 'owa', count: 5, spawnInterval: 1800 },
      ],
    },
    // Wave 4: Armor appears — forces Laser/HPM purchase
    {
      drones: [
        { type: 'owa', count: 8, spawnInterval: 1200 },
        { type: 'payloadDelivery', count: 3, spawnInterval: 3000 },
      ],
    },
    // Wave 5: Saturation — HPM becomes valuable for crowd control
    {
      drones: [
        { type: 'isr', count: 8, spawnInterval: 1000 },
        { type: 'owa', count: 12, spawnInterval: 800 },
        { type: 'payloadDelivery', count: 4, spawnInterval: 2500 },
      ],
    },
  ],
  prepTimeBetweenWaves: 15000,       // ms — player gets 15s between waves

  // Colors (mirrors STYLE.md palette — keep in sync)
  // threatRedMid/Dim are derived quantization steps for trail fading.
  // droneIsr/Owa/Payload are semantic aliases for per-type drone body colors (legend + renderer use these).
  colors: {
    bgDark: '#0d1b2a',
    bgMid: '#1b2a3f',
    gridLine: '#2a3f5f',
    friendlyCyan: '#4fc3f7',
    alertAmber: '#ffb74d',
    threatRed: '#ef5350',
    threatRedMid: '#a0302c',
    threatRedDim: '#5a1b19',
    threatViolet: '#c770c0',
    successGreen: '#66bb6a',
    accentWhite: '#f5f5f5',
    droneIsr: '#ef5350',
    droneOwa: '#ffb74d',
    dronePayload: '#c770c0',
  },

  devSpawner: {
    enabled: false,  // retired by wave system — left here for debug / rollback
    intervalMs: { isr: 3000, owa: 5000, payloadDelivery: 7000 },
  },
};
