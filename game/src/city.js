// Solmar Bay: the city itself. A street grid of blocks, each block holding
// buildings, a park, a plaza or a beach strip, plus the named places missions use.
import { makeRng, pick } from './util.js';

export const WORLD = 3600;            // city is WORLD x WORLD world units
export const PITCH = 450;             // distance between street centrelines
export const ROAD_W = 96;             // street width
export const STREETS = 8;             // streets per axis (centres at 225 + i*450)

export function streetCentres() {
  const out = [];
  for (let i = 0; i < STREETS; i++) out.push(225 + i * PITCH);
  return out;
}
export function onRoad(x, y) {
  const c = streetCentres();
  for (const s of c) {
    if (Math.abs(x - s) < ROAD_W / 2 + 14) return true;
    if (Math.abs(y - s) < ROAD_W / 2 + 14) return true;
  }
  return false;
}
export function nearestStreetCoord(v) {
  const c = streetCentres();
  let best = c[0], bd = Math.abs(v - c[0]);
  for (const s of c) { const d = Math.abs(v - s); if (d < bd) { bd = d; best = s; } }
  return best;
}

const PALETTES = [
  ['#e8a34c', '#d98f3a', '#f0b565'], // warm stucco
  ['#7fb3c8', '#5f9db8', '#93c4d6'], // sea blue
  ['#c96f5e', '#b25a49', '#dd8574'], // brick rose
  ['#8fae7a', '#789c66', '#a5c292'], // palm green
  ['#b9a7d6', '#a18fc4', '#cbbde6'], // dusk lavender
  ['#e6d27a', '#d4bd5c', '#f0dc92'], // sun yellow
];

export function buildCity() {
  const rng = makeRng(20261124);
  const buildings = [];
  const parks = [];
  const centres = streetCentres();
  const block = PITCH - ROAD_W; // 354
  for (let ix = 0; ix < STREETS - 1; ix++) {
    for (let iy = 0; iy < STREETS - 1; iy++) {
      const bx = centres[ix] + ROAD_W / 2, by = centres[iy] + ROAD_W / 2;
      const roll = rng();
      if (roll < 0.12) { // park block
        parks.push({ x: bx, y: by, w: block, h: block, trees: 7 + Math.floor(rng() * 6) });
        continue;
      }
      // 2x2 buildings per block with a courtyard gap
      const pal = pick(rng, PALETTES);
      for (let gx = 0; gx < 2; gx++) {
        for (let gy = 0; gy < 2; gy++) {
          const w = 120 + rng() * 40, h = 120 + rng() * 40;
          const x = bx + 8 + gx * (block / 2) + (block / 2 - w) / 2 - 4;
          const y = by + 8 + gy * (block / 2) + (block / 2 - h) / 2 - 4;
          buildings.push({
            x, y, w, h,
            color: pal[(gx * 2 + gy) % pal.length],
            roof: rng() < 0.3 ? '#5b7d8a' : '#6b5a49',
            height: 1 + Math.floor(rng() * 3),
            windows: 3 + Math.floor(rng() * 3),
          });
        }
      }
    }
  }
  // Named places the story and missions point at (all on streets / plazas).
  const places = {
    hideout: { x: 675, y: 675, name: 'Rico\'s Hideout' },
    marina: { x: 3375, y: 675, name: 'Marina Pier' },
    market: { x: 675, y: 3375, name: 'Solmar Market' },
    bank: { x: 2475, y: 1575, name: 'Bay Trust Bank' },
    stadium: { x: 1575, y: 2475, name: 'Sunbowl Stadium' },
    plaza: { x: 2025, y: 2025, name: 'Palm Plaza' },
    airport: { x: 3375, y: 3375, name: 'Solmar Airfield' },
    garage: { x: 1125, y: 2025, name: 'Dino\'s Garage' },
  };
  return { buildings, parks, places, rng };
}

// Is a point inside any building? Used for collision and spawning.
export function insideBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  }
  return null;
}
