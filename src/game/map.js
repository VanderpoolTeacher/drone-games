// Logical tile grid. With the image-backdrop enabled, the tile TYPES are
// decoration for apartment/casualty feedback only — the image carries the
// land/water visuals. Tile COORDINATES still drive placement, corridors,
// structure positions, apartment locations, etc.
//
// Positions are tuned so structures, zones, and corridor mouths land on
// plausible Manhattan landmarks when manhattan.png is rotated 90° CCW and
// cover-fit to the map area (Harlem at left edge, Battery at right).

const TILE_STRING = `
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWWaWWWWWWaWWWWaWWWaWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWaWWWWWaWWWWWaWWWWWaWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWWaWWWWWWWWWWaWWWWaWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWaWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
`.trim().split('\n').map(row => row.split('').map(ch => {
  if (ch === 'L') return 'land';
  if (ch === 'B') return 'bridge';
  if (ch === '#') return 'building';
  if (ch === 'r') return 'road';
  if (ch === 'p') return 'park';
  if (ch === 'a') return 'apartment';
  return 'water';
}));

const APARTMENT_POPULATION = 100;
const APARTMENTS = [];
for (let y = 0; y < TILE_STRING.length; y++) {
  for (let x = 0; x < TILE_STRING[y].length; x++) {
    if (TILE_STRING[y][x] === 'apartment') {
      APARTMENTS.push({ tile: { x, y }, maxPop: APARTMENT_POPULATION });
    }
  }
}

export const MAP = {
  shape: 'manhattan',
  gridW: 30,
  gridH: 13,
  tileSize: 16,
  padTop: 3,
  padBottom: 3,
  tiles: TILE_STRING,
  apartments: APARTMENTS,
  structures: [
    // Rough Manhattan landmarks on the rotated backdrop (Harlem left → Battery right):
    { id: 'power',    type: 'power',    tile: { x: 20, y: 7 }, displayName: 'Power Substation' },  // Con Ed East 14th area
    { id: 'comms',    type: 'comms',    tile: { x: 13, y: 6 }, displayName: 'Comms Tower' },       // Midtown (30 Rock-ish)
    { id: 'cityHall', type: 'cityHall', tile: { x: 25, y: 8 }, displayName: 'City Hall' },         // Lower Manhattan (City Hall Park)
  ],
  placementZones: [
    // Upper Manhattan / Harlem
    { x: 6,  y: 6 }, { x: 6,  y: 8 },
    { x: 9,  y: 5 }, { x: 9,  y: 9 },
    // Upper East/West
    { x: 12, y: 7 }, { x: 12, y: 9 },
    // Midtown
    { x: 15, y: 5 }, { x: 15, y: 8 },
    // Chelsea / Flatiron
    { x: 18, y: 7 }, { x: 18, y: 9 },
    // SoHo / Lower East Side
    { x: 22, y: 6 }, { x: 22, y: 9 },
    // Financial District / Battery
    { x: 26, y: 7 }, { x: 27, y: 9 },
  ],
  spawnEdges: {
    N: { active: true,  waves: [1, 2, 3, 4, 5], droneTypes: ['isr'] },
    S: { active: true,  waves: [3, 4, 5],        droneTypes: ['owa'] },
    W: { active: true,  waves: [4, 5],           droneTypes: ['payloadDelivery'] },
    E: { active: true,  waves: [4, 5],           droneTypes: ['payloadDelivery'] },
  },
  corridors: {
    // ISR drones cross from East River (N edge) south over Manhattan, exiting via Hudson
    isr: [
      { waypoints: [{ x: 8,  y: 0 }, { x: 8,  y: 5 }, { x: 8,  y: 8 }, { x: 8,  y: 13 }], exitEdge: 'S' },
      { waypoints: [{ x: 16, y: 0 }, { x: 16, y: 6 }, { x: 16, y: 9 }, { x: 16, y: 13 }], exitEdge: 'S' },
      { waypoints: [{ x: 24, y: 0 }, { x: 24, y: 5 }, { x: 24, y: 9 }, { x: 24, y: 13 }], exitEdge: 'S' },
    ],
    // OWA drones enter from Hudson (S edge), commit north to their structure
    owa: [
      { waypoints: [{ x: 20, y: 13 }, { x: 20, y: 10 }, { x: 20, y: 7 }], targetStructureId: 'power' },
      { waypoints: [{ x: 13, y: 13 }, { x: 13, y: 10 }, { x: 13, y: 6 }], targetStructureId: 'comms' },
      { waypoints: [{ x: 25, y: 13 }, { x: 25, y: 11 }, { x: 25, y: 8 }], targetStructureId: 'cityHall' },
    ],
    // Payload drones cross east↔west at mid-Manhattan, dropping on the comms or cityHall axis
    payloadDelivery: [
      { waypoints: [{ x: -1, y: 7 }, { x: 30, y: 7 }], dropPoint: { x: 13, y: 6 } },
      { waypoints: [{ x: 30, y: 8 }, { x: -1, y: 8 }], dropPoint: { x: 25, y: 8 } },
    ],
  },
};
