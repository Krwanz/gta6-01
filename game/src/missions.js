// The story: Rico Vale, a Solmar Bay courier who owes $4,000 to loan shark
// Marina Kessler, works it off one job at a time. Five missions, each with
// an objective marker, HUD text and a cash payout.
import { dist } from './util.js';

const MISSION_DEFS = [
  {
    id: 'first-wheels', title: 'Mission 1 — First Wheels',
    brief: 'Marina wants her money. Start by getting wheels: steal any car (walk up, press E).',
    objective: 'Steal a car',
    kind: 'steal', pay: 150,
    hint: 'Parked cars line the streets. Walk up to one and press E.',
  },
  {
    id: 'courier-run', title: 'Mission 2 — Courier Run',
    brief: 'Dino at the garage has a package for the Marina Pier. Drive it there — fast, no cops.',
    objective: 'Drive the package to Marina Pier',
    kind: 'drive', target: 'marina', pay: 400,
    hint: 'Follow the yellow marker. Watch the minimap.',
  },
  {
    id: 'market-stash', title: 'Mission 3 — Market Stash',
    brief: 'A stash is hidden at Solmar Market, guarded by Kessler\'s thugs. Get in on foot and take it.',
    objective: 'Fight the thugs, grab the stash at Solmar Market',
    kind: 'fight', target: 'market', pay: 700, thugs: 3,
    hint: 'Space punches, click or Shift+Space shoots. Grab the glowing stash.',
  },
  {
    id: 'bank-job', title: 'Mission 4 — The Bay Trust Job',
    brief: 'The big one: lift the cash from Bay Trust Bank. It WILL bring the police. Escape to the hideout.',
    objective: 'Grab the cash at Bay Trust Bank, then lose the cops at the Hideout',
    kind: 'escape', target: 'bank', escapeTo: 'hideout', pay: 1500,
    hint: 'Grab the cash, then drive to the hideout and stay out of sight.',
  },
  {
    id: 'last-mile', title: 'Mission 5 — The Last Mile',
    brief: 'One last delivery to Solmar Airfield and the debt is done. Marina is waiting — don\'t keep her waiting.',
    objective: 'Deliver the case to Solmar Airfield',
    kind: 'drive', target: 'airport', pay: 1250,
    hint: 'Final run. Drive clean and the debt is paid.',
  },
];

export function createMissions(city) {
  return {
    defs: MISSION_DEFS, index: 0, stage: 'go', // go | grab | escape | done
    thugs: [], stashTaken: false, cashTaken: false,
    message: '', messageTimer: 0, completed: 0, totalCashEarned: 0,
    done: false, finalShown: false,
  };
}

export function currentMission(m) { return m.defs[m.index] || null; }

export function missionTarget(m, city) {
  const def = currentMission(m);
  if (!def) return null;
  if (def.kind === 'escape' && m.stage === 'escape') return city.places[def.escapeTo];
  if (def.target) return city.places[def.target];
  return null;
}

export function missionObjectiveText(m) {
  const def = currentMission(m);
  if (!def) return 'Debt paid. Solmar Bay is yours, Rico.';
  if (def.kind === 'steal') return 'Steal a car — walk up and press E';
  if (def.kind === 'fight' && m.stage === 'go') return 'Reach Solmar Market and deal with the thugs';
  if (def.kind === 'fight') return 'Grab the glowing stash!';
  if (def.kind === 'escape' && m.stage === 'escape') return 'ESCAPE! Reach the Hideout and lose the cops';
  if (def.kind === 'escape') return 'Grab the cash at Bay Trust Bank';
  if (def.kind === 'drive') return 'Drive to ' + (cityName(def.target));
  return def.objective;
}
function cityName(key) {
  return { marina: 'Marina Pier', airport: 'Solmar Airfield', market: 'Solmar Market', bank: 'Bay Trust Bank', hideout: 'the Hideout', garage: 'Dino\'s Garage', stadium: 'Sunbowl Stadium' }[key] || key;
}

export function startMission(m, city, game) {
  const def = currentMission(m);
  if (!def) return;
  m.stage = 'go'; m.stashTaken = false; m.cashTaken = false; m.thugs = [];
  if (def.kind === 'fight') {
    const t = city.places[def.target];
    for (let i = 0; i < def.thugs; i++) {
      m.thugs.push({
        kind: 'thug', x: t.x + (i - 1) * 70, y: t.y + 60 + (i % 2) * 50,
        angle: 0, speed: 95, health: 50, color: '#5b2a86', attackTimer: 0,
        walkPhase: Math.random() * 6,
      });
    }
  }
  game.setBanner(def.title, def.brief);
  game.addToast(def.title + ' — ' + def.objective);
}

export function completeMission(m, game) {
  const def = currentMission(m);
  if (!def) return;
  game.player.cash += def.pay;
  m.totalCashEarned += def.pay;
  m.completed += 1;
  game.audio.cash();
  game.setBanner('MISSION COMPLETE', def.title + ' — paid $' + def.pay);
  game.addToast('+$' + def.pay + ' — total earned $' + m.totalCashEarned);
  game.saveGame();
  m.index += 1;
  if (m.index >= m.defs.length) {
    m.done = true;
    game.setBanner('DEBT PAID!', 'Rico is free. Solmar Bay is yours — keep driving, the city never sleeps.');
  } else {
    startMission(m, game.city, game);
  }
}

export function updateMissions(m, dt, game) {
  const def = currentMission(m);
  if (!def) return;
  const p = game.player;
  const target = missionTarget(m, game.city);
  if (def.kind === 'steal') {
    if (p.inCar) completeMission(m, game);
    return;
  }
  if (def.kind === 'fight') {
    // Thugs chase Rico on foot and swing when close.
    for (const th of m.thugs) {
      if (th.health <= 0) continue;
      th.attackTimer -= dt;
      const d = dist(th.x, th.y, p.x, p.y);
      if (d < 420) {
        const a = Math.atan2(p.y - th.y, p.x - th.x);
        th.angle = a;
        if (d > 30) { th.x += Math.cos(a) * th.speed * dt; th.y += Math.sin(a) * th.speed * dt; }
        if (d < 34 && th.attackTimer <= 0) {
          th.attackTimer = 0.9;
          p.health -= 8; p.hurtFlash = 0.4;
          game.audio.punch(); game.addShake(3);
          if (p.health <= 0) game.onPlayerDown();
        }
      }
      th.walkPhase += dt * 8;
    }
    const alive = m.thugs.filter((t) => t.health > 0).length;
    if (alive === 0 && m.stage === 'go') {
      m.stage = 'grab';
      game.setBanner('THUGS DOWN', 'Grab the glowing stash!');
      game.addToast('Stash is unguarded — walk over it!');
    }
    if (m.stage === 'grab' && target && dist(p.x, p.y, target.x, target.y) < 60) {
      m.stashTaken = true;
      game.audio.pickup();
      completeMission(m, game);
    }
    return;
  }
  if (def.kind === 'escape') {
    if (m.stage === 'go' && target && dist(p.x, p.y, target.x, target.y) < 70) {
      m.stage = 'escape'; m.cashTaken = true;
      game.audio.pickup();
      game.police.wanted = Math.max(game.police.wanted, 3);
      game.police.heat = 1;
      game.setBanner('CASH GRABBED — RUN!', 'Three stars! Lose the cops at the Hideout.');
      game.addToast('The alarm is screaming. Drive to the Hideout!');
    } else if (m.stage === 'escape') {
      const hide = game.city.places[def.escapeTo];
      if (dist(p.x, p.y, hide.x, hide.y) < 90 && game.police.wanted === 0) {
        completeMission(m, game);
      }
    }
    return;
  }
  if (def.kind === 'drive') {
    if (target && dist(p.x, p.y, target.x, target.y) < 80) completeMission(m, game);
  }
}
