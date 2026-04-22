// 20×8 tile grid at 24 px — bigger cells, A-T columns × 1-8 rows for easy
// reference when the backdrop is off. Apartments authored directly rather
// than scraped from TILE_STRING (TILE_STRING now only encodes apartment
// positions — everything else is scenery in the image).

const GRID_W = 20;
const GRID_H = 8;

const APARTMENTS = [
  { tile: { x: 3,  y: 2 }, maxPop: 100 },
  { tile: { x: 6,  y: 2 }, maxPop: 100 },
  { tile: { x: 9,  y: 2 }, maxPop: 100 },
  { tile: { x: 13, y: 3 }, maxPop: 100 },
  { tile: { x: 4,  y: 4 }, maxPop: 100 },
  { tile: { x: 11, y: 4 }, maxPop: 100 },
  { tile: { x: 15, y: 4 }, maxPop: 100 },
  { tile: { x: 5,  y: 5 }, maxPop: 100 },
  { tile: { x: 12, y: 5 }, maxPop: 100 },
  { tile: { x: 16, y: 6 }, maxPop: 100 },
];

const BRIDGES = [
  { x: 1,  y: 5 },   // B6
  { x: 1,  y: 6 },   // B7
  { x: 8,  y: 0 },   // I1
  { x: 12, y: 0 },   // M1
  { x: 12, y: 1 },   // M2
  { x: 15, y: 1 },   // P2
  { x: 17, y: 1 },   // R2
  { x: 17, y: 2 },   // R3
  { x: 16, y: 3 },   // Q4
];

// Tile string encodes bridges + apartments; everything else is 'water' with
// the image carrying the visual. With backdrop off, cells show as blue grid.
const TILE_STRING = [];
for (let y = 0; y < GRID_H; y++) {
  const row = new Array(GRID_W).fill('water');
  TILE_STRING.push(row);
}
for (const b of BRIDGES) {
  TILE_STRING[b.y][b.x] = 'bridge';
}
for (const apt of APARTMENTS) {
  TILE_STRING[apt.tile.y][apt.tile.x] = 'apartment';
}

export const MAP = {
  shape: 'manhattan',
  gridW: GRID_W,
  gridH: GRID_H,
  tileSize: 24,
  padTop: 8,
  padBottom: 8,
  tiles: TILE_STRING,
  apartments: APARTMENTS,
  structures: [
    { id: 'power',    type: 'power',    tile: { x: 13, y: 4 }, displayName: 'Power Substation' },  // Con Ed-ish, Midtown East
    { id: 'comms',    type: 'comms',    tile: { x: 9,  y: 4 }, displayName: 'Comms Tower' },       // 30 Rock-ish, Midtown
    { id: 'cityHall', type: 'cityHall', tile: { x: 17, y: 5 }, displayName: 'City Hall' },         // Lower Manhattan
  ],
  placementZones: [
    { x: 2,  y: 3 }, { x: 5,  y: 3 },
    { x: 7,  y: 3 }, { x: 10, y: 3 }, { x: 12, y: 3 }, { x: 14, y: 3 },
    { x: 3,  y: 5 }, { x: 6,  y: 5 }, { x: 8,  y: 5 }, { x: 11, y: 5 },
    { x: 14, y: 5 }, { x: 16, y: 5 }, { x: 18, y: 5 },
    { x: 10, y: 6 },
  ],
  spawnEdges: {
    N: { active: true,  waves: [1, 2, 3, 4, 5], droneTypes: ['isr'] },
    S: { active: true,  waves: [3, 4, 5],        droneTypes: ['owa'] },
    W: { active: true,  waves: [4, 5],           droneTypes: ['payloadDelivery'] },
    E: { active: true,  waves: [4, 5],           droneTypes: ['payloadDelivery'] },
  },
  corridors: {
    // ISR crosses north→south over Manhattan
    isr: [
      { waypoints: [{ x: 5,  y: 0 }, { x: 5,  y: 3 }, { x: 5,  y: 6 }, { x: 5,  y: 8 }], exitEdge: 'S' },
      { waypoints: [{ x: 11, y: 0 }, { x: 11, y: 3 }, { x: 11, y: 6 }, { x: 11, y: 8 }], exitEdge: 'S' },
      { waypoints: [{ x: 17, y: 0 }, { x: 17, y: 3 }, { x: 17, y: 6 }, { x: 17, y: 8 }], exitEdge: 'S' },
    ],
    // OWA enters from Hudson (S edge) committing north to each structure
    owa: [
      { waypoints: [{ x: 13, y: 8 }, { x: 13, y: 6 }, { x: 13, y: 4 }], targetStructureId: 'power' },
      { waypoints: [{ x: 9,  y: 8 }, { x: 9,  y: 6 }, { x: 9,  y: 4 }], targetStructureId: 'comms' },
      { waypoints: [{ x: 17, y: 8 }, { x: 17, y: 6 }, { x: 17, y: 5 }], targetStructureId: 'cityHall' },
    ],
    // Payload crosses east↔west, dropping on comms and cityHall axes
    payloadDelivery: [
      { waypoints: [{ x: -1, y: 4 }, { x: 20, y: 4 }], dropPoint: { x: 9,  y: 4 } },
      { waypoints: [{ x: 20, y: 5 }, { x: -1, y: 5 }], dropPoint: { x: 17, y: 5 } },
    ],
  },
};
