// Small math and random helpers shared by every Solmar Bay module.
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
export function pushCircleOutOfRect(p, r, rx, ry, rw, rh) {
  if (!circleHitsRect(p.x, p.y, r, rx, ry, rw, rh)) return;
  const left = p.x - (rx - r), right = (rx + rw + r) - p.x;
  const top = p.y - (ry - r), bottom = (ry + rh + r) - p.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) p.x = rx - r; else if (m === right) p.x = rx + rw + r;
  else if (m === top) p.y = ry - r; else p.y = ry + rh + r;
}
// Deterministic mulberry32 so the city layout is the same every load.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
