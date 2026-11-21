// Keyboard and mouse input for SOLMAR, chunk 2. Held keys are read every
// frame; one-shot presses (confirm, pause, enter a car, reload, weapon keys,
// taxi, mute, help, save, quit) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// The mouse is tracked in logical canvas coordinates with the renderer's
// letterbox math, so aiming works at any window size. Space is the handbrake
// only — confirm is Enter or a click, never Space.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_RELOAD = 8;
export const ACTION_WEAPON1 = 16;
export const ACTION_WEAPON2 = 32;
export const ACTION_WEAPON3 = 64;
export const ACTION_TAXI = 128;
export const ACTION_MUTE = 256;
export const ACTION_HELP = 512;
export const ACTION_SAVE = 1024;
export const ACTION_QUIT = 2048;

const VIEW_W = 1280;
const VIEW_H = 720;

function isUp(code) { return code === 'ArrowUp' || code === 'KeyW'; }
function isDown(code) { return code === 'ArrowDown' || code === 'KeyS'; }
function isLeft(code) { return code === 'ArrowLeft' || code === 'KeyA'; }
function isRight(code) { return code === 'ArrowRight' || code === 'KeyD'; }

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  const mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, clicked: false };

  // The canvas fills the window with the 1280x720 view letterboxed inside:
  // undo that scale and offset so the mouse lands on the same logical point
  // the renderer draws at.
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
    const ox = (rect.width - VIEW_W * scale) / 2;
    const oy = (rect.height - VIEW_H * scale) / 2;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  function queueFor(code) {
    if (code === 'Enter' || code === 'NumpadEnter') return ACTION_CONFIRM;
    if (code === 'KeyP' || code === 'Escape') return ACTION_PAUSE;
    if (code === 'KeyE' || code === 'KeyF') return ACTION_ENTER;
    if (code === 'KeyR') return ACTION_RELOAD;
    if (code === 'Digit1') return ACTION_WEAPON1;
    if (code === 'Digit2') return ACTION_WEAPON2;
    if (code === 'Digit3') return ACTION_WEAPON3;
    if (code === 'KeyT') return ACTION_TAXI;
    if (code === 'KeyM') return ACTION_MUTE;
    if (code === 'KeyH') return ACTION_HELP;
    if (code === 'KeyS') return ACTION_SAVE;
    if (code === 'KeyQ') return ACTION_QUIT;
    return 0;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    queued |= queueFor(event.code);
    // Keep the page from scrolling while the game owns these keys.
    if (isUp(event.code) || isDown(event.code) || isLeft(event.code)
      || isRight(event.code) || event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of all.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const p = toLogical(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const p = toLogical(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
    queued |= ACTION_CONFIRM;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    // Movement vector, -1..1 on each axis.
    move() {
      return {
        x: (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0)
          - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0),
        y: (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0)
          - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0),
      };
    },
    run() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    handbrake() {
      return held.has('Space');
    },
    mouse,
    // One-shot presses since the last call, as ACTION_* flags. Taking them
    // clears the queue, so each press is delivered exactly once.
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
    // True once for a mouse click since the last call.
    takeClick() {
      const was = mouse.clicked;
      mouse.clicked = false;
      return was;
    },
  };
}
