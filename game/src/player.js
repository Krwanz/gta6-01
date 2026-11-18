// Rico Vale on foot and behind the wheel: movement, car entry/exit,
// punching, shooting, and getting hit.
import { clamp, dist, circleHitsRect, pushCircleOutOfRect, angleDiff } from './util.js';
import { WORLD, insideBuilding } from './city.js';

export function createPlayer(city) {
  return {
    x: 675, y: 760, angle: -Math.PI / 2, speed: 0,
    health: 100, cash: 0, ammo: 12, hasGun: true,
    inCar: null, onFoot: true, punchTimer: 0, shootTimer: 0,
    hurtFlash: 0, walkPhase: 0, wantedHeat: 0,
  };
}

export function updatePlayer(p, input, dt, city, traffic, audio, game) {
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.shootTimer = Math.max(0, p.shootTimer - dt);
  if (p.inCar) {
    updateDriving(p, input, dt, city, traffic, audio, game);
  } else {
    updateOnFoot(p, input, dt, city, traffic, audio, game);
  }
}

function updateOnFoot(p, input, dt, city, traffic, audio, game) {
  let mx = 0, my = 0;
  if (input.isDown('w', 'arrowup')) my -= 1;
  if (input.isDown('s', 'arrowdown')) my += 1;
  if (input.isDown('a', 'arrowleft')) mx -= 1;
  if (input.isDown('d', 'arrowright')) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    p.angle = Math.atan2(my, mx);
    p.walkPhase += dt * 10;
    p.x += mx * 235 * dt; p.y += my * 235 * dt;
  }
  p.x = clamp(p.x, 30, WORLD - 30);
  p.y = clamp(p.y, 30, WORLD - 30);
  for (const b of city.buildings) pushCircleOutOfRect(p, 16, b.x, b.y, b.w, b.h);

  // Aim with the mouse when shooting; otherwise face movement direction.
  if (input.mouse.clicked && p.hasGun && p.ammo > 0 && p.shootTimer <= 0) {
    shoot(p, input, game, audio);
  }
  if (input.wasPressed(' ') || input.wasPressed('f')) {
    if (p.shootTimer <= 0 && p.hasGun && p.ammo > 0 && input.isDown('shift')) shoot(p, input, game, audio);
    else punch(p, game, audio);
  }
  if (input.wasPressed('e')) {
    const car = nearestStealable(traffic.cars, p.x, p.y);
    if (car) {
      p.inCar = car; car.playerDriven = true; car.parked = false; car.stolen = true;
      p.x = car.x; p.y = car.y;
      audio.horn();
      game.onCarStolen(car);
    }
  }
  if (input.wasPressed('r') && p.ammo <= 0) { p.ammo = 12; game.addToast('Ammo restocked at the hideout rate — $0, Rico knows a guy'); }
}

function nearestStealable(cars, x, y) {
  let best = null, bd = 95;
  for (const c of cars) {
    if (c.police) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function punch(p, game, audio) {
  p.punchTimer = 0.35;
  audio.punch();
  game.punchAt(p.x + Math.cos(p.angle) * 34, p.y + Math.sin(p.angle) * 34, 46, 25, 'player');
}

function shoot(p, input, game, audio) {
  p.shootTimer = 0.28; p.ammo -= 1;
  audio.shoot();
  const aim = game.screenToWorldAngle ? game.screenToWorldAngle(input.mouse.x, input.mouse.y) : p.angle;
  p.angle = aim;
  game.shootAt(p.x, p.y, aim, 'player');
}

function updateDriving(p, input, dt, city, traffic, audio, game) {
  const car = p.inCar;
  const forward = input.isDown('w', 'arrowup') ? 1 : input.isDown('s', 'arrowdown') ? -0.6 : 0;
  const steer = (input.isDown('a', 'arrowleft') ? -1 : 0) + (input.isDown('d', 'arrowright') ? 1 : 0);
  const accel = 420;
  car.speed += forward * accel * dt;
  car.speed -= car.speed * 0.9 * dt; // drag
  if (forward === 0) car.speed -= Math.sign(car.speed) * 160 * dt;
  car.speed = clamp(car.speed, -160, 560);
  if (Math.abs(car.speed) > 8) car.angle += steer * 2.1 * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 200, 0.3, 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Buildings stop the car with a thud.
  let hit = false;
  for (const b of city.buildings) {
    if (circleHitsRect(nx, ny, 24, b.x, b.y, b.w, b.h)) { hit = true; break; }
  }
  if (hit) {
    if (Math.abs(car.speed) > 140) { audio.crash(); game.addShake(6); game.onCrash(Math.abs(car.speed)); }
    car.speed *= -0.25;
  } else {
    car.x = clamp(nx, 30, WORLD - 30); car.y = clamp(ny, 30, WORLD - 30);
  }
  // Bumping traffic cars and pedestrians.
  for (const o of traffic.cars) {
    if (o === car || o.playerDriven) continue;
    if (dist(car.x, car.y, o.x, o.y) < 52 && Math.abs(car.speed) > 60) {
      // Shove the car sideways out of the player's lane instead of dead
      // ahead: a bumped car that stops in front of the player becomes a
      // wall the player keeps rear-ending. A bump jolts; it doesn't wound
      // like a building crash does.
      const cross = Math.cos(car.angle) * (o.y - car.y) - Math.sin(car.angle) * (o.x - car.x);
      const side = cross >= 0 ? 1 : -1;
      o.x += Math.cos(car.angle + side * Math.PI / 2) * 26;
      o.y += Math.sin(car.angle + side * Math.PI / 2) * 26;
      audio.crash(); game.addShake(4);
    }
  }
  for (const ped of traffic.peds) {
    if (ped.health <= 0) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 40) {
      ped.health = 0; ped.panic = 0;
      game.onPedHit(ped);
    }
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
  if (input.wasPressed('e')) {
    car.playerDriven = false; car.speed = 0;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    p.x = clamp(p.x, 30, WORLD - 30); p.y = clamp(p.y, 30, WORLD - 30);
    audio.blip(440, 0.1, 'sine', 0.12);
  }
  if (input.wasPressed(' ') && Math.abs(car.speed) > 60) {
    car.speed *= 0.55; audio.noise(0.2, 0.25, 900); // handbrake slide
  }
}
