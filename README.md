# HTML5 Canvas Planetarium Star Map

An animated star map rendered on a 2160 × 1080 canvas using **canvas-sketch**. Stars and constellation lines rotate with the day of year, simulating the night sky's annual cycle. A **Tweakpane** panel exposes all controls at runtime; the same options can be pre-set in the `CONFIG` object at the top of `canvas-skymap.js` before launching.

Check the [demos here](https://amirabet.github.io/html5Canvas_skymap/)!

## Running

```bash
npx canvas-sketch canvas-skymap.js --open
```

---

## Configuration (`CONFIG`)

Edit the `CONFIG` object in `canvas-skymap.js` to pre-configure the sketch before it opens. Every field maps 1-to-1 to a control in the Tweakpane panel.

### Sky display

| Field                    | Type      | Default  | Values                                                            |
| ------------------------ | --------- | -------- | ----------------------------------------------------------------- |
| `viewScale`              | `string`  | `"sky"`  | `"sky"` — cropped panoramic view · `"1:1"` — full square map      |
| `showGrid`               | `boolean` | `true`   | `true` / `false`                                                  |
| `showConstellationName`  | `boolean` | `true`   | `true` / `false`                                                  |
| `showConstellationLines` | `boolean` | `true`   | `true` / `false`                                                  |
| `showStarNames`          | `string`  | `"none"` | `"none"` · `"on_hover"` · any constellation name (e.g. `"Orion"`) |

`showStarNames` accepts any constellation name present in `constellations_v3.json` — those stars' names will always be visible.

---

### Date / time

| Field       | Type      | Default | Values                                                   |
| ----------- | --------- | ------- | -------------------------------------------------------- |
| `dayOfYear` | `integer` | today   | `1` (Jan 1) – `365` (Dec 31)                             |
| `autoplay`  | `boolean` | `false` | `true` — advances one day every 50 ms · `false` — static |

---

### Theme

| Field   | Type     | Default  | Values                                                                           |
| ------- | -------- | -------- | -------------------------------------------------------------------------------- |
| `theme` | `string` | `"blue"` | `"blue"` · `"monochrome"` · `"nightmode"` · `"light"` · `"elegant"` · `"custom"` |

Setting `theme: "custom"` unlocks the individual colour pickers in the panel. When any built-in preset is selected the colour pickers are read-only.

**Preset reference**

| Preset       | Look                                                     |
| ------------ | -------------------------------------------------------- |
| `blue`       | Deep midnight blue sky, pale gold lines, sky-blue stars  |
| `monochrome` | Pure black background, white/grey stars                  |
| `nightmode`  | Black background, deep red palette (dark-room safe)      |
| `light`      | White background, navy/indigo lines                      |
| `elegant`    | Dark navy, antique gold constellation lines, cream stars |

---

### Panel

| Field         | Type      | Default          | Values                                                            |
| ------------- | --------- | ---------------- | ----------------------------------------------------------------- |
| `panelCorner` | `string`  | `"bottom-right"` | `"top-left"` · `"top-right"` · `"bottom-left"` · `"bottom-right"` |
| `showPane`    | `boolean` | `true`           | `true` — panel visible on load · `false` — hidden                 |

---

### Search (initial selection)

These fields control which object the sky is centred on when the sketch first opens.

| Field                 | Type     | Default | Values                                                |
| --------------------- | -------- | ------- | ----------------------------------------------------- |
| `searchConstellation` | `string` | `""`    | Any constellation name, e.g. `"Orion"` · `""` to skip |
| `searchStar`          | `string` | `""`    | Any star name, e.g. `"Sirius"` · `""` to skip         |

#### Startup priority

When the sketch initialises it applies a strict hierarchy — only the highest-priority non-empty field takes effect:

```
1. searchStar          ← wins if non-empty; constellation field is cleared
2. searchConstellation ← wins if searchStar is empty
3. dayOfYear           ← used if both search fields are empty
```

The sky animates to the chosen object on load. After that, runtime behaviour is unchanged: moving the day slider clears both search fields, and selecting one search field clears the other.

**Examples**

```js
// Start centred on Sirius (star priority wins)
searchStar: "Sirius",
searchConstellation: "",   // ignored

// Start centred on Orion (no star set)
searchStar: "",
searchConstellation: "Orion",

// Start at a specific date, no search pre-selection
searchStar: "",
searchConstellation: "",
dayOfYear: 355,            // late December sky
```

---

## Data

Star and constellation data is loaded from `constellations.json`. Each constellation entry contains:

- `name` — display name (used as the value for `searchConstellation` and `showStarNames`)
- `stars[]` — array of `{ name, ra, dec, magnitude }` objects
- `paths[]` — arrays of star name sequences that define the line art

`ra` is right ascension in hours (0 – 24). `dec` is declination in degrees (−90 – +90). `magnitude` is apparent magnitude; lower = brighter.

For a full reference of all 43 constellation names and 269 star names available as CONFIG values, see [docs/star-data.md](docs/star-data.md).

---

## Building

The sketch can be compiled into a single self-contained HTML file using `build.js`, which wraps `canvas-sketch-cli` and adds post-processing (CONFIG injection, custom page title, output renaming).

### Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run build`     | Default build → `docs/canvas-skymap.html`    |
| `npm run build:all` | Build one HTML file per config in `configs/` |

### Single build

```bash
node build.js [--title "Title"] [--config <file-or-json>] [--out <filename.html>]
```

| Flag       | Description                                                           |
| ---------- | --------------------------------------------------------------------- |
| `--title`  | Sets the `<title>` tag. Defaults to the `--out` filename stem.        |
| `--config` | CONFIG overrides — a path to a `.json` file or an inline JSON string. |
| `--out`    | Output filename inside `docs/`. Defaults to `canvas-skymap.html`.     |

**Examples:**

```bash
# Default build (no overrides)
node build.js

# Named output with a config file
node build.js --title "Orion" --config configs/orion.json --out orion.html

# Inline JSON (use a config file on Windows to avoid quoting issues)
node build.js --title "Stars Only" --config configs/stars-only.json --out stars-only.html
```

### Build all configs at once

```bash
npm run build:all
# or
node build.js --all
```

Iterates over every `configs/*.json` file alphabetically, builds a separate HTML file for each one, and renames the output to match the config filename. The page title is derived automatically from the filename stem (`nightmode-autoplay` → `Nightmode Autoplay`).

**Output in `docs/`:**

| Config file                       | Output file                    | Title              |
| --------------------------------- | ------------------------------ | ------------------ |
| `configs/nightmode-autoplay.json` | `docs/nightmode-autoplay.html` | Nightmode Autoplay |
| `configs/orion.json`              | `docs/orion.html`              | Orion              |
| `configs/print.json`              | `docs/print.html`              | Print              |
| `configs/sirius.json`             | `docs/sirius.html`             | Sirius             |
| `configs/stars-only.json`         | `docs/stars-only.html`         | Stars Only         |

### Config files

Config files in `configs/` are plain JSON objects whose keys are a subset of `CONFIG` fields. Any field not present falls back to the `CONFIG` default.

**Example — `configs/orion.json`:**

```json
{
  "searchConstellation": "Orion",
  "theme": "elegant",
  "showPane": false
}
```

To add a new build variant, create a new `.json` file in `configs/` and run `npm run build:all`.

### How CONFIG injection works

1. `build.js` runs `canvas-sketch-cli --inline` to produce a single-file HTML bundle
2. It inserts `<script>window.__SKETCH_CONFIG__ = {...};</script>` before the main bundle
3. The sketch reads it via `...(window.__SKETCH_CONFIG__ || {})` at the end of `CONFIG`
4. The page title is replaced with the value from `--title`

In dev mode (`npm start`) `window.__SKETCH_CONFIG__` is never set, so all CONFIG defaults apply unchanged.

### Pending tasks

- Improve repo confgi
  - block branches
  - autopublish releases
- Add speed toggle for autoplay
- Make a plugin with CDN
