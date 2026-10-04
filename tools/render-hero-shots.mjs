#!/usr/bin/env node
/*
 * Renders 2048×2048 PNGs of the hero (plus a little below the fold), one image per
 * brand colour, per heading font and per hero-art style. Each set changes only its
 * own variable; everything else stays on the defaults below.
 *
 *   node tools/render-hero-shots.mjs              # all sets → renders/
 *   node tools/render-hero-shots.mjs --only=fonts # one set: colours | fonts | styles
 *   node tools/render-hero-shots.mjs --out=some/dir --size=4096   # e.g. back to 4K
 *
 * Needs only Node 18+ and Chrome or Edge (override the path with BROWSER=...).
 * Uses the page's own URL parameters (see README › Hero art), so new options
 * added to the explorer only need a line in SETS below.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, openSync, readSync, closeSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));

const SIZE = Number(args.size || 2048);   // output pixels, square
const VIEWPORT = 1536;                    // CSS px: desktop layout, hero plus a little below the fold
const SCALE = SIZE / VIEWPORT;            // 2048 / 1536 = 1.333×
const OUT = resolve(ROOT, args.out || "renders");
const CONCURRENCY = 3;

// Shared settings: fixed layout seed, art captured 12s in (intro finished), explorer hidden
const BASE = { art: "threads", brand: "1a635f", tone: "light", hf: "Spectral", bf: "Inter", seed: "42", at: "12000", controls: "0" };

const SETS = {
  colours: [
    ["teal-1a635f",        { brand: "1a635f" }],
    ["deep-teal-043230",   { brand: "043230" }],
    ["ultramarine-4225ff", { brand: "4225ff" }],
    ["oxblood-861618",     { brand: "861618" }],
    ["olive-5c5d27",       { brand: "5c5d27" }]
  ],
  fonts: [
    ["spectral",         { hf: "Spectral" }],
    ["brawler",          { hf: "Brawler" }],
    ["tinos",            { hf: "Tinos" }],
    ["strichpunkt-sans", { hf: "Strichpunkt Sans" }]
  ],
  styles: [
    ["threads",       { art: "threads" }],
    ["signal",        { art: "signal" }],
    ["constellation", { art: "constellation" }],
    ["dot-wave",      { art: "dotwave" }]
  ]
};

function findBrowser() {
  const candidates = [
    process.env.BROWSER,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
  ].filter(Boolean);
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error("No Chrome/Edge found. Set BROWSER=/path/to/chrome");
  return hit;
}

function pngSize(file) {
  const fd = openSync(file, "r"), buf = Buffer.alloc(24);
  readSync(fd, buf, 0, 24, 0); closeSync(fd);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

function shoot(browser, url, file) {
  const profile = mkdtempSync(join(tmpdir(), "cdm-shot-"));
  const flags = [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    `--window-size=${VIEWPORT},${VIEWPORT}`,
    `--force-device-scale-factor=${SCALE}`,
    "--virtual-time-budget=8000",           // time for web fonts, colour transitions and the art to settle
    `--screenshot=${file}`,
    url
  ];
  return new Promise((ok, fail) => {
    const p = spawn(browser, flags, { stdio: "ignore" });
    p.on("error", fail);
    p.on("exit", () => {
      rmSync(profile, { recursive: true, force: true });
      existsSync(file) ? ok(file) : fail(new Error("No screenshot written for " + file));
    });
  });
}

async function main() {
  const browser = findBrowser();
  const page = pathToFileURL(join(ROOT, "index.html")).href;
  const sets = args.only ? { [args.only]: SETS[args.only] } : SETS;
  if (Object.values(sets).some((s) => !s)) throw new Error("--only must be one of: " + Object.keys(SETS).join(", "));

  const jobs = [];
  for (const [set, shots] of Object.entries(sets)) {
    mkdirSync(join(OUT, set), { recursive: true });
    shots.forEach(([name, overrides], i) => {
      const q = new URLSearchParams({ ...BASE, ...overrides });
      const file = join(OUT, set, `${String(i + 1).padStart(2, "0")}-${name}.png`);
      jobs.push({ url: `${page}?${q}`, file });
    });
  }

  console.log(`Rendering ${jobs.length} images at ${SIZE}×${SIZE} with ${browser}`);
  let failed = 0;
  const queue = [...jobs];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let job; (job = queue.shift());) {
      try {
        await shoot(browser, job.url, job.file);
        const [w, h] = pngSize(job.file);
        const flag = w === SIZE && h === SIZE ? "" : `  (!) got ${w}×${h}`;
        console.log(`  ✓ ${job.file.slice(ROOT.length + 1)}${flag}`);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${job.file}: ${e.message}`);
      }
    }
  }));
  console.log(failed ? `${failed} failed.` : `Done → ${OUT}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
