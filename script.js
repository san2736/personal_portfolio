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
    soundBtn.addEventListener('click', () => {
      setSound(!soundOn);
      // Turning sound on replays the start so you hear it straight away.
      if (soundOn) startRace();
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

// ---------- Race-track scroll bar ----------
function raceTrack() {
  const track = document.querySelector('[data-track]');
  const car = document.querySelector('[data-car]');
  if (!track || !car) return;
  const doc = document.documentElement;
  const PAD = 22; // keep the car between the start and finish lines
  let last = window.scrollY;
  let queued = false;

  const maxScroll = () => Math.max(0, doc.scrollHeight - window.innerHeight);

  const place = () => {
    queued = false;
    const max = maxScroll();
    const progress = max ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const travel = track.clientHeight - car.offsetHeight - PAD * 2;
    car.style.transform = `translateY(${PAD + progress * travel}px)`;
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

  // Drag the car, or click anywhere on the track, to scroll like a normal scroll bar.
  const scrollToPointer = (clientY) => {
    const rect = track.getBoundingClientRect();
    const usable = rect.height - car.offsetHeight - PAD * 2;
    const p = Math.min(1, Math.max(0, (clientY - rect.top - PAD - car.offsetHeight / 2) / usable));
    window.scrollTo({ top: p * maxScroll(), behavior: 'instant' }); // follow the pointer exactly, no smooth-scroll lag
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
