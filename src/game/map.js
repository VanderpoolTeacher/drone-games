const TILE_STRING = `
LLLLLLLLLLLLLLLLLLLL
LLLLLLLLLLLLLLLLLLLL
WLLLLLLLLLLLLLLLLLLW
WLLLLLLLLLLLLLLLLLLW
WWLLLLLLLLLLLLLLLLWW
WWLLLLLLLLLLLLLLLLWW
WWWLLLLLLLLLLLLLLWWW
WWWWLLLLLLLLLLLWWWWW
`.trim().split('\n').map(row => row.split('').map(ch => ch === 'L' ? 'land' : 'water'));

export const MAP = {
  shape: 'coastalPeninsula',
  gridW: 20,
  gridH: 8,
  tileSize: 24,
  padTop: 11,
  padBottom: 11,
  tiles: TILE_STRING,
  structures: [
    { id: 'power',    type: 'power',    tile: { x: 16, y: 2 }, displayName: 'Power Substation' },
    { id: 'comms',    type: 'comms',    tile: { x: 9,  y: 4 }, displayName: 'Comms Tower' },
    { id: 'cityHall', type: 'cityHall', tile: { x: 4,  y: 6 }, displayName: 'City Hall' },
  ],
  placementZones: [
    { x: 1,  y: 1 }, { x: 6,  y: 1 }, { x: 11, y: 1 }, { x: 16, y: 1 },
    { x: 10, y: 2 }, { x: 13, y: 3 },
    { x: 6,  y: 4 }, { x: 13, y: 4 },
    { x: 3,  y: 5 }, { x: 8,  y: 5 }, { x: 12, y: 5 },
    { x: 7,  y: 6 }, { x: 13, y: 6 },
    { x: 5,  y: 7 },
  ],
  spawnEdges: {
    N: { active: true,  waves: [1, 2, 3, 4, 5], droneTypes: ['isr'] },
    S: { active: false, waves: [3, 4, 5],        droneTypes: ['owa'] },
    W: { active: false, waves: [4, 5],           droneTypes: ['payloadDelivery'] },
    E: { active: false, waves: [4, 5],           droneTypes: ['payloadDelivery'] },
  },
  corridors: {
    isr: [
      { waypoints: [{ x: 2,  y: 0 }, { x: 3,  y: 2 }, { x: 5,  y: 4 }, { x: 4,  y: 6 }, { x: 5,  y: 8 }], exitEdge: 'S' },
      { waypoints: [{ x: 10, y: 0 }, { x: 10, y: 2 }, { x: 9,  y: 4 }, { x: 10, y: 6 }, { x: 10, y: 8 }], exitEdge: 'S' },
      { waypoints: [{ x: 16, y: 0 }, { x: 15, y: 2 }, { x: 16, y: 4 }, { x: 15, y: 6 }, { x: 15, y: 8 }], exitEdge: 'S' },
    ],
    owa: [
      { waypoints: [{ x: 5,  y: 8 }, { x: 5,  y: 6 }], targetStructureId: 'cityHall' },
      { waypoints: [{ x: 9,  y: 8 }, { x: 9,  y: 5 }], targetStructureId: 'comms' },
      { waypoints: [{ x: 15, y: 8 }, { x: 15, y: 3 }], targetStructureId: 'power' },
    ],
    payloadDelivery: [
      { waypoints: [{ x: -1, y: 4 }, { x: 19, y: 4 }], dropPoint: { x: 9, y: 4 } },
      { waypoints: [{ x: 20, y: 5 }, { x: 0,  y: 5 }], dropPoint: { x: 4, y: 5 } },
    ],
  },
};
