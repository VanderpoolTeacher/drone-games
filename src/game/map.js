const TILE_STRING = `
WWWWWWWWWWWWWWWBBWWWWWWWWWWWWW
WWWWWWWWWWWWWWWBBWWWWWWWWWWWWW
WWWWWLLL#LLLLLLrLLLLLLL#LWWWWW
WWWWLL#LLLLLLLLrLLL#LLaLLLWWWW
WWWLL#LLLLLLLaLrLLaL#LLLLLLWWW
BBBLLLLLLLLaLLLrLLaLLLLLLLLBBB
WWWLLLppLLLLLaLrLLLLLaLLLLLWWW
WWWWLLpLLLLLLLLrLLLLLLLLLLWWWW
WWWWWrrrrrrrrrrrrrrrrrrrrWWWWW
WWWWWWLLL##LLLaLLLLLL##LLWWWWW
WWWWWWWLLLLLLLLLLLLLLLLWWWWWWW
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
  shape: 'coastalPeninsula',
  gridW: 30,
  gridH: 13,
  tileSize: 16,
  padTop: 3,
  padBottom: 3,
  tiles: TILE_STRING,
  apartments: APARTMENTS,
  structures: [
    { id: 'power',    type: 'power',    tile: { x: 22, y: 5 }, displayName: 'Power Substation' },
    { id: 'comms',    type: 'comms',    tile: { x: 15, y: 5 }, displayName: 'Comms Tower' },
    { id: 'cityHall', type: 'cityHall', tile: { x: 8,  y: 6 }, displayName: 'City Hall' },
  ],
  placementZones: [
    { x: 7,  y: 3 }, { x: 12, y: 3 }, { x: 18, y: 3 }, { x: 24, y: 3 },
    { x: 10, y: 4 }, { x: 19, y: 4 },
    { x: 5,  y: 5 }, { x: 13, y: 5 }, { x: 20, y: 5 }, { x: 25, y: 5 },
    { x: 11, y: 6 }, { x: 18, y: 6 }, { x: 24, y: 6 },
    { x: 9,  y: 7 },
  ],
  spawnEdges: {
    N: { active: true,  waves: [1, 2, 3, 4, 5], droneTypes: ['isr'] },
    S: { active: false, waves: [3, 4, 5],        droneTypes: ['owa'] },
    W: { active: false, waves: [4, 5],           droneTypes: ['payloadDelivery'] },
    E: { active: false, waves: [4, 5],           droneTypes: ['payloadDelivery'] },
  },
  corridors: {
    isr: [
      { waypoints: [{ x: 4,  y: 0 }, { x: 5,  y: 3 }, { x: 6,  y: 5 }, { x: 7,  y: 7 }, { x: 8,  y: 10 }, { x: 7,  y: 13 }], exitEdge: 'S' },
      { waypoints: [{ x: 15, y: 0 }, { x: 14, y: 3 }, { x: 15, y: 5 }, { x: 14, y: 7 }, { x: 15, y: 10 }, { x: 15, y: 13 }], exitEdge: 'S' },
      { waypoints: [{ x: 24, y: 0 }, { x: 24, y: 3 }, { x: 25, y: 5 }, { x: 23, y: 7 }, { x: 21, y: 10 }, { x: 21, y: 13 }], exitEdge: 'S' },
    ],
    owa: [
      { waypoints: [{ x: 8,  y: 13 }, { x: 8,  y: 10 }, { x: 8,  y: 6  }], targetStructureId: 'cityHall' },
      { waypoints: [{ x: 15, y: 13 }, { x: 15, y: 10 }, { x: 15, y: 5  }], targetStructureId: 'comms' },
      { waypoints: [{ x: 22, y: 13 }, { x: 22, y: 10 }, { x: 22, y: 5  }], targetStructureId: 'power' },
    ],
    payloadDelivery: [
      { waypoints: [{ x: -1, y: 5 }, { x: 30, y: 5 }], dropPoint: { x: 15, y: 5 } },
      { waypoints: [{ x: 30, y: 6 }, { x: -1, y: 6 }], dropPoint: { x: 8,  y: 6 } },
    ],
  },
};
