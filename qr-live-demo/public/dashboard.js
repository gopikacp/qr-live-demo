/* ==========================================================
   QR Live Demo — dashboard.js
   Live-updating admin dashboard (Socket.IO)
   ========================================================== */

(function () {
  'use strict';

  initParticles();
  initTheme();
  initClock();

  const visitorsList = document.getElementById('visitorsList');
  const emptyState = document.getElementById('emptyState');
  const qrUrl = document.getElementById('qrUrl');

  let sessionStartedAt = Date.now();

  const socket = io({ query: { role: 'dashboard' } });

  socket.on('init', (payload) => {
    sessionStartedAt = payload.sessionStartedAt || Date.now();
    qrUrl.textContent = payload.siteUrl || window.location.origin;

    visitorsList.innerHTML = '';
    if (!payload.visitors || payload.visitors.length === 0) {
      showEmptyState();
    } else {
      // newest first
      [...payload.visitors].reverse().forEach(v => addVisitorCard(v, false));
    }
    updateStats(payload.stats);
  });

  socket.on('new-visitor', (visitor) => {
    addVisitorCard(visitor, true);
    playJoinChime();
    toast(`New visitor #${visitor.id} joined — ${visitor.platformLabel}`);
  });

  socket.on('stats-update', (stats) => updateStats(stats));

  socket.on('visitors-cleared', () => {
    visitorsList.innerHTML = '';
    showEmptyState();
  });

  function showEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.id = 'emptyState';
    div.textContent = 'Waiting for the first scan… 📷';
    visitorsList.appendChild(div);
  }

  function addVisitorCard(v, animate) {
    const existingEmpty = document.getElementById('emptyState');
    if (existingEmpty) existingEmpty.remove();

    const card = document.createElement('div');
    card.className = 'visitor-card';
    card.innerHTML = `
      <div class="v-id">Visitor #${v.id}</div>
      <div class="v-main">${platformEmoji(v.platformLabel)} ${v.platformLabel || 'Unknown'} &nbsp;·&nbsp; 🌐 ${escapeHtml(v.browser || 'Unknown')}</div>
      <div class="v-meta">
        <span>📍 ${escapeHtml(v.city || 'Unknown')}${v.country ? ', ' + escapeHtml(v.country) : ''}</span>
        <span>📡 ${escapeHtml(v.isp || 'Unknown')}</span>
        <span>🕒 ${formatClockTime(v.time)}</span>
      </div>
    `;
    visitorsList.prepend(card);
  }

  function platformEmoji(label) {
    switch (label) {
      case 'Android': return '📱';
      case 'iPhone': return '📱';
      case 'Mac': return '🖥️';
      case 'Windows': return '🖥️';
      case 'Linux': return '🐧';
      default: return '💻';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatClockTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function updateStats(stats) {
    if (!stats) return;
    animateCount('stat-total', stats.total);
    setPct('stat-android', stats.androidPct);
    setPct('stat-iphone', stats.iphonePct);
    setPct('stat-chrome', stats.chromePct);
    setPct('stat-safari', stats.safariPct);
    setPct('stat-firefox', stats.firefoxPct);
    document.getElementById('stat-topcity').textContent = stats.topCity || '—';
    document.getElementById('stat-topisp').textContent = stats.topIsp || '—';
    document.getElementById('stat-avgscan').textContent = (stats.avgScanTimeMs || 0) + ' ms';
    document.getElementById('stat-newest').textContent = stats.newestVisitor || '—';
  }

  function setPct(id, value) {
    animateCount(id, value, '%');
  }

  const countState = {};
  function animateCount(id, target, suffix) {
    suffix = suffix || '';
    const el = document.getElementById(id);
    if (!el) return;
    const from = countState[id] || 0;
    countState[id] = target;
    const duration = 500;
    const start = performance.now();

    function step(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------------- Admin controls ----------------
  document.getElementById('exportBtn').addEventListener('click', () => {
    const key = document.getElementById('adminKeyInput').value.trim();
    if (!key) { toast('Enter the admin key first'); return; }
    window.open('/api/export-csv?key=' + encodeURIComponent(key), '_blank');
  });

  document.getElementById('clearBtn').addEventListener('click', async () => {
    const key = document.getElementById('adminKeyInput').value.trim();
    if (!key) { toast('Enter the admin key first'); return; }
    if (!confirm('Clear all visitors for this session?')) return;
    try {
      const res = await fetch('/api/clear-visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      if (!data.ok) toast('Wrong admin key');
    } catch (e) {
      toast('Could not clear visitors');
    }
  });

  // ---------------- Theme toggle ----------------
  function initTheme() {
    const saved = localStorage.getItem('qr-demo-theme') || 'dark';
    document.body.className = 'theme-' + saved;
    document.getElementById('themeToggle').addEventListener('click', () => {
      const isDark = document.body.classList.contains('theme-dark');
      const next = isDark ? 'light' : 'dark';
      document.body.className = 'theme-' + next;
      localStorage.setItem('qr-demo-theme', next);
    });
  }

  // ---------------- Clock + session timer ----------------
  function initClock() {
    const clockEl = document.getElementById('liveClock');
    const timerEl = document.getElementById('sessionTimer');

    function tick() {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString();

      const elapsed = Math.max(0, Date.now() - sessionStartedAt);
      const h = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
      timerEl.textContent = `Session ${h}:${m}:${s}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  // ---------------- Join chime + toast ----------------
  function playJoinChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 740;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch (e) { /* ignore */ }
  }

  let toastTimeout;
  function toast(message) {
    let el = document.getElementById('toastEl');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toastEl';
      el.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: rgba(20,20,35,0.9); color: #fff; padding: 10px 18px;
        border-radius: 999px; font-size: 13px; z-index: 50; opacity: 0;
        transition: opacity 0.25s ease; pointer-events: none; border: 1px solid rgba(255,255,255,0.15);
      `;
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = '1';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  }

  // ---------------- Floating particles (shared visual) ----------------
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

    const COUNT = Math.min(50, Math.floor((window.innerWidth * window.innerHeight) / 26000));
    particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2 + 0.6,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
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
        ctx.fillStyle = `rgba(${p.hue}, 0.45)`;
        ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    tick();
  }
})();
