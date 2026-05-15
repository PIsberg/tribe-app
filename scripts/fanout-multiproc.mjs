#!/usr/bin/env node
// Multi-process fanout experiment.
//
// Spawns N worker processes that all subscribe to the SAME tribe. One worker
// is the writer (one process does the writes); the others are subscribe-only.
// Reports each worker's push-latency summary so we can disambiguate
// client-side Node-event-loop saturation from server-side per-write fan-out
// cost.
//
// Usage:
//   node scripts/fanout-multiproc.mjs --procs=3 --subsPerProc=100 --duration=30
//
// If 3 procs × 100 subs each looks like the single-process 100-sub baseline,
// the bottleneck at higher concurrency was client-side. If it looks like the
// single-process 300-sub run, it's server-side fan-out work.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [[m[1], m[2] ?? "true"]] : [];
  })
);

const PROCS = Number(args.procs ?? 3);
const SUBS_PER_PROC = Number(args.subsPerProc ?? 100);
const DURATION_S = Number(args.duration ?? 30);
const WRITERS = Number(args.writers ?? 8);
const MSG_RATE = Number(args.msgRate ?? 10);

const here = dirname(fileURLToPath(import.meta.url));
const harness = resolve(here, "loadtest.mjs");

function runChild(extraArgs, captureTribeId = false) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(process.execPath, [harness, ...extraArgs], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let buf = "";
    let tribeId = null;
    let report = null;
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      for (;;) {
        const i = buf.indexOf("\n");
        if (i < 0) break;
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (captureTribeId && line.startsWith("TRIBE_ID:")) {
          tribeId = line.slice("TRIBE_ID:".length);
        } else if (line.startsWith("REPORT_JSON:")) {
          report = JSON.parse(line.slice("REPORT_JSON:".length));
        }
      }
    });
    child.on("exit", (code) => {
      if (code === 0) resolveP({ tribeId, report });
      else rejectP(new Error(`child exited ${code}`));
    });
    child.on("error", rejectP);
    if (captureTribeId) {
      // Need tribeId before the rest can start — poll buffer briefly.
      const interval = setInterval(() => {
        if (tribeId) {
          clearInterval(interval);
          resolveP._tribeReady?.(tribeId);
        }
      }, 50);
      resolveP._tribeReady = null;
    }
  });
}

// Two-phase: spawn writer process first, capture the tribe ID it creates,
// then spawn the subscriber-only processes pointing at the same tribe.

const baseArgs = (extra) => [
  `--scenario=fanout`,
  `--duration=${DURATION_S + 5}`, // give subs a head start
  `--ramp=3`,
  `--json=true`,
  ...extra,
];

console.log(`[mp] spawning writer process: subs=${SUBS_PER_PROC}, writers=${WRITERS}, msgRate=${MSG_RATE}, duration=${DURATION_S}s`);

// Writer process — also has SUBS_PER_PROC subscribers and creates the tribe.
const writerArgs = baseArgs([
  `--users=${SUBS_PER_PROC}`,
  `--writers=${WRITERS}`,
  `--msgRate=${MSG_RATE}`,
  `--emitTribeId=true`,
]);

const writer = spawn(process.execPath, [harness, ...writerArgs], {
  stdio: ["ignore", "pipe", "inherit"],
});

let writerBuf = "";
let tribeId = null;
const writerReportP = new Promise((res, rej) => {
  let report = null;
  writer.stdout.on("data", (chunk) => {
    writerBuf += chunk.toString();
    for (;;) {
      const i = writerBuf.indexOf("\n");
      if (i < 0) break;
      const line = writerBuf.slice(0, i);
      writerBuf = writerBuf.slice(i + 1);
      if (line.startsWith("TRIBE_ID:")) {
        tribeId = line.slice("TRIBE_ID:".length);
        console.log(`[mp] writer tribe=${tribeId}`);
      } else if (line.startsWith("REPORT_JSON:")) {
        report = JSON.parse(line.slice("REPORT_JSON:".length));
      }
    }
  });
  writer.on("exit", (code) => {
    if (code === 0) res({ name: "writer", report });
    else rej(new Error(`writer exited ${code}`));
  });
  writer.on("error", rej);
});

// Wait for tribeId.
await new Promise((res) => {
  const t = setInterval(() => {
    if (tribeId) { clearInterval(t); res(); }
  }, 50);
  setTimeout(() => { clearInterval(t); res(); }, 30_000);
});
if (!tribeId) {
  console.error("[mp] timed out waiting for writer to emit tribe ID");
  writer.kill();
  process.exit(1);
}

// Spawn the subscriber-only processes.
const subPromises = [];
for (let i = 1; i < PROCS; i++) {
  const subArgs = baseArgs([
    `--users=${SUBS_PER_PROC}`,
    `--writers=0`,
    `--noWrites=true`,
    `--existingTribeId=${tribeId}`,
  ]);
  const child = spawn(process.execPath, [harness, ...subArgs], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  let buf = "";
  let report = null;
  subPromises.push(new Promise((res, rej) => {
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      for (;;) {
        const i = buf.indexOf("\n");
        if (i < 0) break;
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.startsWith("REPORT_JSON:")) report = JSON.parse(line.slice("REPORT_JSON:".length));
      }
    });
    child.on("exit", (code) => {
      if (code === 0) res({ name: `sub-${i}`, report });
      else rej(new Error(`sub-${i} exited ${code}`));
    });
    child.on("error", rej);
  }));
  console.log(`[mp] spawned subscriber process ${i} (subs=${SUBS_PER_PROC}, same tribe)`);
}

const all = await Promise.all([writerReportP, ...subPromises]);

console.log("\n" + "═".repeat(80));
console.log(`MULTI-PROCESS FANOUT — procs=${PROCS}, subsPerProc=${SUBS_PER_PROC}, total subs=${PROCS * SUBS_PER_PROC}`);
console.log("═".repeat(80));
console.log("  proc        label              n   p50    p95    p99    max");
for (const { name, report } of all) {
  if (!report) { console.log(`  ${name.padEnd(10)} (no report)`); continue; }
  const push = report.summaries["push-latency"];
  const send = report.summaries["send"];
  if (push) console.log(`  ${name.padEnd(10)}  push-latency  ${String(push.n).padStart(5)}  ${String(push.p50).padStart(4)}ms  ${String(push.p95).padStart(4)}ms  ${String(push.p99).padStart(4)}ms  ${String(push.max).padStart(4)}ms`);
  if (send && send.n > 0) console.log(`  ${name.padEnd(10)}  send          ${String(send.n).padStart(5)}  ${String(send.p50).padStart(4)}ms  ${String(send.p95).padStart(4)}ms  ${String(send.p99).padStart(4)}ms  ${String(send.max).padStart(4)}ms`);
}
console.log("═".repeat(80));
