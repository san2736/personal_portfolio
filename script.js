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
// The scroll bar is a closed circuit: two thin carriageways either side of a winding centre line,
// joined by a hairpin at each end, with grass in the middle. Scrolling down drives the car down the
// left side; scrolling up, it U-turns and drives back up the right side. At either end of the page
// it takes the hairpin by itself, so a lap always finishes back on the start line.
function raceTrack() {
  const track = document.querySelector('[data-track]');
  const car = document.querySelector('[data-car]');
  const path = document.querySelector('[data-path]');
  const map = document.querySelector('[data-map]');
  if (!track || !car || !path || !map) return;
  const startLine = map.querySelector('[data-start-line]');
  const doc = document.documentElement;
  const VIEW_W = 60;
  const CENTRE = VIEW_W / 2;
  const Y_TOP = 20; // the centre line runs from y 20 to y 980 on its 60 x 1000 design grid
  const Y_BOTTOM = 980;
  const total = path.getTotalLength();

  // Sample the centre line once, so scrolling never has to measure the path again
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
    for (let j = i - SMOOTH; j <= i + SMOOTH; j++) sum += pts[Math.min(SAMPLES, Math.max(0, j))].x;
    return sum / (2 * SMOOTH + 1);
  });
  pts.forEach((p, i) => { p.x = smoothX[i]; });

  const cssNum = (name, fallback) => parseFloat(getComputedStyle(track).getPropertyValue(name)) || fallback;
  const fmt = (p) => p.x.toFixed(2) + ' ' + p.y.toFixed(2);

  // Current layout in screen pixels, rebuilt whenever the track changes size
  let geo = null;

  // How far the corners can swing at this size: as much as --sway allows, but never so sharp that
  // the inside of a bend pinches, and never wider than the track's box.
  const fitSway = (w, kMax, lane, kerb, toY) => {
    const sx = w / VIEW_W;
    const needR = lane + kerb / 2 + 10;
    const room = w / 2 - lane - kerb / 2;
    const ok = (k) => {
      let maxCurv = 0;
      let dev = 0;
      for (let i = 1; i < SAMPLES; i++) {
        const x0 = (pts[i - 1].x - CENTRE) * k * sx, x1 = (pts[i].x - CENTRE) * k * sx, x2 = (pts[i + 1].x - CENTRE) * k * sx;
        const y0 = toY(pts[i - 1].y), y1 = toY(pts[i].y), y2 = toY(pts[i + 1].y);
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

  const layout = () => {
    const w = track.clientWidth;
    const h = track.clientHeight;
    const lane = cssNum('--lane', 10); // half the distance between the two sides
    const road = cssNum('--asphalt-w', 10);
    const kerb = cssNum('--kerb-w', road);
    const kMax = cssNum('--sway', 1);
    const key = [w, h, lane, road, kerb, kMax].join('x');
    if (geo && geo.key === key) return geo;

    // Leave room above and below for the hairpins, so they never run off the end of the track
    const pad = lane + kerb / 2 + 3;
    const toY = (y) => pad + ((y - Y_TOP) / (Y_BOTTOM - Y_TOP)) * (h - 2 * pad);
    const k = fitSway(w, kMax, lane, kerb, toY);
    const sx = w / VIEW_W;
    const C = pts.map((p) => ({ x: (CENTRE + (p.x - CENTRE) * k) * sx, y: toY(p.y) }));
    const T = [];
    const N = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const a = C[Math.max(0, i - 2)];
      const b = C[Math.min(SAMPLES, i + 2)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      T.push({ x: (b.x - a.x) / len, y: (b.y - a.y) / len }); // direction of travel down the page
      N.push({ x: (b.y - a.y) / len, y: -(b.x - a.x) / len }); // points to the right-hand side
    }
    const left = [];
    const right = [];
    for (let i = 0; i <= SAMPLES; i += 2) {
      left.push({ x: C[i].x - N[i].x * lane, y: C[i].y - N[i].y * lane });
      right.push({ x: C[i].x + N[i].x * lane, y: C[i].y + N[i].y * lane });
    }
    const arc = `A ${lane} ${lane} 0 0 0 `;
    const loop =
      'M ' + left.map(fmt).join(' L ') +
      ' ' + arc + fmt(right[right.length - 1]) +
      ' L ' + right.slice().reverse().map(fmt).join(' L ') +
      ' ' + arc + fmt(left[0]) + ' Z';
    map.setAttribute('viewBox', `0 0 ${w} ${h}`);
    map.querySelectorAll('[data-draw]').forEach((el) => el.setAttribute('d', loop));
    if (startLine) {
      // The start and finish line, across the left side just below the top hairpin
      const s0 = left[0];
      startLine.setAttribute('x', (s0.x - road / 2).toFixed(2));
      startLine.setAttribute('y', (s0.y + 2).toFixed(2));
      startLine.setAttribute('width', road.toFixed(2));
      startLine.setAttribute('height', '6');
    }
    geo = { key, h, pad, lane, C, T, N };
    return geo;
  };

  // ----- Driving -----
  // side: -1 on the left (driving down), +1 on the right (driving up).
  // A U-turn is a half circle across the grass, ahead of the car, from one side to the other.
  let side = -1;
  let turn = null; // { from, start } while a U-turn is under way
  let wanted = 'down'; // the direction the visitor last scrolled
  const TURN_MS = 650;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const maxScroll = () => Math.max(0, doc.scrollHeight - window.innerHeight);
  const progress = () => {
    const max = maxScroll();
    return max ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };

  // Position on the loop for the car at sample i: on a side, or part-way through a U-turn (u from 0 to 1)
  const pose = (g, i, fromSide, u) => {
    const c = g.C[i], t = g.T[i], n = g.N[i];
    const ahead = fromSide < 0 ? 1 : -1; // driving down on the left, up on the right
    const at = (uu) => {
      const th = Math.PI * uu;
      const across = fromSide * Math.cos(th) * g.lane; // from fromSide over to the other side
      const fwd = ahead * Math.sin(th) * g.lane;
      return { x: c.x + n.x * across + t.x * fwd, y: c.y + n.y * across + t.y * fwd };
    };
    const p = at(u);
    let dx, dy;
    if (u <= 0 || u >= 1) {
      const dir = (u >= 1 ? -fromSide : fromSide) < 0 ? 1 : -1;
      dx = t.x * dir;
      dy = t.y * dir;
    } else {
      const q = at(Math.min(1, u + 0.01));
      dx = q.x - p.x;
      dy = q.y - p.y;
    }
    // The car is drawn nose-up, so add 90 degrees to point it along its direction of travel
    return { x: p.x, y: p.y, angle: (Math.atan2(dy, dx) * 180) / Math.PI + 90 };
  };

  const startTurn = () => {
    if (turn) return;
    if (reduceMotion()) { side = -side; return; }
    turn = { from: side, start: performance.now() };
  };

  let queued = false;
  const place = () => {
    queued = false;
    const g = layout();
    const p = progress();
    const i = Math.round(p * SAMPLES);

    if (turn) {
      const u = Math.min(1, (performance.now() - turn.start) / TURN_MS);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; // ease in and out
      const ps = pose(g, i, turn.from, e);
      car.style.transform = `translate(${ps.x}px, ${ps.y}px) rotate(${ps.angle}deg)`;
      if (u < 1) { queue(); return; }
      side = -turn.from;
      turn = null;
    }

    // At either end of the page the car takes the hairpin, so a lap always finishes on the start line
    if (p >= 0.999) wanted = 'up';
    if (p <= 0.001) wanted = 'down';
    if ((wanted === 'up') !== (side > 0)) {
      startTurn();
      if (turn) { queue(); return; }
    }

    const ps = pose(g, i, side, 0);
    car.style.transform = `translate(${ps.x}px, ${ps.y}px) rotate(${ps.angle}deg)`;
    track.dataset.dir = side < 0 ? 'down' : 'up';
  };
  function queue() {
    if (!queued) { queued = true; requestAnimationFrame(place); }
  }

  let last = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > last + 1) wanted = 'down';
    else if (y < last - 1) wanted = 'up';
    last = y;
    queue();
  }, { passive: true });
  window.addEventListener('resize', queue);
  track.dataset.dir = 'down';
  place();

  // Drag the car, or click on the track, to scroll like a normal scroll bar.
  // The circuit only ever runs downwards, so the nearest sample by height gives the progress.
  const scrollToPointer = (clientY) => {
    const g = layout();
    const rect = track.getBoundingClientRect();
    const y = clientY - rect.top;
    let best = 0;
    for (let i = 1; i <= SAMPLES; i++) {
      if (Math.abs(g.C[i].y - y) < Math.abs(g.C[best].y - y)) best = i;
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
