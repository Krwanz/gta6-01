// Solmar Bay — entry point. Owns the game loop, camera, modes (menu / play /
// paused / busted / down), crime events, combat resolution and screenshots
// scenarios (?shot=start|drive|foot|chase|mission).
import { buildCity, WORLD } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer } from './player.js';
import { createTraffic, updateTraffic, nearestCar } from './traffic.js';
import { createPolice, updatePolice, addWanted } from './police.js';
import { createMissions, updateMissions, startMission, currentMission } from './missions.js';
import { createRenderer, render } from './render.js';
import { saveGameState, loadGameState, hasSave } from './save.js';
import { clamp, dist } from './util.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);

const game = {
  mode: 'menu', time: 0, shake: 0,
  camera: { x: 675, y: 700, zoom: 1 },
  bannerTitle: '', bannerText: '', bannerTimer: 0,
  toasts: [], effects: [], menuIndex: 0, hasSaveData: hasSave(),
  muted: false,
};
game.audio = audio;

function buildWorld() {
  game.city = buildCity();
  game.player = createPlayer(game.city);
  game.traffic = createTraffic(game.city);
  game.police = createPolice();
  game.missions = createMissions(game.city);
  game.camera.x = game.player.x; game.camera.y = game.player.y;
}

buildWorld();

// ---- game-facing helpers called by the other modules ----
game.addToast = (text) => {
  if (game.toasts.some((t) => t.text === text)) return;
  game.toasts.push({ text, life: 5 });
  if (game.toasts.length > 3) game.toasts.shift();
};
game.setBanner = (title, text) => {
  game.bannerTitle = title; game.bannerText = text; game.bannerTimer = 4.5;
};
game.addShake = (n) => { game.shake = Math.max(game.shake, n); };
game.saveGame = () => {
  saveGameState({
    cash: game.player.cash, missionsDone: game.missions.index,
    x: game.player.x, y: game.player.y, health: game.player.health,
    totalEarned: game.missions.totalCashEarned,
  });
};
game.screenToWorldAngle = (sx, sy) => {
  const wx = game.camera.x + (sx - canvas.width / 2) / game.camera.zoom;
  const wy = game.camera.y + (sy - canvas.height / 2) / game.camera.zoom;
  return Math.atan2(wy - game.player.y, wx - game.player.x);
};
game.onCarStolen = (car) => {
  game.addToast('You stole a ' + car.name + '! The owner is calling it in…');
  addWanted(game.police, 1, audio);
  for (const ped of game.traffic.peds) {
    if (dist(ped.x, ped.y, car.x, car.y) < 260) { ped.panic = 2.5; ped.fleeX = car.x; ped.fleeY = car.y; }
  }
  game.saveGame();
};
game.onCrash = (speed) => {
  game.crashCooldown = (game.crashCooldown || 0);
  if (speed > 260 && game.crashCooldown <= 0) {
    game.crashCooldown = 0.8;
    game.player.health -= 4; game.player.hurtFlash = 0.3;
    if (game.player.health <= 0) game.onPlayerDown();
  }
};
game.onRam = () => {
  game.player.health -= 2; game.player.hurtFlash = 0.25;
  if (game.player.health <= 0) game.onPlayerDown();
};
game.onPedHit = (ped) => {
  game.addToast('You hit a pedestrian! Wanted level up.');
  addWanted(game.police, 1, audio);
  for (const p2 of game.traffic.peds) {
    if (dist(p2.x, p2.y, ped.x, ped.y) < 300) { p2.panic = 3; p2.fleeX = ped.x; p2.fleeY = ped.y; }
  }
};
game.onBusted = () => {
  game.mode = 'busted';
  game.player.cash = Math.max(0, game.player.cash - 200);
  game.police.wanted = 0; game.police.units.length = 0;
  audio.setSiren(false);
};
game.onPlayerDown = () => {
  if (game.mode !== 'play') return;
  game.mode = 'down';
  game.police.wanted = 0; game.police.units.length = 0;
  audio.setSiren(false);
};
game.punchAt = (x, y, range, dmg, from) => {
  game.effects.push({ kind: 'spark', x, y, life: 0.25, max: 0.25 });
  const hitList = [...game.traffic.peds, ...game.missions.thugs];
  for (const t of hitList) {
    if (t.health <= 0) continue;
    if (dist(x, y, t.x, t.y) < range) {
      t.health -= dmg;
      if (t.kind === 'ped') { t.panic = 3; t.fleeX = game.player.x; t.fleeY = game.player.y; addWanted(game.police, 1, audio); }
      game.addToast(t.kind === 'thug' ? 'Thug down!' : 'You punched a pedestrian! Wanted up.');
    }
  }
  for (const u of game.police.units) {
    if (u.footX !== null && dist(x, y, u.footX, u.footY) < range) {
      addWanted(game.police, 1, audio);
      game.addToast('You hit an officer! Wanted up.');
    }
  }
};
game.shootAt = (x, y, angle, from) => {
  const tx = x + Math.cos(angle) * 900, ty = y + Math.sin(angle) * 900;
  game.effects.push({ kind: 'shot', x, y, angle, life: 0.12, max: 0.12 });
  let bestD = 900, best = null;
  const targets = [...game.traffic.peds, ...game.missions.thugs];
  for (const t of targets) {
    if (t.health <= 0) continue;
    const d = dist(x, y, t.x, t.y);
    if (d > 900) continue;
    const a = Math.atan2(t.y - y, t.x - x);
    let da = Math.abs(a - angle);
    if (da > Math.PI) da = Math.PI * 2 - da;
    if (da < 0.09 && d < bestD) { bestD = d; best = t; }
  }
  if (best) {
    best.health -= 34;
    game.effects.push({ kind: 'spark', x: best.x, y: best.y, life: 0.3, max: 0.3 });
    if (best.kind === 'ped') { addWanted(game.police, 1, audio); }
  }
  if (from === 'player' && game.police.wanted < 5 && Math.random() < 0.5) {
    // Firing a gun in the city draws attention.
    if (game.police.units.length > 0 || Math.random() < 0.4) addWanted(game.police, 1, audio);
  }
};

// ---- starting / continuing ----
function startGame(fresh) {
  audio.ensure();
  if (fresh) {
    buildWorld();
  } else {
    const s = loadGameState();
    if (s) {
      buildWorld();
      game.player.cash = s.cash || 0;
      game.player.x = s.x || 675; game.player.y = s.y || 760;
      game.player.health = s.health || 100;
      game.missions.index = Math.min(s.missionsDone || 0, game.missions.defs.length - 1);
      game.missions.totalCashEarned = s.totalEarned || 0;
      game.missions.completed = game.missions.index;
    }
  }
  game.mode = 'play';
  game.camera.x = game.player.x; game.camera.y = game.player.y;
  startMission(game.missions, game.city, game);
  statusEl.textContent = 'Playing Solmar Bay. Mission: ' + (currentMission(game.missions) || {}).title;
}

function respawn() {
  const cash = game.player.cash;
  const idx = game.missions.index;
  buildWorld();
  game.player.cash = cash;
  game.missions.index = idx;
  game.missions.completed = idx;
  game.player.x = game.city.places.hideout.x;
  game.player.y = game.city.places.hideout.y + 80;
  game.player.health = 100;
  game.mode = 'play';
  startMission(game.missions, game.city, game);
}

// ---- screenshot scenarios (?shot=...) ----
function applyShot(shot) {
  audio.ensure();
  if (shot === 'start') { game.mode = 'menu'; return; }
  startGame(true);
  const p = game.player;
  if (shot === 'drive') {
    const car = game.traffic.cars.find((c) => c.parked) || game.traffic.cars[0];
    p.inCar = car; car.playerDriven = true; car.parked = false;
    car.x = 2025; car.y = 2025; car.angle = 0; car.speed = 380;
    p.x = car.x; p.y = car.y;
    game.police.wanted = 2; game.police.heat = 1;
    game.missions.index = 1; startMission(game.missions, game.city, game);
    game.camera.x = p.x; game.camera.y = p.y;
  } else if (shot === 'foot') {
    p.x = 1575; p.y = 1575; p.angle = Math.PI / 4;
    game.traffic.peds.slice(0, 6).forEach((pd, i) => { pd.x = 1500 + i * 60; pd.y = 1500 + (i % 3) * 55; });
    game.missions.index = 1; startMission(game.missions, game.city, game);
    game.camera.x = p.x; game.camera.y = p.y;
  } else if (shot === 'chase') {
    const car = game.traffic.cars.find((c) => c.parked) || game.traffic.cars[0];
    p.inCar = car; car.playerDriven = true; car.parked = false;
    car.x = 1575; car.y = 1125; car.angle = Math.PI / 2; car.speed = 420;
    p.x = car.x; p.y = car.y;
    game.police.wanted = 4; game.police.heat = 1;
    game.missions.index = 3; startMission(game.missions, game.city, game);
    game.camera.x = p.x; game.camera.y = p.y;
  } else if (shot === 'mission') {
    p.x = 675; p.y = 3300; p.angle = -Math.PI / 2;
    game.missions.index = 2; startMission(game.missions, game.city, game);
    game.traffic.peds.slice(0, 4).forEach((pd, i) => { pd.x = 600 + i * 80; pd.y = 3220 + (i % 2) * 60; });
    game.police.wanted = 0; game.police.heat = 0;
    game.camera.x = p.x; game.camera.y = p.y;
    game.toasts = [];
  }
  game.toasts = [];
}

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 22);
  game.crashCooldown = Math.max(0, (game.crashCooldown || 0) - dt);
  game.bannerTimer = Math.max(0, game.bannerTimer - dt);
  game.toasts.forEach((t) => (t.life -= dt));
  game.toasts = game.toasts.filter((t) => t.life > 0);
  game.effects.forEach((e) => (e.life -= dt));
  game.effects = game.effects.filter((e) => e.life > 0);

  if (input.wasPressed('m')) game.muted = !game.muted;
  if (game.muted) audio.setSiren(false);

  if (game.mode === 'menu') {
    // Gentle camera drift over the city behind the title.
    game.camera.x = 1800 + Math.cos(game.time * 0.05) * 500;
    game.camera.y = 1800 + Math.sin(game.time * 0.04) * 400;
    game.camera.zoom = Math.min(canvas.width, canvas.height) < 700 ? 0.55 : 0.7;
    if (input.wasPressed('enter')) startGame(game.hasSaveData ? false : true);
    if (input.wasPressed('n')) startGame(true);
    if (input.wasPressed('arrowdown')) game.menuIndex = (game.menuIndex + 1) % 3;
    if (input.wasPressed('arrowup')) game.menuIndex = (game.menuIndex + 2) % 3;
  } else if (game.mode === 'play') {
    if (input.wasPressed('p') || input.wasPressed('escape')) { game.mode = 'paused'; game.saveGame(); }
    // Screenshot scenes keep the car rolling so the shot shows it moving.
    if (game.shotMode === 'drive' || game.shotMode === 'chase') input.keys['w'] = true;
    updatePlayer(game.player, input, dt, game.city, game.traffic, audio, game);
    updateTraffic(game.traffic, dt, game.city, game.player, game.police);
    updatePolice(game.police, dt, game.player, game.city, game.traffic, audio, game);
    updateMissions(game.missions, dt, game);
    // Camera follows the player, zooming out a little while driving fast.
    const targetZoom = game.player.inCar
      ? clamp(0.62 + Math.abs(game.player.inCar.speed) / 2400, 0.62, 0.85)
      : 0.95;
    const z = Math.min(canvas.width, canvas.height) < 700 ? targetZoom * 0.8 : targetZoom;
    game.camera.zoom += (z - game.camera.zoom) * Math.min(1, dt * 3);
    game.camera.x += (game.player.x - game.camera.x) * Math.min(1, dt * 5);
    game.camera.y += (game.player.y - game.camera.y) * Math.min(1, dt * 5);
    // Engine hum + police siren follow the action.
    audio.engine(game.player.inCar ? Math.abs(game.player.inCar.speed) / 560 : 0, !!game.player.inCar);
    if (game.player.health <= 0) game.onPlayerDown();
    // Passive health regen out of trouble.
    if (game.police.wanted === 0 && game.player.health < 100) game.player.health = Math.min(100, game.player.health + 2 * dt);
    if (game.time % 10 < dt) game.saveGame();
  } else if (game.mode === 'paused') {
    if (input.wasPressed('p') || input.wasPressed('escape') || input.wasPressed('enter')) game.mode = 'play';
  } else if (game.mode === 'busted' || game.mode === 'down') {
    if (input.wasPressed('enter')) respawn();
  }
  render(renderer, game, dt);
  input.endFrame();
  requestAnimationFrame(frame);
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(shot);
  // Keep the scene alive for the screenshot: run a few sim seconds.
  game.shotMode = shot;
} else {
  game.mode = 'menu';
}

// Test / automation hook: state the play-test script reads.
window.__game = game;
window.__solmar = {
  state: () => ({
    mode: game.mode,
    x: Math.round(game.player.x), y: Math.round(game.player.y),
    inCar: !!game.player.inCar, cash: game.player.cash,
    health: Math.round(game.player.health), wanted: game.police.wanted,
    mission: game.missions.index, missionDone: game.missions.done,
    policeUnits: game.police.units.length,
    cars: game.traffic.cars.length, peds: game.traffic.peds.length,
  }),
  start: () => startGame(true),
  teleport: (x, y) => {
    game.player.x = x; game.player.y = y;
    if (game.player.inCar) { game.player.inCar.x = x; game.player.inCar.y = y; game.player.inCar.speed = 0; }
    game.camera.x = x; game.camera.y = y;
  },
};

requestAnimationFrame(frame);
