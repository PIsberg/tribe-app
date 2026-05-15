# Load-test harness

Synthetic load generator for the Convex backend. Targets the dev deployment in `.env.local` by default — **never point this at production unless you are doing a planned baseline run**.

## Quick start

```
npm run loadtest:burst       # 30 users, 1 tribe, 30s — write throughput
npm run loadtest:fanout      # 100 subscribers, 5 writers — push latency
npm run loadtest:mixed       # 100 users across 10 tribes, 60s — realistic mix
```

Or fully custom:

```
node scripts/loadtest.mjs --scenario=fanout --users=200 --writers=10 --duration=60 --url=https://...
```

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--scenario` | `chat-burst` | `chat-burst`, `fanout`, or `mixed` |
| `--users` | 20 | Virtual users (subscribers in `fanout`) |
| `--writers` | `max(1, users/10)` | Writer count for `fanout` |
| `--tribes` | 1 | Tribes to spread `mixed` users across |
| `--duration` | 30 | Test duration in seconds |
| `--ramp` | 5 | Ramp-up window in seconds |
| `--msgRate` | 10 | Messages/min per writer |
| `--likeRate` | 20 | Likes/min per writer |
| `--url` | from `.env.local` | Convex deployment URL |

## What each scenario measures

- **`chat-burst`** — pure write throughput. All users in one tribe sending messages and likes. Surfaces send-mutation latency, rate-limit thresholds, and tx-budget burn from any cascading reads inside `send`.
- **`fanout`** — reactive push latency. Many WebSocket subscribers on one tribe, a small number of writers. Each subscriber records when a new message first appears; the harness compares against the writer's send time. This is the scenario most relevant to the §3.1 risk in `SCALING_ANALYSIS.md`.
- **`mixed`** — realistic distribution. Users spread across multiple tribes, sending/liking/typing at organic rates. Surfaces cross-query invalidation (e.g., `lastMessageAt` patches).

## Output

Each run prints a table with per-mutation p50/p95/p99 latency, error rates, and top error messages. Use this as the input to PR4 baseline analysis.

## Safety

- All synthetic users get IDs prefixed `loadtest-`, `u`, `w`, `mu` — easy to identify and never collide with real users.
- All test tribes are created at lat ~-30, lng ~-20 (mid-Atlantic ocean) — well outside any populated geofence cell, so they won't pollute `listNearby` for real users.
- Test tribes auto-expire via the existing 24 h TTL cron.
- Messages auto-expire via the existing 30-min TTL cron.
- No cleanup is needed.
