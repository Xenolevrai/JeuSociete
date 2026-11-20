/**
 * Petits sons synthétisés à la volée (WebAudio) : aucun fichier à charger.
 * Discrets par principe — ils accompagnent le jeu, ils ne le commentent pas.
 */
let ctx = null;
let muted = (() => {
  try {
    return localStorage.getItem('gabo:muted') === '1';
  } catch {
    return false;
  }
})();

export function isMuted() {
  return muted;
}
export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem('gabo:muted', value ? '1' : '0');
  } catch {}
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, start, duration, { type = 'sine', gain = 0.12 } = {}) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function swish() {
  const ac = audio();
  if (!ac) return;
  const length = Math.floor(ac.sampleRate * 0.12);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2500;
  const g = ac.createGain();
  g.gain.value = 0.25;
  src.buffer = buffer;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
}

const SOUNDS = {
  card: () => swish(),
  turn: () => {
    tone(660, 0, 0.18);
    tone(880, 0.12, 0.3);
  },
  snap: () => {
    swish();
    tone(523, 0, 0.12, { type: 'triangle' });
    tone(784, 0.08, 0.22, { type: 'triangle' });
  },
  wrong: () => {
    tone(180, 0, 0.25, { type: 'square', gain: 0.06 });
    tone(140, 0.12, 0.3, { type: 'square', gain: 0.06 });
  },
  gabo: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.35, { type: 'triangle', gain: 0.1 })),
  win: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.11, 0.5, { gain: 0.1 })),
  open: () => tone(990, 0, 0.12, { type: 'triangle', gain: 0.07 }),
};

export function play(name) {
  if (muted) return;
  try {
    SOUNDS[name]?.();
  } catch {}
}

/** Une petite vibration sur téléphone, quand c'est à soi. */
export function buzz(pattern = 60) {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
