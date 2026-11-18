// All drawing: the city, cars, people, effects, HUD, minimap and menus.
// Canvas 2D, flat sun-soaked art direction, drawn fresh every frame.
import { clamp, dist, lerp } from './util.js';
import { WORLD, streetCentres, ROAD_W, PITCH } from './city.js';
import { missionTarget, currentMission, missionObjectiveText } from './missions.js';

const SKY = '#ffd98a';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function drawCarShape(ctx, x, y, angle, len, wid, color, police) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  ctx.fillStyle = color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 8); ctx.fill();
  ctx.fillStyle = police ? '#e8e8e8' : 'rgba(255,255,255,0.85)';
  roundRect(ctx, -len / 2 + 8, -wid / 2 + 4, len * 0.42, wid - 8, 4); ctx.fill();
  ctx.fillStyle = '#222831';
  roundRect(ctx, len * 0.08, -wid / 2 + 5, len * 0.3, wid - 10, 4); ctx.fill();
  // headlights + taillights
  ctx.fillStyle = '#ffe9a3'; ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 6); ctx.fillRect(len / 2 - 3, wid / 2 - 9, 3, 6);
  ctx.fillStyle = '#ff4d4d'; ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 6); ctx.fillRect(-len / 2, wid / 2 - 9, 3, 6);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, angle, color, phase, scale) {
  const s = scale || 1;
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(phase) * 1.5 * s;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 8 * s, 9 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, bob - 2 * s, 7 * s, 0, Math.PI * 2); ctx.fill(); // head
  ctx.fillStyle = '#2b2b33';
  ctx.beginPath(); ctx.arc(0, bob - 6 * s, 7.5 * s, Math.PI, 0); ctx.fill(); // hair
  ctx.fillStyle = color;
  roundRect(ctx, -6 * s, 4 * s + bob * 0.3, 12 * s, 14 * s, 4); ctx.fill(); // body
  ctx.fillStyle = '#222';
  ctx.fillRect(-5 * s, 17 * s, 4 * s, 6 * s); ctx.fillRect(1 * s, 17 * s, 4 * s, 6 * s);
  ctx.restore();
}

export function render(r, game, dt) {
  const { ctx, canvas } = r;
  const W = canvas.width, H = canvas.height;
  const cam = game.camera;
  ctx.fillStyle = '#2e4a2f';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  const scale = cam.zoom;
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-cam.x, -cam.y);
  drawCity(ctx, game);
  drawMarkers(ctx, game);
  drawTraffic(ctx, game);
  drawPolice(ctx, game);
  drawThugs(ctx, game);
  drawPlayer(ctx, game);
  drawEffects(ctx, game);
  ctx.restore();
  drawHud(ctx, game, W, H);
  if (game.mode === 'menu') drawMenu(ctx, game, W, H);
  if (game.mode === 'busted' || game.mode === 'down') drawEndScreen(ctx, game, W, H);
  if (game.mode === 'paused') drawPaused(ctx, game, W, H);
}

function drawCity(ctx, game) {
  const city = game.city;
  // Ground: warm sand with a beach strip on the south-east edge.
  ctx.fillStyle = '#d9b380'; ctx.fillRect(0, 0, WORLD, WORLD);
  ctx.fillStyle = '#7fc4d6';
  ctx.fillRect(WORLD - 260, 0, 260, WORLD); // the bay on the east
  ctx.fillStyle = '#f2d8a0';
  ctx.fillRect(WORLD - 300, 0, 40, WORLD); // beach sand
  // Parks
  for (const pk of city.parks) {
    ctx.fillStyle = '#6fae5e'; ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#5a9a4c';
    for (let i = 0; i < pk.trees; i++) {
      const tx = pk.x + 20 + ((i * 53) % (pk.w - 40));
      const ty = pk.y + 20 + ((i * 97) % (pk.h - 40));
      ctx.beginPath(); ctx.arc(tx, ty, 14, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#8ec8e8';
    ctx.beginPath(); ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, 26, 0, Math.PI * 2); ctx.fill();
  }
  // Roads
  const centres = streetCentres();
  ctx.fillStyle = '#3a3f4a';
  for (const s of centres) {
    ctx.fillRect(0, s - ROAD_W / 2, WORLD, ROAD_W);
    ctx.fillRect(s - ROAD_W / 2, 0, ROAD_W, WORLD);
  }
  // Lane dashes
  ctx.fillStyle = '#f5d76e';
  for (const s of centres) {
    for (let d = 0; d < WORLD; d += 64) {
      ctx.fillRect(d, s - 2, 30, 4);
      ctx.fillRect(s - 2, d, 4, 30);
    }
  }
  // Sidewalk edges
  ctx.strokeStyle = '#c9b18a'; ctx.lineWidth = 4;
  for (const s of centres) {
    ctx.strokeRect(s - ROAD_W / 2 - 4, 0, 8, WORLD);
    ctx.strokeRect(0, s - ROAD_W / 2 - 4, WORLD, 8);
  }
  // Buildings with fake 3D tops
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const cols = b.windows;
    for (let i = 0; i < cols; i++) {
      ctx.fillRect(b.x + 14 + i * ((b.w - 28) / cols), b.y + 12, 8, 8);
      ctx.fillRect(b.x + 14 + i * ((b.w - 28) / cols), b.y + b.h - 22, 8, 8);
    }
  }
  // Named places: signs on the ground.
  ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
  for (const key in city.places) {
    const pl = city.places[key];
    ctx.fillStyle = 'rgba(20,30,40,0.75)';
    roundRect(ctx, pl.x - 90, pl.y - 52, 180, 26, 6); ctx.fill();
    ctx.fillStyle = '#ffe9a3';
    ctx.fillText(pl.name.toUpperCase(), pl.x, pl.y - 33);
  }
  // Palm trees dotted along the bay.
  ctx.fillStyle = '#3f7d3a';
  for (let i = 0; i < 14; i++) {
    const ty = 120 + i * 250;
    ctx.beginPath(); ctx.arc(WORLD - 285, ty, 12, 0, Math.PI * 2); ctx.fill();
  }
}

function drawMarkers(ctx, game) {
  const target = missionTarget(game.missions, game.city);
  if (!target || game.mode !== 'play') return;
  const pulse = 1 + Math.sin(game.time * 4) * 0.12;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,214,10,0.25)';
  ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2); ctx.fill();
  // Downward beacon arrow
  ctx.fillStyle = '#ffd60a';
  ctx.beginPath();
  ctx.moveTo(0, -78 - Math.sin(game.time * 4) * 8);
  ctx.lineTo(-14, -52 - Math.sin(game.time * 4) * 8);
  ctx.lineTo(14, -52 - Math.sin(game.time * 4) * 8);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // Edge arrow pointing to an off-screen target.
  const p = game.player;
  const d = dist(p.x, p.y, target.x, target.y);
  if (d > 700) {
    const a = Math.atan2(target.y - p.y, target.x - p.x);
    const ax = p.x + Math.cos(a) * 260, ay = p.y + Math.sin(a) * 260;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, -13); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Stash / cash glow for grab stages.
  const m = game.missions;
  if ((m.defs[m.index] || {}).kind === 'fight' && m.stage === 'grab') {
    ctx.save(); ctx.translate(target.x, target.y + 40);
    ctx.fillStyle = '#39ff88';
    ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(game.time * 5) * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#083';
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', 0, 6);
    ctx.restore();
  }
  if ((m.defs[m.index] || {}).kind === 'escape' && m.stage === 'go') {
    ctx.save(); ctx.translate(target.x, target.y + 40);
    ctx.fillStyle = '#39ff88';
    ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(game.time * 5) * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#083';
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', 0, 6);
    ctx.restore();
  }
}

function drawTraffic(ctx, game) {
  for (const car of game.traffic.cars) {
    if (car.playerDriven) continue;
    drawCarShape(ctx, car.x, car.y, car.angle, car.len, car.wid, car.color, false);
    if (car.parked) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('E — STEAL', car.x, car.y - 34);
    }
  }
  for (const ped of game.traffic.peds) {
    if (ped.health <= 0) {
      // Downed pedestrian: lying flat, X eyes.
      ctx.save(); ctx.translate(ped.x, ped.y);
      ctx.fillStyle = ped.color;
      roundRect(ctx, -12, -5, 24, 10, 4); ctx.fill();
      ctx.restore();
      continue;
    }
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.walkPhase, 1);
  }
}

function drawPolice(ctx, game) {
  for (const u of game.police.units) {
    drawCarShape(ctx, u.x, u.y, u.angle, u.len, u.wid, u.color, true);
    // Flashing light bar.
    const on = Math.sin(game.time * 10 + u.lightPhase) > 0;
    ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
    ctx.beginPath(); ctx.arc(u.x - Math.cos(u.angle) * 6, u.y - Math.sin(u.angle) * 6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', u.x, u.y + 26);
    if (u.footX !== null && u.footY !== null && dist(u.x, u.y, game.player.x, game.player.y) < 200) {
      drawPerson(ctx, u.footX, u.footY, Math.atan2(game.player.y - u.footY, game.player.x - u.footX), '#1c2733', game.time * 8, 1.1);
    }
  }
}

function drawThugs(ctx, game) {
  for (const th of game.missions.thugs) {
    if (th.health <= 0) continue;
    drawPerson(ctx, th.x, th.y, th.angle, th.color, th.walkPhase, 1.25);
    // Health bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(th.x - 18, th.y - 30, 36, 6);
    ctx.fillStyle = '#ff3b30'; ctx.fillRect(th.x - 18, th.y - 30, 36 * (th.health / 50), 6);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('THUG', th.x, th.y - 36);
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.inCar) {
    drawCarShape(ctx, p.inCar.x, p.inCar.y, p.inCar.angle, p.inCar.len, p.inCar.wid, p.inCar.color, false);
    // Player marker ring.
    ctx.strokeStyle = '#39ff88'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.inCar.x, p.inCar.y, 40, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('YOU — ' + p.inCar.name.toUpperCase(), p.inCar.x, p.inCar.y - 40);
  } else {
    if (p.hurtFlash > 0) { ctx.globalAlpha = 0.6 + Math.sin(game.time * 30) * 0.3; }
    drawPerson(ctx, p.x, p.y, p.angle, '#e8b23a', p.walkPhase, 1.15);
    ctx.globalAlpha = 1;
    if (p.punchTimer > 0) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 34, p.y + Math.sin(p.angle) * 34, 14, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('RICO', p.x, p.y - 30);
  }
}

function drawEffects(ctx, game) {
  // Bullets and punch sparks.
  for (const e of game.effects) {
    if (e.kind === 'shot') {
      ctx.strokeStyle = '#ffe45e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - Math.cos(e.angle) * 26, e.y - Math.sin(e.angle) * 26); ctx.stroke();
    } else if (e.kind === 'spark') {
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath(); ctx.arc(e.x, e.y, 6 * (e.life / e.max), 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'smoke') {
      ctx.fillStyle = 'rgba(120,120,120,' + (0.5 * e.life / e.max) + ')';
      ctx.beginPath(); ctx.arc(e.x, e.y, 10 + (1 - e.life / e.max) * 18, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Hurt vignette.
  if (game.player.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(255,0,0,' + (game.player.hurtFlash * 0.4) + ')';
    ctx.fillRect(game.camera.x - 800, game.camera.y - 600, 1600, 1200);
  }
}

function drawHud(ctx, game, W, H) {
  if (game.mode === 'menu') return;
  const p = game.player, pol = game.police, m = game.missions;
  ctx.textAlign = 'left';
  // Top-left panel: stars, cash, health.
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  roundRect(ctx, 12, 12, 300, 108, 10); ctx.fill();
  ctx.font = 'bold 26px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < pol.wanted ? '★' : '☆';
  ctx.fillStyle = pol.wanted > 0 ? '#ffb02e' : '#cfe3ff';
  ctx.fillText(stars, 24, 44);
  ctx.fillStyle = '#39ff88'; ctx.font = 'bold 22px sans-serif';
  ctx.fillText('$' + p.cash.toLocaleString('en-US'), 24, 74);
  ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
  ctx.fillText('RICO VALE  •  MISSION ' + Math.min(m.index + 1, m.defs.length) + '/' + m.defs.length, 24, 98);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(24, 106, 180, 8);
  ctx.fillStyle = p.health > 40 ? '#39ff88' : '#ff3b30';
  ctx.fillRect(24, 106, 180 * clamp(p.health / 100, 0, 1), 8);
  // Mission objective bar (bottom centre).
  const obj = missionObjectiveText(m);
  ctx.font = 'bold 18px sans-serif';
  const ow = ctx.measureText(obj).width + 120;
  ctx.fillStyle = 'rgba(10,16,24,0.78)';
  roundRect(ctx, (W - ow) / 2, H - 64, ow, 46, 10); ctx.fill();
  ctx.fillStyle = '#ffd60a';
  ctx.fillText('◉  ' + obj, (W - ow) / 2 + 20, H - 35);
  // Speed + car state (bottom right).
  if (p.inCar) {
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    roundRect(ctx, W - 190, H - 64, 178, 46, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.18) + ' km/h', W - 176, H - 35);
  } else {
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    roundRect(ctx, W - 250, H - 64, 238, 46, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
    ctx.fillText('ON FOOT • E near a car to steal • Ammo ' + p.ammo, W - 236, H - 35);
  }
  // Banner (mission title).
  if (game.bannerTimer > 0) {
    const a = clamp(game.bannerTimer, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,16,24,0.8)';
    roundRect(ctx, W / 2 - 330, 90, 660, 84, 12); ctx.fill();
    ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(game.bannerTitle, W / 2, 126);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
    wrapText(ctx, game.bannerText, W / 2, 152, 620, 20);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  // Toasts (top centre, under banner).
  ctx.font = '15px sans-serif'; ctx.textAlign = 'left';
  game.toasts.forEach((t, i) => {
    ctx.fillStyle = 'rgba(10,16,24,0.7)';
    const tw = ctx.measureText(t.text).width + 24;
    roundRect(ctx, (W - tw) / 2, 190 + i * 30, tw, 24, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, (W - tw) / 2 + 12, 190 + i * 30 + 17);
  });
  drawMinimap(ctx, game, W, H);
  // Controls hint (top right, under minimap).
  ctx.fillStyle = 'rgba(10,16,24,0.6)';
  roundRect(ctx, W - 216, 200, 204, 92, 8); ctx.fill();
  ctx.fillStyle = '#dfe8ff'; ctx.font = '13px sans-serif';
  ctx.fillText('WASD drive / walk', W - 204, 220);
  ctx.fillText('E enter / steal car', W - 204, 240);
  ctx.fillText('Space punch • Click shoot', W - 204, 260);
  ctx.fillText('P pause • M mute', W - 204, 280);
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW) { lines.push(line); line = ''; }
    line += w + ' ';
  }
  lines.push(line);
  lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln.trim(), cx, y + i * lh));
}

function drawMinimap(ctx, game, W, H) {
  const size = 176, pad = 12;
  const x0 = W - size - pad, y0 = pad;
  const s = size / WORLD;
  ctx.fillStyle = 'rgba(10,16,24,0.78)';
  roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, size, size); ctx.clip();
  ctx.fillStyle = '#b99a6b'; ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#7fc4d6'; ctx.fillRect(x0 + size - 14, y0, 14, size);
  ctx.fillStyle = '#3a3f4a';
  for (const c of streetCentres()) {
    ctx.fillRect(x0, y0 + c * s - 2, size, 4);
    ctx.fillRect(x0 + c * s - 2, y0, 4, size);
  }
  ctx.fillStyle = '#6fae5e';
  for (const pk of game.city.parks) ctx.fillRect(x0 + pk.x * s, y0 + pk.y * s, pk.w * s, pk.h * s);
  const target = missionTarget(game.missions, game.city);
  if (target) {
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.arc(x0 + target.x * s, y0 + target.y * s, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x0 + target.x * s, y0 + target.y * s, 6, 0, Math.PI * 2); ctx.stroke();
  }
  for (const car of game.traffic.cars) {
    if (car.playerDriven) continue;
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(x0 + car.x * s - 1.5, y0 + car.y * s - 1.5, 3, 3);
  }
  for (const u of game.police.units) {
    ctx.fillStyle = '#2f7bff';
    ctx.beginPath(); ctx.arc(x0 + u.x * s, y0 + u.y * s, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = game.player;
  ctx.save();
  ctx.translate(x0 + p.x * s, y0 + p.y * s); ctx.rotate(p.angle);
  ctx.fillStyle = '#39ff88';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', x0 + 2, y0 + size + 2);
}

function drawMenu(ctx, game, W, H) {
  ctx.fillStyle = 'rgba(8,12,20,0.55)';
  ctx.fillRect(0, 0, W, H);
  // Sun-soaked title card.
  ctx.fillStyle = '#ff9d2e';
  roundRect(ctx, W / 2 - 340, 90, 680, 150, 16); ctx.fill();
  ctx.fillStyle = '#1c2733';
  ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SOLMAR BAY', W / 2, 152);
  ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#5b2a86';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', W / 2, 190);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText('Rico Vale owes $4,000 to loan shark Marina Kessler.', W / 2, 268);
  ctx.fillText('Steal cars. Outrun the police. Work off the debt — one job at a time.', W / 2, 296);
  const has = game.hasSaveData;
  const items = has
    ? ['▶  CONTINUE  (Enter)', '↻  NEW GAME  (N)', 'HOW TO PLAY  (H)']
    : ['▶  START GAME  (Enter)', 'HOW TO PLAY  (H)'];
  ctx.font = 'bold 24px sans-serif';
  items.forEach((it, i) => {
    const y = 360 + i * 48;
    ctx.fillStyle = i === game.menuIndex ? '#ffd60a' : '#ffffff';
    ctx.fillText(it, W / 2, y);
  });
  ctx.fillStyle = '#dfe8ff'; ctx.font = '16px sans-serif';
  ctx.fillText('WASD move / drive  •  E steal & enter cars  •  Space punch  •  Click shoot', W / 2, 560);
  ctx.fillText('Missions pay cash. Crimes raise your wanted stars. Lose the cops to cool off.', W / 2, 588);
  ctx.fillText('Progress saves automatically. An original game — no real city, no real gangsters.', W / 2, 616);
  ctx.textAlign = 'left';
}

function drawPaused(ctx, game, W, H) {
  ctx.fillStyle = 'rgba(8,12,20,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press P to resume — your progress is saved.', W / 2, H / 2 + 30);
  ctx.textAlign = 'left';
}

function drawEndScreen(ctx, game, W, H) {
  ctx.fillStyle = 'rgba(8,12,20,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff3b30'; ctx.font = 'bold 52px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(game.mode === 'busted' ? 'BUSTED!' : 'RICO IS DOWN!', W / 2, H / 2 - 30);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText(game.mode === 'busted'
    ? 'The Solmar Bay police took you in. You lose $200 bail — the debt remains.'
    : 'The streets of Solmar Bay are unforgiving. You wake up at the hideout.', W / 2, H / 2 + 10);
  ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press Enter to get back out there', W / 2, H / 2 + 60);
  ctx.textAlign = 'left';
}
