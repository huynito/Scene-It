#!/usr/bin/env node
/**
 * Phase B consolidation: produce a portable single-folder snapshot of
 * the project that a receiving agent can use to recreate the source
 * tree on another machine without git access.
 *
 * Outputs (under _consolidation/):
 *   - consolidation.txt        single text file with every text source
 *                              file in length-prefixed blocks
 *                              (===GSVFILE=== path BYTES===)
 *   - _consolidated_assets/    flat folder of every binary asset, names
 *                              path-encoded to avoid collisions
 *   - _consolidated_assets/MANIFEST.txt  flatname -> original path
 *   - RECONSTITUTE.md          step-by-step instructions for the
 *                              receiving agent
 *
 * Usage:
 *   node scripts/consolidate.mjs              # writes to _consolidation/ in CWD
 *   node scripts/consolidate.mjs --out=PATH   # custom output directory
 *
 * Exclusions match .gitignore plus a few additions:
 *   - node_modules/, .next/, out/, .git/, .vercel/, .turbo/
 *   - .env, .env.*
 *   - tmp-*  (working files like temporary screenshots)
 *   - _consolidation/  (avoid recursion if rerun in place)
 *   - public/scenes/<scene>/scene.ply, depth.glb, *.splat (large gaussian
 *     splat assets, fetched separately via download-assets.sh)
 *   - package-lock.json (recreated by npm install)
 */

import fs from "node:fs";
import path from "node:path";
import { argv, cwd, exit } from "node:process";

const ROOT = cwd();

const OUT_FLAG = argv.find((a) => a.startsWith("--out="));
const OUT_DIR = OUT_FLAG ? path.resolve(OUT_FLAG.slice("--out=".length)) : path.join(ROOT, "_consolidation");
const ASSETS_DIR = path.join(OUT_DIR, "_consolidated_assets");
const SOURCE_TXT = path.join(OUT_DIR, "consolidation.txt");
const MANIFEST_TXT = path.join(ASSETS_DIR, "MANIFEST.txt");
const RECONSTITUTE_MD = path.join(OUT_DIR, "RECONSTITUTE.md");

/** Directories to skip entirely. */
const SKIP_DIRS = new Set([
  "node_modules", ".next", "out", ".git", ".vercel", ".turbo",
  "_consolidation",
]);

/** Path patterns to skip (relative to ROOT). */
const SKIP_PATTERNS = [
  /^\.env(\..*)?$/,
  /^tmp-/,
  /(^|\/)\.DS_Store$/,
  /^package-lock\.json$/,
  /^tsconfig\.tsbuildinfo$/,
  /^\.playwright-mcp\//,
  /\.log$/,
  /^public\/scenes\/[^/]+\/scene\.ply$/,
  /^public\/scenes\/[^/]+\/depth\.glb$/,
  /^public\/scenes\/[^/]+\/.*\.splat$/,
];

/** File extensions we treat as text and inline into consolidation.txt. */
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".html", ".json", ".jsonc", ".md", ".mdc",
  ".sh", ".py", ".txt", ".yml", ".yaml", ".toml",
  ".gitignore", ".npmrc", ".env",
]);

/** Special "no extension" filenames we still treat as text. */
const TEXT_BASENAMES = new Set([
  ".gitignore", ".npmrc", ".nvmrc", "Dockerfile", "Makefile", "LICENSE",
  ".node-version",
]);

/** File extensions we treat as binary assets (extracted into the flat folder). */
const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".wav", ".mp3", ".ogg", ".aac", ".flac",
  ".mp4", ".webm", ".mov",
  ".zip", ".tar", ".gz",
]);

function shouldSkip(rel) {
  for (const pat of SKIP_PATTERNS) if (pat.test(rel)) return true;
  return false;
}

function isText(file) {
  const ext = path.extname(file).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  if (TEXT_BASENAMES.has(path.basename(file))) return true;
  return false;
}

function isBinary(file) {
  const ext = path.extname(file).toLowerCase();
  return BINARY_EXT.has(ext);
}

/** Encode a path into a flat filename: slashes -> double underscore. */
function flatName(rel) {
  return rel.replace(/\//g, "__");
}

function* walk(dir, base = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && SKIP_DIRS.has(entry.name)) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (shouldSkip(rel)) continue;
    if (entry.isDirectory()) {
      yield* walk(full, rel);
    } else if (entry.isFile()) {
      yield { full, rel };
    }
  }
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function ensureFreshDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function buildReconstituteMd(stats) {
  return `# Reconstitute the gaussian-scene-viewer project

This bundle contains everything needed to recreate the project source
tree on another machine without git access.

## What's in this folder

| File | Purpose |
|---|---|
| \`consolidation.txt\` (${fmtBytes(stats.sourceBytes)}, ${stats.sourceFiles} files) | Every text source file inlined in fenced blocks |
| \`_consolidated_assets/\` (${fmtBytes(stats.assetBytes)}, ${stats.assetFiles} files) | Every binary asset with path-encoded flat filenames |
| \`_consolidated_assets/MANIFEST.txt\` | Maps each flat filename back to its original project path |
| \`RECONSTITUTE.md\` | This file |

## Reconstitution procedure

### 1. Recreate the source tree from \`consolidation.txt\`

The text file is a sequence of length-prefixed blocks. Each block is:

\`\`\`
===GSVFILE=== path/to/file.ext BYTES===
<exactly BYTES bytes of file contents (UTF-8)>
\\n
\`\`\`

For each block:
1. Read the header line (terminated by the first \`\\n\`)
2. Parse: split on space, last field is the byte count followed by \`===\`,
   the field before is the path
3. Read exactly BYTES bytes of UTF-8 content
4. Skip the trailing \`\\n\`
5. \`mkdir -p\` the parent directory and write the contents to the path

Length-prefix encoding means consolidation.txt itself can appear inside
another file (no scanning for markers). Reference parsers:

\`\`\`js
// Node.js
const buf = fs.readFileSync("consolidation.txt");
let pos = 0;
while (pos < buf.length) {
  const eol = buf.indexOf(0x0a, pos);                  // '\\n'
  const header = buf.subarray(pos, eol).toString("utf8");
  const m = header.match(/^===GSVFILE=== (.+?) (\\d+)===$/);
  if (!m) throw new Error(\`bad header at \${pos}: \${header}\`);
  const [, rel, bytesStr] = m;
  const bytes = Number(bytesStr);
  pos = eol + 1;
  const contents = buf.subarray(pos, pos + bytes);
  fs.mkdirSync(path.dirname(rel), { recursive: true });
  fs.writeFileSync(rel, contents);
  pos += bytes + 1;                                    // skip trailing '\\n'
}
\`\`\`

### 2. Recreate the binary assets from \`_consolidated_assets/\`

Read \`MANIFEST.txt\`. Each line is:

\`\`\`
<flatname> -> <original/path/with/slashes>
\`\`\`

For each entry:
1. Copy \`_consolidated_assets/<flatname>\` to \`<original/path/with/slashes>\`
2. \`mkdir -p\` the parent directory first

### 3. Install dependencies and build

\`\`\`bash
npm install
npm run dev      # development server at http://localhost:3000
# or
npm run build    # static export to out/
\`\`\`

## What is NOT included

- \`node_modules/\` — recreated by \`npm install\`
- \`package-lock.json\` — recreated by \`npm install\` (note: exact dependency
  versions may differ; if you need lockfile parity, re-include it)
- \`.next/\`, \`out/\`, \`.vercel/\`, \`.turbo/\` — build output, recreated
- \`.git/\` — not needed for reconstitution
- \`.env\`, \`.env.*\` — security-sensitive, copy manually if applicable
- \`public/scenes/<scene>/scene.ply\`, \`depth.glb\`, \`*.splat\` — gaussian
  splat scene assets (180-300+ MB each). Three options:
  1. Run \`download-assets.sh\` if GHE Releases is reachable (recommended)
  2. Manually copy from the source machine's \`public/scenes/<scene>/\`
  3. Skip — the app loads the scene selector but won't render anything
     until at least one scene is present

## Verification

After reconstitution:

\`\`\`bash
# 1. Build should succeed
npm install
npm run build

# 2. Dev server should serve / with status 200
npm run dev &
sleep 5
curl -o /dev/null -w "%{http_code}\\n" http://localhost:3000/   # expect 200

# 3. All seven themes should switch without missing-asset 404s.
#    Manually switch through each in the theme picker (default, Win95,
#    Winamp, AIM, sciin_it, scenit) and check the browser console for
#    failed network requests.
\`\`\`

## Source counts (at consolidation time)

- Text source files: ${stats.sourceFiles} (${fmtBytes(stats.sourceBytes)})
- Binary assets: ${stats.assetFiles} (${fmtBytes(stats.assetBytes)})
- Skipped (large scene assets, env files, build artifacts): see exclusion
  rules in \`scripts/consolidate.mjs\`
`;
}

function main() {
  console.log(`Consolidating from ${ROOT}`);
  console.log(`Output dir: ${OUT_DIR}`);

  ensureFreshDir(OUT_DIR);
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const sourceParts = [];
  const manifestLines = [];
  let sourceFiles = 0, sourceBytes = 0;
  let assetFiles = 0, assetBytes = 0;
  let skippedFiles = 0;

  // Sort entries for deterministic output.
  const entries = [...walk(ROOT)].sort((a, b) => a.rel.localeCompare(b.rel));

  for (const { full, rel } of entries) {
    const stat = fs.statSync(full);
    if (isText(full)) {
      const contents = fs.readFileSync(full, "utf8");
      // Length-prefix encoding: header line declares byte count, then
      // exactly that many UTF-8 bytes follow. No scanning for markers
      // means consolidation.txt itself can be embedded verbatim.
      const byteLen = Buffer.byteLength(contents, "utf8");
      sourceParts.push(`===GSVFILE=== ${rel} ${byteLen}===\n${contents}\n`);
      sourceFiles++;
      sourceBytes += stat.size;
    } else if (isBinary(full)) {
      const flat = flatName(rel);
      fs.copyFileSync(full, path.join(ASSETS_DIR, flat));
      manifestLines.push(`${flat} -> ${rel}`);
      assetFiles++;
      assetBytes += stat.size;
    } else {
      // Anything not classified -- skip, but report.
      skippedFiles++;
      console.warn(`  skipped (unclassified): ${rel}`);
    }
  }

  fs.writeFileSync(SOURCE_TXT, sourceParts.join(""), "utf8");
  fs.writeFileSync(MANIFEST_TXT, manifestLines.join("\n") + "\n", "utf8");
  fs.writeFileSync(
    RECONSTITUTE_MD,
    buildReconstituteMd({ sourceFiles, sourceBytes, assetFiles, assetBytes }),
    "utf8",
  );

  console.log(`\nDone:`);
  console.log(`  consolidation.txt:        ${sourceFiles} text files, ${fmtBytes(sourceBytes)}`);
  console.log(`  _consolidated_assets/:    ${assetFiles} binary files, ${fmtBytes(assetBytes)}`);
  console.log(`  RECONSTITUTE.md:          written`);
  if (skippedFiles > 0) {
    console.log(`  Unclassified files skipped: ${skippedFiles} (see warnings above)`);
  }
}

try {
  main();
} catch (err) {
  console.error("Consolidation failed:", err);
  exit(1);
}
