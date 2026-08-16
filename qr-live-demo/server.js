/**
 * QR Live Demo — server.js
 * ------------------------------------------------------------
 * Educational demo (TinkerHub session).
 *
 * Shows participants, in real time, what information a browser
 * *routinely* shares with any website it visits:
 *   - User-Agent derived info (browser, OS, device) via ua-parser-js
 *   - Approximate location derived from public IP via ipapi.co
 *
 * No sensitive data is collected, no browser security is bypassed,
 * and nothing is persisted to disk/DB — everything lives in memory
 * for the duration of the process and is only meant for a live,
 * consenting audience to see on a shared dashboard/projector.
 * ------------------------------------------------------------
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const { UAParser } = require('ua-parser-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const ADMIN_KEY = process.env.ADMIN_KEY || 'tinkerhub2026';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------
// In-memory state (reset whenever the server restarts)
// ------------------------------------------------------------
let visitors = [];
let visitorCounter = 0;
const sessionStartedAt = Date.now();

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** Pull the best-guess client IP out of the request/handshake. */
function getClientIp(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return socket.handshake.address ? socket.handshake.address.replace('::ffff:', '') : '';
}

function isPrivateOrLocalIp(ip) {
  if (!ip) return true;
  return (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.3')
  );
}

/** Look up approximate geolocation + ISP for a public IP. Fails soft. */
async function lookupGeo(ip) {
  const fallback = {
    city: 'Unknown',
    region: '',
    country: 'Unknown',
    isp: 'Unknown',
    ip: ip || 'Unknown'
  };

  if (isPrivateOrLocalIp(ip)) {
    return { ...fallback, city: 'Local Network', country: '' };
  }

  try {
    const { data } = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 4000 });
    if (data && !data.error) {
      return {
        city: data.city || 'Unknown',
        region: data.region || '',
        country: data.country_name || 'Unknown',
        isp: data.org || 'Unknown',
        ip: data.ip || ip
      };
    }
    return fallback;
  } catch (err) {
    return fallback;
  }
}

/** Parse the User-Agent header into friendly, demo-ready fields. */
function parseDevice(userAgent) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const browser = result.browser.name || 'Unknown Browser';
  const browserVersion = result.browser.version || '';
  const os = result.os.name || 'Unknown OS';
  const osVersion = result.os.version || '';

  let deviceType = result.device.type || 'desktop'; // mobile, tablet, desktop
  let deviceVendor = result.device.vendor || '';
  let deviceModel = result.device.model || '';

  let platformLabel = 'Desktop';
  if (os.toLowerCase().includes('android')) platformLabel = 'Android';
  else if (os.toLowerCase().includes('ios') || os.toLowerCase().includes('iphone') || os.toLowerCase().includes('mac')) {
    platformLabel = deviceType === 'mobile' || os.toLowerCase().includes('ios') ? 'iPhone' : 'Mac';
  } else if (os.toLowerCase().includes('windows')) platformLabel = 'Windows';
  else if (os.toLowerCase().includes('linux')) platformLabel = 'Linux';

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
    deviceVendor,
    deviceModel,
    platformLabel
  };
}

function computeStats() {
  const total = visitors.length;
  const pct = (count) => (total === 0 ? 0 : Math.round((count / total) * 100));

  const androidCount = visitors.filter(v => v.platformLabel === 'Android').length;
  const iphoneCount = visitors.filter(v => v.platformLabel === 'iPhone').length;
  const chromeCount = visitors.filter(v => v.browser.toLowerCase().includes('chrome')).length;
  const safariCount = visitors.filter(v => v.browser.toLowerCase().includes('safari') && !v.browser.toLowerCase().includes('chrome')).length;
  const firefoxCount = visitors.filter(v => v.browser.toLowerCase().includes('firefox')).length;

  const cityCounts = {};
  const ispCounts = {};
  visitors.forEach(v => {
    if (v.city) cityCounts[v.city] = (cityCounts[v.city] || 0) + 1;
    if (v.isp) ispCounts[v.isp] = (ispCounts[v.isp] || 0) + 1;
  });

  const topOf = (obj) => {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '—';
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };

  const avgScanTime = total === 0
    ? 0
    : Math.round(visitors.reduce((sum, v) => sum + (v.scanTimeMs || 0), 0) / total);

  const newest = total === 0 ? null : visitors[visitors.length - 1];

  return {
    total,
    androidPct: pct(androidCount),
    iphonePct: pct(iphoneCount),
    chromePct: pct(chromeCount),
    safariPct: pct(safariCount),
    firefoxPct: pct(firefoxCount),
    topCity: topOf(cityCounts),
    topIsp: topOf(ispCounts),
    avgScanTimeMs: avgScanTime,
    newestVisitor: newest ? `#${newest.id} · ${newest.platformLabel}` : '—'
  };
}

function toCsvRow(fields) {
  return fields
    .map(f => {
      const s = String(f === undefined || f === null ? '' : f);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(',');
}

// ------------------------------------------------------------
// HTTP routes
// ------------------------------------------------------------

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/site-info', (req, res) => {
  res.json({ siteUrl: SITE_URL, sessionStartedAt });
});

app.get('/api/export-csv', (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).send('Unauthorized. Provide ?key=YOUR_ADMIN_KEY');
  }

  const header = toCsvRow([
    'ID', 'Time', 'Platform', 'Browser', 'Browser Version', 'OS', 'OS Version',
    'Device Type', 'Device Vendor', 'City', 'Region', 'Country', 'ISP', 'IP', 'Scan Time (ms)'
  ]);

  const rows = visitors.map(v => toCsvRow([
    v.id, v.time, v.platformLabel, v.browser, v.browserVersion, v.os, v.osVersion,
    v.deviceType, v.deviceVendor, v.city, v.region, v.country, v.isp, v.ip, v.scanTimeMs
  ]));

  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="qr-live-demo-visitors.csv"');
  res.send(csv);
});

app.post('/api/clear-visitors', (req, res) => {
  if (req.body.key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  visitors = [];
  visitorCounter = 0;
  io.emit('visitors-cleared');
  io.emit('stats-update', computeStats());
  res.json({ ok: true });
});

// ------------------------------------------------------------
// Socket.IO
// ------------------------------------------------------------

io.on('connection', async (socket) => {
  const role = socket.handshake.query.role;

  if (role === 'dashboard') {
    // A dashboard/admin client joined — just hand it current state.
    socket.emit('init', { visitors, stats: computeStats(), siteUrl: SITE_URL, sessionStartedAt });
    return;
  }

  // Otherwise, this is a participant scanning the QR code.
  const connectionStart = Date.now();
  const ip = getClientIp(socket);
  const userAgent = socket.handshake.headers['user-agent'] || '';

  const deviceInfo = parseDevice(userAgent);
  const geo = await lookupGeo(ip);

  visitorCounter += 1;
  const scanTimeMs = Date.now() - connectionStart;

  const visitor = {
    id: visitorCounter,
    socketId: socket.id,
    time: new Date().toISOString(),
    scanTimeMs,
    ...deviceInfo,
    ...geo
  };

  visitors.push(visitor);

  // Tell the visitor what we detected about them.
  socket.emit('your-info', visitor);

  // Broadcast to every connected dashboard.
  io.emit('new-visitor', visitor);
  io.emit('stats-update', computeStats());

  socket.on('disconnect', () => {
    // We keep the visitor in the log for the session (for stats/CSV),
    // we just no longer have a live connection to them.
  });
});

server.listen(PORT, () => {
  console.log('==============================================');
  console.log('  QR Live Demo server running');
  console.log('  Local:      http://localhost:' + PORT);
  console.log('  Public URL: ' + SITE_URL);
  console.log('  Dashboard:  ' + SITE_URL + '/dashboard');
  console.log('==============================================');
});
