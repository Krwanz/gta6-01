// The Solmar Bay Police Department: wanted stars, patrol cars that spawn,
// chase, ram, and arrest Rico when they catch him on foot.
import { clamp, dist, angleTo, angleDiff, makeRng } from './util.js';
import { WORLD, streetCentres } from './city.js';

export function createPolice() {
  return {
    wanted: 0, heat: 0, quietTimer: 0, units: [], rng: makeRng(4242),
    arrestTimer: 0, busted: false,
  };
}

export function addWanted(police, amount, audio) {
  const before = police.wanted;
  police.wanted = clamp(police.wanted + amount, 0, 5);
  police.heat = 1; police.quietTimer = 0;
  if (police.wanted > before && audio) audio.wanted();
}

export function updatePolice(police, dt, player, city, traffic, audio, game) {
  // An arrest only happens on foot: once Rico is back in a car the grab
  // timer must not carry over, or an officer could bust him the instant
  // he steps out again with a timer already half full.
  if (player.inCar) police.arrestTimer = 0;
  // Laying low at the hideout shakes the trail faster: the hideout is
  // where Rico loses the cops, so heat and the quiet timer run down
  // quicker within its radius than out on the street.
  const hide = city.places.hideout;
  const hiding = hide && dist(player.x, player.y, hide.x, hide.y) < 220;
  // Heat decays when Rico stays quiet; stars fall one at a time.
  if (police.heat <= 0 && police.wanted > 0) {
    police.quietTimer += dt * (hiding ? 2 : 1);
    if (police.quietTimer > 9) { police.wanted -= 1; police.quietTimer = 0; game.addToast('The heat is cooling off…'); }
  } else if (police.heat > 0) {
    police.heat = Math.max(0, police.heat - dt * (hiding ? 0.35 : 0.08));
  }
  const wantUnits = police.wanted === 0 ? 0 : police.wanted + 1;
  // Spawn units near (but not on top of) the player.
  while (police.units.length < wantUnits) {
    const u = spawnUnit(police, player);
    if (u) police.units.push(u);
  }
  if (police.units.length > wantUnits) police.units.length = wantUnits;
  audio.setSiren(police.wanted > 0 && police.units.length > 0);

  for (const u of police.units) {
    const d = dist(u.x, u.y, player.x, player.y);
    if (player.inCar) {
      // Chase the car: steer toward Rico, ram when close.
      const want = angleTo(u.x, u.y, player.x, player.y);
      u.angle += clamp(angleDiff(u.angle, want), -2.6 * dt, 2.6 * dt);
      u.speed = clamp(u.speed + 380 * dt, 0, 450);
      u.x += Math.cos(u.angle) * u.speed * dt;
      u.y += Math.sin(u.angle) * u.speed * dt;
      if (d < 58 && Math.abs(player.inCar.speed) < 420) {
        // A ram lands at most once per timer per unit: cutting the
        // player's speed every frame while the cars overlap pins it at
        // ~0 forever, so it can never drive away from the police.
        u.ramTimer = (u.ramTimer || 0) - dt;
        if (u.ramTimer <= 0) {
          u.ramTimer = 2.2;
          player.inCar.speed *= 0.82; u.speed *= 0.7;
          game.addShake(3); game.onRam();
        }
      }
      if (d > 1600) { const s = respawnNear(police, player); u.x = s.x; u.y = s.y; }
    } else {
      // On foot: drive close, then two officers get out and close in.
      if (d > 90) {
        const want = angleTo(u.x, u.y, player.x, player.y);
        u.angle += clamp(angleDiff(u.angle, want), -2.6 * dt, 2.6 * dt);
        u.speed = clamp(u.speed + 340 * dt, 0, 480);
        u.x += Math.cos(u.angle) * u.speed * dt;
        u.y += Math.sin(u.angle) * u.speed * dt;
      } else {
        u.speed = Math.max(0, u.speed - 300 * dt);
        u.footX = u.footX ?? u.x; u.footY = u.footY ?? u.y;
        const fa = angleTo(u.footX, u.footY, player.x, player.y);
        u.footX += Math.cos(fa) * 150 * dt; u.footY += Math.sin(fa) * 150 * dt;
        if (dist(u.footX, u.footY, player.x, player.y) < 26) {
          police.arrestTimer += dt;
          game.addToast('POLICE ARE GRABBING YOU — run! (' + Math.ceil(2 - police.arrestTimer) + ')');
          if (police.arrestTimer > 2) { police.busted = true; game.onBusted(); }
        } else police.arrestTimer = Math.max(0, police.arrestTimer - dt);
      }
    }
    u.x = clamp(u.x, 30, WORLD - 30); u.y = clamp(u.y, 30, WORLD - 30);
  }
  if (police.wanted === 0) { police.units.length = 0; police.arrestTimer = 0; }
}

function respawnNear(police, player) {
  const a = police.rng() * Math.PI * 2;
  const d = 500 + police.rng() * 300;
  return {
    x: clamp(player.x + Math.cos(a) * d, 60, WORLD - 60),
    y: clamp(player.y + Math.sin(a) * d, 60, WORLD - 60),
  };
}

function spawnUnit(police, player) {
  const s = respawnNear(police, player);
  return {
    kind: 'police', x: s.x, y: s.y, angle: angleTo(s.x, s.y, player.x, player.y),
    speed: 200, len: 52, wid: 26, color: '#1c2733', police: true,
    lightPhase: police.rng() * 6, footX: null, footY: null,
  };
}

export function policeHitPlayer(police, player, amount) {
  player.health -= amount; player.hurtFlash = 0.4;
}
