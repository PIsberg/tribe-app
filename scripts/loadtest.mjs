#!/usr/bin/env node
// Load-test harness for the Convex backend.
//
// Usage:
//   node scripts/loadtest.mjs --scenario=chat-burst --users=50 --duration=30
//   node scripts/loadtest.mjs --scenario=fanout --users=200 --duration=30 --writers=5
//   node scripts/loadtest.mjs --scenario=mixed --users=100 --tribes=10 --duration=60
//
// Scenarios:
//   chat-burst  — N users hammer a single tribe with messages + likes (HTTP).
//                 Measures write throughput and rate-limit headroom.
//   fanout      — N WS subscribers + K writers in one tribe.
//                 Measures reactive push latency (send → receive).
//   mixed       — N users spread across M tribes, realistic mix of
//                 sends/likes/joins/typing.
//
// All scenarios respect rate limits per (userId, tribeId). The harness
// generates synthetic userIds, so it never collides with real users.
//
// Reads CONVEX_URL from --url or env var VITE_CONVEX_URL.

import { ConvexHttpClient, ConvexClient } from "convex/browser";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [[m[1], m[2] ?? "true"]] : [];
  })
);

const SCENARIO = args.scenario ?? "chat-burst";
const USERS = Number(args.users ?? 20);
const WRITERS = Number(args.writers ?? Math.max(1, Math.floor(USERS / 10)));
const TRIBES = Number(args.tribes ?? 1);
const DURATION_S = Number(args.duration ?? 30);
const RAMP_S = Number(args.ramp ?? 5);
const URL = args.url ?? loadEnvUrl();
const MSG_RATE_PER_MIN = Number(args.msgRate ?? 10); // per writer
const LIKE_RATE_PER_MIN = Number(args.likeRate ?? 20);

if (!URL) {
  console.error("Missing Convex URL. Pass --url=... or set VITE_CONVEX_URL in .env.local");
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadEnvUrl() {
  if (process.env.VITE_CONVEX_URL) return process.env.VITE_CONVEX_URL;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const envPath = resolve(here, "..", ".env.local");
    const txt = readFileSync(envPath, "utf8");
    const m = txt.match(/^VITE_CONVEX_URL=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function randId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

class Stats {
  constructor(label) {
    this.label = label;
    this.samples = [];
    this.errors = 0;
    this.errorsByCode = new Map();
  }
  observe(ms) { this.samples.push(ms); }
  error(msg) {
    this.errors++;
    const key = String(msg).slice(0, 300);
    this.errorsByCode.set(key, (this.errorsByCode.get(key) ?? 0) + 1);
  }
  summary() {
    const s = [...this.samples].sort((a, b) => a - b);
    const pct = (p) => s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0;
    return {
      label: this.label,
      n: s.length,
      errors: this.errors,
      errorRate: s.length + this.errors > 0 ? this.errors / (s.length + this.errors) : 0,
      mean: s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0,
      p50: pct(0.5),
      p95: pct(0.95),
      p99: pct(0.99),
      max: s.at(-1) ?? 0,
      topErrors: [...this.errorsByCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }
}

async function timed(stats, fn) {
  const t0 = Date.now();
  try {
    const out = await fn();
    stats.observe(Date.now() - t0);
    return out;
  } catch (e) {
    stats.error(e?.data ?? e?.message ?? e);
    return null;
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function printReport(scenario, stats, extras) {
  console.log("\n" + "─".repeat(70));
  console.log(`SCENARIO: ${scenario}`);
  console.log("─".repeat(70));
  console.log(
    `  ${"label".padEnd(18)} ${"n".padStart(7)} ${"err%".padStart(6)} ${"mean".padStart(7)} ${"p50".padStart(6)} ${"p95".padStart(6)} ${"p99".padStart(6)} ${"max".padStart(6)}`
  );
  for (const s of stats) {
    const r = s.summary();
    console.log(
      `  ${r.label.padEnd(18)} ${String(r.n).padStart(7)} ${(r.errorRate * 100).toFixed(1).padStart(5)}% ${r.mean.toFixed(0).padStart(6)}ms ${String(r.p50).padStart(5)}ms ${String(r.p95).padStart(5)}ms ${String(r.p99).padStart(5)}ms ${String(r.max).padStart(5)}ms`
    );
    if (r.topErrors.length) {
      for (const [msg, count] of r.topErrors) {
        console.log(`      ↳ err×${count}: ${msg}`);
      }
    }
  }
  if (extras) {
    console.log();
    for (const [k, v] of Object.entries(extras)) console.log(`  ${k}: ${v}`);
  }
  console.log("─".repeat(70) + "\n");
}

// ─── Tribe setup ──────────────────────────────────────────────────────────────

// Use a unique anchor point per run so we never collide with real fires.
// Mid-Atlantic ocean — no one is there.
function anchorPoint() {
  return {
    lat: -30 + Math.random() * 0.01,
    lng: -20 + Math.random() * 0.01,
  };
}

async function createTribe(http, name) {
  const { lat, lng } = anchorPoint();
  const tribeId = await http.mutation("tribes:create", {
    name,
    creatorId: randId("loadtest-creator"),
    lat,
    lng,
  });
  return { tribeId, lat, lng };
}

// ─── Scenario: chat-burst ─────────────────────────────────────────────────────
// N users in one tribe, each sending messages at MSG_RATE_PER_MIN.
// Pure write pressure. HTTP only.

async function chatBurst() {
  const http = new ConvexHttpClient(URL);
  const tribe = await createTribe(http, `LT-burst-${Date.now()}`);
  console.log(`[chat-burst] tribe=${tribe.tribeId}, users=${USERS}, duration=${DURATION_S}s`);

  const sendStats = new Stats("send");
  const likeStats = new Stats("toggleLike");
  const joinStats = new Stats("joinTribe");

  const stopAt = Date.now() + DURATION_S * 1000;
  const messageIds = [];
  let sent = 0;

  const users = Array.from({ length: USERS }, (_, i) => ({
    userId: randId(`u${i}`),
    name: `loadtest_${i}`,
    avatarSeed: `seed-${i}`,
  }));

  // Stagger user start across ramp window.
  await Promise.all(users.map(async (u, i) => {
    await sleep((i / USERS) * RAMP_S * 1000);

    // Join the tribe (creates member row).
    await timed(joinStats, () =>
      http.mutation("members:joinTribe", {
        tribeId: tribe.tribeId,
        userId: u.userId,
        userName: u.name,
        avatarSeed: u.avatarSeed,
      })
    );

    const intervalMs = (60_000 / MSG_RATE_PER_MIN);
    while (Date.now() < stopAt) {
      // Skip random jitter so we don't all-hit at once.
      await sleep(intervalMs * (0.5 + Math.random()));
      if (Date.now() >= stopAt) break;
      const id = await timed(sendStats, () =>
        http.mutation("messages:send", {
          tribeId: tribe.tribeId,
          text: `msg ${++sent} from ${u.name}`,
          author: u.name,
          authorId: u.userId,
          avatarSeed: u.avatarSeed,
        })
      );
      if (id) messageIds.push(id);
      // 30% chance to like a random recent message
      if (messageIds.length > 0 && Math.random() < 0.3) {
        const target = messageIds[Math.floor(Math.random() * Math.min(messageIds.length, 50))];
        await timed(likeStats, () =>
          http.mutation("messages:toggleLike", { messageId: target, userId: u.userId })
        );
      }
    }
  }));

  printReport("chat-burst", [sendStats, likeStats, joinStats], {
    "messages sent": sent,
    "throughput msg/s": (sent / DURATION_S).toFixed(2),
    "tribeId": tribe.tribeId,
  });
}

// ─── Scenario: fanout ─────────────────────────────────────────────────────────
// N WebSocket subscribers + WRITERS HTTP writers in one tribe.
// Measures end-to-end push latency: send → onUpdate fires on subscriber.

async function fanout() {
  const http = new ConvexHttpClient(URL);
  const tribe = await createTribe(http, `LT-fanout-${Date.now()}`);
  console.log(`[fanout] tribe=${tribe.tribeId}, subscribers=${USERS}, writers=${WRITERS}, duration=${DURATION_S}s`);

  const sendStats = new Stats("send");
  const pushStats = new Stats("push-latency");

  // Track messages by text → first-seen timestamp on each subscriber.
  // The "push latency" is when the FASTEST subscriber sees the new doc.
  // (Convex pushes the same patch to all subscribers near-simultaneously, so first-seen
  //  closely approximates server→client time; spread between subscribers is the fan-out cost.)
  const inflight = new Map(); // text → sendTime
  const seenPerClient = []; // Set<string>[] — texts each subscriber has reported on

  // Spin up subscribers.
  const subs = [];
  for (let i = 0; i < USERS; i++) {
    const ws = new ConvexClient(URL);
    const seen = new Set();
    seenPerClient.push(seen);
    subs.push(ws);
    ws.onUpdate(
      "messages:list",
      { tribeId: tribe.tribeId },
      (msgs) => {
        for (const m of msgs) {
          if (seen.has(m.text)) continue;
          seen.add(m.text);
          const sent = inflight.get(m.text);
          if (sent) pushStats.observe(Date.now() - sent);
        }
      },
      (err) => pushStats.error(err?.message ?? err)
    );
    // Spread connection establishment.
    if (i % 25 === 24) await sleep(100);
  }
  console.log(`[fanout] ${USERS} subscribers connected. Waiting 3s for stabilisation…`);
  await sleep(3000);

  // Writers send messages at MSG_RATE_PER_MIN each.
  const stopAt = Date.now() + DURATION_S * 1000;
  const writers = Array.from({ length: WRITERS }, (_, i) => ({
    userId: randId(`w${i}`),
    name: `writer_${i}`,
    avatarSeed: `wseed-${i}`,
  }));

  // Pre-join writers.
  for (const w of writers) {
    await http.mutation("members:joinTribe", {
      tribeId: tribe.tribeId,
      userId: w.userId,
      userName: w.name,
      avatarSeed: w.avatarSeed,
    });
  }

  let sent = 0;
  await Promise.all(writers.map(async (w, i) => {
    await sleep((i / WRITERS) * RAMP_S * 1000);
    const intervalMs = 60_000 / MSG_RATE_PER_MIN;
    while (Date.now() < stopAt) {
      await sleep(intervalMs * (0.5 + Math.random()));
      if (Date.now() >= stopAt) break;
      const text = `fanout-${++sent}-${Math.random().toString(36).slice(2, 8)}`;
      inflight.set(text, Date.now());
      await timed(sendStats, () =>
        http.mutation("messages:send", {
          tribeId: tribe.tribeId,
          text,
          author: w.name,
          authorId: w.userId,
          avatarSeed: w.avatarSeed,
        })
      );
    }
  }));

  // Drain — wait up to 5s for late pushes.
  await sleep(5000);
  await Promise.all(subs.map((s) => s.close()));

  printReport("fanout", [sendStats, pushStats], {
    "subscribers": USERS,
    "writers": WRITERS,
    "messages sent": sent,
    "tribeId": tribe.tribeId,
  });
}

// ─── Scenario: mixed ──────────────────────────────────────────────────────────
// N users spread across M tribes. Mix of joins, sends, likes, typing.

async function mixed() {
  const http = new ConvexHttpClient(URL);
  const tribes = [];
  for (let i = 0; i < TRIBES; i++) {
    tribes.push(await createTribe(http, `LT-mixed-${Date.now()}-${i}`));
  }
  console.log(`[mixed] tribes=${TRIBES}, users=${USERS}, duration=${DURATION_S}s`);

  const sendStats = new Stats("send");
  const likeStats = new Stats("toggleLike");
  const joinStats = new Stats("joinTribe");
  const typingStats = new Stats("setTyping");

  const stopAt = Date.now() + DURATION_S * 1000;
  const messagesByTribe = new Map(tribes.map((t) => [t.tribeId, []]));
  let sent = 0;

  await Promise.all(Array.from({ length: USERS }, async (_, i) => {
    await sleep((i / USERS) * RAMP_S * 1000);
    const u = {
      userId: randId(`mu${i}`),
      name: `mixed_${i}`,
      avatarSeed: `mseed-${i}`,
    };
    const t = tribes[i % tribes.length];

    await timed(joinStats, () =>
      http.mutation("members:joinTribe", {
        tribeId: t.tribeId,
        userId: u.userId,
        userName: u.name,
        avatarSeed: u.avatarSeed,
      })
    );

    while (Date.now() < stopAt) {
      // Per-iteration jitter ≈ one action every 2–5 seconds.
      await sleep(2000 + Math.random() * 3000);
      if (Date.now() >= stopAt) break;
      const dice = Math.random();
      if (dice < 0.6) {
        await timed(typingStats, () =>
          http.mutation("typing:setTyping", {
            tribeId: t.tribeId,
            userId: u.userId,
            userName: u.name,
            isTyping: true,
          })
        );
        const id = await timed(sendStats, () =>
          http.mutation("messages:send", {
            tribeId: t.tribeId,
            text: `mixed msg ${++sent}`,
            author: u.name,
            authorId: u.userId,
            avatarSeed: u.avatarSeed,
          })
        );
        if (id) messagesByTribe.get(t.tribeId).push(id);
        await timed(typingStats, () =>
          http.mutation("typing:setTyping", {
            tribeId: t.tribeId,
            userId: u.userId,
            userName: u.name,
            isTyping: false,
          })
        );
      } else if (dice < 0.9) {
        const ids = messagesByTribe.get(t.tribeId);
        if (ids.length) {
          const target = ids[Math.floor(Math.random() * ids.length)];
          await timed(likeStats, () =>
            http.mutation("messages:toggleLike", { messageId: target, userId: u.userId })
          );
        }
      }
      // else: idle tick (simulates lurking user)
    }
  }));

  printReport("mixed", [sendStats, likeStats, joinStats, typingStats], {
    "tribes": TRIBES,
    "users": USERS,
    "messages sent": sent,
    "throughput msg/s": (sent / DURATION_S).toFixed(2),
  });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const SCENARIOS = { "chat-burst": chatBurst, fanout, mixed };
const fn = SCENARIOS[SCENARIO];
if (!fn) {
  console.error(`Unknown scenario: ${SCENARIO}. Valid: ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(1);
}

console.log(`URL: ${URL}`);
const t0 = Date.now();
try {
  await fn();
  console.log(`Total wall time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(0);
} catch (e) {
  console.error("Load test failed:", e);
  process.exit(1);
}
