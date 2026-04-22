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

  // Critical structures
  structures: {
    count: 3,
    maxHP: 120,
    damageFromOWAStrike: 25,       // kamikaze contact
    damageFromPayloadDrop: 50,     // area-effect payload
  },

  // Drones — real DoD doctrinal roles
  drones: {
    // Group 1 sUAS, ISR role — small quadcopter-class, operator-controlled (FPV)
    isr: {
      displayName: 'ISR Drone',
      classification: 'Group 1 sUAS, ISR',
      controlMode: 'fpv',            // vulnerable to RF jamming
      hp: 20,
      speed: 45,                     // px per second
      size: 16,
    },
    // Group 1 OWA / loitering munition — Shahed-class, FPV strike
    owa: {
      displayName: 'OWA Drone',
      classification: 'Group 1 OWA / loitering munition',
      controlMode: 'preprogrammed',  // RF jamming less effective mid-commit
      hp: 25,
      speed: 100,
      size: 16,
    },
    // Group 2 sUAS, payload-carrying — fixed-wing or heavy multirotor
    payloadDelivery: {
      displayName: 'Payload-Delivery Drone',
      classification: 'Group 2 sUAS, payload role',
      controlMode: 'preprogrammed',
      hp: 160,
      speed: 25,
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
      hp: 1,
      installMs: 3000,
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
      hp: 2,
      installMs: 5000,
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
      hp: 3,
      installMs: 8000,
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
      hp: 3,
      installMs: 12000,
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
    // Wave 1 — Probe (90s active). ISR only; longer cadence.
    {
      drones: [
        { type: 'isr', count: 15, spawnInterval: 5500, spawnDelayMs: 0 },
      ],
      briefing: "First watch. ISR only — no teeth on 'em, just eyes. Get an RF jammer up north; that breaks their link. Easy start. Heads up: next run you'll see heavier volume, still ISR.",
      portrait: 'neutral',
    },
    // Wave 2 — Pressure (95s). More ISR, tighter cadence.
    {
      drones: [
        { type: 'isr', count: 20, spawnInterval: 4500, spawnDelayMs: 0 },
      ],
      briefing: "More ISR, heavier volume this time. Widen your jammer coverage. Don't let 'em slip past on the edges. Intel says Red Cell starts mixing OWA strikes next — keep something kinetic in reserve.",
      portrait: 'neutral',
    },
    // Wave 3 — Strike (100s). ISR + OWA mix; OWA starts 10s in.
    {
      drones: [
        { type: 'isr', count: 12, spawnInterval: 6000, spawnDelayMs: 0 },
        { type: 'owa', count: 10, spawnInterval: 8000, spawnDelayMs: 10000 },
      ],
      briefing: "They're mixing now. ISR north, OWA east. RF won't catch a committed OWA — it's preprogrammed, no link to kill. Interceptors east. Next wave: Payload birds, armored. Laser is the answer — save the delivery.",
      portrait: 'stern',
    },
    // Wave 4 — Heavy (110s). OWA first, Payload 20s in.
    {
      drones: [
        { type: 'owa', count: 12, spawnInterval: 8000, spawnDelayMs: 0 },
        { type: 'payloadDelivery', count: 6, spawnInterval: 15000, spawnDelayMs: 20000 },
      ],
      briefing: "Payload birds inbound west — armored, so interceptors'll chip but laser burns through fast. OWA's still pressing east; keep that corridor locked. Next is the saturation run — all three types. HPM comes online in your next delivery. Don't sit on it.",
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
  prepTimeBetweenWaves: 20000,       // ms — 20s prep window between waves

  combat: {
    owaEngageRange: 60,
    isrDisableRange: 36,
    owaDefenseDamage: 1,
    payloadDefenseDamage: 2,
  },
  warden: {
    autoCollapseMs: 8000,
  },

  endScreens: {
    win: {
      image: './src/images/statue-of-liberty.png',
      headline: 'CITY HELD',
      headlineColor: 'successGreen',
      body: [
        "City held. Against everything they threw, you kept the lights on.",
        "",
        "Red Cell will remember this name. The watchfloor never sleeps — get some rest.",
        "",
        "You earned it.",
      ],
    },
    lose: {
      image: './src/images/statue-of-liberty-post-attack.png',
      headline: 'DEFENSE FAILED',
      headlineColor: 'threatRed',
      body: [
        "They got through. Structures down, city dark.",
        "",
        "Debriefs hurt, but we learn — the ones who didn't come home taught us more than a hundred clean runs.",
        "",
        "Fall back, regroup. We go again.",
      ],
    },
  },

  music: {
    waves: [
      { prep: 'Barbed Lullaby',    active: 'Barricade Pulse' },    // Wave 1
      { prep: 'Fortress Rations',  active: 'Fortress Beat' },      // Wave 2
      { prep: 'Barricade Static',  active: 'Determined Forces' },  // Wave 3
      { prep: 'Steel Rations',     active: 'Marching Forth' },     // Wave 4
      { prep: 'Welded Bastion',    active: 'Steel Hero' },         // Wave 5
    ],
    title: 'Fortress Static',
    win: 'Avenged',
    lose: 'Fallen Not Forgotten',
    volume: 0.4,
    crossfadeMs: 500,
  },

  tooltips: {
    'drone-isr': {
      header: 'ISR DRONE',
      headerColor: 'threatRed',
      body: [
        'Surveillance scout (Group 1 sUAS)',
        'STRONG: RF Jammer',
        'WEAK: Interceptor, Laser',
      ],
    },
    'drone-owa': {
      header: 'OWA DRONE',
      headerColor: 'threatRed',
      body: [
        'One-way attack / loitering munition',
        'STRONG: Interceptor, Laser',
        'WEAK: RF Jammer (preprogrammed)',
      ],
    },
    'drone-payloadDelivery': {
      header: 'PAYLOAD-DELIVERY DRONE',
      headerColor: 'threatRed',
      body: [
        'Armored Group 2 payload carrier',
        'STRONG: Laser, HPM',
        'WEAK: RF Jammer',
      ],
    },
    'defense-rfJammer': {
      header: 'RF JAMMER',
      headerColor: 'friendlyCyan',
      body: [
        'Soft-kill electronic warfare',
        'STRONG: ISR',
        'WEAK: OWA, Payload',
      ],
    },
    'defense-interceptor': {
      header: 'INTERCEPTOR',
      headerColor: 'friendlyCyan',
      body: [
        'Hard-kill kinetic (single target)',
        'STRONG: OWA, Payload',
        'WEAK: ISR (cooldown waste)',
      ],
    },
    'defense-laser': {
      header: 'LASER (HEL)',
      headerColor: 'friendlyCyan',
      body: [
        'Directed energy — continuous beam',
        'STRONG: Payload, OWA',
        'WEAK: ISR; overheats on sustained fire',
      ],
    },
    'defense-hpm': {
      header: 'HPM',
      headerColor: 'friendlyCyan',
      body: [
        'Directed energy — cone area pulse',
        'STRONG: Swarms (all types in cone)',
        'WEAK: Single high-HP targets',
      ],
    },
    'structure-power': {
      header: 'POWER SUBSTATION',
      body: ['Critical infrastructure'],
    },
    'structure-comms': {
      header: 'COMMS TOWER',
      body: ['Critical infrastructure'],
    },
    'structure-cityHall': {
      header: 'CITY HALL',
      body: ['Critical infrastructure'],
    },
  },

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

// Drift check: each wave's briefing text must mention every drone type
// present in that wave. Shallow keyword search; warns on drift at boot.
function validateBriefings() {
  const keyword = { isr: 'ISR', owa: 'OWA', payloadDelivery: 'Payload' };
  for (let i = 0; i < CONFIG.waves.length; i++) {
    const w = CONFIG.waves[i];
    if (!w.briefing) continue;
    const types = new Set(w.drones.map(d => d.type));
    const missing = [];
    for (const t of types) {
      const kw = keyword[t];
      if (!kw) continue;
      if (!w.briefing.includes(kw)) missing.push(kw);
    }
    if (missing.length) {
      console.warn(`[briefing] wave ${i + 1} missing mention of: ${missing.join(', ')}`);
    }
  }
}

validateBriefings();

// --- Mode overrides -------------------------------------------------------
// Campaign = current tuned v1 (what's already authored above). Training =
// pre-tuning baseline (shorter, faster, easier). applyMode(name) writes the
// selected mode's values over the flat CONFIG fields that game logic reads,
// so existing read sites stay unchanged.

CONFIG.modes = {
  training: {
    drones: {
      isr:             { speed: 60,  hp: 20  },
      owa:             { speed: 140, hp: 15  },
      payloadDelivery: { speed: 30,  hp: 120 },
    },
    structures: {
      maxHP: 100,
      damageFromOWAStrike: 30,
      damageFromPayloadDrop: 60,
    },
    prepTimeBetweenWaves: 15000,
    deliveries: [
      { rfJammer: 3, interceptor: 2 },                 // Wave 1
      { rfJammer: 2, interceptor: 1 },                 // Wave 2
      {              interceptor: 1, laser: 1 },       // Wave 3
      {              interceptor: 2, laser: 1 },       // Wave 4
      {              interceptor: 1,            hpm: 1 }, // Wave 5
    ],
    waves: [
      {
        drones: [ { type: 'isr', count: 5, spawnInterval: 1500, spawnDelayMs: 0 } ],
        briefing: "First watch. ISR only — no teeth on 'em, just eyes. Get an RF jammer up north; that breaks their link. Easy start. Heads up: next run you'll see heavier volume, still ISR.",
        portrait: 'neutral',
      },
      {
        drones: [ { type: 'isr', count: 8, spawnInterval: 1200, spawnDelayMs: 0 } ],
        briefing: "More ISR, heavier volume this time. Widen your jammer coverage. Don't let 'em slip past on the edges. Intel says Red Cell starts mixing OWA strikes next — keep something kinetic in reserve.",
        portrait: 'neutral',
      },
      {
        drones: [
          { type: 'isr', count: 6, spawnInterval: 1200, spawnDelayMs: 0 },
          { type: 'owa', count: 5, spawnInterval: 1800, spawnDelayMs: 0 },
        ],
        briefing: "They're mixing now. ISR north, OWA east. RF won't catch a committed OWA — it's preprogrammed, no link to kill. Interceptors east. Next wave: Payload birds, armored. Laser is the answer — save the delivery.",
        portrait: 'stern',
      },
      {
        drones: [
          { type: 'owa', count: 8, spawnInterval: 1200, spawnDelayMs: 0 },
          { type: 'payloadDelivery', count: 3, spawnInterval: 3000, spawnDelayMs: 0 },
        ],
        briefing: "Payload birds inbound west — armored, so interceptors'll chip but laser burns through fast. OWA's still pressing east; keep that corridor locked. Next is the saturation run — all three types. HPM comes online in your next delivery. Don't sit on it.",
        portrait: 'stern',
      },
      {
        drones: [
          { type: 'isr', count: 8, spawnInterval: 1000, spawnDelayMs: 0 },
          { type: 'owa', count: 12, spawnInterval: 800, spawnDelayMs: 0 },
          { type: 'payloadDelivery', count: 4, spawnInterval: 2500, spawnDelayMs: 0 },
        ],
        briefing: "All of it. Saturation run — ISR, OWA, Payload, everything. You need the full stack. HPM earns its keep here. One pulse, many drones. Good luck, Watchfloor.",
        portrait: 'angry',
      },
    ],
  },
  campaign: {
    drones: {
      isr:             { speed: 45,  hp: 20  },
      owa:             { speed: 100, hp: 25  },
      payloadDelivery: { speed: 25,  hp: 160 },
    },
    structures: {
      maxHP: 120,
      damageFromOWAStrike: 25,
      damageFromPayloadDrop: 50,
    },
    prepTimeBetweenWaves: 20000,
    deliveries: [
      { rfJammer: 2, interceptor: 1 },                 // Wave 1
      { rfJammer: 1, interceptor: 1 },                 // Wave 2
      {              interceptor: 1, laser: 1 },       // Wave 3
      {              interceptor: 1, laser: 1 },       // Wave 4
      {              interceptor: 1,            hpm: 1 }, // Wave 5
    ],
    waves: CONFIG.waves,
  },
};

export function applyMode(name) {
  const src = CONFIG.modes[name];
  if (!src) return;
  CONFIG.waves = src.waves;
  CONFIG.drones.isr.speed = src.drones.isr.speed;
  CONFIG.drones.isr.hp = src.drones.isr.hp;
  CONFIG.drones.owa.speed = src.drones.owa.speed;
  CONFIG.drones.owa.hp = src.drones.owa.hp;
  CONFIG.drones.payloadDelivery.speed = src.drones.payloadDelivery.speed;
  CONFIG.drones.payloadDelivery.hp = src.drones.payloadDelivery.hp;
  CONFIG.structures.maxHP = src.structures.maxHP;
  CONFIG.structures.damageFromOWAStrike = src.structures.damageFromOWAStrike;
  CONFIG.structures.damageFromPayloadDrop = src.structures.damageFromPayloadDrop;
  CONFIG.prepTimeBetweenWaves = src.prepTimeBetweenWaves;
  CONFIG.deliveries = src.deliveries;
}

// CONFIG boots at campaign (the tuned v1 — matches every existing read site).
applyMode('campaign');
