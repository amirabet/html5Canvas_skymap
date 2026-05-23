#!/usr/bin/env node
"use strict";

/**
 * build.js  –  canvas-sketch build + post-processing
 *
 * Single build:
 *   node build.js [--title "My Title"] [--config configs/orion.json] [--out orion.html]
 *
 * Build all configs at once (one HTML per configs/*.json):
 *   node build.js --all
 *
 * --title   Sets the <title> tag. Defaults to the config filename stem.
 * --config  CONFIG overrides: a .json file path or an inline JSON string.
 * --out     Output filename inside docs/. Defaults to canvas-skymap.html.
 * --all     Iterates over every configs/*.json and produces a named HTML file.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CANVAS_SKETCH_CMD =
  "npx canvas-sketch canvas-skymap.js --build --no-compress --inline --html docs/template.html --dir docs";
const OUT_DIR = path.join(__dirname, "docs");
const DEFAULT_OUT = "canvas-skymap.html";

// ─── Helpers ───────────────────────────────────────────────────────────────
function loadConfig(val) {
  try {
    return val.trim().endsWith(".json")
      ? JSON.parse(fs.readFileSync(path.resolve(val), "utf8"))
      : JSON.parse(val);
  } catch (e) {
    console.error("--config error:", e.message);
    process.exit(1);
  }
}

// Converts a kebab-case filename stem to a Title Case string.
// e.g. "nightmode-autoplay" → "Nightmode Autoplay"
function stemToTitle(stem) {
  return stem.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildOne({ title, configOverride, outFile }) {
  console.log(`\n⟶  Building → docs/${outFile} …`);

  execSync(CANVAS_SKETCH_CMD, { stdio: "inherit", cwd: __dirname });

  const defaultPath = path.join(OUT_DIR, DEFAULT_OUT);
  let html = fs.readFileSync(defaultPath, "utf8");

  // Inject window.__SKETCH_CONFIG__ before the main bundle.
  if (Object.keys(configOverride).length > 0) {
    const inject = `<script>window.__SKETCH_CONFIG__=${JSON.stringify(configOverride)};</script>`;
    html = html.replace(/(<script\b)/, `${inject}\n$1`);
  }

  // Set page title.
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  const finalPath = path.join(OUT_DIR, outFile);
  fs.writeFileSync(finalPath, html);

  // Remove the default-named file if it was renamed.
  if (outFile !== DEFAULT_OUT && fs.existsSync(defaultPath)) {
    fs.unlinkSync(defaultPath);
  }

  console.log(`✓ docs/${outFile}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--all")) {
  // Build one HTML file per configs/*.json
  const configsDir = path.join(__dirname, "configs");
  const files = fs
    .readdirSync(configsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    console.error("No .json files found in configs/");
    process.exit(1);
  }

  for (const file of files) {
    const stem = path.basename(file, ".json");
    buildOne({
      title: stemToTitle(stem),
      configOverride: loadConfig(path.join(configsDir, file)),
      outFile: `${stem}.html`,
    });
  }

  console.log(`\n✓ All done — ${files.length} files built in docs/`);
} else {
  // Single build
  let title = null;
  let configOverride = {};
  let outFile = DEFAULT_OUT;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--title" && args[i + 1]) title = args[++i];
    else if (args[i] === "--config" && args[i + 1])
      configOverride = loadConfig(args[++i]);
    else if (args[i] === "--out" && args[i + 1]) outFile = args[++i];
  }

  // Derive title from --out filename stem if not explicitly provided.
  if (!title) {
    title = stemToTitle(path.basename(outFile, ".html"));
  }

  buildOne({ title, configOverride, outFile });
}
