# PR5 — Push-latency curve & corrected baseline

Branch: `investigation/push-latency-curve`
Date: 2026-05-15
Target: dev deployment (`impressive-seahorse-423.eu-west-1.convex.cloud`)

## What changed since PR4

Two harness bugs were inflating the PR4 baseline numbers:

1. **Sub-only processes were exiting after 3s of stabilisation** because the writer-loop was empty. The 3-process fanout (300 total subs) actually had only ~100 alive subs by the time messages started flowing. The "100ms p50 with 300 subs" reading was misleading — those other 200 subscribers had already disconnected.
2. **A single `ConvexHttpClient` was shared across all virtual users** in chat-burst and mixed. Node's keep-alive pool tops out at ~6 connections per host, so 40 concurrent users serialised behind 6 in-flight requests. The observed p50 was queue depth × per-mutation latency, not backend latency.

Both fixed in `e0b3de8` and `976f93d`. The numbers below are taken with both fixes in place. **Disregard PR4_BASELINE.md numbers — they were harness-bound.**

## Per-scenario corrected baseline

### chat-burst, 40 users, msgRate=12/min, 45s

| mutation | n | p50 | p95 | p99 | max |
|---|---|---|---|---|---|
| `send` | 307 | **90ms** | 108ms | 134ms | 185ms |
| `toggleLike` | 99 | 83ms | 98ms | 144ms | 144ms |
| `joinTribe` | 40 | 94ms | 131ms | 200ms | 200ms |

Throughput 6.8 msg/s, 0 errors. The send mutation's hot path (rate-limit + geofence + member lookup + insert + throttled tribe touch) is comfortably under 100ms p50 even at 40-user concurrency.

### mixed multi-proc, 160 users across 12 tribes, 45s

| mutation | n | p50 | p95(worst proc) | p99(worst proc) |
|---|---|---|---|---|
| `send` | 1,059 | **91ms** | 181ms | 283ms |
| `toggleLike` | 516 | 83ms | 98ms | 123ms |
| `joinTribe` | 160 | 94ms | 199ms | 229ms |
| `setTyping` | 2,118 | 81ms | 92ms | 121ms |

160 users distributed across many fires is the realistic "healthy traffic" shape. Backend is not stressed.

### Fanout subscriber-count sweep (the real PR5 finding)

| Total subs | Config | p50 | p95 | p99 | max |
|---|---|---|---|---|---|
| 100 | 1 proc × 100 | **119ms** | 175ms | 193ms | 252ms |
| 200 | 2 procs × 100 | **339ms** | 1,013ms | 1,084ms | 1,312ms |
| 300 | 3 procs × 100 | **566ms** | 1,382ms | 1,542ms | 1,606ms |
| 500 | 5 procs × 100 | **730ms** | 2,030ms | 2,395ms | 2,604ms |

Send mutation latency stayed flat across all four runs (~90–95ms p50) — write path is fine. The growing numbers above are **purely push fan-out cost** from server to subscribers.

#### Curve shape

p50 grows approximately linearly with subscriber count: ~1.5–2.0 ms per subscriber above the 100-sub baseline. Extrapolating:

- 1,000 subs ≈ 1.5s p50, 4s+ p99
- 2,000 subs ≈ 3s p50

The tail (p95/p99) widens much faster than the median — by 500 subs, 5% of pushes take >2s.

This is **fundamental Convex reactive-fan-out cost**. The Risk #1 fix dramatically improved per-push work (no more 10k-reaction scan per subscriber), but each invalidation still ships an update to every subscriber, and at high subscriber counts that fan-out itself becomes the dominant cost.

## Revised verdict

Earlier I wrote: *"yes with measured headroom for the realistic scenarios."* That stands for fires up to ~200 subscribers (p50 < 400ms). Beyond that, the UX degrades visibly:

| Fire size | p50 push | Chat UX |
|---|---|---|
| ≤ 100 subs | ~120ms | Snappy |
| 200 subs | ~340ms | Just-noticeable lag |
| 300 subs | ~570ms | Noticeable lag |
| 500 subs | ~730ms | Laggy |
| 1,000 subs (extrap.) | ~1.5s | Bad |

The 1.5 km geofence is doing real scaling work — without it any urban fire could trivially exceed 1,000 subs. With it, a typical fire stays under 50; only events (concert, stadium, downtown bar district on a Friday) reach the danger zone.

## What we are NOT going to do

Spent time considering and ruling out:

- **Payload-shape optimisation** (smaller message docs, lazy imageUrl). Convex sends deltas, not full snapshots, on incremental updates. Per-push bytes are already tiny (~one message). The bottleneck is per-subscriber dispatch overhead, not payload size.
- **Reducing `messages.list` cap from 200 to 100**. Same reason — the cap affects the initial snapshot only, not the incremental updates that drive push latency.
- **Trying to "be cleverer" with reactive subscriptions**. The curve is fundamental to how Convex ships updates to subscribers. We can't optimise our way past it; we can only avoid hitting it by capping fire size.

## What we SHOULD do (app-level mitigations)

These aren't load-test fixes — they're product changes that decide how the app behaves when a fire grows past the comfortable subscriber count.

1. **Auto-shard hot fires.** When a fire exceeds, say, 150 active subscribers, spawn an adjacent "overflow" fire in the same geohash cell. The product mental model — "campfires you gather around" — already supports the idea that there might be multiple fires in one area.
2. **Subscriber decay.** Idle clients (tab in background, no input for N minutes) should drop the reactive subscription and re-poll on focus. Convex doesn't auto-do this; we'd add a presence-driven `useQuery(... "skip")` toggle.
3. **Soft cap with admission control.** Above N subs, new clients see "fire is at capacity, try the nearby fire" and join an adjacent one. The geofence already supports this — there'd just be more visible fires per area.
4. **Telemetry on push-latency.** Until we ship one of the above, we should at least know which fire is melting. Easy first version: client-side measure of "time between my send and my own onUpdate reflecting it" sampled to a Convex action that aggregates by tribeId.

## Practical scaling limit summary

The system **comfortably** supports:
- A few thousand registered users
- Many fires (limited only by Convex storage)
- Up to ~150 simultaneous subscribers per fire with snappy UX
- Send throughput of dozens of msg/s per fire

The system **starts to degrade** when:
- A single fire crosses ~200 active subscribers
- A single client subscribes to 10+ fires simultaneously (each adds proportional push cost)

The system **breaks UX** when:
- A single fire exceeds ~500 active subscribers

The 1.5 km geofence is the single biggest scaling mitigation in the design. **Do not widen it without first implementing one of the four app-level mitigations above.**

## Harness notes for future runs

- Always use multi-process for any test >100 users. Single-process saturates Node's event loop for WebSockets and the HTTP connection pool for mutations.
- `scripts/fanout-multiproc.mjs` — subscriber sweep tool. Writer process advertises its tribeId; sub-only processes consume it.
- `scripts/mixed-multiproc.mjs` — realistic mixed traffic.
- `--json=true` on `loadtest.mjs` emits a single `REPORT_JSON:{...}` line for programmatic capture. Useful for CI regression checks.
- Per-test cost on dev: each subscriber-sweep run consumes ~25–40k function calls on the Convex side. Don't loop these.
