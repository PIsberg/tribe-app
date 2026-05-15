# Scaling Analysis — tribe-app at ~1–2K concurrent users with many campfires

Branch: `analysis/scaling-1k-users`
Date: 2026-05-15

## TL;DR

**Verdict: Probably YES for a few thousand *registered* users distributed across many fires; SHAKY for a few thousand *concurrent* users if even one fire goes viral.** Convex auto-scales the edge/runtime, so the failure mode isn't "server falls over" — it's **per-query work × per-user fan-out** turning into runaway tx-budget burn and slow reactivity inside any single hot fire. The geofence (1.5 km message radius) naturally caps fire size, which is the single biggest thing keeping the current design in the green zone.

The recent PR1/PR2 work (sharded counters, hot-doc removal from `lastMessageAt` writes, indexes, rate limits, server-side geofence) addressed most of the *acute* bottlenecks. What remains is a **reactive-query fan-out problem** in `messages.list` and a few `.collect()`/large-`take()` patterns that scale linearly with fire activity.

---

## 1. Architecture recap (relevant to scaling)

- **Backend**: Convex. Reactive queries auto-push updates to every subscribed client whenever any document the query read changes.
- **Data model** (`convex/schema.ts:4`): `tribes`, `messages`, `tribeMembers`, `reactions`, `typing`, `users`, `counters`, `rateLimits` — all properly indexed for primary access patterns.
- **Ephemerality**: messages TTL 30 min, tribes TTL 24 h, typing TTL 4 s (purged every 2 min). Bounds steady-state DB size very well.
- **Geofence**: 1.5 km message radius (`convex/lib/geofence.ts:3`) → a single fire's *physical* user pool is small. Geohash-4 cells (~20 km) are used for `listNearby` discovery.
- **Per-fire subscriptions** (`src/App.tsx:46-48`): each open client subscribes to `messages.list`, `members.list`, and `typing.listTyping` for the active tribe.

## 2. Capacity model

Convex doesn't publish hard QPS numbers, but the practical scaling unit on a paid plan is:

- **Function calls/sec**: high, but each function is billed in "action-seconds" / function-seconds.
- **Per-tx document budget**: a single function can read/write at most a few thousand docs cheaply; beyond ~16k reads it errors.
- **Reactive fan-out**: each invalidated query re-runs **once per subscribed client**. This is the dominant cost at scale.

Back-of-envelope for a 2K-concurrent-user target:

| Scenario | Concurrent users | Fires | Per-fire users | Msgs/min/fire | Notes |
|---|---|---|---|---|---|
| **Healthy** | 2,000 | 200 | ~10 | 5–15 | Long tail; geofence naturally enforces this. Comfortable. |
| **One hot fire** | 2,000 | 100 + 1 viral | 300 in viral | 60+ | **Risk zone.** See §3.1. |
| **Pathological** | 2,000 | 1 mega-fire | 2,000 | 200+ | Will not work — `messages.list` reactive fan-out alone is ~400k function-runs/min. |

The geofence makes scenario 3 nearly impossible (2K users in one 1.5 km radius = a stadium event). **Scenario 2 is the real failure mode**: a dense urban fire (concert, campus, downtown bar district) with 100–500 active users.

## 3. Concrete bottlenecks

### 3.1 `messages.list` reactive fan-out  — **highest risk** ⚠️

`convex/messages.ts:10-46`

- Reads up to 200 messages + `take(10000)` of **all reactions in the tribe** on every run.
- Re-runs for **every subscribed client** in that tribe whenever *any* message *or any reaction* in the tribe changes.
- Cost per fire-minute ≈ `subscribers × (messages_changed + reactions_changed)` invocations, each doing the full 200-msg + reactions scan.

Numbers for a 200-user fire with 30 msgs/min and 60 likes/min:
- ~90 invalidations/min × 200 clients ≈ **18,000 function runs/min**, each scanning ~200 messages and up to 10k reactions.
- The `take(10000)` is a worst-case safety net, but on a busy fire reactions accumulate fast (msgs × likes per msg; with 30-min retention this trends to thousands within an hour).

**Recommendations** (in priority order):
1. **Split reactions into a separate subscription** (`api.reactions.likesForTribe(tribeId)` returning a compact `{messageId: userIds[]}` map). Then `messages.list` only invalidates on message changes. This roughly **halves fan-out and removes the 10k take**.
2. **Cap subscriber count per fire**, or fall back to polling/pagination once a fire exceeds N members (e.g., 100). Probably a product call.
3. Consider denormalizing `likeCount` + `likedByMe` onto messages (computed in the message doc or via a tiny per-message reactions counter) to drop the cross-table read entirely. Bigger refactor.

### 3.2 `members.list` uses `.collect()` — **medium risk**

`convex/members.ts:8-15`

- `.collect()` is unbounded. Membership accumulates as users pass through (current code never removes them, only marks `kicked`/`banned`).
- Also a reactive subscription open on every connected client.
- A long-lived fire (24 h TTL) in a high-traffic area could collect 500–2000 member rows.

**Recommendation**: `.take(500)` + paginate, or split into `activeMembers` (recent `joinedAt` or recent `lastMessageAt`-derived activity) vs full list (admin only). The `joinTribe` path already does `.take(500)` (`convex/members.ts:36`), so callers tolerate a cap.

### 3.3 `tribes.listWithCountsNearby` per-tribe member fetch — **medium risk**

`convex/tribes.ts:86-117`

- For each nearby tribe (up to ~1800 from 9 geohash cells × 200), it fetches up to 500 members.
- 50 nearby fires × 500 members = 25k document reads on every map-view subscription update.
- This subscription re-runs whenever **any tribe in any of the 9 cells** changes (and tribes patch `lastMessageAt` on every message — see §3.4).

**Recommendation**: Use the existing sharded counters pattern for `tribeMemberCount` per tribe (incremented on join, decremented on kick/ban). Read O(1) per tribe. Or limit map view to top-N by `lastMessageAt`.

### 3.4 `lastMessageAt` patch on every message — **medium risk (partly addressed)**

`convex/messages.ts:170`, `convex/bots.ts:179,202,226`

- Every message `send` patches the tribe doc. This invalidates **every query that reads the tribe doc**, including `listNearby`, `listWithCountsNearby`, `getById`, the `geoGate` distance check, etc.
- For 2K users on the home/map view, each message in any nearby fire fan-outs an invalidation to many of them.

**Recommendation**: Either (a) move `lastMessageAt` to a separate small "tribe activity" doc that the map view reads but the in-fire UI doesn't, or (b) debounce — only patch if last update was >N seconds ago. The memory notes that PR1 removed hot-doc churn, but `lastMessageAt` is still a hot-doc write.

### 3.5 Rate limit storage growth — **low risk**

`convex/lib/rateLimit.ts` + `rateLimits` table — no purge cron. At 2K users × ~5 distinct keys × 1440 windows/day = ~14M rows/day if never cleaned.

**Recommendation**: Add a cron that deletes `rateLimits` rows with `windowStart < now - 2*windowMs`. Trivial fix; should be in PR2 follow-up.

### 3.6 Stats page (`convex/stats.ts:9`) — **low risk, but expensive**

- Reads up to 5,000 recent messages, all typing rows, all active tribes, plus members for top 5.
- Single subscriber (admin/stats viewer) so fan-out is fine, but each refresh is a heavy query.
- Acceptable for now; consider caching or sharded aggregates if Stats becomes public.

### 3.7 Bot moderation read-on-every-send — **low risk**

`convex/bots.ts:70` scans 100 recent messages on every top-level send for spam detection. Cost ≈ messages/min × 100 reads = ~3k reads/min per active fire. Fine.

## 4. What's already good

- **Indexes**: every hot query has a covering index. Confirmed.
- **Sharded counters** (`convex/metrics.ts:7`): 10 shards prevents counter doc contention.
- **Self-rescheduling cleanup crons** (`messages.deleteOldMessages`, `tribes.deleteOldTribes`, `messages.deleteByAuthor`): bounded per-tx, can drain backlogs without blowing tx budget.
- **Rate limits on writes**: send (30/min), like (60/min), join (10/min), typing (60/min), upload (5/min). Solid baseline.
- **Server-side geofence on send** (`convex/messages.ts:124`): client can't bypass.
- **Cursor-based message pagination**: `take(200)` is the cap; older messages auto-expire so unbounded scroll isn't a concern.
- **Bulk reaction fetch** in `messages.list`: avoids N+1 per message (good — but see §3.1 about the trade-off).
- **Geohash-prefix spatial index** for nearby fires: O(cells) instead of full-scan.

## 5. Missing pieces for confident 2K-user launch

1. **Load test harness** — memory says PR3 is planned but not landed. Without it, all of the above is theory. The single most valuable next step is to write the harness and find the actual breaking point on a Convex preview deployment.
2. **Observability** — no metrics on function-seconds/tx or per-fire subscriber count. Hard to know which fire is melting before it does.
3. **Admission control** — no mechanism to cap subscribers per fire, kick idle clients, or back off the map view when too many fires are visible.

## 6. Recommended next-PR ordering

1. **`messages.list` reactivity split** (§3.1) — biggest bang for buck.
2. **`rateLimits` GC cron** (§3.5) — 5 lines, prevents slow storage bloat.
3. **`lastMessageAt` debounce or separate doc** (§3.4) — removes a chunk of cross-query invalidation.
4. **Member-count sharded counter** (§3.3) — kills the per-tribe member fetch on the map.
5. **`members.list` bounded** (§3.2) — defensive.
6. **Land the load-test harness (PR3)** and measure before doing more guessing.

## 7. Bottom line for the "couple thousand users with campfires quite rapidly" question

- If "rapidly" means **gradual organic growth to 2K registered users with peak ~500 concurrent across many fires** — the current design will hold, especially after items 1–4 above.
- If "rapidly" means **a single launch event that spikes 500+ concurrent users into one geographic area** — expect degraded reactivity (slow message arrival, stale typing indicators) due to §3.1 fan-out. Will likely still function, but UX will suffer until item 1 is shipped.
- **The geofence is doing most of the heavy lifting on scaling.** Don't widen the 1.5 km radius without re-running this analysis.
