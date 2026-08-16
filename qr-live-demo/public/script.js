/* ==========================================================
   QR Live Demo — script.js (participant page)
   Cinematic fake-terminal loading sequence, then reveals
   what the browser shared with the server.
   ========================================================== */

(function () {
  'use strict';

  // ---------------- Floating particles background ----------------
  initParticles();

  // ---------------- Terminal sequence ----------------
  const terminalBody = document.getElementById('terminalBody');
  const terminalScreen = document.getElementById('terminalScreen');
  const revealScreen = document.getElementById('revealScreen');

  const steps = [
    { text: 'Initializing Secure Connection…', cls: '' },
    { text: 'Reading QR…', cls: '' },
    { text: 'Connecting…', cls: '' },
    { bar: true },
    { text: 'Detecting Browser…', cls: 'dim' },
    { text: 'Detecting Device…', cls: 'dim' },
    { text: 'Detecting Approximate Location…', cls: 'dim' },
    { text: 'Loading…', cls: '' },
    { text: '✔ Connected', cls: 'ok' }
  ];

  let delay = 0;
  const STEP_DELAY = 260;

  steps.forEach((step) => {
    delay += STEP_DELAY;
    setTimeout(() => {
      if (step.bar) {
        renderProgressBar();
      } else {
        addLine(step.text, step.cls);
      }
    }, delay);
  });

  const TOTAL_TERMINAL_TIME = delay + 700;

  function addLine(text, cls) {
    const line = document.createElement('div');
    line.className = 'term-line' + (cls ? ' ' + cls : '');
    line.textContent = text;
    if (text.indexOf('Connected') === -1) {
      const cursor = document.createElement('span');
      cursor.className = 'cursor';
      line.appendChild(cursor);
    }
    terminalBody.appendChild(line);
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  function renderProgressBar() {
    const frames = ['████░░░░░░', '███████░░░', '██████████'];
    let i = 0;
    const line = document.createElement('div');
    line.className = 'term-line bar';
    terminalBody.appendChild(line);

    const iv = setInterval(() => {
      line.textContent = frames[i];
      i += 1;
      if (i >= frames.length) clearInterval(iv);
    }, 220);
  }

  // ---------------- Transition to reveal screen ----------------
  setTimeout(() => {
    terminalScreen.classList.add('hidden');
    revealScreen.classList.remove('hidden');
    playChime();
    staggerRevealItems();
  }, TOTAL_TERMINAL_TIME);

  function staggerRevealItems() {
    const items = document.querySelectorAll('.info-item');
    items.forEach((item, idx) => {
      item.style.animationDelay = (idx * 70) + 'ms';
    });
  }

  // ---------------- Socket.IO: get + display real info ----------------
  const socket = io();

  socket.on('your-info', (data) => {
    setVal('browser', `${data.browser} ${data.browserVersion || ''}`.trim());
    setVal('os', `${data.os} ${data.osVersion || ''}`.trim());
    setVal('device', formatDevice(data));
    setVal('ip', data.ip || 'Unavailable');
    setVal('city', data.city || 'Unknown');
    setVal('country', data.country || 'Unknown');
    setVal('isp', data.isp || 'Unknown');
    setVal('time', formatTime(data.time));
  });

  function formatDevice(data) {
    const type = data.deviceType ? capitalize(data.deviceType) : 'Desktop';
    const vendor = data.deviceVendor ? ` (${data.deviceVendor})` : '';
    return `${data.platformLabel || type}${vendor !== ` (${data.platformLabel})` ? '' : ''}` + (data.deviceModel ? ` — ${data.deviceModel}` : '');
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function formatTime(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        day: '2-digit', month: 'short'
      });
    } catch (e) {
      return isoString;
    }
  }

  function setVal(key, value) {
    const el = document.getElementById('val-' + key);
    if (el) el.textContent = value || 'Unavailable';
  }

  // ---------------- Tiny "connected" chime (Web Audio, no asset needed) ----------------
  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [660, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.32);
      });
    } catch (e) { /* ignore — audio isn't essential */ }
  }

  // ---------------- Floating particles ----------------
  function initParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const COUNT = Math.min(60, Math.floor((window.innerWidth * window.innerHeight) / 22000));
    particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2 + 0.6,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      hue: Math.random() > 0.5 ? '124,92,255' : '34,211,238'
    }));

    function tick() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue}, 0.5)`;
        ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    tick();
  }
})();
