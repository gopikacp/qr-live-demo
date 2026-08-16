# 📡 QR Live Demo

An interactive, live demo for technical sessions (built for **TinkerHub**) that shows an audience,
in real time, what a browser automatically shares with a website the moment they scan a QR code and
open a page — nothing more, nothing hidden. It's meant to spark a conversation about privacy,
HTTP headers, and IP-based geolocation.

> 🎓 **Educational only.** This project only reads standard, non-sensitive data every website already
> receives (User-Agent header + IP-based approximate location via a public API). It does **not**
> access contacts, precise GPS, camera, files, or anything requiring special permissions, and it does
> **not** attempt to bypass any browser security.

---

## ✨ What it does

1. A participant scans a QR code on the projector and opens the site.
2. They see a cinematic "connecting…" terminal animation.
3. The page reveals what was detected: browser, OS, device type, public IP, approximate city,
   country, ISP, and time — with a nudge to **"look at the projector."**
4. The `/dashboard` page (shown on the projector) updates **live** via Socket.IO: a new animated
   card appears for every visitor, plus running stats (Android/iPhone %, browser share, top city,
   top ISP, average "scan time", etc).

---

## 🧱 Tech stack

- **Backend:** Node.js, Express, Socket.IO
- **Device detection:** `ua-parser-js`
- **Geolocation:** [ipapi.co](https://ipapi.co) (free tier, no key required for light use)
- **QR generation:** `qrcode` npm package
- **Frontend:** plain HTML / CSS / vanilla JS (no build step, no framework)
- **Storage:** none — everything lives in memory for the life of the process

---

## 📂 Project structure

```
qr-live-demo/
├── server.js            # Express + Socket.IO server, all API routes
├── generateQR.js         # Generates public/qr.png from SITE_URL
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── public/
    ├── index.html         # Participant-facing page
    ├── dashboard.html      # Live admin/projector dashboard
    ├── style.css           # Shared glassmorphism dark/light theme
    ├── script.js            # Participant page logic (terminal + reveal)
    ├── dashboard.js          # Dashboard live updates via Socket.IO
    └── qr.png               # Generated automatically — not committed to git
```

---

## 🚀 Run it locally

Requirements: Node.js 18+

```bash
git clone <your-repo-url>
cd qr-live-demo
cp .env.example .env
npm install
npm start
```

The `postinstall` script automatically generates `public/qr.png` pointing at `SITE_URL`
(defaults to `http://localhost:3000`).

Then open:

- Participant page: **http://localhost:3000**
- Dashboard (projector): **http://localhost:3000/dashboard**

> 💡 To test the "scan" flow from your phone on the same Wi-Fi, set `SITE_URL` in `.env` to your
> computer's LAN IP (e.g. `http://192.168.1.10:3000`), then re-run `npm run generate-qr`, and open
> that URL from your phone.

---

## ☁️ Deploying to Render (step by step)

### 1. Create a GitHub repository

```bash
cd qr-live-demo
git init
git add .
git commit -m "Initial commit: QR Live Demo"
```

- Go to [github.com/new](https://github.com/new), create a new repository (e.g. `qr-live-demo`).
- Then push:

```bash
git remote add origin https://github.com/<your-username>/qr-live-demo.git
git branch -M main
git push -u origin main
```

### 2. Create the Render Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com) and sign in (GitHub login is easiest).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account and select the `qr-live-demo` repository.
4. Configure the service:
   - **Name:** `qr-live-demo` (this becomes part of your URL)
   - **Region:** closest to your venue
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free is fine for a live demo

### 3. Set environment variables

In the Render service settings → **Environment**, add:

| Key         | Value                                                    |
|-------------|-----------------------------------------------------------|
| `SITE_URL`  | `https://qr-live-demo.onrender.com` (your actual Render URL) |
| `ADMIN_KEY` | a password of your choice for dashboard admin actions      |

> Render assigns `PORT` automatically — you don't need to set it.

### 4. Deploy

Click **Create Web Service**. Render will install dependencies (running `postinstall`, which
generates the QR code using the `SITE_URL` you set) and start the server. Watch the logs until you
see:

```
QR Live Demo server running
Public URL: https://qr-live-demo.onrender.com
```

### 5. Re-generate the QR after the first deploy (recommended)

Because `SITE_URL` is only known once Render assigns your final URL, do one deploy first, copy the
real URL into the `SITE_URL` env var if you hadn't already, then trigger **Manual Deploy → Deploy
latest commit** so `postinstall` regenerates `public/qr.png` against the correct, final URL.

### 6. Get your QR code

Visit:

```
https://qr-live-demo.onrender.com/qr.png
```

or just open `/dashboard` — the QR is displayed there too, ready to project.

---

## 🖥️ Running the session

1. Open `/dashboard` on the venue's projector/screen.
2. Show the QR code (from the dashboard sidebar, or project `/qr.png` directly, or share the link).
3. Ask participants to scan it with their phone camera.
4. Watch visitor cards and stats populate live as people scan.
5. Use the **admin key** (set via `ADMIN_KEY`) in the dashboard toolbar to:
   - **Export CSV** of all visitors this session
   - **Clear** all visitors to reset for a new demo run

---

## 🔐 Privacy & ethics notes for presenters

- Mention at the start of the session that scanning is optional and that the page only reads
  standard browser/network metadata (no permissions prompts, no location APIs, no device sensors).
- Data lives only in server memory for the current process — restarting the server clears everything.
- Nothing is written to a database or third-party analytics tool.
- If you export a CSV for a slide/blog recap, strip or anonymize it before sharing publicly.

---

## 🧩 Bonus features included

- ✅ Live visitor counter with animated count-up
- ✅ Admin "Clear visitors" action (key-protected)
- ✅ CSV export of the session's visitors (key-protected)
- ✅ QR code displayed directly on the dashboard
- ✅ Connection "chime" sound effects (generated with the Web Audio API — no audio files needed)
- ✅ Toast notification when a new visitor joins
- ✅ Live clock + running session timer
- ✅ Dark / light mode toggle on the dashboard

---

## 🛠️ Troubleshooting

- **QR points to `localhost`:** you deployed without setting `SITE_URL`. Set it in Render's
  environment variables and redeploy.
- **Geolocation shows "Local Network":** this is expected when testing from `localhost` or a private
  Wi-Fi IP — public IP geolocation only works once traffic is going through a real public IP
  (e.g. once deployed on Render, or when testing over mobile data).
- **`ipapi.co` rate-limited:** the free tier has a request cap; the app fails soft and shows
  `"Unknown"` for location fields rather than crashing.
- **Dashboard not updating:** confirm both tabs are pointed at the same deployed URL, and check the
  browser console / Render logs for Socket.IO connection errors.

---

Built for a TinkerHub technical session. MIT licensed — reuse and adapt freely for your own
meetups and workshops.
