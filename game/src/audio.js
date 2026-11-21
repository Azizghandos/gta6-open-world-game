// Synthesised sound only: every effect is an oscillator or filtered noise built in
// code, so the game ships no audio files. Everything guards for a missing
// AudioContext, so the game runs silent instead of throwing on a browser that
// has none, and nothing starts until the player first interacts (create() is
// called from the start gesture).
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;

  /** Build the context. Call from a user gesture; safe to call twice. */
  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || !master) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), context.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur + 0.02);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  function noise(dur, vol, cutoff) {
    if (!context || !master) return;
    try {
      const len = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff || 900;
      const gain = context.createGain();
      gain.gain.value = vol || 0.25;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  return {
    ensure,
    /** A gunshot: a short noise crack, deeper for the SMG's chatter. */
    shot(weapon) {
      if (weapon === 'smg') noise(0.07, 0.18, 1400);
      else noise(0.12, 0.3, 900);
    },
    /** A fist thud. */
    thud() {
      tone(90, 0.1, 'sine', 0.3, 50);
    },
    /** A pickup chime: two rising notes. */
    pickup() {
      tone(660, 0.09, 'sine', 0.2);
      setTimeout(() => tone(990, 0.12, 'sine', 0.2), 70);
    },
    /** Cash register tick. */
    cash() {
      tone(880, 0.07, 'triangle', 0.18);
      setTimeout(() => tone(1320, 0.1, 'triangle', 0.15), 60);
    },
    /** A mission sting: a short three-note rise. */
    mission() {
      tone(523, 0.12, 'triangle', 0.22);
      setTimeout(() => tone(659, 0.12, 'triangle', 0.22), 110);
      setTimeout(() => tone(784, 0.22, 'triangle', 0.25), 220);
    },
    /** A low warning buzz for the wanted level rising. */
    siren() {
      tone(440, 0.25, 'square', 0.08, 620);
    },
    /** A UI click. */
    click() {
      tone(1200, 0.04, 'square', 0.08);
    },
    /** A crash: noise plus a low thump. */
    crash() {
      noise(0.25, 0.35, 500);
      tone(70, 0.25, 'sine', 0.3, 35);
    },
    /** Keep the engine hum in step with speed (0..1). Silent on foot. */
    engine(speed) {
      if (!context || !engineOsc || !engineGain) return;
      try {
        const target = speed > 0.02 ? 0.05 + speed * 0.06 : 0;
        engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(50 + speed * 130, context.currentTime, 0.1);
      } catch {
        // Sound is garnish; never let it break the game.
      }
    },
  };
}
