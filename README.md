# tribe 🔥

> Hyper-local, ephemeral campfire chat. Create a fire anywhere — only people within 1.5 km can join.

**tribe** is a real-time, geofenced mobile web app. Anyone can light a campfire at their GPS coordinates. Messages glow orange when fresh, fade to ash after 5 minutes, and self-destruct after 30. Walk out of range and you're automatically ejected.

---

## Features

| Feature | Details |
|---|---|
| **Multiple campfires** | Create a named fire at your current coordinates; others within 1.5 km can join |
| **Geofenced access** | `haversineDistance` is checked on every GPS update — entry blocked and auto-kick enforced server-side |
| **Campfire map** | Leaflet map (CartoDB dark tiles) shows all fires within 50 km; 1.5 km geofence ring visualised |
| **Ephemeral messages** | Auto-deleted after 30 min by a Convex cron; tribes expire after 24 h |
| **Message heat** | Fresh messages glow orange (`hot`), then fade (`warm` → `cold`) |
| **Threaded replies** | Tap 💬 on any message to open a slide-in thread panel |
| **Image upload** | Attach images via Convex File Storage (presigned PUT → `storageId` in message) |
| **Clickable links** | URLs in messages render as tappable `<a>` links |
| **Relative timestamps** | "just now", "2m", "1h" — updated on every render pass |
| **Reactions** | 🔥 like any message; count shown inline |
| **Username picker** | New joiners choose a display name; rename any time via the identity chip |
| **No sign-up** | Random name + deterministic SVG avatar generated from `userId` seed |
| **AdSense ready** | Every 7th message slot renders a styled "Signal from the Outside" ad unit |
| **Cyber-primal aesthetic** | Deep forest green `#051a05` + campfire orange `#ff4500`, monospace fonts |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v3 + Framer Motion |
| Map | Leaflet + react-leaflet (CartoDB dark tiles) |
| Backend | Convex (real-time queries, mutations, file storage, crons) |
| Deployment | Vercel |
| Tests | Playwright E2E |
| CI/CD | GitHub Actions |

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/tribe.git
cd tribe
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required: from `npx convex dev` (see step 3)
VITE_CONVEX_URL=https://your-project.convex.cloud

# Optional: your Google AdSense publisher ID
VITE_ADSENSE_PUB_ID=ca-pub-XXXXXXXXXXXXXXXX
```

> **Dev note:** Without `VITE_CONVEX_URL` the app runs in mock mode — everything works except cross-device real-time sync. `VITE_TRIBE_LAT` / `VITE_TRIBE_LNG` are no longer required; each campfire stores its own coordinates.

### 3. Set up Convex

```bash
npx convex dev
```

This will:
- Prompt you to log in / create a project
- Generate `convex/_generated/` files
- Deploy your schema and functions
- Print your `VITE_CONVEX_URL` — paste it into `.env.local`

### 4. Run the dev server

```bash
npm run dev
```

Open `http://localhost:5173`. Grant location permissions when prompted. If you're outside an existing fire's 1.5 km radius, use **"Light a new fire"** to create one at your location.

> **Dev tip:** Use your browser's DevTools geolocation override to test with spoofed coordinates without physically moving.

---

## Running Tests

```bash
# Install browsers (first time only)
npx playwright install chromium

# Run all E2E tests
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Show the HTML report
npx playwright show-report
```

Tests mock geolocation — no need to be at any real coordinates. The suite covers landing state, inner circle, identity, message features, geofence gating, the map toggle, auto-kick on geo departure, ad units, accessibility, and mobile layout.

---

## Deployment

### Vercel (recommended)

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link`
3. Add these secrets in Vercel dashboard and GitHub → Settings → Secrets:
   - `CONVEX_DEPLOY_KEY` — from Convex dashboard → Settings → Deploy Keys
   - `CONVEX_DEPLOYMENT` — your Convex deployment name
   - `VITE_CONVEX_URL` — your Convex deployment URL
   - `VITE_ADSENSE_PUB_ID` — (optional) Google AdSense publisher ID
4. Push to `main` — GitHub Actions handles Convex deploy + Vercel deploy automatically.

### Manual deploy

```bash
npx convex deploy --cmd 'npm run build'
vercel --prod
```

### AdSense setup

1. Replace `pub-XXXXXXXXXXXXXXXX` in `public/ads.txt`
2. Set `VITE_ADSENSE_PUB_ID`
3. Submit to AdSense for review

The `TribeManifesto` section provides article-style text to satisfy the content policy crawler.

---

## Geofence Radius

The join radius is 1.5 km, set in `src/utils/geo.ts`:

```typescript
export const GEOFENCE_RADIUS_M = 1500; // metres
```

The map also shows all campfires within a 50 km discovery radius.

---

## Project Structure

```
tribe/
├── src/
│   ├── App.tsx                    # Root shell + screen state machine
│   ├── main.tsx
│   ├── index.css
│   ├── components/
│   │   ├── FireBackground.tsx     # Animated campfire background (canvas)
│   │   ├── TribeLanding.tsx       # Landing: browse / create fires
│   │   ├── NearbyTribes.tsx       # Scrollable list of nearby campfires
│   │   ├── CampfireMap.tsx        # Leaflet map with fire markers + geofence ring
│   │   ├── CreateTribeForm.tsx    # Light a new fire form
│   │   ├── TribeHeader.tsx        # Sticky header: tribe name + identity chip
│   │   ├── ChatFeed.tsx           # Message list + ad injection
│   │   ├── MessageBubble.tsx      # Message with heat styling + links + image
│   │   ├── MessageInput.tsx       # Textarea + image attach + send button
│   │   ├── ThreadPanel.tsx        # Slide-in thread view
│   │   ├── Avatar.tsx             # SVG avatar wrapper
│   │   ├── TribeAd.tsx            # AdSense unit (cyber-primal styled)
│   │   ├── AdSenseProvider.tsx    # Lazy AdSense script loader
│   │   └── TribeManifesto.tsx     # SEO content section
│   ├── hooks/
│   │   ├── useGeolocation.ts      # watchPosition + GeoState
│   │   ├── useActiveTribe.ts      # activeTribeId + confirmedTribeId (localStorage)
│   │   └── useTribeIdentity.ts    # userId + tribeName + avatarSeed (localStorage)
│   ├── utils/
│   │   ├── geo.ts                 # Haversine formula + GEOFENCE_RADIUS_M
│   │   ├── tribeNames.ts          # Random name generator
│   │   └── avatar.ts              # Deterministic DJB2-hashed SVG avatar
│   └── lib/
│       └── MockConvexProvider.tsx # In-memory mock for dev without Convex
├── convex/
│   ├── schema.ts                  # tribes + messages tables
│   ├── tribes.ts                  # list, create, deleteOldTribes
│   ├── messages.ts                # list, listThread, send, toggleLike,
│   │                              # generateUploadUrl, deleteOldMessages
│   └── crons.ts                   # purge messages (5 min), purge tribes (1 hr)
├── docs/
│   └── diagrams/                  # PlantUML sources + generated PNGs
├── tests/
│   └── e2e/
│       └── tribe.spec.ts          # Playwright E2E tests
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint + type-check + build + E2E on PR
│       └── deploy.yml             # Deploy to Vercel on main push
├── public/
│   └── ads.txt
├── playwright.config.ts
├── tailwind.config.js
├── vercel.json
└── .env.example
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript check without building |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright interactive UI mode |
| `npm run convex:dev` | Start Convex dev server |
| `npm run convex:deploy` | Deploy Convex functions |

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for a full breakdown of data flow, geofence logic, message lifecycle, component tree, and CI/CD pipeline — with PlantUML diagrams.

---

## License

MIT
