/**
 * generateQR.js
 * ------------------------------------------------------------
 * Generates public/qr.png pointing at process.env.SITE_URL.
 * Run automatically on `npm install` (postinstall) and can also
 * be run manually with `npm run generate-qr`.
 * ------------------------------------------------------------
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const OUTPUT_PATH = path.join(__dirname, 'public', 'qr.png');

async function generate() {
  try {
    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    await QRCode.toFile(OUTPUT_PATH, SITE_URL, {
      width: 600,
      margin: 2,
      color: {
        dark: '#0b0f1a',
        light: '#ffffffff'
      }
    });

    console.log('✅ QR code generated for:', SITE_URL);
    console.log('   Saved to:', OUTPUT_PATH);
  } catch (err) {
    console.error('⚠️  Could not generate QR code:', err.message);
    // Don't crash `npm install` if this fails — server can still run.
  }
}

generate();
