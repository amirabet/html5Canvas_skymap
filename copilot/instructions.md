# Sketch 06 — AI Agent Onboarding Instructions

> This file gives a new AI agent everything it needs to understand, run, modify, and extend the **Planetarium Star Map** sketch. Read it top-to-bottom before touching any code.

---

## 1. What this project is

A browser-based, animated **star map of the northern-hemisphere night sky**, built with [`canvas-sketch`](https://github.com/mattdesl/canvas-sketch) (a creative-coding framework that manages the canvas render loop). It renders 43 constellations and ~269 named stars on a 2160 × 1080 canvas. The sky rotates with the selected day of year, simulating the annual cycle. All runtime controls are exposed through a **Tweakpane** panel embedded in the page.

The sketch can be used in two ways:

- **Dev mode** — live-reloading dev server via `canvas-sketch-cli`
- **Built mode** — single self-contained HTML file produced by `build.js`

---

## 2. Folder layout

```
root/
├── canvas-skymap.js      ← The single source file for the entire sketch
├── constellations.json   ← Star/constellation data (the only data file; do NOT rename)
├── build.js              ← Build script (wraps canvas-sketch-cli, adds CONFIG injection)
├── package.json          ← Dependencies: canvas-sketch, tweakpane ^3.x, tweakpane-plugin-search-list
├── README.md             ← Full user-facing reference (CONFIG table, build docs)
├── configs/              ← Pre-built CONFIG overrides (one .json per build variant)
│   ├── nightmode-autoplay.json
│   ├── orion.json
│   ├── print.json
│   ├── sirius.json
│   └── stars-only.json
├── docs/                 ← Output from build.js (static HTML files, deployed as-is)
│   ├── template.html     ← HTML shell that canvas-sketch-cli fills in; do NOT remove
│   ├── index.html        ← Landing page / entry point for the docs site
│   ├── canvas-skymap.html ← Default build output
│   ├── orion.html
│   ├── nightmode-autoplay.html
│   ├── print.html
│   ├── sirius.html
│   ├── stars-only.html
│   └── star-data.md      ← Full list of all 43 constellation names and 269 star names
└── copilot/
    └── instructions.md   ← This file
```

---

## 3. Running

```bash
cd sketches/06
npm install           # first time only
npm start             # alias for: npx canvas-sketch canvas-skymap.js --open
```

The dev server opens the sketch in a browser with live reload. **Do NOT use `node canvas-skymap.js`** — it is a browser script bundled by Browserify.

### Troubleshooting startup

| Symptom                                                                       | Fix                                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ParseError: 'import' and 'export' may appear only with 'sourceType: module'` | Stale Browserify cache. **Restart the dev server** — do not touch package versions. |
| Blank page / canvas-sketch hangs                                              | Check the browser console; usually a JS runtime error in `canvas-skymap.js`.        |
| Panel not visible                                                             | `CONFIG.showPane` is `false`. Reload after setting it to `true`.                    |

---

## 4. Building

```bash
npm run build          # → docs/canvas-skymap.html  (default, no CONFIG override)
npm run build:all      # → one docs/*.html per configs/*.json file
```

Manual build with overrides:

```bash
node build.js --title "Orion" --config configs/orion.json --out orion.html
```

**How CONFIG injection works:**

1. `build.js` calls `canvas-sketch-cli --inline` → produces `docs/canvas-skymap.html` (single-file bundle)
2. It inserts `<script>window.__SKETCH_CONFIG__ = {...};</script>` _before_ the main bundle script
3. At runtime, `canvas-skymap.js` spreads `window.__SKETCH_CONFIG__` at the end of `CONFIG`, overriding any keys present
4. The `<title>` tag is replaced with `--title` value

In dev mode, `window.__SKETCH_CONFIG__` is never set, so all CONFIG defaults apply.

---

## 5. Architecture of `canvas-skymap.js`

The file is structured top-to-bottom as follows. Read sections in order when debugging.

### 5.1 Imports and settings

```js
const canvasSketch = require("canvas-sketch");
const tweakPane = require("tweakpane"); // MUST be ^3.x (CJS/UMD)
const TweakpaneSearchListPlugin = require("tweakpane-plugin-search-list");
const constellationsData = require("./constellations.json");

const settings = { dimensions: [2160, 1080], animate: true };
```

### 5.2 CONFIG object

Single source of truth for all configurable parameters. Pre-set here in dev mode; overridden by `window.__SKETCH_CONFIG__` in built mode. Every key maps 1-to-1 to a Tweakpane control.

```js
const CONFIG = {
  viewScale: "sky",           // "sky" | "1:1"
  showGrid: true,
  showConstellationName: true,
  showConstellationLines: true,
  showStarNames: "none",      // "none" | "on_hover" | <constellationName>
  dayOfYear: <today>,         // 1–365
  autoplay: false,
  theme: "blue",              // "blue" | "monochrome" | "nightmode" | "light" | "elegant" | "custom"
  panelCorner: "bottom-right",
  showPane: true,
  searchConstellation: "",    // any constellation name | "" to skip
  searchStar: "",             // any star name | "" to skip
  target: "",                 // DOM element id to mount canvas into; empty = auto-create wrapper
  ...(window.__SKETCH_CONFIG__ || {}),
};
```

**Startup search priority** (enforced by `applyConfigSearch()` which runs once after all Tweakpane bindings are created):

1. `searchStar` wins if non-empty → clears `searchConstellation`, rotates to that star
2. `searchConstellation` wins if `searchStar` is empty → rotates to constellation centroid RA
3. `dayOfYear` used if both search fields are empty

### 5.3 Theme system

```js
const themes = { blue, monochrome, nightmode, light, elegant };
const theme = { ...(themes[CONFIG.theme] ?? themes.blue) }; // live mutable copy
```

`theme` is a plain object with keys: `background`, `grid`, `constellationLine`, `starStroke`, `starDimColor`, `starBrightColor`, `constellationLabel`, `labelStroke`, `starLabel`. Each value is `{ r, g, b }`.

`toRgb({ r, g, b })` converts to a CSS `rgb()` string. `getStarFillColor(brightness)` lerps between `starDimColor` and `starBrightColor`.

When the user selects a preset in Tweakpane, `Object.assign(theme, preset)` mutates the live theme object, so the next frame picks up the new colours automatically. When `"custom"` is selected, Tweakpane colour pickers write directly into `theme`.

`applyPaneTheme()` applies `--tp-*` CSS custom properties to `pane.element` and injects a `<style id="tp-search-list-theme">` tag for the search-list plugin's Popper.js dropdown (which is appended to `document.body`, outside the pane element, so scoped vars can't reach it).

### 5.4 Coordinate projection

The sky is a polar projection centred at the North Celestial Pole (dec = 90°).

```js
const raDecToXY = (ra, dec, rotationOffset) => {
  const angle = (1 - ra / 24) * 2 * Math.PI + rotationOffset;
  const radius = ((90 - dec) / 90) * 0.45; // 0.45 keeps stars inside a unit circle of r=0.45
  const xPos = 0.5 + radius * Math.cos(angle);
  const yPos = 0.5 - radius * Math.sin(angle);
  return { xPos, yPos }; // normalised 0–1 fractions of `size`
};
```

`rotationOffset` is derived from the selected `dayOfYear`:

```js
const DAY_OFFSET_BASE = Math.PI / 2 - (83 / 365.25) * 2 * Math.PI;
// Day 83 (March 24) → π/2 (calibration anchor)

const rotationOffset =
  DAY_OFFSET_BASE + (params.dayOfYear / 365.25) * 2 * Math.PI;
```

### 5.5 Secondary canvas pattern

All star/constellation drawing happens on `planetariumCanvas` (an off-screen `<canvas>` element, never added to the DOM). At the end of each frame, it is composited onto the main canvas with `context.drawImage(...)`.

This avoids polluting the main canvas context's state and allows the sky circle to be drawn at a fixed logical size (`size = Math.min(width, height)`) regardless of canvas aspect ratio.

**Sky view** (`viewScale = "sky"`): the planetarium canvas is scaled to `1.9×` and cropped, giving a wide-angle panorama feel:

```js
context.drawImage(
  planetariumCanvas,
  (width - size * 1.85) / 2,
  -size * 0.85, // dx, dy (negative dy crops the top)
  size * 1.85,
  size * 1.85, // dw, dh
);
```

**1:1 view**: the planetarium canvas is drawn at exact size, centred:

```js
context.drawImage(planetariumCanvas, xOffset, 0, size, size);
```

### 5.6 Tweakpane setup

- **Library version:** `tweakpane ^3.1.10` (UMD/CJS). Do NOT upgrade to v4 — it is ESM-only and breaks Browserify bundling.
- **API:** `pane.addInput(obj, key, options)` and `.on("change", fn)`. The v4 API (`addBinding`) must NOT be used.
- All bindings whose `.refresh()` is needed later are stored in module-level `let` variables (`dayOfYearBinding`, `autoplayBinding`, `searchConstellationBinding`, `searchStarBinding`).
- `suppressSearchChange` flag prevents cascade re-triggers when one search field programmatically clears the other.

### 5.7 Search and rotation animation

`rotateToRa(ra)` computes the `dayOfYear` that places a given RA at the bottom-centre of the chart, then calls `animateToDayOfYear(targetDay)`.

`animateToDayOfYear(target)` animates `params.dayOfYear` toward the target over 900 ms using cubic ease-out and `requestAnimationFrame`. The `searchFolder` is disabled during animation to prevent re-triggering.

`wrapDay(d)` wraps a fractional day to an integer in [1, 365], handling year-boundary crossings.

### 5.8 Mouse / touch hover

Mouse position is tracked in `mousePos` (main canvas logical coords). The hover logic in the render loop inverts the `drawImage` transform to find the equivalent position on the secondary canvas, then checks distance from each star.

### 5.9 Embedding (`CONFIG.target`)

If `CONFIG.target` is a non-empty string, the sketch mounts its `<canvas>` into the DOM element with that id, rather than auto-creating a wrapper div. Useful for embedding the sketch into an existing HTML page.

---

## 6. Data format (`constellations.json`)

```json
{
  "constellations": [
    {
      "name": "Orion",
      "stars": [
        { "name": "Betelgeuse", "ra": 5.919, "dec": 7.407, "magnitude": 0.42, "brightness": 0.98 },
        ...
      ],
      "paths": [
        ["Betelgeuse", "Bellatrix", "Rigel"],
        ...
      ]
    },
    ...
  ]
}
```

- `ra`: right ascension in **decimal hours** (0 – 24)
- `dec`: declination in **degrees** (−90 – +90)
- `magnitude`: apparent magnitude (lower = brighter; typical range −1.5 to 6.5)
- `brightness`: pre-computed as `10^(−0.4 × magnitude)`, used for visual sizing/colour lerping
- `paths`: each sub-array is a sequence of star names defining one segment of constellation lines

The file is loaded at the top of the script and never mutated.

---

## 7. Themes reference

| Key          | `background`          | Vibe                 |
| ------------ | --------------------- | -------------------- |
| `blue`       | Midnight blue         | Classic night sky    |
| `monochrome` | Pure black            | Minimal B&W          |
| `nightmode`  | Pure black + deep red | Dark-room safe       |
| `light`      | White                 | Print-friendly       |
| `elegant`    | Dark navy             | Antique gold accents |

To add a new theme: add an entry to the `themes` object in `canvas-skymap.js` and add it to the `options` object in the `themePresetBinding` setup. The Tweakpane dropdown will pick it up automatically.

---

## 8. Config files (`configs/*.json`)

Each file is a partial CONFIG object. Any key not present falls back to the defaults in `CONFIG`. To add a new build variant:

1. Create `configs/my-variant.json` with the desired overrides
2. Run `npm run build:all` — it will produce `docs/my-variant.html` automatically

Example:

```json
{
  "theme": "nightmode",
  "autoplay": true,
  "showPane": false
}
```

---

## 9. Known issues and workarounds

| Issue                                               | Root cause                                                                      | Workaround                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ParseError: 'import' and 'export'…` on startup     | Stale Browserify dev server cache                                               | Restart `npm start`                                                                                               |
| Search-list dropdown doesn't close on outside click | Bug in `tweakpane-plugin-search-list` click-outside handler (logic is inverted) | Patched in `canvas-skymap.js` via a `mousedown` listener on `document` that removes `data-show` from the open box |
| Tweakpane v4 ESM parse error                        | `canvas-sketch-cli` uses Browserify which can't handle ESM                      | Use `tweakpane ^3.1.10` only                                                                                      |
| Dropdown arrow styling broken                       | Tweakpane v3 uses a CSS-only triangle that can't be recoloured                  | Overridden in `applyPaneTheme()` via `-webkit-appearance: none` + SVG background-image                            |

---

## 10. Open TODOs (from the code)

```
- Embedding into any webpage via JS (plugin)
- Create dedicated repo
- Add a "fork me on github" label to all demos
- Announce on Reddit / astronomy communities
```

---

## 11. Dependency notes

| Package                        | Version   | Notes                                                                                |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------ |
| `canvas-sketch`                | `^0.7.7`  | Provides the render loop and canvas-sketch CLI                                       |
| `tweakpane`                    | `^3.1.10` | **Must stay on v3.** v4 is ESM-only → breaks Browserify                              |
| `tweakpane-plugin-search-list` | `^0.0.10` | Search dropdown for constellation/star fields; has the click-outside bug noted above |

`canvas-sketch-cli` is the CLI tool (installed globally or via `npx`). It uses **Browserify + esmify** to bundle the sketch. Only CJS/UMD packages work as `require()` targets.

---

## 12. Extension guide (how to add things)

### Add a new theme preset

1. Add a new key to the `themes` object in `canvas-skymap.js`
2. The `themePresetBinding` options object is built via `Object.keys(themes)` — no further change needed

### Add a new CONFIG field

1. Add the key and default value to `CONFIG`
2. Add a corresponding `pane.addInput(params, "yourKey", {...})` in the appropriate folder
3. If the field is set via `window.__SKETCH_CONFIG__`, it will be picked up automatically

### Add a new build config

1. Create `configs/new-variant.json` with partial CONFIG overrides
2. Run `npm run build:all`

### Embed in an external page

Set `CONFIG.target` to the `id` of an existing DOM element. The canvas will be appended to it instead of a new wrapper div. The responsive CSS still applies (uses the wrapper element's id).

---

## 13. File change impact map

| File changed          | Impact                                                           |
| --------------------- | ---------------------------------------------------------------- |
| `canvas-skymap.js`    | Requires `npm start` restart; all logic lives here               |
| `constellations.json` | Data only; changes take effect on next page reload               |
| `build.js`            | Build pipeline only; no effect on dev mode                       |
| `configs/*.json`      | Only affects built output; re-run `npm run build:all`            |
| `docs/template.html`  | Changes the HTML shell for all builds; re-run build              |
| `docs/*.html`         | Built artifacts; do not edit manually — they will be overwritten |
