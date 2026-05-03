#!/usr/bin/env node
// Generates PNG images from .puml files via the PlantUML online server.
// Run: node docs/diagrams/generate.js
import { deflateRawSync } from "node:zlib";
import { readFileSync, createWriteStream } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const __dir = dirname(fileURLToPath(import.meta.url));

function encode6bit(b) {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return "-";
  if (b === 1) return "_";
  return "?";
}

function append3bytes(b1, b2, b3) {
  return (
    encode6bit((b1 >> 2) & 0x3f) +
    encode6bit((((b1 & 0x3) << 4) | (b2 >> 4)) & 0x3f) +
    encode6bit((((b2 & 0xf) << 2) | (b3 >> 6)) & 0x3f) +
    encode6bit(b3 & 0x3f)
  );
}

function encode64(data) {
  let r = "";
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) r += append3bytes(data[i], data[i + 1], 0);
    else if (i + 1 === data.length) r += append3bytes(data[i], 0, 0);
    else r += append3bytes(data[i], data[i + 1], data[i + 2]);
  }
  return r;
}

function encodePuml(source) {
  const compressed = deflateRawSync(Buffer.from(source, "utf8"), { level: 9 });
  return encode64(compressed);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    function get(u) {
      https
        .get(u, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return get(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          }
          res.pipe(file);
          file.on("finish", () => file.close(resolve));
        })
        .on("error", reject);
    }
    get(url);
  });
}

const files = [
  "system-overview.puml",
  "screen-flow.puml",
  "data-model.puml",
  "message-send-flow.puml",
  "geofence-gate.puml",
];

for (const f of files) {
  const src = readFileSync(join(__dir, f), "utf8");
  const encoded = encodePuml(src);
  const url = `https://www.plantuml.com/plantuml/png/${encoded}`;
  const out = join(__dir, basename(f, ".puml") + ".png");
  process.stdout.write(`Generating ${basename(f, ".puml")}.png ... `);
  try {
    await download(url, out);
    console.log("done");
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
  }
}
