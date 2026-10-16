// ---------- Start lights ----------
function startLights() {
  const root = document.documentElement;
  const cols = Array.from(document.querySelectorAll('.gantry__col'));
  const replay = document.querySelector('[data-replay]');
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
    try { sessionStorage.setItem('lightsOut', '1'); } catch (e) {}
  };

  const runStart = () => {
    clear();
    root.classList.remove('lights-out');
    root.classList.add('pre-start');
    cols.forEach((c) => c.classList.remove('is-on'));
    // One column per second in the real sport; a little quicker here.
    cols.forEach((c, i) => {
      timers.push(setTimeout(() => c.classList.add('is-on'), 450 + i * 600));
    });
    // Hold for a random moment, as the race director does, then go.
    const hold = 450 + cols.length * 600 + 300 + Math.random() * 900;
    timers.push(setTimeout(lightsOut, hold));
  };

  if (root.classList.contains('pre-start')) {
    runStart();
    // Let impatient visitors skip straight to the race.
    const skip = () => {
      if (root.classList.contains('pre-start')) lightsOut();
    };
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
  } else {
    root.classList.add('lights-out');
  }

  if (replay) {
    replay.addEventListener('click', () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      window.scrollTo({ top: 0 });
      runStart();
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
