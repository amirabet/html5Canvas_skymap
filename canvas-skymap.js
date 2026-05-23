const canvasSketch = require("canvas-sketch");
const tweakPane = require("tweakpane");
const TweakpaneSearchListPlugin = require("tweakpane-plugin-search-list");

const constellationsData = require("./constellations.json");

const settings = {
  dimensions: [2160, 1080],
  animate: true,
};

// ─── Shared constants ──────────────────────────────────────────────────────
const MS_PER_DAY = 86400000;
const SEARCH_NONE = ""; // empty option key used by search-list fields

// ─── Default configuration ────────────────────────────────────────────────
// All knobs exposed in the Tweakpane UI, collected in one place so a future
// caller can supply a partial overrides object to pre-configure the sketch.
const getTodayDayOfYear = () => {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / MS_PER_DAY);
};
// Convert a 1-based day-of-year to a short readable date string (e.g. "Mar 24").
// Uses a fixed non-leap year so day 1 = Jan 1 and day 365 = Dec 31.
const dayOfYearToDate = (day) =>
  new Date(2001, 0, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const CONFIG = {
  // ── Sky display ──────────────────────────────────────────────────────────
  viewScale: "sky", // "sky" | "1:1"
  showGrid: true,
  showConstellationName: true,
  showConstellationLines: true,
  showStarNames: "none", // "none" | "on_hover" | <constellationName>

  // ── Date / time ──────────────────────────────────────────────────────────
  dayOfYear: getTodayDayOfYear(), // 1–365 (defaults to today)
  date: dayOfYearToDate(getTodayDayOfYear()), // display string, kept in sync with dayOfYear
  autoplay: false, // animate day-of-year forward automatically

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme: "blue", // preset key | "custom"

  // ── Panel ─────────────────────────────────────────────────────────────────
  panelCorner: "bottom-right", // "top-left" | "top-right" | "bottom-left" | "bottom-right"
  showPane: true, // whether the Tweakpane panel is visible

  // ── Search (initial selection) ─────────────────────────────────────────────
  // Priority at startup: searchStar (1) > searchConstellation (2) > dayOfYear (3).
  // The top-priority non-empty value wins; lower-priority fields are ignored.
  // This only affects the initial view — runtime behaviour is unchanged.
  searchConstellation: SEARCH_NONE, // constellation name | SEARCH_NONE ("")
  searchStar: SEARCH_NONE, // star name | SEARCH_NONE ("")

  // ── Embedding ─────────────────────────────────────────────────────────────
  target: "", // id of an existing DOM element to mount the canvas into;
  // leave empty to auto-create a #canvas-wrapper div

  // ── Build-time overrides ───────────────────────────────────────────────────
  // Injected by build.js via window.__SKETCH_CONFIG__ before the main script.
  // Has no effect in dev mode (window.__SKETCH_CONFIG__ is undefined → spread {}).
  ...(window.__SKETCH_CONFIG__ || {}),
};

// ─── Theme ─────────────────────────────────────────────────────────────────
// Converts a theme {r, g, b} colour to a CSS rgb() string for canvas use.
const toRgb = ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`;

const themes = {
  blue: {
    background: { r: 25, g: 25, b: 112 }, // MidnightBlue
    grid: { r: 65, g: 105, b: 225 }, // RoyalBlue
    constellationLine: { r: 238, g: 232, b: 170 }, // PaleGoldenRod
    starStroke: { r: 238, g: 232, b: 170 }, // PaleGoldenRod
    starDimColor: { r: 135, g: 206, b: 250 }, // LightSkyBlue
    starBrightColor: { r: 224, g: 255, b: 255 },
    constellationLabel: { r: 135, g: 206, b: 250 }, // LightSkyBlue
    labelStroke: { r: 25, g: 25, b: 112 }, // MidnightBlue
    starLabel: { r: 255, g: 255, b: 255 }, // white
  },
  monochrome: {
    background: { r: 0, g: 0, b: 0 },
    grid: { r: 50, g: 50, b: 50 },
    constellationLine: { r: 112, g: 112, b: 112 },
    starStroke: { r: 255, g: 255, b: 255 },
    starDimColor: { r: 150, g: 150, b: 150 },
    starBrightColor: { r: 255, g: 255, b: 255 },
    constellationLabel: { r: 200, g: 200, b: 200 },
    labelStroke: { r: 0, g: 0, b: 0 },
    starLabel: { r: 255, g: 255, b: 255 },
  },
  nightmode: {
    background: { r: 0, g: 0, b: 0 },
    grid: { r: 100, g: 15, b: 15 },
    constellationLine: { r: 180, g: 35, b: 15 },
    starStroke: { r: 180, g: 35, b: 15 },
    starDimColor: { r: 140, g: 25, b: 10 },
    starBrightColor: { r: 255, g: 90, b: 30 },
    constellationLabel: { r: 200, g: 45, b: 20 },
    labelStroke: { r: 0, g: 0, b: 0 },
    starLabel: { r: 220, g: 60, b: 25 },
  },
  light: {
    background: { r: 255, g: 255, b: 255 },
    grid: { r: 180, g: 180, b: 200 },
    constellationLine: { r: 80, g: 100, b: 160 },
    starStroke: { r: 60, g: 60, b: 120 },
    starDimColor: { r: 120, g: 130, b: 180 },
    starBrightColor: { r: 30, g: 30, b: 80 },
    constellationLabel: { r: 60, g: 80, b: 160 },
    labelStroke: { r: 255, g: 255, b: 255 },
    starLabel: { r: 20, g: 20, b: 80 },
  },
  elegant: {
    background: { r: 10, g: 20, b: 40 }, // deep dark navy
    grid: { r: 38, g: 72, b: 110 }, // muted steel blue
    constellationLine: { r: 190, g: 155, b: 65 }, // antique gold
    starStroke: { r: 220, g: 200, b: 140 }, // warm gold
    starDimColor: { r: 160, g: 130, b: 60 }, // dim amber gold
    starBrightColor: { r: 248, g: 244, b: 228 }, // warm cream white
    constellationLabel: { r: 210, g: 175, b: 80 }, // golden yellow
    labelStroke: { r: 10, g: 20, b: 40 }, // deep navy (matches bg)
    starLabel: { r: 235, g: 225, b: 190 }, // soft warm white
  },
};

const getStarFillColor = (brightness) => {
  // brightness = 10^(-0.4*m); brightest stars ~1.0, dimmest ~0.01
  const t = Math.max(0, Math.min(brightness, 1.0));
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  return toRgb({
    r: lerp(theme.starDimColor.r, theme.starBrightColor.r),
    g: lerp(theme.starDimColor.g, theme.starBrightColor.g),
    b: lerp(theme.starDimColor.b, theme.starBrightColor.b),
  });
};

const getStarBlinkAmount = (time, x, y, brightness) => {
  const phaseOffset = x * 17 + y * 31 + brightness * 2;
  const pulse = (Math.sin(time * 2 + phaseOffset) + 1) / 2;

  return 0.45 + pulse * 0.55;
};

const raDecToXY = (ra, dec, rotationOffset) => {
  // RA: 0–24 horas
  // DEC: -90 a +90 grados

  const angle = (1 - ra / 24) * 2 * Math.PI + rotationOffset;

  // radius is normalized to the canvas half-size so DEC=0 lands on the rim
  const radius = ((90 - dec) / 90) * 0.45;

  const xPos = 0.5 + radius * Math.cos(angle);
  const yPos = 0.5 - radius * Math.sin(angle);

  return { xPos, yPos };
};

const drawTextOnArc = (
  context,
  text,
  arcCenterX,
  arcCenterY,
  radius,
  centerAngle,
) => {
  const spacing = 4;
  const characters = [...text].reverse();
  const characterAngles = characters.map(
    (character) => (context.measureText(character).width + spacing) / radius,
  );
  const totalAngle = characterAngles.reduce(
    (sum, characterAngle) => sum + characterAngle,
    0,
  );

  let currentAngle = centerAngle - totalAngle / 2;

  for (let i = 0; i < characters.length; i++) {
    const character = characters[i];
    const characterAngle = characterAngles[i];

    currentAngle += characterAngle / 2;

    const x = arcCenterX + Math.cos(currentAngle) * radius;
    const y = arcCenterY + Math.sin(currentAngle) * radius;
    const tangentAngle = currentAngle - Math.PI / 2;

    context.save();
    context.translate(x, y);
    context.rotate(tangentAngle);
    context.strokeText(character, 0, 0);
    context.fillText(character, 0, 0);
    context.restore();

    currentAngle += characterAngle / 2;
  }
};

// Draws a star label (outlined text) at the given secondary-canvas position.
const drawStarLabel = (
  ctx,
  name,
  x,
  y,
  { font = "9px sans-serif", lineWidth = 3 } = {},
) => {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = toRgb(theme.labelStroke);
  ctx.lineWidth = lineWidth;
  ctx.fillStyle = toRgb(theme.starLabel);
  ctx.strokeText(name, x + 7, y);
  ctx.fillText(name, x + 7, y);
  ctx.restore();
};
const planetariumCanvas = document.createElement("canvas");
const planetariumCanvasContext = planetariumCanvas.getContext("2d");
const constellations = constellationsData.constellations.flatMap((entry) =>
  Array.isArray(entry.constellations) ? entry.constellations : [entry],
);
// Day 83 (March 24) → rotationOffset = π/2 (the original hardcoded value).
// BASE is back-calculated so that calibration stays when dayOfYear = 83.
const DAY_OFFSET_BASE = Math.PI / 2 - (83 / 365.25) * 2 * Math.PI;

// ─── Helpers ───────────────────────────────────────────────────────────────

// Wraps a fractional day value to an integer in [1, 365]. Needed because the
// search animation destination can cross year boundaries (e.g. searching for a
// winter constellation from early January yields a raw day around −8 → 357).
const wrapDay = (d) => ((Math.round(d) - 1 + 3650) % 365) + 1;

// ─── Tweakpane option objects ──────────────────────────────────────────────
// Built upfront so they can be referenced both in params and in pane inputs.

// "Show star names" dropdown: none | hover | per-constellation
const starNameOptions = { None: "none", "User action": "on_hover" };
for (const constellation of constellations) {
  starNameOptions[constellation.name] = constellation.name;
}

// Constellation search-list: empty entry + one entry per constellation
const searchConstellationOptions = { [SEARCH_NONE]: SEARCH_NONE };
for (const constellation of constellations) {
  searchConstellationOptions[constellation.name] = constellation.name;
}

// Star search-list: empty entry + all unique star names sorted A–Z.
// Also builds starRaByName for the rotation calculation (first occurrence wins).
const starRaByName = {};
for (const constellation of constellations) {
  for (const star of constellation.stars) {
    if (starRaByName[star.name] === undefined) {
      starRaByName[star.name] = star.ra;
    }
  }
}
const searchStarOptions = { [SEARCH_NONE]: SEARCH_NONE };
Object.keys(starRaByName)
  .sort()
  .forEach((name) => {
    searchStarOptions[name] = name;
  });

// Initialize the live theme from CONFIG.theme (falls back to blue if the key is unknown).
const theme = { ...(themes[CONFIG.theme] ?? themes.blue) };

// ─── Params ────────────────────────────────────────────────────────────────
// Runtime working copy of CONFIG; date is updated whenever dayOfYear changes.
const params = { ...CONFIG };

// ─── Pane ──────────────────────────────────────────────────────────────────
const pane = new tweakPane.Pane({ title: "Planetarium Controls" });
pane.registerPlugin(TweakpaneSearchListPlugin);
pane.hidden = !CONFIG.showPane;

// ─── Sky Data folder ────────────────────────────────────────────────────────
const skyDataFolder = pane.addFolder({ title: "Sky Data", expanded: false });
skyDataFolder.addInput(params, "viewScale", {
  label: "View scale",
  options: { "Sky view": "sky", "1:1": "1:1" },
});
skyDataFolder.addInput(params, "showGrid", { label: "Show grid" });
skyDataFolder.addInput(params, "showConstellationName", {
  label: "Show constellation name",
});
skyDataFolder.addInput(params, "showConstellationLines", {
  label: "Show constellation lines",
});
skyDataFolder.addInput(params, "showStarNames", {
  label: "Show star names",
  options: starNameOptions,
});

// ─── State: intervals and bindings ─────────────────────────────────────────
// Bindings are stored so we can call .refresh() after external param changes.
let autoplayInterval = null;
let todayAnimInterval = null;
let autoplayBinding = null;
let searchConstellationBinding = null;
let searchStarBinding = null;
// Prevents the .refresh() call inside resetXSearch() from re-triggering
// the other field's change handler and creating a cascade.
let suppressSearchChange = false;

// Stops autoplay if running and syncs the toggle UI.
function stopAutoplay() {
  if (!autoplayInterval) return;
  clearInterval(autoplayInterval);
  autoplayInterval = null;
  params.autoplay = false;
  if (autoplayBinding) autoplayBinding.refresh();
}

// Clears each search field independently (used for mutual exclusion).
// The search-list plugin keeps two separate values: `value` (the bound param)
// and `textValue` (what is displayed in the input). refresh() only updates
// `value`; we must also clear `textValue` so the input visually resets.
function clearSearchListDisplay(binding) {
  const pluginCtrl = binding.controller_.valueController;
  if (pluginCtrl && pluginCtrl.textValue) {
    pluginCtrl.textValue.rawValue = SEARCH_NONE;
  }
}
function resetConstellationSearch() {
  if (params.searchConstellation === SEARCH_NONE) return;
  params.searchConstellation = SEARCH_NONE;
  suppressSearchChange = true;
  if (searchConstellationBinding) {
    searchConstellationBinding.refresh();
    clearSearchListDisplay(searchConstellationBinding);
  }
  suppressSearchChange = false;
}
function resetStarSearch() {
  if (params.searchStar === SEARCH_NONE) return;
  params.searchStar = SEARCH_NONE;
  suppressSearchChange = true;
  if (searchStarBinding) {
    searchStarBinding.refresh();
    clearSearchListDisplay(searchStarBinding);
  }
  suppressSearchChange = false;
}
// Resets both search fields at once (called when the day changes).
function resetSearch() {
  resetConstellationSearch();
  resetStarSearch();
}

// ─── Search rotation helpers ───────────────────────────────────────────────
let searchAnimFrame = null;

// Smoothly animates params.dayOfYear toward `target` (cubic ease-out, 900 ms),
// updating the date display each frame so the slider and date stay in sync
// with the rotation. Because the rotation lives entirely in dayOfYear,
// "Go to Today" always works from wherever the view has landed.
function animateToDayOfYear(target) {
  if (searchAnimFrame) cancelAnimationFrame(searchAnimFrame);
  searchFolder.disabled = true; // block new searches until rotation finishes
  const startDay = params.dayOfYear;
  // Normalise to the shortest arc within ±182.625 days (half a year = half a revolution).
  let diff = target - startDay;
  while (diff > 182.625) diff -= 365.25;
  while (diff < -182.625) diff += 365.25;
  const destination = startDay + diff;
  const duration = 900;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
    params.dayOfYear = wrapDay(startDay + diff * ease);
    params.date = dayOfYearToDate(params.dayOfYear);
    suppressSearchChange = true;
    dayOfYearBinding.refresh();
    suppressSearchChange = false;
    if (t < 1) searchAnimFrame = requestAnimationFrame(step);
    else {
      searchAnimFrame = null;
      searchFolder.disabled = false;
    }
  }
  searchAnimFrame = requestAnimationFrame(step);
}

// Computes the day-of-year that places the given RA at the bottom-center of
// the chart (totalRotation = 3π/2) and starts the animation.
// Derived from: DAY_OFFSET_BASE + (targetDay/365.25)·2π = 3π/2 − (1−ra/24)·2π
function rotateToRa(ra) {
  const numerator =
    (3 * Math.PI) / 2 - (1 - ra / 24) * 2 * Math.PI - DAY_OFFSET_BASE;
  const targetDay = (numerator * 365.25) / (2 * Math.PI);
  animateToDayOfYear(targetDay);
}

// ─── Date folder ───────────────────────────────────────────────────────────
const dateFolder = pane.addFolder({ title: "Date", expanded: false });

const dayOfYearBinding = dateFolder
  .addInput(params, "dayOfYear", {
    label: "Day of year",
    min: 1,
    max: 365,
    step: 1,
  })
  .on("change", () => {
    params.date = dayOfYearToDate(params.dayOfYear);
    if (!suppressSearchChange) resetSearch();
  });

dateFolder.addMonitor(params, "date", { label: "Date", interval: 50 });

autoplayBinding = dateFolder
  .addInput(params, "autoplay", { label: "Autoplay" })
  .on("change", () => {
    if (params.autoplay) {
      autoplayInterval = setInterval(() => {
        params.dayOfYear = params.dayOfYear >= 365 ? 1 : params.dayOfYear + 1;
        dayOfYearBinding.refresh(); // change handler updates date and resets search
      }, 50);
    } else {
      clearInterval(autoplayInterval);
      autoplayInterval = null;
    }
  });

// Kick-start autoplay if it was pre-set via __SKETCH_CONFIG__.
if (params.autoplay && !autoplayInterval) {
  autoplayInterval = setInterval(() => {
    params.dayOfYear = params.dayOfYear >= 365 ? 1 : params.dayOfYear + 1;
    dayOfYearBinding.refresh();
  }, 50);
}

dateFolder.addButton({ title: "Go to Today" }).on("click", () => {
  const targetDay = getTodayDayOfYear();
  stopAutoplay();
  clearInterval(todayAnimInterval);
  if (searchAnimFrame) {
    cancelAnimationFrame(searchAnimFrame);
    searchAnimFrame = null;
    searchFolder.disabled = false;
  }
  resetSearch();

  const dir = targetDay > params.dayOfYear ? 1 : -1;
  todayAnimInterval = setInterval(() => {
    const remaining = Math.abs(targetDay - params.dayOfYear);
    const step = dir * Math.min(3, remaining);
    params.dayOfYear += step;
    dayOfYearBinding.refresh(); // change handler updates date and resets search (no-op)
    if (params.dayOfYear === targetDay) {
      clearInterval(todayAnimInterval);
      todayAnimInterval = null;
    }
  }, 10);
});

// ─── Search folder ─────────────────────────────────────────────────────────
const searchFolder = pane.addFolder({ title: "Search", expanded: false });

// Factory for the shared search-list field config (instant filtering).
const searchListConfig = (label, options) => ({
  label,
  view: "search-list",
  options,
  noDataText: "not found",
  debounceDelay: 0,
});

searchConstellationBinding = searchFolder
  .addInput(
    params,
    "searchConstellation",
    searchListConfig("Constellation", searchConstellationOptions),
  )
  .on("change", () => {
    if (suppressSearchChange) return;
    stopAutoplay();
    resetStarSearch(); // always clear star when constellation field is touched
    if (params.searchConstellation === SEARCH_NONE) return;
    // Rotate to the centroid RA of the selected constellation
    const found = constellations.find(
      (c) => c.name === params.searchConstellation,
    );
    if (!found) return;
    const avgRa =
      found.stars.reduce((sum, s) => sum + s.ra, 0) / found.stars.length;
    rotateToRa(avgRa);
  });

searchStarBinding = searchFolder
  .addInput(params, "searchStar", searchListConfig("Star", searchStarOptions))
  .on("change", () => {
    if (suppressSearchChange) return;
    stopAutoplay();
    resetConstellationSearch(); // always clear constellation when star field is touched
    if (params.searchStar === SEARCH_NONE) return;
    const starRa = starRaByName[params.searchStar];
    if (starRa === undefined) return;
    rotateToRa(starRa);
  });

// ─── Pane theming ───────────────────────────────────────────────────────
// Applies the current sketch theme to Tweakpane by writing --tp-* CSS
// custom properties directly onto pane.element (pure JS, no CSS file needed).
// canvasWrapper is set in the sketch factory and updated here on theme change.
let canvasWrapper = null;
const applyPaneTheme = () => {
  const el = pane.element;
  const bg = theme.background;
  const label = theme.constellationLabel;
  const bright = theme.starBrightColor;
  const grid = theme.grid;
  const rgba = ({ r, g, b }, a = 1) => `rgba(${r},${g},${b},${a})`;
  const hex = ({ r, g, b }) =>
    [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 6"><path fill="#${hex(label)}" d="M0 0l5 6 5-6z"/></svg>`;
  const arrowUrl = `url("data:image/svg+xml,${encodeURIComponent(arrowSvg)}")`;

  el.style.setProperty("--tp-base-background-color", rgba(bg, 0.95));
  el.style.setProperty("--tp-base-shadow-color", rgba(bg, 0.6));
  el.style.setProperty("--tp-button-background-color", rgba(grid, 1));
  el.style.setProperty(
    "--tp-button-background-color-active",
    rgba(bright, 0.9),
  );
  el.style.setProperty("--tp-button-background-color-focus", rgba(grid, 0.9));
  el.style.setProperty("--tp-button-background-color-hover", rgba(grid, 0.8));
  el.style.setProperty("--tp-button-foreground-color", rgba(bg, 1));
  el.style.setProperty("--tp-container-background-color", rgba(bg, 0.5));
  el.style.setProperty("--tp-container-background-color-active", rgba(bg, 0.8));
  el.style.setProperty("--tp-container-background-color-focus", rgba(bg, 0.7));
  el.style.setProperty("--tp-container-background-color-hover", rgba(bg, 0.6));
  el.style.setProperty("--tp-container-foreground-color", rgba(label, 0.8));
  el.style.setProperty("--tp-groove-foreground-color", rgba(grid, 0.4));
  el.style.setProperty("--tp-input-background-color", rgba(bg, 0.4));
  el.style.setProperty("--tp-input-background-color-active", rgba(bg, 0.7));
  el.style.setProperty("--tp-input-background-color-focus", rgba(bg, 0.6));
  el.style.setProperty("--tp-input-background-color-hover", rgba(bg, 0.5));
  el.style.setProperty("--tp-input-foreground-color", rgba(bright, 0.9));
  el.style.setProperty("--tp-label-foreground-color", rgba(label, 0.9));
  el.style.setProperty("--tp-monitor-background-color", rgba(bg, 0.3));
  el.style.setProperty("--tp-monitor-foreground-color", rgba(bright, 0.5));

  el.style.border = `1px solid ${rgba(label, 0.5)}`;
  el.style.borderRadius = "4px";
  if (canvasWrapper)
    canvasWrapper.style.backgroundColor = toRgb(theme.background);

  // The search-list plugin renders its dropdown via Popper.js, appending it to
  // document.body — outside pane.element — so the scoped --tp-* vars above
  // can't reach it. We inject/update a <style> tag instead (still pure JS).
  let searchListStyle = document.getElementById("tp-search-list-theme");
  if (!searchListStyle) {
    searchListStyle = document.createElement("style");
    searchListStyle.id = "tp-search-list-theme";
    document.head.appendChild(searchListStyle);
  }
  searchListStyle.textContent = `
    .tp-search-listv_options {
      background-color: ${rgba(bg, 0.97)} !important;
      border: 1px solid ${rgba(label, 0.4)} !important;
      border-radius: 4px !important;
      scrollbar-color: ${rgba(grid, 0.8)} ${rgba(bg, 0.4)};
      scrollbar-width: thin;
    }
    .tp-search-listv_options li {
      color: ${rgba(bright, 1)};
    }
    .tp-search-listv_options li:hover {
      background-color: ${rgba(grid, 0.85)} !important;
      color: ${rgba(bright, 1)};
    }
    .tp-search-listv_options .no-data {
      color: ${rgba(label, 0.7)} !important;
    }
    .tp-search-listv_options::-webkit-scrollbar {
      width: 5px;
    }
    .tp-search-listv_options::-webkit-scrollbar-track {
      background: ${rgba(bg, 0.4)};
      border-radius: 3px;
    }
    .tp-search-listv_options::-webkit-scrollbar-thumb {
      background-color: ${rgba(grid, 0.8)};
      border-radius: 3px;
    }
    .tp-search-listv_options::-webkit-scrollbar-thumb:hover {
      background-color: ${rgba(grid, 1)};
    }

    /* Search-list plugin trigger: accent arrow + pointer cursor */
    .tp-search-listv,
    .tp-search-listv_i {
      cursor: pointer !important;
    }
    .tp-search-listv_m {
      color: ${rgba(bright, 0.9)} !important;
    }
    .tp-search-listv_m svg path {
      fill: ${rgba(bright, 0.9)} !important;
    }

    /* Checkbox: subtle border on the visible box */
    .tp-ckbv_w {
      border: 1px solid ${rgba(label, 0.3)} !important;
      border-radius: 3px;
      box-sizing: border-box !important;
    }

    /* Dropdown: border, pointer cursor, custom accent arrow */
    .tp-lstv {
      border: 1px solid ${rgba(label, 0.25)} !important;
      border-radius: 3px !important;
      box-sizing: border-box !important;
      cursor: pointer !important;
    }
    .tp-lstv_s {
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      appearance: none !important;
      background-image: ${arrowUrl} !important;
      background-repeat: no-repeat !important;
      background-position: right 6px center !important;
      background-size: 10px 6px !important;
      padding-right: 24px !important;
      cursor: pointer !important;
    }
    /* Hide Tweakpane's own CSS-triangle marker so only our SVG arrow shows */
    .tp-lstv_m {
      display: none !important;
    }

    /* Input fields: subtle border (text input, monitor readouts — not slider) */
    .tp-txtv_i,
    .tp-mllv,
    .tp-sglv,
    .tp-sglv_v {
      border: 1px solid ${rgba(label, 0.25)} !important;
      border-radius: 3px !important;
      box-sizing: border-box !important;
    }

    /* Folder titles: always bright + always border-bottom */
    .tp-fldv_b {
      color: ${rgba(bright, 1)} !important;
      font-weight: 600 !important;
      border-bottom: 1px solid ${rgba(label, 0.3)} !important;
    }
    /* Folder accordion marker: replicate Tweakpane's cross gradient with bright accent color */
    .tp-fldv_m {
      background: linear-gradient(to left, ${rgba(bright, 1)}, ${rgba(bright, 1)} 2px, transparent 2px, transparent 4px, ${rgba(bright, 1)} 4px) !important;
      opacity: 1 !important;
    }
    /* Opened folder content: border-bottom closes the panel visually */
    .tp-fldv_c {
      border-bottom: 1px solid ${rgba(label, 0.3)} !important;
    }

    /* Root pane: block the button from collapsing the pane */
    .tp-rotv_b {
      pointer-events: none !important;
      cursor: default !important;
      border-bottom: 1px solid ${rgba(bright, 1)} !important;
    }
    /* Hide the rotating accordion marker on the root pane title */
    .tp-rotv_m {
      display: none !important;
    }
    /* Root pane title text */
    .tp-rotv_t {
      color: ${rgba(bright, 1)} !important;
      font-weight: 700 !important;
      font-size: 13px !important;
      letter-spacing: 0.1em !important;
      text-shadow: 0 0 8px ${rgba(label, 0.6)};
    }
  `;
};

// ─── Theme folder ────────────────────────────────────────────────────────
const themeFolder = pane.addFolder({ title: "Theme", expanded: false });
const themePresetBinding = themeFolder.addInput(params, "theme", {
  label: "Preset",
  options: Object.fromEntries(
    [...Object.keys(themes), "custom"].map((k) => [k, k]),
  ),
});

themeFolder.addSeparator();
const themeColorBindings = [
  ["background", "Background"],
  ["grid", "Grid"],
  ["constellationLine", "Constellation line"],
  ["starStroke", "Star stroke"],
  ["starDimColor", "Star dim"],
  ["starBrightColor", "Star bright"],
  ["constellationLabel", "Constellation label"],
  ["labelStroke", "Label stroke"],
  ["starLabel", "Star label"],
].map(([key, label]) => {
  const b = themeFolder.addInput(theme, key, { label });
  b.disabled = true;
  return b;
});

themePresetBinding.on("change", () => {
  if (params.theme === "custom") {
    themeColorBindings.forEach((b) => {
      b.disabled = false;
    });
  } else {
    const preset = themes[params.theme];
    if (preset) Object.assign(theme, preset);
    themeColorBindings.forEach((b) => {
      b.disabled = true;
      b.refresh();
    });
  }
  applyPaneTheme();
});

themeFolder.addSeparator();

// ─── Pane position ──────────────────────────────────────────────────────────
const applyPanePosition = () => {
  const el = pane.element;
  const margin = "12px";
  const [v, h] = params.panelCorner.split("-");
  el.style.position = "fixed";
  el.style.top = v === "top" ? margin : "auto";
  el.style.bottom = v === "bottom" ? margin : "auto";
  el.style.left = h === "left" ? margin : "auto";
  el.style.right = h === "right" ? margin : "auto";
};

themeFolder
  .addInput(params, "panelCorner", {
    label: "Panel corner",
    options: {
      "Top left": "top-left",
      "Top right": "top-right",
      "Bottom left": "bottom-left",
      "Bottom right": "bottom-right",
    },
  })
  .on("change", () => applyPanePosition());

// Apply the initial theme and position to the pane on load
applyPaneTheme();
applyPanePosition();

// ─── Apply CONFIG initial search priority ──────────────────────────────────
// Enforces: searchStar (1) > searchConstellation (2) > dayOfYear (3).
// Runs once after all bindings are ready. Runtime resets are unaffected.
const applyConfigSearch = () => {
  if (CONFIG.searchStar !== SEARCH_NONE) {
    // Star wins — clear constellation, set star, rotate.
    params.searchConstellation = SEARCH_NONE;
    params.searchStar = CONFIG.searchStar;
    suppressSearchChange = true;
    searchConstellationBinding.refresh();
    clearSearchListDisplay(searchConstellationBinding);
    suppressSearchChange = false;
    searchStarBinding.refresh();
    const ra = starRaByName[CONFIG.searchStar];
    if (ra !== undefined) rotateToRa(ra);
  } else if (CONFIG.searchConstellation !== SEARCH_NONE) {
    // Constellation wins — set field, rotate to centroid RA.
    params.searchConstellation = CONFIG.searchConstellation;
    searchConstellationBinding.refresh();
    const found = constellations.find(
      (c) => c.name === CONFIG.searchConstellation,
    );
    if (found) {
      const avgRa =
        found.stars.reduce((sum, s) => sum + s.ra, 0) / found.stars.length;
      rotateToRa(avgRa);
    }
  }
  // else: dayOfYear from CONFIG already applied via params spread — nothing to do.
};
applyConfigSearch();

// ─── Fix: search-list plugin click-outside bug ──────────────────────────────
// The plugin's own onDocClick handler has the containment check inverted so
// clicking outside never closes the dropdown. We patch it here instead.
document.addEventListener("mousedown", (e) => {
  const openBox = document.querySelector(
    ".tp-search-listv_select-box[data-show]",
  );
  if (!openBox) return;
  const insideTrigger = !!e.target.closest?.(".tp-search-listv");
  const insidePopup = openBox.contains(e.target);
  if (!insideTrigger && !insidePopup) openBox.removeAttribute("data-show");
});

// Mouse position in main canvas logical coordinates (initialised off-screen)
const mousePos = { x: -9999, y: -9999 };
let canvasListenerAttached = false;

const sketch = ({ canvas }) => {
  // ─── Responsive wrapper ──────────────────────────────────────────────────
  // If CONFIG.target names an existing element, mount the canvas into it.
  // Otherwise auto-create a #canvas-wrapper div next to the canvas.
  let wrapper = CONFIG.target ? document.getElementById(CONFIG.target) : null;
  const wrapperId = "skystarmapcanvas";
  if (wrapper) {
    wrapper.appendChild(canvas);
  } else {
    wrapper = document.createElement("div");
    wrapper.id = wrapperId;
    canvas.parentNode.insertBefore(wrapper, canvas);
    wrapper.appendChild(canvas);
  }
  if (!wrapper.id) wrapper.id = wrapperId;
  canvasWrapper = wrapper;

  // Inject responsive CSS. Uses !important to override the inline
  // width/height px values that canvas-sketch sets on the canvas element.
  const responsiveStyle = document.createElement("style");
  responsiveStyle.textContent = `
    #${wrapper.id} {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: ${toRgb(theme.background)};
      display: flex;
      justify-content: center;
      align-items: center;
    }
    #${wrapper.id} canvas {
      display: block !important;
      width: auto !important;
      height: 100% !important;
      aspect-ratio: 2 / 1;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(responsiveStyle);

  return ({ context, width, height, time }) => {
    // Use the smaller dimension as the base so the star circle stays circular
    // on non-square canvases (e.g. 2160×1080). xOffset centres it horizontally.
    const isSkyView = params.viewScale === "sky";
    const size = Math.min(width, height);
    const xOffset = (width - size) / 2;
    planetariumCanvas.width = Math.round(size * (isSkyView ? 1.9 : 1));
    planetariumCanvas.height = Math.round(size * (isSkyView ? 1.9 : 1));
    if (isSkyView) planetariumCanvasContext.scale(1.9, 1.9);

    // Attach mouse/touch listeners once so we can track hover/touch position
    if (!canvasListenerAttached) {
      const canvasEl = context.canvas;

      const setFromClient = (clientX, clientY) => {
        const rect = canvasEl.getBoundingClientRect();
        mousePos.x = (clientX - rect.left) * (width / rect.width);
        mousePos.y = (clientY - rect.top) * (height / rect.height);
      };
      const clear = () => {
        mousePos.x = -9999;
        mousePos.y = -9999;
      };

      canvasEl.addEventListener("mousemove", (e) =>
        setFromClient(e.clientX, e.clientY),
      );
      canvasEl.addEventListener("mouseleave", clear);

      canvasEl.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          setFromClient(e.touches[0].clientX, e.touches[0].clientY);
        },
        { passive: false },
      );
      canvasEl.addEventListener(
        "touchmove",
        (e) => {
          e.preventDefault();
          setFromClient(e.touches[0].clientX, e.touches[0].clientY);
        },
        { passive: false },
      );
      canvasEl.addEventListener("touchend", clear);
      canvasEl.addEventListener("touchcancel", clear);

      canvasListenerAttached = true;
    }

    // Radius for planetary Canvas
    // const radGradient = context.createRadialGradient(
    //   width / 2,
    //   height / 2,
    //   width / 2,
    //   width / 2,
    //   height / 2,
    //   width / 5,
    // );
    // radGradient.addColorStop(0, "MidnightBlue");
    // radGradient.addColorStop(0.9, "DarkBlue");
    // radGradient.addColorStop(1, "DarkBlue");
    // context.fillStyle = radGradient;

    // Fill the main canvas margins (outside the star-map square) with bg colour.
    context.fillStyle = toRgb(theme.background);
    context.fillRect(0, 0, width, height);
    planetariumCanvasContext.fillStyle = toRgb(theme.background);
    planetariumCanvasContext.fillRect(0, 0, size, size);

    // Planetarium grid
    // Create circles and lines for sky map
    if (params.showGrid) {
      const centerX = size / 2;
      const centerY = size / 2;
      const firstCircleRadius = size / 12.2;
      const lastCircleRadius = (size / 12.2) * 6;

      for (let i = 0; i < 6; i++) {
        planetariumCanvasContext.beginPath();
        planetariumCanvasContext.arc(
          centerX,
          centerY,
          (size / 12.2) * (i + 1),
          0,
          Math.PI * 2,
        );
        planetariumCanvasContext.strokeStyle = toRgb(theme.grid);
        planetariumCanvasContext.lineWidth = 1;
        planetariumCanvasContext.stroke();
      }

      for (let i = 0; i < 24; i++) {
        const angle = (Math.PI * 2 * i) / 24;
        const startX = centerX + Math.cos(angle) * firstCircleRadius;
        const startY = centerY + Math.sin(angle) * firstCircleRadius;
        const endX = centerX + Math.cos(angle) * lastCircleRadius;
        const endY = centerY + Math.sin(angle) * lastCircleRadius;

        planetariumCanvasContext.beginPath();
        planetariumCanvasContext.moveTo(startX, startY);
        planetariumCanvasContext.lineTo(endX, endY);
        planetariumCanvasContext.strokeStyle = toRgb(theme.grid);
        planetariumCanvasContext.lineWidth = 1;
        planetariumCanvasContext.stroke();
      }
    }

    // Rotation offset derived from the selected day of year.
    // The sky at midnight makes one full rotation per year: +2π / 365.25 per day.
    const rotationOffset =
      DAY_OFFSET_BASE + (params.dayOfYear / 365.25) * 2 * Math.PI;

    // loop all constellations
    for (const constellation of constellations) {
      const starsByName = Object.fromEntries(
        constellation.stars.map((star) => [
          star.name,
          { ...star, ...raDecToXY(star.ra, star.dec, rotationOffset) },
        ]),
      );
      const bounds = Object.values(starsByName).reduce(
        (accumulator, star) => ({
          minX: Math.min(accumulator.minX, star.xPos),
          minY: Math.min(accumulator.minY, star.yPos),
          maxX: Math.max(accumulator.maxX, star.xPos),
          maxY: Math.max(accumulator.maxY, star.yPos),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        },
      );

      // Paint Lines
      if (
        params.showConstellationLines ||
        constellation.name === params.searchConstellation
      ) {
        for (const path of constellation.paths) {
          for (let i = 0; i < path.length - 1; i++) {
            const startStar = starsByName[path[i]];
            const endStar = starsByName[path[i + 1]];

            if (!startStar || !endStar) continue;

            planetariumCanvasContext.beginPath();
            planetariumCanvasContext.moveTo(
              startStar.xPos * size,
              startStar.yPos * size,
            );
            planetariumCanvasContext.lineTo(
              endStar.xPos * size,
              endStar.yPos * size,
            );
            planetariumCanvasContext.lineWidth = 1;
            planetariumCanvasContext.strokeStyle = toRgb(
              theme.constellationLine,
            );
            planetariumCanvasContext.stroke();
          }
        }
      }

      // Paint stars
      for (const star of Object.values(starsByName)) {
        const { xPos, yPos, magnitude, brightness } = star;
        const blinkAmount = getStarBlinkAmount(time, xPos, yPos, brightness);
        planetariumCanvasContext.save();
        planetariumCanvasContext.globalAlpha = blinkAmount;
        planetariumCanvasContext.fillStyle = getStarFillColor(brightness);
        planetariumCanvasContext.beginPath();
        // magnitude = apparent magnitude (m); lower m = bigger/brighter star
        const pixelmagnitude = Math.max(0.5, (6.5 - magnitude) * 1.5);
        planetariumCanvasContext.arc(
          xPos * size,
          yPos * size,
          pixelmagnitude * (0.45 + blinkAmount * 0.25),
          0,
          Math.PI * 2,
        );
        planetariumCanvasContext.fill();
        planetariumCanvasContext.lineWidth = 1;
        planetariumCanvasContext.strokeStyle = toRgb(theme.starStroke);
        planetariumCanvasContext.stroke();
        planetariumCanvasContext.restore();
      }

      // Paint constellations' name
      if (
        params.showConstellationName ||
        constellation.name === params.searchConstellation
      ) {
        const centerX = ((bounds.minX + bounds.maxX) * size) / 2;
        const centerY = ((bounds.minY + bounds.maxY) * size) / 2;
        const textAngle = Math.atan2(centerY - size / 2, centerX - size / 2);
        const textRadius = Math.hypot(centerX - size / 2, centerY - size / 2);

        const boundsSpan = Math.hypot(
          bounds.maxX - bounds.minX,
          bounds.maxY - bounds.minY,
        );
        const fontmagnitude = Math.round(
          10 + Math.min(boundsSpan / 0.5, 1) * 6,
        );

        planetariumCanvasContext.fillStyle = toRgb(theme.constellationLabel);
        planetariumCanvasContext.font = `${fontmagnitude}px sans-serif`;
        planetariumCanvasContext.textAlign = "center";
        planetariumCanvasContext.textBaseline = "middle";
        planetariumCanvasContext.strokeStyle = toRgb(theme.labelStroke);
        planetariumCanvasContext.lineWidth = 4;
        drawTextOnArc(
          planetariumCanvasContext,
          constellation.name.toUpperCase(),
          size / 2,
          size / 2,
          textRadius,
          textAngle,
        );
      }

      // Paint star names for the selected constellation
      if (params.showStarNames === constellation.name) {
        for (const star of Object.values(starsByName)) {
          drawStarLabel(
            planetariumCanvasContext,
            star.name,
            star.xPos * size,
            star.yPos * size,
          );
        }
      }

      // Paint star name on hover
      // In sky mode the secondary canvas is offset and scaled by drawImage, so we
      // must invert that transform to find the logical coord under the cursor.
      // In 1:1 mode the secondary canvas maps directly to screen coords.
      if (params.showStarNames === "on_hover") {
        // Invert the drawImage transform to find the secondary-canvas logical
        // coordinate under the cursor. Sky: dx=(width-size*1.85)/2, scale=1.85.
        // 1:1: secondary canvas placed at (xOffset, 0) at scale 1.
        const logMouseX = isSkyView
          ? (mousePos.x - width / 2) / 1.85 + size / 2
          : mousePos.x - xOffset;
        const logMouseY = isSkyView
          ? (mousePos.y + size * 0.85) / 1.85
          : mousePos.y;
        for (const star of Object.values(starsByName)) {
          const dist = Math.hypot(
            logMouseX - star.xPos * size,
            logMouseY - star.yPos * size,
          );
          if (dist < 12) {
            drawStarLabel(
              planetariumCanvasContext,
              star.name,
              star.xPos * size,
              star.yPos * size,
              { font: "bold 10px sans-serif" },
            );
          }
        }
      }

      // Show name of the searched star
      if (params.searchStar !== SEARCH_NONE && starsByName[params.searchStar]) {
        const star = starsByName[params.searchStar];
        drawStarLabel(
          planetariumCanvasContext,
          star.name,
          star.xPos * size,
          star.yPos * size,
          { font: "bold 11px sans-serif" },
        );
      }
    }

    // Paint the planetary canvas in the main canvas
    if (isSkyView) {
      // Centre the square map horizontally; maintain the original y crop.
      context.drawImage(
        planetariumCanvas,
        (width - size * 1.85) / 2,
        -size * 0.85,
        size * 1.85,
        size * 1.85,
      );
    } else {
      // Place the square map centred in the wide canvas.
      context.drawImage(planetariumCanvas, xOffset, 0, size, size);
    }
  };
};

canvasSketch(sketch, settings);

/* TODOs  
- Embedding into any webpage via JS (plugin)
- Annunciate
	- https://www.reddit.com/r/Astronomy/comments/1l10ctd/i_created_a_star_map_of_the_northern_hemisphere/#lightbox
	- Find other pages where it can be interesting
*/
