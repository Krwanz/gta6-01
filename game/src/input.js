// Keyboard + mouse input, with edge-triggered "just pressed" keys.
export function createInput(canvas) {
  const keys = {};
  const pressed = {};
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const input = { keys, pressed, mouse };
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys[e.key.toLowerCase()] && !keys[e.key]) pressed[e.key.toLowerCase()] = true;
    keys[e.key.toLowerCase()] = true;
    keys[e.key] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.key] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => { mouse.down = true; mouse.clicked = true; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  input.isDown = (...names) => names.some((n) => keys[n]);
  input.wasPressed = (name) => !!pressed[name.toLowerCase()];
  input.endFrame = () => {
    for (const k in pressed) delete pressed[k];
    mouse.clicked = false;
  };
  input.clear = () => { for (const k in keys) delete keys[k]; };
  return input;
}
