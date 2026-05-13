# 🚚 Shu-Haul

> *The exclusive rideshare experience. Disrupting hauling, one friend at a time.*

A satirical Uber/Lyft clone for a private group of friends. The only driver is Sheldon. He drives a pickup truck. The ETA keeps getting worse.

---

## How it works

1. User opens the app, sees a live map with fake trucks roaming around
2. They type a destination and pick a vehicle tier (X, Black, or Pool)
3. They hit **Request Shu-Haul** → the backend fires an SMS to the driver via Twilio
4. The "connecting" screen plays, then the active ride screen appears
5. The ETA message updates every 15–30 seconds, getting progressively worse

No matter which tier is selected, it's the same truck.

---

## Tech stack

| Layer | What |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, Leaflet.js + OpenStreetMap |
| Backend | Cloudflare Pages Function (single endpoint) |
| SMS | Twilio REST API |
| Hosting | Cloudflare Pages (free tier) |

---

## Local development

### Option A — Cloudflare wrangler (recommended, matches production exactly)

```bash
# 1. Install dependencies
npm install

# 2. Copy the secrets template and fill it in
cp .dev.vars.example .dev.vars

# 3. Start the dev server (static files + Pages Function)
npm run cf:dev
# → http://localhost:8788
```

The `.dev.vars` file is gitignored. It's the local equivalent of the CF dashboard secrets.

### Option B — Plain Node.js (no Twilio in local dev)

```bash
cp .env.example .env   # fill in Twilio creds
npm run dev            # nodemon → http://localhost:3000
```

---

## Deploy to Cloudflare Pages

### First time setup

**Step 1 — Log in to Cloudflare via wrangler**
```bash
npx wrangler login
# Opens a browser window — authorise with your Cloudflare account
```

**Step 2 — Deploy (this also creates the project on first run)**
```bash
npm run cf:deploy
# First run will ask for a project name → use: shuhaul
```

**Step 3 — Add secrets in the Cloudflare dashboard**

Go to: `dash.cloudflare.com` → **Workers & Pages** → `shuhaul` → **Settings** → **Environment Variables**

Add each of these as a **Secret** (not plain text) for the **Production** environment:

| Variable | Where to find it |
|---|---|
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com) → Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info |
| `TWILIO_FROM_NUMBER` | Twilio Console → Phone Numbers (format: `+15550001234`) |
| `DRIVER_PHONE_NUMBER` | The driver's real phone number (format: `+15550001234`) |

**Step 4 — Redeploy once so the Function picks up the new secrets**
```bash
npm run cf:deploy
```

That's it. Your app is live at `https://shuhaul.pages.dev` (or your custom domain).

---

### Subsequent deploys

```bash
npm run cf:deploy
```

---

## Environment variables reference

| Variable | Used by | Description |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Pages Function | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Pages Function | Twilio secret key |
| `TWILIO_FROM_NUMBER` | Pages Function | The Twilio number that sends the SMS |
| `DRIVER_PHONE_NUMBER` | Pages Function | Sheldon's phone number |
| `PORT` | server.js only | Port for local Node server (default: 3000) |

---

## Project structure

```
shuhaul/
├── functions/
│   └── api/
│       └── request-ride.js   # Cloudflare Pages Function — sends the SMS
├── public/
│   ├── index.html            # Single-page app
│   ├── css/style.css         # U-Haul orange theme
│   └── js/app.js             # Map, booking flow, ETA gag
├── server.js                 # Express server (Dokploy / local Node fallback)
├── wrangler.toml             # Cloudflare Pages config
├── .dev.vars.example         # Local secrets template (copy → .dev.vars)
├── .env.example              # Node/Dokploy secrets template (copy → .env)
└── Dockerfile                # For Dokploy deployments
```

---

## The ETA gag (for reference)

| Time elapsed | Message |
|---|---|
| 0s | "Sheldon is completing a trip nearby. Arriving in 5 minutes." |
| 15s | "Traffic is heavy. Arriving in 10 minutes." |
| 30s | "Sheldon missed a turn. Arriving in 30 minutes." |
| 45s | "Sheldon is stopping for coffee. Arriving in 45 minutes." |
| 60s | "Arriving... eventually. Just keep waiting." |
