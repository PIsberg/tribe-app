# tribe 🔥

> A hyper-local, ephemeral campfire chat. Only for people within 300 meters.

**tribe** is a real-time, geofenced mobile web app built with React, Tailwind CSS, Framer Motion, and Convex. Messages are ephemeral — they glow orange when fresh, fade to ash after 5 minutes, and self-destruct after 30.

---

## Features

- **Geofenced access** — Only users within 300m of the target coordinate enter the Inner Circle
- **Ephemeral messages** — Auto-deleted after 30 minutes by a Convex cron job
- **Message heat** — Fresh messages glow orange, older messages fade to charcoal
- **No sign-up** — The app assigns you a random Tribe Name (e.g. *Neon Wolf*) and a generative SVG avatar
- **Lost the Signal** — Walk out of the geofence and you're immediately ejected with an animation
- **AdSense ready** — Every 7th message is a styled "Signal from the Outside" ad unit
- **Cyber-Primal aesthetic** — Deep forest green (#051a05) + campfire orange (#ff4500), monospaced fonts, fire flicker animations

---

## Tech Stack

| Layer      | Technology                    |
|------------|-------------------------------|
| Frontend   | React 19 + Vite + TypeScript  |
| Styling    | Tailwind CSS v3               |
| Animation  | Framer Motion                 |
| Backend    | Convex (real-time, serverless)|
| Deployment | Vercel                        |
| Tests      | Playwright (E2E)              |
| CI/CD      | GitHub Actions                |

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

# Set to your real event coordinates
VITE_TRIBE_LAT=51.5074
VITE_TRIBE_LNG=-0.1278

# Optional: your Google AdSense publisher ID
VITE_ADSENSE_PUB_ID=ca-pub-XXXXXXXXXXXXXXXX
```

> **Dev without Convex:** Skip `VITE_CONVEX_URL` and the app runs in mock mode with local in-memory messages. Everything works except cross-device real-time sync.

### 3. Set up Convex (optional but recommended for real-time)

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

Open `http://localhost:5173`. Since you're likely not at the tribe coordinates, you'll see the "Walking to the Tribe..." locked state. To bypass this in development, use your browser's DevTools geolocation override to spoof coordinates matching `VITE_TRIBE_LAT/LNG`.

---

## Running Tests

### E2E tests (Playwright)

```bash
# Install browsers (first time only)
npx playwright install chromium

# Run all E2E tests
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Run a specific test file
npx playwright test tests/e2e/tribe.spec.ts

# Show the HTML report
npx playwright show-report
```

> Tests automatically mock geolocation — no need to be physically at the coordinates.

---

## Deployment

### Vercel (recommended)

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link`
3. Add secrets in Vercel dashboard:
   - `VITE_CONVEX_URL`
   - `VITE_TRIBE_LAT` / `VITE_TRIBE_LNG`
   - `VITE_ADSENSE_PUB_ID`
4. Deploy with Convex sync:

```bash
npx convex deploy --cmd 'npm run build'
vercel --prod
```

Or push to `main` — the GitHub Actions workflow handles it automatically if you add these GitHub secrets:
- `VERCEL_TOKEN`
- `CONVEX_DEPLOY_KEY` (from Convex dashboard → Settings → Deploy Keys)

### AdSense setup

1. Replace `pub-XXXXXXXXXXXXXXXX` in `public/ads.txt` with your publisher ID
2. Set `VITE_ADSENSE_PUB_ID` in your environment
3. Submit the site to AdSense for review

> The Tribe Manifesto section at the bottom provides enough article-style text to satisfy the AdSense content policy bot.

---

## Changing the Tribe Location

Update `VITE_TRIBE_LAT` and `VITE_TRIBE_LNG` to any coordinates. The 300m radius is set in `src/utils/geo.ts`:

```typescript
export const GEOFENCE_RADIUS_M = 300; // metres
```

---

## Project Structure

```
tribe/
├── src/
│   ├── App.tsx                  # Root shell + state machine
│   ├── main.tsx
│   ├── index.css
│   ├── components/
│   │   ├── FireBackground.tsx   # Animated campfire background
│   │   ├── LockedState.tsx      # Out-of-range / permission denied UI
│   │   ├── LostSignal.tsx       # Walk-out ejection animation
│   │   ├── TribeHeader.tsx      # Sticky header with identity chip
│   │   ├── ChatFeed.tsx         # Message list + ad injection
│   │   ├── MessageBubble.tsx    # Message with heat-based styling
│   │   ├── MessageInput.tsx     # Textarea + send button
│   │   ├── Avatar.tsx           # SVG avatar wrapper
│   │   ├── TribeAd.tsx          # AdSense unit (cyber-primal styled)
│   │   ├── AdSenseProvider.tsx  # Lazy AdSense script loader
│   │   └── TribeManifesto.tsx   # SEO content section
│   ├── hooks/
│   │   ├── useGeolocation.ts    # Geolocation API + Haversine check
│   │   └── useTribeIdentity.ts  # localStorage identity
│   ├── utils/
│   │   ├── geo.ts               # Haversine formula + constants
│   │   ├── tribeNames.ts        # Random name generator
│   │   └── avatar.ts            # Deterministic SVG avatar
│   └── lib/
│       └── MockConvexProvider.tsx  # In-memory mock for dev
├── convex/
│   ├── schema.ts                # messages table
│   ├── messages.ts              # list, send, deleteOldMessages
│   └── crons.ts                 # 5-min purge cron
├── tests/
│   └── e2e/
│       └── tribe.spec.ts        # Playwright E2E tests
├── .github/
│   └── workflows/
│       ├── ci.yml               # Lint + build + E2E on PR
│       └── deploy.yml           # Deploy to Vercel on main push
├── public/
│   └── ads.txt                  # AdSense publisher declaration
├── playwright.config.ts
├── tailwind.config.js
├── vercel.json
└── .env.example
```

---

## Scripts

| Command                | Description                          |
|------------------------|--------------------------------------|
| `npm run dev`          | Start dev server at localhost:5173   |
| `npm run build`        | Type-check + production build        |
| `npm run preview`      | Preview production build locally     |
| `npm run lint`         | Run ESLint                           |
| `npm run type-check`   | TypeScript check without building    |
| `npm run test:e2e`     | Run Playwright E2E tests             |
| `npm run test:e2e:ui`  | Playwright interactive UI mode       |
| `npm run convex:dev`   | Start Convex dev server              |
| `npm run convex:deploy`| Deploy Convex functions              |

---

## License

MIT
