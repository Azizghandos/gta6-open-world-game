// Keyboard + mouse input, turned into the control contract the world steps on:
// { moveX, moveY, fire, aimX, aimY, interact } plus one-frame edge flags for
// pause, start and weapon switching. Aim is a world coordinate, converted from
// the pointer through the camera the renderer returned on its last frame.
export function createInput(canvas, cameraFn) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  const edge = { interact: false, pause: false, start: false, weapon: null, clicked: false };

  function codeOf(event) {
    return event.code || '';
  }

  function onKeyDown(event) {
    const code = codeOf(event);
    if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Space') {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(code);
    if (code === 'KeyE') edge.interact = true;
    if (code === 'KeyP') edge.pause = true;
    if (code === 'Space' || code === 'Enter') edge.start = true;
    if (code === 'Digit1') edge.weapon = 'fists';
    if (code === 'Digit2') edge.weapon = 'pistol';
    if (code === 'Digit3') edge.weapon = 'smg';
  }

  function onKeyUp(event) {
    keys.delete(codeOf(event));
  }

  function onMouseMove(event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }

  function onMouseDown(event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.down = true;
    edge.clicked = true;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  /** Read this frame's control. Edge flags are true only on the frame they happened. */
  function poll() {
    let moveX = 0;
    let moveY = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) moveY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveY += 1;
    const len = Math.hypot(moveX, moveY);
    if (len > 0) {
      moveX /= len;
      moveY /= len;
    }
    const cam = cameraFn ? cameraFn() : null;
    const scale = cam && cam.scale ? cam.scale : 1;
    const aimX = cam ? cam.camX + mouse.x / scale : mouse.x;
    const aimY = cam ? cam.camY + mouse.y / scale : mouse.y;
    const control = {
      moveX,
      moveY,
      fire: mouse.down,
      aimX,
      aimY,
      interact: edge.interact,
      pause: edge.pause,
      start: edge.start || edge.clicked,
      weapon: edge.weapon,
    };
    edge.interact = false;
    edge.pause = false;
    edge.start = false;
    edge.weapon = null;
    edge.clicked = false;
    return control;
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  }

  return { poll, destroy };
}
