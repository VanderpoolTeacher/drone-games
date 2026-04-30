// 40×16 tile grid at 12 px — fine granularity for precise placement.
// Columns labeled A-Z then AA-AN (col 26..39); rows 1-16. Apartments
// authored directly rather than scraped from TILE_STRING (TILE_STRING now
// only encodes apartment positions — everything else is scenery in image).

const GRID_W = 40;
const GRID_H = 16;
// Playable columns are 0..STATS_COL_START-1; stats sidebar lives to the right.
export const STATS_COL_START = 30;

// Blank slate — assets will be laid down manually.
const APARTMENTS = [];
const SKYSCRAPERS = [];

// Park A8-L10.
const PARK = { x0: 0, y0: 7, x1: 11, y1: 9 };

// Land mask: which tiles are land (placeable). Fill row-by-row with [xMin, xMax]
// ranges, or leave null to mark the row as all water. Multi-segment rows can
// use an array of ranges: [[xMinA, xMaxA], [xMinB, xMaxB]].
// Row index = y (0..GRID_H-1). User supplies coords from the backdrop image.
const LAND_ROWS = new Array(GRID_H).fill(null);
// Filled in between the top/bottom borders, skipping park (A8-L10 = x 0..11,
// y 7..9) which splits rows 8/9/10 into a right-side land strip only.
LAND_ROWS[4]  = [0, 24];          // row 5:  A-Y top border
LAND_ROWS[5]  = [0, 25];          // row 6:  A-Z
LAND_ROWS[6]  = [0, 26];          // row 7:  A-AA
LAND_ROWS[7]  = [12, 27];         // row 8:  M-AB (park covers A-L)
LAND_ROWS[8]  = [12, 28];         // row 9:  M-AC (park covers A-L)
LAND_ROWS[9]  = [12, 28];         // row 10: M-AC (park covers A-L)
LAND_ROWS[10] = [0, 28];          // row 11: A-AC
LAND_ROWS[11] = [0, 27];          // row 12: A-AB
LAND_ROWS[12] = [0, 24];          // row 13: A-Y bottom border

export function isLand(x, y) {
  if (y < 0 || y >= GRID_H || x < 0 || x >= GRID_W) return false;
  const row = LAND_ROWS[y];
  if (row === null) return false;
  const ranges = Array.isArray(row[0]) ? row : [row];
  for (const [a, b] of ranges) {
    if (x >= a && x <= b) return true;
  }
  return false;
}
function inPark(x, y) {
  return x >= PARK.x0 && x <= PARK.x1 && y >= PARK.y0 && y <= PARK.y1;
}

// Every playable tile is one of these types. Defenses render on top of the
// underlying asset; placement validity checks this function.
export function getTileType(x, y) {
  if (!isLand(x, y)) return 'water';
  if (BRIDGES.some(b => b.tile.x === x && b.tile.y === y)) return 'bridge';
  if (APARTMENTS.some(a => a.tile.x === x && a.tile.y === y)) return 'apartment';
  if (SKYSCRAPERS.some(s => s.tile.x === x && s.tile.y === y)) return 'skyscraper';
  if (inPark(x, y)) return 'park';
  // Structures checked against MAP.structures inline (exported below) via
  // a direct array scan using the module-scope structures list.
  for (const s of STRUCTURES) {
    if (s.tile.x === x && s.tile.y === y) return 'structure';
  }
  return 'road';   // default buildable vacant tile
}

export function isBuildableType(type) {
  // Defenses may sit on top of roads/apartments/skyscrapers.
  // Blocked: bridge (supply line), park (green space), structure (anchor), water.
  return type === 'road' || type === 'apartment' || type === 'skyscraper';
}

const BRIDGE_MAX_HP = 1;
const BRIDGES = [
  // Bridges cluster at the south end of the island (higher x on the rotated
  // backdrop). Hudson crossings live in the top bridge band (y=2..4); East
  // River crossings in the bottom band (y=13..15).
  { id: 'br-GW',            tile: { x: 1,  y: 2  }, maxHp: BRIDGE_MAX_HP, displayName: 'George Washington' },
  { id: 'br-GW-2',          tile: { x: 1,  y: 1  }, maxHp: BRIDGE_MAX_HP, displayName: 'GW approach' },
  { id: 'br-GW-3',          tile: { x: 1,  y: 2  }, maxHp: BRIDGE_MAX_HP, displayName: 'GW deck' },
  { id: 'br-GW-4',          tile: { x: 1,  y: 2  }, maxHp: BRIDGE_MAX_HP, displayName: 'GW lower' },
  { id: 'br-B4',            tile: { x: 1,  y: 3  }, maxHp: BRIDGE_MAX_HP, displayName: 'B4 crossing' },
  { id: 'br-M3',            tile: { x: 12, y: 2  }, maxHp: BRIDGE_MAX_HP, displayName: 'M3 crossing' },
  { id: 'br-M4',            tile: { x: 12, y: 3  }, maxHp: BRIDGE_MAX_HP, displayName: 'M4 crossing' },
  { id: 'br-Y3',            tile: { x: 24, y: 2  }, maxHp: BRIDGE_MAX_HP, displayName: 'Y3 crossing' },
  { id: 'br-Y4',            tile: { x: 24, y: 3  }, maxHp: BRIDGE_MAX_HP, displayName: 'Y4 crossing' },
  { id: 'br-R3',            tile: { x: 17, y: 2  }, maxHp: BRIDGE_MAX_HP, displayName: 'R3 crossing' },
  { id: 'br-R4',            tile: { x: 17, y: 3  }, maxHp: BRIDGE_MAX_HP, displayName: 'R4 crossing' },
  { id: 'br-V2',            tile: { x: 21, y: 1  }, maxHp: BRIDGE_MAX_HP, displayName: 'V2 crossing' },
  { id: 'br-V3',            tile: { x: 21, y: 2  }, maxHp: BRIDGE_MAX_HP, displayName: 'V3 crossing' },
  { id: 'br-V4',            tile: { x: 21, y: 3  }, maxHp: BRIDGE_MAX_HP, displayName: 'V4 crossing' },
  { id: 'br-RFK-2',         tile: { x: 4,  y: 13 }, maxHp: BRIDGE_MAX_HP, displayName: 'RFK approach' },
  { id: 'br-RFK-3',         tile: { x: 4,  y: 14 }, maxHp: BRIDGE_MAX_HP, displayName: 'RFK approach' },
  { id: 'br-Queensboro',    tile: { x: 14, y: 13 }, maxHp: BRIDGE_MAX_HP, displayName: 'Queensboro' },
  { id: 'br-Queensboro-2',  tile: { x: 14, y: 14 }, maxHp: BRIDGE_MAX_HP, displayName: 'Queensboro approach' },
  { id: 'br-Queensboro-3',  tile: { x: 14, y: 14 }, maxHp: BRIDGE_MAX_HP, displayName: 'Queensboro ramp' },
  { id: 'br-Queensboro-4',  tile: { x: 14, y: 14 }, maxHp: BRIDGE_MAX_HP, displayName: 'Queensboro deck' },
  { id: 'br-O16',           tile: { x: 14, y: 15 }, maxHp: BRIDGE_MAX_HP, displayName: 'Queens approach' },
  { id: 'br-Williamsburg',  tile: { x: 19, y: 14 }, maxHp: BRIDGE_MAX_HP, displayName: 'Williamsburg' },
  { id: 'br-Williamsburg-2',tile: { x: 19, y: 14 }, maxHp: BRIDGE_MAX_HP, displayName: 'Williamsburg deck' },
  { id: 'br-T16',           tile: { x: 19, y: 15 }, maxHp: BRIDGE_MAX_HP, displayName: 'Brooklyn approach' },
  { id: 'br-Manhattan',     tile: { x: 25, y: 14 }, maxHp: BRIDGE_MAX_HP, displayName: 'Manhattan Bridge' },
  { id: 'br-Y14',           tile: { x: 24, y: 13 }, maxHp: BRIDGE_MAX_HP, displayName: 'Manhattan approach' },
  { id: 'br-T14',           tile: { x: 19, y: 13 }, maxHp: BRIDGE_MAX_HP, displayName: 'Williamsburg approach' },
  { id: 'br-Brooklyn',      tile: { x: 25, y: 15 }, maxHp: BRIDGE_MAX_HP, displayName: 'Brooklyn Bridge' },
];

// Tile string encodes apartment positions for rendering (see drawApartments).
// Populated AFTER populateBuildings runs (end of file) so it reflects the
// computed APARTMENTS list. See initTileString() call below MAP export.
const TILE_STRING = [];
for (let y = 0; y < GRID_H; y++) {
  const row = new Array(GRID_W).fill('water');
  TILE_STRING.push(row);
}
// Only the critical trio remains — hospital/transits/financials to be
// replaced by hand as the new layout takes shape.
const STRUCTURES = [
  { id: 'power',      type: 'power',      tile: { x: 26, y: 8  }, displayName: 'Power Substation', critical: true },
  { id: 'comms',      type: 'comms',      tile: { x: 18, y: 8  }, displayName: 'Comms Tower',      critical: true },
  { id: 'cityHall',   type: 'cityHall',   tile: { x: 28, y: 10 }, displayName: 'City Hall',        critical: true },
  { id: 'un',         type: 'un',         tile: { x: 26, y: 7  }, displayName: 'UN HQ',            critical: true },
  { id: 'water',      type: 'water',      tile: { x: 14, y: 8  }, displayName: 'Water Plant',      critical: true },
  { id: 'fedReserve', type: 'fedReserve', tile: { x: 22, y: 11 }, displayName: 'Federal Reserve',  critical: true },
  // Mid-tier landmarks — destroyed = gameplay penalty, not game-over.
  { id: 'hospital',     type: 'hospital',     tile: { x: 18, y: 5  }, displayName: 'Hospital' },
  { id: 'transit-G',    type: 'transit',      tile: { x: 15, y: 7  }, displayName: 'Grand Central' },
  { id: 'transit-P',    type: 'transit',      tile: { x: 12, y: 7  }, displayName: 'Penn Station' },
  { id: 'fin-exchange', type: 'financial',    tile: { x: 24, y: 12 }, displayName: 'Exchange' },
  { id: 'fin-bank',     type: 'financial',    tile: { x: 23, y: 12 }, displayName: 'Bank Tower' },
  { id: 'stock-floor',  type: 'exchange',     tile: { x: 24, y: 11 }, displayName: 'Stock Exchange' },
  { id: 'fire-station', type: 'fireStation',  tile: { x: 10, y: 6  }, displayName: 'Fire Station' },
  { id: 'police-hq',    type: 'police',       tile: { x: 27, y: 11 }, displayName: 'Police HQ' },
  { id: 'port-auth',    type: 'portAuth',     tile: { x: 14, y: 6  }, displayName: 'Port Authority' },
  { id: 'tv-broadcast', type: 'tvBroadcast',  tile: { x: 17, y: 6  }, displayName: 'TV Broadcast' },
];

// Populate apartments (residential) + skyscrapers (commercial/financial) to
// cover every remaining land tile, zoned by real NYC neighborhoods.
(function populateBuildings() {
  const structTiles = new Set(STRUCTURES.map(s => s.tile.x + ',' + s.tile.y));
  const bridgeTiles = new Set(BRIDGES.map(b => b.tile.x + ',' + b.tile.y));
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (!isLand(x, y)) continue;
      const key = x + ',' + y;
      if (structTiles.has(key) || bridgeTiles.has(key) || inPark(x, y)) continue;
      // Zoning by neighborhood (rotated layout: x low = north, x high = south):
      // - Uptown residential: x ≤ 11 rows 4-6 (Harlem / Upper Manhattan)
      // - Midtown commercial: x 12-27, rows 5-9
      // - Financial district: x ≥ 18, rows 10-12
      // - Chelsea / Village / LES: x ≤ 17, rows 10-12 (residential)
      const inUptown    = x <= 11 && y <= 6;
      const inMidtown   = x >= 12 && y >= 5 && y <= 9;
      const inFinancial = x >= 18 && y >= 10;
      const isCommercial = inMidtown || inFinancial;
      if (isCommercial && !inUptown) {
        SKYSCRAPERS.push({ tile: { x, y } });
      } else {
        APARTMENTS.push({ tile: { x, y }, maxPop: 100 });
      }
    }
  }
  // Mark apartment positions on TILE_STRING for drawApartments().
  for (const apt of APARTMENTS) {
    TILE_STRING[apt.tile.y][apt.tile.x] = 'apartment';
  }
})();

export const MAP = {
  shape: 'manhattan',
  gridW: GRID_W,
  gridH: GRID_H,
  tileSize: 12,
  padTop: 8,
  padBottom: 8,
  tiles: TILE_STRING,
  apartments: APARTMENTS,
  bridges: BRIDGES,
  skyscrapers: SKYSCRAPERS,
  park: PARK,
  inPark,
  structures: STRUCTURES,
  placementZones: [
    // Uptown (rows 4-5): between apts + skyscrapers.
    { x: 2,  y: 4  }, { x: 4,  y: 4  }, { x: 8,  y: 4  }, { x: 10, y: 4  },
    { x: 14, y: 4  }, { x: 16, y: 4  }, { x: 20, y: 4  },
    // Midtown east of park (rows 6-7): hospital, transits, apt N4.
    { x: 18, y: 6  }, { x: 20, y: 6  }, { x: 22, y: 6  }, { x: 24, y: 6  },
    // Rows 8-9 east of park: comms/power/apt/cityHall anchors.
    { x: 12, y: 8  }, { x: 14, y: 8  }, { x: 16, y: 8  }, { x: 20, y: 8  }, { x: 24, y: 8  },
    // Lower Manhattan (rows 10-11).
    { x: 4,  y: 10 }, { x: 6,  y: 10 }, { x: 8,  y: 10 }, { x: 12, y: 10 },
    { x: 14, y: 10 }, { x: 16, y: 10 }, { x: 20, y: 10 },
  ],
  spawnEdges: {
    N: { active: true,  waves: [1, 2, 3, 4, 5], droneTypes: ['isr'] },
    S: { active: true,  waves: [3, 4, 5],        droneTypes: ['owa'] },
    W: { active: true,  waves: [4, 5],           droneTypes: ['payloadDelivery'] },
    E: { active: true,  waves: [4, 5],           droneTypes: ['payloadDelivery'] },
  },
  corridors: {
    // ISR crosses north→south over Manhattan (playable cols 0..29)
    isr: [
      { waypoints: [{ x: 6,  y: 0 }, { x: 6,  y: 6 },  { x: 6,  y: 12 }, { x: 6,  y: 16 }], exitEdge: 'S' },
      { waypoints: [{ x: 16, y: 0 }, { x: 16, y: 6 },  { x: 16, y: 12 }, { x: 16, y: 16 }], exitEdge: 'S' },
      { waypoints: [{ x: 26, y: 0 }, { x: 26, y: 6 },  { x: 26, y: 12 }, { x: 26, y: 16 }], exitEdge: 'S' },
    ],
    // OWA enters from Hudson (S edge) committing north to each structure
    owa: [
      { waypoints: [{ x: 26, y: 16 }, { x: 26, y: 12 }, { x: 26, y: 8  }], targetStructureId: 'power' },
      { waypoints: [{ x: 18, y: 16 }, { x: 18, y: 12 }, { x: 18, y: 8  }], targetStructureId: 'comms' },
      { waypoints: [{ x: 28, y: 16 }, { x: 28, y: 12 }, { x: 28, y: 10 }], targetStructureId: 'cityHall' },
      { waypoints: [{ x: 26, y: 16 }, { x: 26, y: 11 }, { x: 26, y: 7  }], targetStructureId: 'un' },
      { waypoints: [{ x: 14, y: 16 }, { x: 14, y: 12 }, { x: 14, y: 8  }], targetStructureId: 'water' },
      { waypoints: [{ x: 22, y: 16 }, { x: 22, y: 13 }, { x: 22, y: 11 }], targetStructureId: 'fedReserve' },
    ],
    // Payload crosses east↔west within A–AD; east edge = col 30.
    payloadDelivery: [
      // Structure-attack corridors (drop on Comms / City Hall)
      { waypoints: [{ x: -1, y: 8  }, { x: 30, y: 8  }], dropPoint: { x: 18, y: 8  } },
      { waypoints: [{ x: 30, y: 10 }, { x: -1, y: 10 }], dropPoint: { x: 28, y: 10 } },
      // Bridge-attack corridors — dropPoint is overwritten at spawn-time with
      // a random live bridge tile (see spawnDrone), so payloads spread across
      // every surviving bridge instead of hitting the same preset clusters.
      { waypoints: [{ x: -1, y: 3 }, { x: 30, y: 3  }], dropPoint: { x: 16, y: 3  }, isBridgeAttack: true },
      { waypoints: [{ x: 30, y: 3 }, { x: -1, y: 3  }], dropPoint: { x: 3,  y: 3  }, isBridgeAttack: true },
      { waypoints: [{ x: -1, y: 13},{ x: 30, y: 13 }], dropPoint: { x: 14, y: 13 }, isBridgeAttack: true },
      { waypoints: [{ x: 30, y: 14},{ x: -1, y: 14 }], dropPoint: { x: 21, y: 14 }, isBridgeAttack: true },
      { waypoints: [{ x: -1, y: 15},{ x: 30, y: 15 }], dropPoint: { x: 26, y: 15 }, isBridgeAttack: true },
    ],
  },
};
