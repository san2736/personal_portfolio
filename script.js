// ---------- Sound ----------
// Everything is synthesised with the Web Audio API, so there is no audio file to load.
// Browsers only allow sound after a click, so it stays off until the visitor turns it on.
const sound = (() => {
  let ctx = null;
  let enabled = false;
  try { enabled = localStorage.getItem('engineSound') === 'on'; } catch (e) {}

  const audio = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  // A short tone each time a column of lights comes on
  const beep = () => {
    if (!enabled) return;
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 760;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  };

  // Lights out: the engine revs up through two gear changes and fades down the straight
  const roar = () => {
    if (!enabled) return;
    const c = audio();
    if (!c) return;
    const t = c.currentTime;
    const dur = 2.8;

    // Soft clipping gives the engine its rasp
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(4 * x);
    }
    shaper.curve = curve;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.linearRampToValueAtTime(2600, t + 0.9);
    filter.frequency.linearRampToValueAtTime(1400, t + dur);

    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
    master.gain.setValueAtTime(0.16, t + 1.9);
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    shaper.connect(filter).connect(master).connect(c.destination);

    // Engine pitch: rev, upshift, rev, upshift, rev
    const rpm = (param, k) => {
      param.setValueAtTime(70 * k, t);
      param.exponentialRampToValueAtTime(190 * k, t + 0.85);
      param.exponentialRampToValueAtTime(130 * k, t + 0.95);
      param.exponentialRampToValueAtTime(205 * k, t + 1.75);
      param.exponentialRampToValueAtTime(150 * k, t + 1.85);
      param.exponentialRampToValueAtTime(215 * k, t + dur);
    };

    [1, 2.01, 0.5].forEach((k) => {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      rpm(osc.frequency, k);
      const g = c.createGain();
      g.gain.value = k === 1 ? 0.5 : 0.25;
      osc.connect(g).connect(shaper);
      osc.start(t);
      osc.stop(t + dur);
    });

    // A little tyre and air noise
    const noise = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = noise;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1200;
    const ng = c.createGain();
    ng.gain.value = 0.12;
    src.connect(band).connect(ng).connect(master);
    src.start(t);
  };

  return {
    get on() { return enabled; },
    set(value) {
      enabled = value;
      try { localStorage.setItem('engineSound', value ? 'on' : 'off'); } catch (e) {}
      if (value) audio();
    },
    beep,
    roar,
  };
})();

// ---------- Start lights ----------
function startLights() {
  const root = document.documentElement;
  const cols = Array.from(document.querySelectorAll('.gantry__col'));
  const replay = document.querySelector('[data-replay]');
  const soundBtn = document.querySelector('[data-sound]');
  const soundLabel = document.querySelector('[data-sound-label]');
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timers = [];

  const clear = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  };

  const lightsOut = () => {
    clear();
    cols.forEach((c) => c.classList.remove('is-on'));
    root.classList.remove('pre-start');
    root.classList.add('lights-out');
    sound.roar();
    try { sessionStorage.setItem('lightsOut', '1'); } catch (e) {}
  };

  const runStart = () => {
    clear();
    root.classList.remove('lights-out');
    root.classList.add('pre-start');
    cols.forEach((c) => c.classList.remove('is-on'));
    // One column per second in the real sport; a little quicker here.
    cols.forEach((c, i) => {
      timers.push(setTimeout(() => {
        c.classList.add('is-on');
        sound.beep();
      }, 450 + i * 600));
    });
    // Hold for a random moment, as the race director does, then go.
    const hold = 450 + cols.length * 600 + 300 + Math.random() * 900;
    timers.push(setTimeout(lightsOut, hold));
  };

  if (root.classList.contains('pre-start')) {
    runStart();
  } else {
    root.classList.add('lights-out');
  }

  // Let impatient visitors skip straight to the race (but not when they press the hero buttons).
  const skip = (event) => {
    if (!root.classList.contains('pre-start')) return;
    if (event.target.closest && event.target.closest('[data-replay], [data-sound]')) return;
    lightsOut();
  };
  window.addEventListener('keydown', skip);
  window.addEventListener('pointerdown', skip);

  const replayStart = () => {
    if (reduceMotion()) {
      sound.roar();
      return;
    }
    window.scrollTo({ top: 0 });
    runStart();
  };

  if (replay) replay.addEventListener('click', replayStart);

  const showSound = () => {
    if (!soundBtn) return;
    soundBtn.setAttribute('aria-pressed', String(sound.on));
    if (soundLabel) soundLabel.textContent = sound.on ? 'Engine sound on' : 'Engine sound off';
  };
  showSound();

  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      sound.set(!sound.on);
      showSound();
      // Turning sound on replays the start so you hear it straight away.
      if (sound.on) replayStart();
    });
  }
}

// ---------- Timing tower: highlight the current section ----------
function timingTower() {
  const rows = new Map(
    Array.from(document.querySelectorAll('[data-spy]')).map((a) => [a.dataset.spy, a])
  );
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        rows.forEach((a) => a.removeAttribute('aria-current'));
        const row = rows.get(entry.target.id);
        if (row) row.setAttribute('aria-current', 'true');
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  document.querySelectorAll('.session').forEach((s) => observer.observe(s));
}

startLights();
timingTower();
