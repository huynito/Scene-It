#!/usr/bin/env node
/**
 * One-shot reconstituter: parse consolidation.txt + MANIFEST.txt and
 * recreate the project tree at the path passed via --dest=PATH.
 *
 * Usage:
 *   node scripts/reconstitute.mjs --src=_consolidation --dest=../gsv-recon
 *
 * Matches the parsing logic documented in RECONSTITUTE.md.
 */

import fs from "node:fs";
import path from "node:path";
import { argv, exit } from "node:process";

const SRC_FLAG = argv.find((a) => a.startsWith("--src="));
const DEST_FLAG = argv.find((a) => a.startsWith("--dest="));
if (!SRC_FLAG || !DEST_FLAG) {
  console.error("Usage: node scripts/reconstitute.mjs --src=PATH --dest=PATH");
  exit(2);
}
const SRC = path.resolve(SRC_FLAG.slice("--src=".length));
const DEST = path.resolve(DEST_FLAG.slice("--dest=".length));

const SOURCE_TXT = path.join(SRC, "consolidation.txt");
const ASSETS_DIR = path.join(SRC, "_consolidated_assets");
const MANIFEST_TXT = path.join(ASSETS_DIR, "MANIFEST.txt");

if (!fs.existsSync(SOURCE_TXT)) { console.error(`missing: ${SOURCE_TXT}`); exit(1); }
if (!fs.existsSync(MANIFEST_TXT)) { console.error(`missing: ${MANIFEST_TXT}`); exit(1); }
if (fs.existsSync(DEST)) {
  console.error(`dest already exists: ${DEST}\nrefusing to overwrite -- delete it first or pick a fresh path`);
  exit(1);
}
fs.mkdirSync(DEST, { recursive: true });

console.log(`Reconstituting into ${DEST}`);

// Step 1: parse consolidation.txt with length-prefix encoding.
const buf = fs.readFileSync(SOURCE_TXT);
let pos = 0;
let written = 0;
const HEADER_RE = /^===GSVFILE=== (.+?) (\d+)===$/;

while (pos < buf.length) {
  const eol = buf.indexOf(0x0a, pos);
  if (eol === -1) {
    if (buf.length - pos > 0) console.warn(`unexpected trailing bytes at ${pos}`);
    break;
  }
  const header = buf.subarray(pos, eol).toString("utf8");
  const m = header.match(HEADER_RE);
  if (!m) {
    console.error(`bad header at byte ${pos}: ${JSON.stringify(header.slice(0, 200))}`);
    exit(1);
  }
  const [, rel, bytesStr] = m;
  const bytes = Number(bytesStr);
  pos = eol + 1;
  const contents = buf.subarray(pos, pos + bytes);
  const target = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  written++;
  pos += bytes + 1; // skip trailing newline that the consolidator adds
}
console.log(`  wrote ${written} text files`);

// Step 2: copy binary assets per MANIFEST.txt.
const manifestLines = fs.readFileSync(MANIFEST_TXT, "utf8").split("\n").filter(Boolean);
let copied = 0;
for (const line of manifestLines) {
  const arrowIdx = line.indexOf(" -> ");
  if (arrowIdx === -1) continue;
  const flat = line.slice(0, arrowIdx);
  const rel = line.slice(arrowIdx + 4);
  const src = path.join(ASSETS_DIR, flat);
  const target = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
  copied++;
}
console.log(`  copied ${copied} binary assets`);

console.log("Done.");
