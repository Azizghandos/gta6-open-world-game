// A small seeded random number generator (mulberry32): the same seed always builds the same
// city, so a screenshot scene is repeatable and the dossier's numbers never wobble.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max) from a `next()` stream. */
export function randomInt(next, min, max) {
  return min + Math.floor(next() * (max - min));
}

/** One item of `list`, picked by a `next()` stream. */
export function randomPick(next, list) {
  return list[Math.floor(next() * list.length)];
}

/** A point inside `rect`, inset by `margin`, from a `next()` stream. */
export function randomPoint(next, rect, margin) {
  return {
    x: rect.x + margin + next() * (rect.w - margin * 2),
    y: rect.y + margin + next() * (rect.h - margin * 2),
  };
}
