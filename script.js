// ---------- Start lights and engine sound ----------
// The sound is one audio file (sounds/start.mp3): the grid holding revs, then the launch.
// These timings match the file exactly, so lights out lands on the launch.
const LIGHT_TIMES = [0.45, 1.05, 1.65, 2.25, 2.85]; // seconds
const LIGHTS_OUT = 3.9; // seconds

function startLights() {
  const root = document.documentElement;
  const cols = Array.from(document.querySelectorAll('.gantry__col'));
  const audio = document.querySelector('[data-start-audio]');
  const replay = document.querySelector('[data-replay]');
  const soundBtn = document.querySelector('[data-sound]');
  const soundLabel = document.querySelector('[data-sound-label]');
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sound is on unless the visitor has chosen otherwise.
  let soundOn = true;
  try { soundOn = localStorage.getItem('engineSound') !== 'off'; } catch (e) {}

  let timers = [];
  let run = 0; // bumps on every start and every lights out, so late callbacks from an old start are ignored
  const clear = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  };

  const stopAudio = () => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  };

  const showSound = () => {
    if (!soundBtn) return;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundLabel) soundLabel.textContent = soundOn ? 'Engine sound on' : 'Engine sound off';
  };

  const setSound = (value) => {
    soundOn = value;
    try { localStorage.setItem('engineSound', value ? 'on' : 'off'); } catch (e) {}
    if (!value) stopAudio();
    showSound();
  };

  const lightsOut = () => {
    run++;
    clear();
    cols.forEach((c) => c.classList.remove('is-on'));
    root.classList.remove('pre-start', 'awaiting');
    root.classList.add('lights-out');
    try { sessionStorage.setItem('lightsOut', '1'); } catch (e) {}
  };

  // Light the columns on the given schedule, then go.
  const runLights = (outAt) => {
    clear();
    root.classList.remove('lights-out', 'awaiting');
    root.classList.add('pre-start');
    cols.forEach((c) => c.classList.remove('is-on'));
    LIGHT_TIMES.forEach((s, i) => {
      timers.push(setTimeout(() => cols[i] && cols[i].classList.add('is-on'), s * 1000));
    });
    timers.push(setTimeout(lightsOut, outAt * 1000));
  };

  // Must be called from a click or tap, which is what lets browsers play the sound.
  const startRace = () => {
    if (reduceMotion()) {
      lightsOut();
      if (soundOn && audio) {
        audio.currentTime = LIGHTS_OUT;
        audio.play().catch(() => {});
      }
      return;
    }
    window.scrollTo({ top: 0 });

    const thisRun = ++run;
    if (soundOn && audio) {
      stopAudio();
      const playing = audio.play();
      if (playing && playing.then) {
        // Start the lights when the audio actually starts, so they line up.
        let started = false;
        const begin = (hold) => {
          if (started || thisRun !== run) return;
          started = true;
          runLights(hold || LIGHTS_OUT);
        };
        playing.then(() => begin()).catch(() => begin(silentHold()));
        // If the audio is slow to load, don't leave the visitor waiting.
        setTimeout(() => begin(), 1200);
      } else {
        runLights(LIGHTS_OUT);
      }
    } else {
      runLights(silentHold());
    }
  };

  // Without sound the hold is random, as the race director's is.
  const silentHold = () => LIGHT_TIMES[LIGHT_TIMES.length - 1] + 0.6 + Math.random() * 0.9;

  // First visit in this session: wait for the visitor to start the race.
  if (!root.classList.contains('pre-start')) {
    root.classList.add('lights-out');
  }

  document.querySelectorAll('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.start === 'quiet') setSound(false);
      else setSound(true);
      startRace();
    });
  });

  // Skip: a tap anywhere else during the start jumps straight to lights out.
  const skip = (event) => {
    if (!root.classList.contains('pre-start')) return;
    const t = event.target;
    if (t.closest && t.closest('[data-start], [data-replay], [data-sound]')) return;
    if (root.classList.contains('awaiting')) {
      lightsOut();
      return;
    }
    if (soundOn && audio && !audio.paused && audio.currentTime < LIGHTS_OUT) {
      audio.currentTime = LIGHTS_OUT;
    }
    lightsOut();
  };
  window.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' || event.key === 'Shift') return;
    skip(event);
  });

  if (replay) replay.addEventListener('click', startRace);

  showSound();
  if (soundBtn) {
    // Only switches the sound on or off for the next start; "Watch the start again" replays it.
    soundBtn.addEventListener('click', () => setSound(!soundOn));
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

// ---------- Race-track scroll bar ----------
// The car follows the circuit drawn in the SVG: scroll progress becomes distance along the track,
// and the car is rotated to the direction of the track at that point, so it steers through the corners.
function raceTrack() {
  const track = document.querySelector('[data-track]');
  const car = document.querySelector('[data-car]');
  const path = document.querySelector('[data-path]');
  if (!track || !car || !path) return;
  const doc = document.documentElement;
  const VIEW_W = 60;
  const VIEW_H = 1000;
  const total = path.getTotalLength();

  // Sample the circuit once, so scrolling never has to measure the path again
  const SAMPLES = 500;
  const pts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = path.getPointAtLength((i / SAMPLES) * total);
    pts.push({ x: p.x, y: p.y });
  }
  // Round off the tightest corners, so the two sides of the loop never pinch into a point
  const SMOOTH = 30;
  const smoothX = pts.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i - SMOOTH; j <= i + SMOOTH; j++) {
      const q = pts[Math.min(SAMPLES, Math.max(0, j))];
      sum += q.x;
      n++;
    }
    return sum / n;
  });
  pts.forEach((p, i) => { p.x = smoothX[i]; });

  // Redraw the circuit at the track's real pixel size, so kerb stripes and corners keep their shape.
  // The circuit is a closed loop: two thin carriageways either side of the winding centre line,
  // joined by a hairpin at each end. The car drives down the left side and back up the right.
  const map = document.querySelector('[data-map]');
  const startLine = map.querySelector('[data-start-line]');
  // --sway narrows the corners and --lane is half the gap between the two sides (both in styles.css)
  const CENTRE = VIEW_W / 2;
  const cssNum = (name, fallback) => parseFloat(getComputedStyle(track).getPropertyValue(name)) || fallback;
  const swayX = (x, k) => CENTRE + (x - CENTRE) * k;
  const fmt = (p) => p.x.toFixed(2) + ' ' + p.y.toFixed(2);
  // How far the corners can swing at this size: as much as --sway allows, but never so sharp that
  // the inside of a bend pinches, and never wider than the track's box. Worked out once per size.
  const fitSway = (w, h, kMax, lane, kerb) => {
    const sx = w / VIEW_W;
    const sy = h / VIEW_H;
    const needR = lane + kerb / 2 + 10;
    const room = w / 2 - lane - kerb / 2;
    const ok = (k) => {
      let maxCurv = 0;
      let dev = 0;
      for (let i = 1; i < SAMPLES; i++) {
        const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
        const x0 = (p0.x - CENTRE) * k * sx, x1 = (p1.x - CENTRE) * k * sx, x2 = (p2.x - CENTRE) * k * sx;
        const y0 = p0.y * sy, y1 = p1.y * sy, y2 = p2.y * sy;
        const dx = (x2 - x0) / 2, dy = (y2 - y0) / 2;
        const ddx = x2 - 2 * x1 + x0, ddy = y2 - 2 * y1 + y0;
        const c = Math.abs(dx * ddy - dy * ddx) / Math.pow(dx * dx + dy * dy, 1.5);
        if (c > maxCurv) maxCurv = c;
        if (Math.abs(x1) > dev) dev = Math.abs(x1);
      }
      return dev <= room && (maxCurv === 0 || 1 / maxCurv >= needR);
    };
    if (ok(kMax)) return kMax;
    let lo = 0, hi = kMax;
    for (let n = 0; n < 14; n++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid; else hi = mid;
    }
    return lo;
  };

  let drawnFor = '';
  let fitK = 1;
  const draw = (w, h, kMax) => {
    const lane = cssNum('--lane', 10);
    const road = cssNum('--asphalt-w', 10);
    const kerb = cssNum('--kerb-w', road);
    const key = [w, h, kMax, lane, road, kerb].join('x');
    if (key === drawnFor) return fitK;
    drawnFor = key;
    const k = (fitK = fitSway(w, h, kMax, lane, kerb));
    const sx = w / VIEW_W;
    const sy = h / VIEW_H;
    map.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const centre = pts.map((p) => ({ x: swayX(p.x, k) * sx, y: p.y * sy }));
    const left = [];
    const right = [];
    for (let i = 0; i <= SAMPLES; i += 2) {
      const a = centre[Math.max(0, i - 2)];
      const b = centre[Math.min(SAMPLES, i + 2)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      // Unit normal pointing to the right of the screen while the line runs downwards
      const nx = (b.y - a.y) / len;
      const ny = -(b.x - a.x) / len;
      const c = centre[i];
      left.push({ x: c.x - nx * lane, y: c.y - ny * lane });
      right.push({ x: c.x + nx * lane, y: c.y + ny * lane });
    }
    const arc = `A ${lane} ${lane} 0 0 0 `;
    const loop =
      'M ' + left.map(fmt).join(' L ') +
      ' ' + arc + fmt(right[right.length - 1]) +
      ' L ' + right.slice().reverse().map(fmt).join(' L ') +
      ' ' + arc + fmt(left[0]) + ' Z';
    map.querySelectorAll('[data-draw]').forEach((el) => el.setAttribute('d', loop));
    if (startLine) {
      const s0 = left[8];
      startLine.setAttribute('x', (s0.x - road / 2).toFixed(2));
      startLine.setAttribute('y', s0.y.toFixed(2));
      startLine.setAttribute('width', road.toFixed(2));
      startLine.setAttribute('height', '6');
    }
    return k;
  };

  let last = window.scrollY;
  let queued = false;
  const maxScroll = () => Math.max(0, doc.scrollHeight - window.innerHeight);

  const place = () => {
    queued = false;
    const w = track.clientWidth;
    const h = track.clientHeight;
    const sx = w / VIEW_W;
    const sy = h / VIEW_H;
    const k = draw(w, h, cssNum('--sway', 1));
    const max = maxScroll();
    const progress = max ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const i = Math.round(progress * SAMPLES);
    const a = pts[Math.max(0, i - 3)];
    const b = pts[Math.min(SAMPLES, i + 3)];
    const here = pts[i];
    // Direction of travel in screen pixels. The car is drawn nose-up (-90 degrees), so add 90 to point it along the track
    const angle = (Math.atan2((b.y - a.y) * sy, (b.x - a.x) * k * sx) * 180) / Math.PI + 90;
    car.style.transform = `translate(${swayX(here.x, k) * sx}px, ${here.y * sy}px) rotate(${angle}deg)`;
    const y = window.scrollY;
    if (y > last + 1) track.dataset.dir = 'down';
    else if (y < last - 1) track.dataset.dir = 'up';
    last = y;
  };
  const queue = () => {
    if (!queued) { queued = true; requestAnimationFrame(place); }
  };

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  track.dataset.dir = 'down';
  place();

  // Drag the car, or click on the track, to scroll like a normal scroll bar.
  // The circuit only ever runs downwards, so the nearest sample by height gives the progress.
  const scrollToPointer = (clientY) => {
    const rect = track.getBoundingClientRect();
    const y = ((clientY - rect.top) / rect.height) * VIEW_H;
    let best = 0;
    for (let i = 1; i <= SAMPLES; i++) {
      if (Math.abs(pts[i].y - y) < Math.abs(pts[best].y - y)) best = i;
    }
    window.scrollTo({ top: (best / SAMPLES) * maxScroll(), behavior: 'instant' }); // follow the pointer exactly
  };
  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId);
    track.classList.add('is-dragging');
    scrollToPointer(e.clientY);
  });
  track.addEventListener('pointermove', (e) => {
    if (track.hasPointerCapture(e.pointerId)) scrollToPointer(e.clientY);
  });
  const stop = (e) => {
    if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
    track.classList.remove('is-dragging');
  };
  track.addEventListener('pointerup', stop);
  track.addEventListener('pointercancel', stop);
}

startLights();
timingTower();
raceTrack();
