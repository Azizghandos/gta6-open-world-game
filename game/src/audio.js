// All sound is synthesised with WebAudio: no audio files ship with the game.
// The context is created lazily on the first user gesture (browsers block
// audio before that) and every call is a no-op until then, so headless
// screenshots and quiet browsers never break. M toggles mute; the setting is
// saved in localStorage. The music is a small step-sequenced groove in A
// minor: a bass line with a kick and hats, looping every 16 sixteenth-notes.

const MUTE_KEY = 'solmar.muted';
const MASTER_LEVEL = 0.5;
const MUSIC_LEVEL = 0.16;

// Bass line, one note per sixteenth step; 0 means rest. A minor groove.
const BASS_LINE = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
const STEP_MS = 134; // ~112 BPM sixteenths

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_LEVEL;
    musicBus.connect(master);
    // Engine hum: two detuned saws through a low-pass, pitch follows speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 58;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();
    // Police siren: a triangle wailing between two notes.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    startMusic();
    return true;
  }

  function ensure() {
    if (ctx) return true;
    try {
      return build();
    } catch {
      ctx = null;
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const step = musicStep % 16;
      musicStep += 1;
      const t = ctx.currentTime;
      const bass = BASS_LINE[step];
      if (bass > 0) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = bass;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
        osc.connect(g);
        g.connect(musicBus);
        osc.start(t);
        osc.stop(t + 0.24);
      }
      if (step % 4 === 0) {
        // Kick: a sine dropping from 120 Hz to 40 Hz.
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.7, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
        osc.connect(g);
        g.connect(musicBus);
        osc.start(t);
        osc.stop(t + 0.16);
      }
      if (step % 2 === 1) {
        // Hat: a short burst of high noise.
        const noise = noiseBurst(0.03, 6000, 0.12);
        noise.connect(musicBus);
      }
    }, STEP_MS);
  }

  function noiseBurst(duration, frequency, volume) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const g = ctx.createGain();
    g.gain.value = volume;
    source.connect(filter);
    filter.connect(g);
    g.connect(master);
    source.start();
    return source;
  }

  function tone(frequency, duration, type, volume, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + duration);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function jingle(notes, gap, duration, type, volume) {
    notes.forEach((n, i) => {
      window.setTimeout(() => tone(n, duration, type, volume), i * gap);
    });
  }

  return {
    // Call on any user gesture: creates (and resumes) the context.
    unlock() {
      resume();
    },
    setMuted(value) {
      muted = value;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Storage can be off.
      }
      if (master) master.gain.value = muted ? 0 : MASTER_LEVEL;
    },
    isMuted() {
      return muted;
    },
    // speed01: 0 stopped, 1 top speed. Call every frame while playing.
    engine(speed01, driving) {
      if (!ctx || muted) return;
      const target = driving ? 0.05 + speed01 * 0.11 : 0.02;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      const freq = 52 + speed01 * 130;
      engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(freq * 1.01, ctx.currentTime, 0.08);
    },
    // Call every frame; true while any wanted star is showing.
    siren(on) {
      if (!ctx) return;
      if (!on) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        return;
      }
      sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
      const now = ctx.currentTime;
      sirenOsc.frequency.cancelScheduledValues(now);
      sirenOsc.frequency.setValueAtTime(660, now);
      sirenOsc.frequency.linearRampToValueAtTime(880, now + 0.45);
      sirenOsc.frequency.linearRampToValueAtTime(660, now + 0.9);
    },
    shoot(weapon) {
      if (!ensure()) return;
      resume();
      noiseBurst(weapon === 'smg' ? 0.07 : 0.12, weapon === 'smg' ? 2400 : 1600, 0.5);
      tone(weapon === 'smg' ? 220 : 160, 0.08, 'square', 0.25, 60);
    },
    enemyShoot() {
      if (!ensure()) return;
      noiseBurst(0.1, 1400, 0.3);
    },
    explosion() {
      if (!ensure()) return;
      resume();
      noiseBurst(0.7, 500, 0.9);
      tone(90, 0.6, 'sine', 0.7, 30);
    },
    crash(strength) {
      if (!ensure()) return;
      noiseBurst(0.15, 900, Math.min(0.6, 0.2 + strength));
      tone(70, 0.15, 'square', 0.3, 40);
    },
    punch() {
      if (!ensure()) return;
      noiseBurst(0.06, 500, 0.4);
    },
    horn() {
      if (!ensure()) return;
      tone(370, 0.18, 'square', 0.2);
      tone(466, 0.18, 'square', 0.15);
    },
    blip() {
      if (!ensure()) return;
      tone(880, 0.09, 'sine', 0.35);
      window.setTimeout(() => tone(1320, 0.12, 'sine', 0.35), 90);
    },
    cash() {
      if (!ensure()) return;
      tone(1046, 0.08, 'sine', 0.3);
      window.setTimeout(() => tone(1318, 0.08, 'sine', 0.3), 80);
      window.setTimeout(() => tone(1568, 0.16, 'sine', 0.3), 160);
    },
    missionDone() {
      if (!ensure()) return;
      jingle([523, 659, 784, 1046], 130, 0.22, 'triangle', 0.35);
    },
    missionFail() {
      if (!ensure()) return;
      jingle([392, 330, 262], 160, 0.25, 'triangle', 0.3);
    },
  };
}
