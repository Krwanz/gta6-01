// Traffic cars that follow the street grid, pedestrians on the sidewalks,
// and parked cars the player can steal. All original Solmar Bay vehicles.
import { clamp, dist, makeRng, pick } from './util.js';
import { streetCentres, ROAD_W, onRoad, WORLD, nearestStreetCoord } from './city.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#39b06a', '#e8e8e8', '#2b2b33', '#c97fd9', '#e07f2e'];
const CAR_NAMES = ['Comet', 'Sandpiper', 'Marlin', 'Palm Cruiser', 'Sunrunner', 'Bayliner', 'Coral', 'Tide'];
const PED_COLORS = ['#f2c14e', '#7fb069', '#e07a5f', '#81b29a', '#f4a261', '#a78bfa', '#ef476f', '#06d6a0'];

export function makeCar(rng, x, y, angle) {
  return {
    kind: 'car', x, y, angle, speed: 0, maxSpeed: 150 + rng() * 90,
    color: pick(rng, CAR_COLORS), name: pick(rng, CAR_NAMES),
    len: 52, wid: 26, stolen: false, parked: false,
    lane: 0, dir: 0, target: null, honk: 0,
  };
}

export function createTraffic(city) {
  const rng = makeRng(777001);
  const cars = [];
  const peds = [];
  const centres = streetCentres();
  // Traffic cars: each drives along one street, turning at intersections.
  for (let i = 0; i < 16; i++) {
    const horizontal = rng() < 0.5;
    const street = pick(rng, centres);
    const along = 100 + rng() * (WORLD - 200);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = (ROAD_W / 2 - 22) * (dir > 0 ? 1 : -1);
    const car = makeCar(rng, horizontal ? along : street + lane, horizontal ? street + lane : along,
      horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
    car.horizontal = horizontal; car.dir = dir; car.speed = car.maxSpeed * 0.7;
    cars.push(car);
  }
  // Parked cars along street edges, ready to steal.
  for (let i = 0; i < 10; i++) {
    const street = pick(rng, centres);
    const along = 300 + rng() * (WORLD - 600);
    const side = rng() < 0.5 ? 1 : -1;
    const horizontal = rng() < 0.5;
    const car = makeCar(rng,
      horizontal ? along : street + side * (ROAD_W / 2 - 16),
      horizontal ? street + side * (ROAD_W / 2 - 16) : along,
      horizontal ? 0 : Math.PI / 2);
    car.parked = true; car.speed = 0;
    cars.push(car);
  }
  for (let i = 0; i < 26; i++) {
    peds.push(spawnPed(rng, city));
  }
  return { cars, peds, rng };
}

function spawnPed(rng, city) {
  const centres = streetCentres();
  const street = pick(rng, centres);
  const along = 100 + rng() * (WORLD - 200);
  const side = (ROAD_W / 2 + 12) * (rng() < 0.5 ? 1 : -1);
  const horizontal = rng() < 0.5;
  return {
    kind: 'ped', x: horizontal ? along : street + side, y: horizontal ? street + side : along,
    angle: rng() * Math.PI * 2, speed: 28 + rng() * 26, color: pick(rng, PED_COLORS),
    walkPhase: rng() * 6, panic: 0, health: 30, fleeX: 0, fleeY: 0,
  };
}

export function nearestCar(cars, x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of cars) {
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function updateTraffic(t, dt, city, player, police) {
  const centres = streetCentres();
  for (const car of t.cars) {
    if (car.parked || car.playerDriven) continue;
    // Drive forward; at an intersection sometimes turn onto the cross street.
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const nearCentre = centres.some((s) => Math.abs(nx - s) < 26 || Math.abs(ny - s) < 26);
    if (nearCentre && Math.random() < dt * 0.25) {
      const horizontal = Math.random() < 0.5;
      const dir = Math.random() < 0.5 ? 1 : -1;
      car.horizontal = horizontal;
      car.angle = horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.x = horizontal ? car.x : nearestStreetCoord(car.x);
      car.y = horizontal ? nearestStreetCoord(car.y) : car.y;
    } else {
      car.x = nx; car.y = ny;
    }
    // Wrap around the city edge instead of vanishing.
    if (car.x < 40) { car.x = 40; car.angle = 0; }
    if (car.x > WORLD - 40) { car.x = WORLD - 40; car.angle = Math.PI; }
    if (car.y < 40) { car.y = 40; car.angle = Math.PI / 2; }
    if (car.y > WORLD - 40) { car.y = WORLD - 40; car.angle = -Math.PI / 2; }
    // Slow down if another car is right ahead.
    for (const o of t.cars) {
      if (o === car || o.playerDriven) continue;
      const d = dist(car.x, car.y, o.x, o.y);
      if (d < 70) { car.speed = Math.max(40, car.speed - 120 * dt); }
    }
    car.speed = clamp(car.speed + 30 * dt, 0, car.maxSpeed);
  }
  for (const ped of t.peds) {
    if (ped.health <= 0) continue;
    ped.walkPhase += dt * 6;
    if (ped.panic > 0) {
      ped.panic -= dt;
      const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
      ped.x += Math.cos(a) * 95 * dt; ped.y += Math.sin(a) * 95 * dt;
      ped.angle = a;
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (Math.random() < dt * 0.08) ped.angle += (Math.random() - 0.5) * 2.4;
      // Peds stay near streets; steer back toward the nearest street.
      if (!onRoad(ped.x, ped.y)) {
        ped.angle = Math.atan2(nearestStreetCoord(ped.y) - ped.y, nearestStreetCoord(ped.x) - ped.x);
      }
    }
    ped.x = clamp(ped.x, 60, WORLD - 60);
    ped.y = clamp(ped.y, 60, WORLD - 60);
  }
}
