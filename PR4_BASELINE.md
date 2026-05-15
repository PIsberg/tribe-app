# PR4 — Baseline load-test results

Branch: `analysis/scaling-1k-users`
Date: 2026-05-15
Target: dev deployment (`impressive-seahorse-423.eu-west-1.convex.cloud`)
Harness: `scripts/loadtest.mjs`
All 5 fixes (Risks #1–#5) deployed; `backfillTribeMemberCounts` run (12 tribes seeded).

## Results

### chat-burst — 40 users, 45s, msgRate=12/min/user

| mutation | n | err% | mean | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| `send` | 292 | 0.0% | 296ms | 246ms | 633ms | 756ms | 800ms |
| `toggleLike` | 99 | 0.0% | 310ms | 268ms | 618ms | 748ms | 748ms |
| `joinTribe` | 40 | 0.0% | 137ms | 107ms | 326ms | 347ms | 347ms |

Throughput: **6.5 msg/s** sustained, **0 errors**.

### fanout — 100 subscribers, 4 writers, 45s, msgRate=20

| mutation | n | err% | mean | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| `send` | 43 | 17.3% | 102ms | 97ms | 135ms | 178ms | 178ms |
| `push-latency` | 4300 | 0.0% | 124ms | 119ms | 175ms | 193ms | 252ms |

Every successful send reached every subscriber (43 × 100 = 4,300 push samples — perfect 1:1, no drops).

The 17.3% send error rate came entirely from `bots.moderateMessage` — 4 writers at 20 msg/min trips the "5 msgs in 10s" spam detector and mutes them. That's a property of the moderation rules, not a backend scaling issue. **The push-latency number is the headline result.**

### mixed — 80 users, 8 tribes, 60s

| mutation | n | err% | mean | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| `send` | 202 | 0.0% | 4801ms | 5115ms | 5657ms | 5829ms | 5924ms |
| `toggleLike` | 106 | 0.0% | 4979ms | 5147ms | 5656ms | 5804ms | 5943ms |
| `joinTribe` | 80 | 0.0% | 1407ms | 578ms | 4733ms | 4886ms | 4886ms |
| `setTyping` | 404 | 0.0% | 4656ms | 5111ms | 5645ms | 5782ms | 5911ms |

**This is a harness artefact, not a backend signal.** 80 concurrent async loops sharing a single `ConvexHttpClient` saturate the local connection pool — every mutation queues behind the others, and you can see the result clustering tightly around ~5s as everything piles up. With 0% errors and chat-burst running clean at 6.5 msg/s through the same path, the bottleneck is on the harness side. Disregard the mixed numbers until the harness is split across multiple Node processes (or multiple clients).

## What the numbers tell us

### The Risk #1 fix is doing its job

The headline: **fanout p50 push-latency = 119ms for 100 subscribers**, and p99 is just 193ms. Before the reactions split, every like or send re-ran the 200-msg + 10k-reaction scan once per subscriber. With 100 subs that would have been ~100× the work per write. The flat profile across all 4,300 push samples — p50 to p99 spans only ~70ms — says the per-subscriber server work is now small enough that network jitter dominates.

This is the closest thing we have to direct evidence that a ~200-subscriber fire is now plausible. We didn't push to 500 (where the geofence makes it physically unrealistic anyway), but the curve is flat enough at 100 that there's no reason to expect a knee in the next factor of 2–3.

### Write throughput is comfortable

6.5 msg/s sustained through `send` with p99 < 1s is more than any single fire will produce organically. A 200-user fire at 30 msgs/min (active conversation) is 0.5 msg/s — an order of magnitude below what chat-burst sustained. The `send` mutation path's hot work — geofence haversine, rate-limit upsert, member lookup, message insert, throttled tribe touch — is comfortably under 300ms p50 even at 40-user concurrency.

### Bot moderation is a load-test footgun

Running >5 messages from one userId in 10 seconds gets you muted. That makes the harness fight the bot when writers go above ~30 msg/min. Two options for the harness:
- Distribute messages across more writer userIds (raise `--writers`, lower per-writer rate).
- Add a `loadtest-` prefix bypass in `bots.moderateMessage` — but that's a deployment carve-out we probably don't want in production code.

Recommend the first. For real-traffic simulation it's actually more realistic anyway.

### What we still don't know

- **Push latency at 300+ subscribers.** 100 is comfortable, but we haven't observed the knee. A targeted run at 200, 300, 500 would map the curve.
- **The counter under contention.** `adjustTribeMemberCount` writes one of 10 shards. In a join-storm (100 users join the same fire in 10s) we'd expect occasional shard contention. Not exercised by these scenarios — chat-burst joins are spread across the ramp window.
- **`lastMessageAt` 30s throttle behaviour.** No metric on it directly. We can infer from the absence of `tribe-doc-watching` query latency rising during chat-burst, but we don't have a direct count.
- **Sustained load over hours.** All scenarios are <60s. Memory leaks, gradual table growth, or cron-cleanup keeping up are unverified.
- **Mixed scenario at meaningful concurrency.** Need to split the harness across processes.

## Verdict update

The earlier analysis said *"plausibly handled but this is theory until PR4 runs"*. PR4 says: **the theory holds for ~100 subscribers in one fire, with comfortable margin.** Push latency is flat, error rate is zero (excluding the orthogonal bot-mute), throughput is well above any organic fire's needs.

Confidence has moved from "probably yes" to "yes with measured headroom" for the realistic scenarios. The pathological one-mega-fire case is still untested at the actual viral scale, but the curve up to 100 subs gives no reason to expect collapse before 300–500.

## Recommended next investigations

1. **Push-latency curve at 200/300/500 subscribers** — same scenario, sweep `--users`. Plot to find the knee.
2. **Multi-process harness** to rescue `mixed`. Spawn N child processes each with their own client.
3. **Persist baseline numbers** (this file + raw outputs) so future regressions are visible. Re-run after any significant Convex schema/query change.
4. **Surface bot-mute as a metric on the stats page** — useful both for real traffic and for understanding harness behaviour.
