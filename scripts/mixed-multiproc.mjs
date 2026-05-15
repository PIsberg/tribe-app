#!/usr/bin/env node
// Multi-process driver for the `mixed` scenario.
//
// Single-process `mixed` saturates the local connection pool at ~80 concurrent
// async loops, so latencies become harness-bound. This spawns N child
// processes each running their own `mixed` scenario against the same shared
// pool of tribes, aggregates the per-process JSON reports, and prints a
// combined summary.
//
// Usage:
//   node scripts/mixed-multiproc.mjs --procs=4 --usersPerProc=50 --tribes=10 --duration=60
//
// Each child creates its own subset of tribes (TRIBES / PROCS, min 1), so
// load is distributed across a realistic number of fires. Pass --sharedTribes
// to point all children at one tribe pool created up front (more contention,
// less realistic).

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [[m[1], m[2] ?? "true"]] : [];
  })
);

const PROCS = Number(args.procs ?? 4);
const USERS_PER_PROC = Number(args.usersPerProc ?? 40);
const TRIBES_TOTAL = Number(args.tribes ?? 10);
const DURATION_S = Number(args.duration ?? 60);

const here = dirname(fileURLToPath(import.meta.url));
const harness = resolve(here, "loadtest.mjs");

const tribesPerProc = Math.max(1, Math.floor(TRIBES_TOTAL / PROCS));

console.log(
  `[mp-mixed] procs=${PROCS}, usersPerProc=${USERS_PER_PROC}, tribesPerProc=${tribesPerProc}, duration=${DURATION_S}s`
);
console.log(`[mp-mixed] total users=${PROCS * USERS_PER_PROC}, total tribes≈${PROCS * tribesPerProc}`);

function runChild(name, extraArgs) {
  return new Promise((res, rej) => {
    const child = spawn(
      process.execPath,
      [
        harness,
        "--scenario=mixed",
        `--users=${USERS_PER_PROC}`,
        `--tribes=${tribesPerProc}`,
        `--duration=${DURATION_S}`,
        `--ramp=5`,
        `--json=true`,
        ...extraArgs,
      ],
      { stdio: ["ignore", "pipe", "inherit"] }
    );
    let buf = "";
    let report = null;
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      for (;;) {
        const i = buf.indexOf("\n");
        if (i < 0) break;
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line.startsWith("REPORT_JSON:")) {
          report = JSON.parse(line.slice("REPORT_JSON:".length));
        }
      }
    });
    child.on("exit", (code) => {
      if (code === 0) res({ name, report });
      else rej(new Error(`${name} exited ${code}`));
    });
    child.on("error", rej);
  });
}

const children = [];
for (let i = 0; i < PROCS; i++) {
  children.push(runChild(`proc-${i}`, []));
  // tiny stagger so we don't all hit createTribe simultaneously
  await new Promise((r) => setTimeout(r, 200));
}

const results = await Promise.all(children);

// Aggregate: collect per-label samples across all procs by merging summaries.
// Since each child reports a summary (not raw samples), we approximate the
// combined view by weighted-averaging percentiles (proper aggregation requires
// raw samples, which we don't ship to save IPC overhead — note in writeups).
function combine(labelStats) {
  const ns = labelStats.map((s) => s.n);
  const totalN = ns.reduce((a, b) => a + b, 0);
  if (totalN === 0) return null;
  const errors = labelStats.reduce((a, s) => a + s.errors, 0);
  const weighted = (key) =>
    labelStats.reduce((sum, s, i) => sum + s[key] * ns[i], 0) / totalN;
  // p50/p95/p99 across procs: take the max as a conservative upper-bound view.
  const maxOf = (key) => Math.max(0, ...labelStats.map((s) => s[key]));
  return {
    n: totalN,
    errors,
    errorRate: totalN + errors > 0 ? errors / (totalN + errors) : 0,
    mean: weighted("mean"),
    p50_avg: weighted("p50"),
    p95_max: maxOf("p95"),
    p99_max: maxOf("p99"),
    max: maxOf("max"),
  };
}

const labels = ["send", "toggleLike", "joinTribe", "setTyping"];
const combined = {};
for (const label of labels) {
  const stats = results
    .map((r) => r.report?.summaries?.[label])
    .filter(Boolean);
  if (stats.length) combined[label] = combine(stats);
}

console.log("\n" + "═".repeat(82));
console.log(`MULTI-PROCESS MIXED — total users=${PROCS * USERS_PER_PROC}, procs=${PROCS}`);
console.log("═".repeat(82));
console.log("  label              n    err%   mean    p50(avg)  p95(max)  p99(max)  max");
for (const [label, s] of Object.entries(combined)) {
  console.log(
    `  ${label.padEnd(18)} ${String(s.n).padStart(5)}  ${(s.errorRate * 100).toFixed(1).padStart(4)}%  ${s.mean.toFixed(0).padStart(5)}ms  ${String(Math.round(s.p50_avg)).padStart(6)}ms  ${String(s.p95_max).padStart(6)}ms  ${String(s.p99_max).padStart(6)}ms  ${String(s.max).padStart(5)}ms`
  );
}
console.log("═".repeat(82));
console.log("  (p50 is sample-weighted across procs; p95/p99/max are conservative max-of-proc)");
