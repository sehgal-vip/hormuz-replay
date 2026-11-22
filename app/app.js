/* What the Hormuz Replay on a uniform 1-hour clock. */
(async function () {
  // Load everything small in parallel; flights (the largest file) load in the background so the page never waits on it.
  let FL = {};
  const [B, SD, ST, AIR] = await Promise.all([
    fetch("data/bundle.json").then((r) => r.json()),
    fetch("data/ship_density.json").then((r) => (r.ok ? r.json() : { days: {} })).catch(() => ({ days: {} })),
    fetch("data/sat_tracks.json").then((r) => (r.ok ? r.json() : { sats: [] })).catch(() => ({ sats: [] })),
    fetch("data/airspace.json").then((r) => (r.ok ? r.json() : { firs: [] })).catch(() => ({ firs: [] })),
  ]);
  fetch("data/flights.json").then((r) => r.json()).then((j) => {
    FL = j;
    if (window.__replay) window.__replay.seek(window.__replay.tick);  // redraw with aircraft
  }).catch(() => {});
  const SAT_SHOWN = ST.sats.filter((x) => x.validated);
  const NT = B.nTicks;
  const T0 = Date.parse(B.t0);
  const GOLD = "#c8a24a", IVORY = "#ece7da", MUTED = "#8d96a3", INK2 = "#1a212c", INK3 = "#2a3340";
  const LANES = ["Airspace", "Attacks", "Insurance", "Fog", "Claims", "Context"];
  const MON = ["Jan", "Feb", "Mar"];

  const $ = (id) => document.getElementById(id);
  const tickDate = (t) => new Date(T0 + t * 3600e3);
  const fmtTick = (t) => { const d = tickDate(t); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, "0")}:00`; };
  const dayKey = (t) => tickDate(t).toISOString().slice(0, 10);
  const sceneOf = (t) => B.scenes.find((s) => t >= s.start && t <= s.end) || B.scenes[0];
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  // File names in the story spine become readable source names on screen.
  const SRC_NAMES = [[/hormuz_daily_counts/, "IMF PortWatch and provider counts"], [/radar_summary|radar_detections/, "our Sentinel-1 ship count"], [/flights\//, "adsb.lol flight archive"],
    [/timeline\.csv/, "event log"], [/ship_incidents/, "UKMTO and JMIC advisories"], [/ship_density/, "Global Fishing Watch AIS presence, daily grid"], [/gfw_sar/, "Global Fishing Watch radar detections"], [/gfw_/, "Global Fishing Watch AIS presence"],
    [/gnss_interference/, "interference reports"], [/sat_tracks/, "Space-Track orbits"], [/satellite_passes/, "Copernicus catalogue"]];
  const srcName = (f) => { for (const [re, n] of SRC_NAMES) if (re.test(f)) return n; return f; };
  const md = (s) => esc(s).replace(/\s*\(`([^`]+)`\)/g, (m, f) => ` <span class="src-chip">${esc(srcName(f))}</span>`).replace(/`([^`]+)`(?:\s+(E\d+(?:\s+to\s+E\d+)?))?/g, (m, f) => `<span class="src-chip">${esc(srcName(f))}</span>`);
  // Long evidence reads as a list: one sentence per line.
  const mdList = (s) => { const parts = String(s).split(/(?<=[.)])\s+(?=[A-Z])/).filter((x) => x.trim()); return parts.length > 1 && s.length > 150 ? `<ul class="ev-list">${parts.map((x) => `<li>${md(x)}</li>`).join("")}</ul>` : md(s); };

  // ---------- state ----------
  let tick = 0, playing = false, acc = 0, holdUntil = 0, lastBeatShown = null, lastFrame = 0;
  const layersOn = { flights: true, sats: true, radar: true, incidents: true, heat: true, context: true };

  // ---------- NASA daily imagery (VIIRS true colour) ----------
  // Suomi NPP passes over the Gulf around 09:30 to 10:00 UTC, so a day's image is shown from 10:00 UTC
  // that day until 10:00 the next day: never before it was taken (same hold rule as other layers).
  function dailyUrl(d) { return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`; }
  function dailyDateFor(t) { return dayKey(t - 10); }
  let dailyShown = null;

  // ---------- map ----------
  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        base: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 17, attribution: "Imagery: Esri, Maxar, Earthstar Geographics · Terrain: Mapzen/AWS · Labels: Esri, © OpenStreetMap contributors" },
        labels: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 16 },
        daily: { type: "raster", tiles: [dailyUrl("2026-02-23")], tileSize: 256, maxzoom: 9, attribution: "Daily imagery: NASA GIBS, VIIRS (Suomi NPP)" },
        dem: { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], tileSize: 256, encoding: "terrarium", maxzoom: 12 },
        demShade: { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], tileSize: 256, encoding: "terrarium", maxzoom: 12 },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#0b0f14" } },
        { id: "base", type: "raster", source: "base", paint: { "raster-saturation": -0.78, "raster-brightness-max": 0.55, "raster-contrast": 0.12 } },
        { id: "daily", type: "raster", source: "daily", paint: { "raster-opacity": 0.9, "raster-saturation": -0.35, "raster-brightness-max": 0.82, "raster-contrast": 0.08, "raster-fade-duration": 600 } },
        { id: "shade", type: "hillshade", source: "demShade", paint: { "hillshade-exaggeration": 0.55, "hillshade-shadow-color": "#05070a", "hillshade-highlight-color": "#e3c77d", "hillshade-accent-color": "#0b0f14", "hillshade-illumination-direction": 315 } },
      ],
      terrain: { source: "dem", exaggeration: 1.15 },
      sky: { "sky-color": "#0b0f14", "horizon-color": "#2a3340", "fog-color": "#11161e", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.85, "atmosphere-blend": 0.6 },
    },
    center: [56.3, 26.3], zoom: 6.9, pitch: 45, bearing: -14, maxPitch: 75, attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "nautical" }), "bottom-right");

  const fc = (features) => ({ type: "FeatureCollection", features });
  const pt = (lon, lat, props = {}) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: props });

  await new Promise((r) => map.on("load", r));
  map.addLayer({ id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.55 } });

  // Analysis boxes
  map.addSource("boxes", { type: "geojson", data: fc(Object.entries(B.boxes).map(([k, ring]) => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { k } }))) });
  map.addLayer({ id: "boxes", type: "line", source: "boxes", paint: { "line-color": MUTED, "line-width": 1, "line-dasharray": [3, 3], "line-opacity": 0.6 } });

  // Ship density (AIS vessel-hours per 0.1 degree cell, per day). A cool blue-white ramp sets ships apart
  // from the amber of everything else; daily data is a day band (D11), held for every tick of its day.
  map.addSource("shipgrid", { type: "geojson", data: fc([]) });
  map.addLayer({ id: "shipgrid", type: "fill", source: "shipgrid", paint: {
    "fill-color": ["interpolate", ["linear"], ["get", "h"], 1, "#12506a", 12, "#1f8fa8", 48, "#4fc3d0", 150, "#a8ecee", 600, "#f2ffff"],
    "fill-opacity": ["interpolate", ["linear"], ["get", "h"], 1, 0.22, 12, 0.5, 48, 0.72, 150, 0.85, 600, 0.92],
    "fill-antialias": false }, filter: ["!=", ["get", "land"], 1] });
  // Cells wholly on land: a port, an inland waterway, or a false (spoofed) position. Drawn as amber outlines, not as sea traffic.
  map.addLayer({ id: "shipgrid-land", type: "line", source: "shipgrid", filter: ["==", ["get", "land"], 1], paint: { "line-color": "#f0c766", "line-width": 1.2, "line-opacity": 0.85 } });
  let gridDay = null;
  const gridCache = {};
  function renderShipGrid(t) {
    const dk = dayKey(t); if (gridDay === dk) return; gridDay = dk;
    if (!gridCache[dk]) {
      const c = SD.cellDeg || 0.1, hf = c / 2;
      gridCache[dk] = fc((SD.days[dk] || []).map(([lon, lat, h, v, land]) => ({ type: "Feature",
        geometry: { type: "Polygon", coordinates: [[[lon - hf, lat - hf], [lon + hf, lat - hf], [lon + hf, lat + hf], [lon - hf, lat + hf], [lon - hf, lat - hf]]] },
        properties: { kind: "grid", h, v, day: dk, land: land || 0 } })));
    }
    map.getSource("shipgrid").setData(gridCache[dk]);
    const nLand = (SD.days[dk] || []).filter((c) => c[4]).length;
    $("gridLegendLand").textContent = `${nLand} cells on land that day`;
  }
  // Radar chip (held, fades with age)
  const firstChip = B.chips.filter((c) => c.tick <= 0).sort((a, b) => b.tick - a.tick)[0] || B.chips[0];
  let currentChipKey = firstChip.key;
  map.addSource("chip", { type: "image", url: "data/" + firstChip.file, coordinates: chipCoords(firstChip.bbox) });
  map.addLayer({ id: "chip", type: "raster", source: "chip", paint: { "raster-opacity": 0, "raster-fade-duration": 0 } });
  function chipCoords(b) { return [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]]; }

  // Satellite footprints
  map.addSource("sats", { type: "geojson", data: fc([]) });
  map.addLayer({ id: "sats-fill", type: "fill", source: "sats", paint: { "fill-color": GOLD, "fill-opacity": ["*", 0.10, ["get", "a"]] } });
  map.addLayer({ id: "sats-line", type: "line", source: "sats", paint: { "line-color": GOLD, "line-width": 1.2, "line-opacity": ["get", "a"] } });

  // Airspace: flight information regions darkened by reported status (closed, partial, contested), brass outline;
  // regions only under the EASA conflict-zone bulletin get a dashed outline.
  map.addSource("airspace", { type: "geojson", data: fc([]) });
  map.addLayer({ id: "airspace-fill", type: "fill", source: "airspace", paint: {
    "fill-color": "#05070a",
    "fill-opacity": ["match", ["get", "status"], "closed", 0.5, "partial", 0.28, "contested", 0.18, 0.001] } });
  map.addLayer({ id: "airspace-line", type: "line", source: "airspace", filter: ["!=", ["get", "status"], "advisory"],
    paint: { "line-color": "#c8a24a", "line-width": ["match", ["get", "status"], "closed", 1.8, 1.2], "line-opacity": 0.85 } });
  map.addLayer({ id: "airspace-dash", type: "line", source: "airspace", filter: ["==", ["get", "status"], "advisory"],
    paint: { "line-color": "#c8a24a", "line-width": 1, "line-dasharray": [3, 3], "line-opacity": 0.6 } });
  const AIR_LABEL = { closed: "Closed", partial: "Partly open", contested: "Contested", advisory: "Open, under conflict-zone bulletin" };
  function renderAirspace(t) {
    const feats = [];
    for (const fir of AIR.firs) {
      let ch = null;
      for (const c of fir.changes) if (c.tick <= t) ch = c;
      if (!ch) continue;
      feats.push({ type: "Feature", geometry: { type: "MultiPolygon", coordinates: fir.polygons },
        properties: { kind: "fir", id: fir.id, name: fir.name, status: ch.status, statusLabel: AIR_LABEL[ch.status], since: fmtTick(ch.tick),
          precision: ch.precision, note: ch.note, source: ch.source, fresh: t - ch.tick } });
    }
    map.getSource("airspace").setData(fc(feats));
  }

  // Heat detections
  map.addSource("heat", { type: "geojson", data: fc([]) });
  map.addLayer({ id: "heat", type: "circle", source: "heat", paint: { "circle-radius": 2.6, "circle-color": "#b5763a", "circle-opacity": ["get", "a"] } });

  // Satellite positions (modelled orbits, only satellites that pass the capture check)
  // Satellites drawn like aircraft (deck.gl): an icon at its position this minute, a fading trail behind it,
  // a tether to its ground point, and a faint line ahead for the rest of this hour's pass.
  const SAT_Z = 160000;  // display height in metres; real orbits are 500 to 800 km, not to scale
  const SAT_ICON = satIcon();
  let satLayers = [], flightLayers = [];
  function pushDeck() { deckOverlay.setProps({ layers: [...flightLayers, ...satLayers] }); }
  function satIcon() {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    g.translate(32, 32); g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.lineWidth = 2;
    g.fillRect(-6, -8, 12, 16);                 // body
    g.fillRect(-28, -5, 18, 10); g.fillRect(10, -5, 18, 10);  // solar panels
    g.beginPath(); g.moveTo(-10, 0); g.lineTo(-6, 0); g.moveTo(6, 0); g.lineTo(10, 0); g.stroke();
    g.beginPath(); g.moveTo(0, -8); g.lineTo(0, -16); g.stroke(); g.beginPath(); g.arc(0, -18, 3, 0, Math.PI * 2); g.fill(); // antenna
    return c.toDataURL();
  }
  const satSegs = SAT_SHOWN.map((sat) => {
    const segs = []; let cur = null;
    for (const q of sat.pts) {
      if (!cur || q[0] - cur.last !== 1) { cur = { sat, path: [], ts: [], last: q[0] }; segs.push(cur); }
      cur.path.push([q[1], q[2], SAT_Z]); cur.ts.push(q[0] * ST.stepMin); cur.last = q[0];
    }
    return segs;
  }).flat();
  function satProps(sat, min, upcoming) {
    return { kind: "satpos", name: sat.name, sensor: sat.sensor, norad: sat.norad, upcoming,
      when: `${dayKey(Math.floor(min / 60))} ${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")} UTC`,
      check: sat.checkMedianKm, p90: sat.checkP90Km, epoch: sat.tleEpoch, exact: !!sat.exact };
  }
  function updateSatellites(t, frac) {
    if (layersOn.satpos === false || !SAT_SHOWN.length) { satLayers = []; pushDeck(); return; }
    const m = t * 60 + frac * 60, hourEnd = (t + 1) * 60;
    const live = [], ahead = [], trails = [], past = [];
    const hourStart = t * 60, KEEP_MIN = 120;
    for (const sg of satSegs) {
      const t0 = sg.ts[0], t1 = sg.ts[sg.ts.length - 1];
      // Completed passes stay on the map and fade out over 2 hours. Passes from earlier hours fade by the
      // story clock (steady within the hour); a pass completed in this hour's loop shows at full strength.
      if (t1 < m && t1 >= hourStart - KEEP_MIN) past.push({ path: sg.path, a: t1 >= hourStart ? 1 : Math.max(0, 1 - (hourStart - t1) / KEEP_MIN) });
      if (t1 < m - 12 || t0 > hourEnd) continue;           // not this hour's pass
      trails.push(sg);
      if (m >= t0 && m <= t1) {
        let i = 1; while (i < sg.ts.length && sg.ts[i] < m) i++;
        const a = sg.path[i - 1], b = sg.path[Math.min(i, sg.path.length - 1)], f = (m - sg.ts[i - 1]) / Math.max(1e-6, sg.ts[Math.min(i, sg.ts.length - 1)] - sg.ts[i - 1]);
        const p = [a[0] + (b[0] - a[0]) * Math.min(1, f), a[1] + (b[1] - a[1]) * Math.min(1, f), SAT_Z];
        const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), dy = b[1] - a[1];
        live.push({ p, h: (Math.atan2(dx, dy) * 180) / Math.PI, a: 1, props: satProps(sg.sat, m, false) });
        ahead.push({ path: sg.path.slice(i - 1), sg });
      } else if (t0 > m) {
        // Pass still to come this hour: show where it enters, faded, with its time.
        const a = sg.path[0], b = sg.path[1] || a;
        const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), dy = b[1] - a[1];
        live.push({ p: a, h: (Math.atan2(dx, dy) * 180) / Math.PI, a: 0.45, props: satProps(sg.sat, t0, true) });
        ahead.push({ path: sg.path, sg });
      }
    }
    const GOLD_RGB = [227, 199, 125];
    satLayers = [
      new deck.PathLayer({ id: "sat-past", data: past, getPath: (d) => d.path, getColor: (d) => [...GOLD_RGB, Math.round(150 * d.a)], widthMinPixels: 1.5,
        capRounded: true, jointRounded: true, updateTriggers: { getColor: [t, past.length] } }),
      new deck.PathLayer({ id: "sat-ahead", data: ahead, getPath: (d) => d.path, getColor: [...GOLD_RGB, 70], widthMinPixels: 1, getDashArray: [4, 4], pickable: true }),
      new deck.TripsLayer({ id: "sat-trails", data: trails, pickable: true, getPath: (d) => d.path, getTimestamps: (d) => d.ts, getColor: GOLD_RGB, opacity: 0.9,
        widthMinPixels: 2, capRounded: true, jointRounded: true, trailLength: 30, currentTime: m, fadeTrail: false }),
      new deck.LineLayer({ id: "sat-tether", data: live, getSourcePosition: (d) => d.p, getTargetPosition: (d) => [d.p[0], d.p[1], 0],
        getColor: (d) => [...GOLD_RGB, Math.round(90 * d.a)], getWidth: 1, updateTriggers: { getColor: m } }),
      new deck.ScatterplotLayer({ id: "sat-ground", data: live, getPosition: (d) => [d.p[0], d.p[1], 0], radiusMinPixels: 3,
        getFillColor: (d) => [...GOLD_RGB, Math.round(160 * d.a)], updateTriggers: { getFillColor: m } }),
      new deck.IconLayer({ id: "sat-icons", data: live, iconAtlas: SAT_ICON, iconMapping: { s: { x: 0, y: 0, width: 64, height: 64, mask: true } },
        getIcon: () => "s", getPosition: (d) => d.p, getAngle: (d) => -d.h, getSize: 22, sizeMinPixels: 16, sizeMaxPixels: 34,
        getColor: (d) => [...GOLD_RGB, Math.round(255 * d.a)], updateTriggers: { getColor: m }, billboard: false, pickable: true,
        autoHighlight: true, highlightColor: [255, 236, 180, 255] }),
    ];
    pushDeck();
  }
  // Flights: deck.gl overlay with 3D trails and aircraft icons at altitude (see flightLayers)
  const PLANE = planeIcon();
  const deckOverlay = new deck.MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(deckOverlay);
  function planeIcon() {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    g.translate(32, 32); g.fillStyle = "#fff"; g.beginPath();
    // top-down airliner silhouette, nose up
    g.moveTo(0, -28); g.bezierCurveTo(3, -26, 3.5, -20, 3.5, -14); g.lineTo(3.5, -6); g.lineTo(26, 6); g.lineTo(26, 10); g.lineTo(3.5, 4);
    g.lineTo(3, 18); g.lineTo(10, 24); g.lineTo(10, 27); g.lineTo(0, 24); g.lineTo(-10, 27); g.lineTo(-10, 24); g.lineTo(-3, 18);
    g.lineTo(-3.5, 4); g.lineTo(-26, 10); g.lineTo(-26, 6); g.lineTo(-3.5, -6); g.lineTo(-3.5, -14); g.bezierCurveTo(-3.5, -20, -3, -26, 0, -28);
    g.closePath(); g.fill();
    return c.toDataURL();
  }

  // Optical ship detections (Sentinel-2): squares; gold filled = no AIS match, ivory outline = broadcasting
  function sqIcon(fill) {
    const c = document.createElement("canvas"); c.width = c.height = 20; const g = c.getContext("2d");
    if (fill) { g.fillStyle = GOLD; g.fillRect(4, 4, 12, 12); g.strokeStyle = "#0b0f14"; g.lineWidth = 1.5; g.strokeRect(4, 4, 12, 12); }
    else { g.strokeStyle = IVORY; g.lineWidth = 2; g.strokeRect(5, 5, 10, 10); }
    return g.getImageData(0, 0, 20, 20);
  }
  map.addImage("sq-dark", sqIcon(true), { pixelRatio: 2 });
  map.addImage("sq-ais", sqIcon(false), { pixelRatio: 2 });
  map.addSource("opt", { type: "geojson", data: fc([]) });
  map.addLayer({ id: "opt", type: "symbol", source: "opt", layout: { "icon-image": ["case", ["==", ["get", "m"], 1], "sq-ais", "sq-dark"], "icon-allow-overlap": true, "icon-ignore-placement": true },
    paint: { "icon-opacity": ["get", "a"] } });

  // Radar detections
  map.addSource("dets", { type: "geojson", data: fc([]) });
  map.addLayer({ id: "dets", type: "circle", source: "dets", paint: { "circle-radius": 5, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": GOLD, "circle-stroke-width": 1.6, "circle-stroke-opacity": ["get", "a"] } });

  // Incidents and context
  map.addSource("inc", { type: "geojson", data: fc([]) });
  map.addLayer({ id: "inc-label", type: "circle", source: "inc", paint: { "circle-radius": 9, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": ["case", ["get", "ctx"], "#6b7380", GOLD], "circle-stroke-width": 1, "circle-stroke-opacity": ["*", 0.5, ["get", "a"]] } });
  map.addLayer({ id: "inc", type: "circle", source: "inc", paint: { "circle-radius": 4.5, "circle-color": ["case", ["get", "ctx"], "#6b7380", GOLD], "circle-opacity": ["get", "a"], "circle-stroke-color": "#0b0f14", "circle-stroke-width": 1 } });

  // ---------- hover details for every map point ----------
  const SAT_INFO = {
    S1A: { name: "Sentinel-1A", sensor: "C-band radar: sees ships through cloud and at night (ESA, EU Copernicus)" },
    S1C: { name: "Sentinel-1C", sensor: "C-band radar: sees ships through cloud and at night (ESA, EU Copernicus)" },
    S1D: { name: "Sentinel-1D", sensor: "C-band radar: sees ships through cloud and at night (ESA, EU Copernicus)" },
    S2A: { name: "Sentinel-2A", sensor: "Optical camera, 10 m, daylight and clear sky only (ESA, EU Copernicus)" },
    S2B: { name: "Sentinel-2B", sensor: "Optical camera, 10 m, daylight and clear sky only (ESA, EU Copernicus)" },
    S2C: { name: "Sentinel-2C", sensor: "Optical camera, 10 m, daylight and clear sky only (ESA, EU Copernicus)" },
    S3A: { name: "Sentinel-3A", sensor: "Thermal radiometer: fires and hot spots (ESA, EU Copernicus)" },
    S3B: { name: "Sentinel-3B", sensor: "Thermal radiometer: fires and hot spots (ESA, EU Copernicus)" },
  };
  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "tip", maxWidth: "300px", offset: 10 });
  const HOVER_LAYERS = ["inc", "dets", "opt", "heat", "shipgrid", "sats-fill", "airspace-fill"];  // priority order: first hit wins
  const ago = (h) => (h === 0 ? "this hour" : `${h} h ago`);
  function tipHTML(p) {
    const row = (k, v) => (v === "" || v == null || v === "null" ? "" : `<div class="tip-row"><span>${k}</span><b>${esc(v)}</b></div>`);
    if (p.kind === "grid") return `<div class="tip-kind">Ship density (AIS)</div><div class="tip-title">${esc(p.h)} vessel-hours</div>${row("Distinct vessels", p.v)}${row("Day", p.day + " (date only)")}<div class="tip-note">Ships broadcasting their position in this 0.1° cell (about 11 km) that day. Ships with AIS off or spoofed are missing or misplaced. Source: Global Fishing Watch.</div>`;
    if (p.kind === "fir") return `<div class="tip-kind">Airspace (flight information region)</div><div class="tip-title">${esc(p.name)}</div>${row("Status", p.statusLabel)}${row("Since", p.since)}${row("Time precision", p.precision)}<div class="tip-note">${esc(p.note)}</div><div class="tip-src">${esc(p.source)}<br>Outline approximate (VATSpy). Official NOTAMs not collected.</div>`;
    if (p.kind === "satpos" && (p.exact === true || p.exact === "true")) return `<div class="tip-kind">${p.upcoming === true || p.upcoming === "true" ? "Satellite pass this hour" : "Satellite position"}</div><div class="tip-title">${esc(p.name)}</div>${row("Time", p.when)}${row("NORAD id", p.norad)}<div class="tip-note">${esc(p.sensor)}. Position from its published orbit at the time (Space-Track element sets, ${esc(p.epoch)}).${p.check && p.check !== "null" && (+p.p90 - +p.check) < 50 ? ` Check: in this window its ground point sits a steady ${esc(p.check)} to ${esc(p.p90)} km from the centre of its own image footprints${/radar/.test(p.sensor) ? ", the sideways look of a radar" : ", the offset of its swath"}.` : ""}</div>`;
    if (p.kind === "satpos") return `<div class="tip-kind">${p.upcoming === true || p.upcoming === "true" ? "Satellite pass this hour (modelled)" : "Satellite position (modelled)"}</div><div class="tip-title">${esc(p.name)}</div>${row("Time", p.when)}${row("NORAD id", p.norad)}<div class="tip-note">${esc(p.sensor)}. Position from its current public orbit (CelesTrak, ${esc(p.epoch)}), stepped back by whole repeat cycles and aligned to its real captures in this window. After alignment its ground point sits a near-constant ${esc(p.check)} to ${esc(p.p90)} km from its own image footprints, as expected for a sensor that looks to the side or has an offset swath.</div>`;
    if (p.kind === "sat") return `<div class="tip-kind">Satellite capture</div><div class="tip-title">${esc(p.title)}</div>${row("Time", p.when)}${row("Seen", ago(+p.age))}<div class="tip-note">${esc(p.sensor)}</div>${row("Image products", p.products)}`;
    if (p.kind === "heat") return `<div class="tip-kind">Heat detection (NASA FIRMS)</div><div class="tip-title">${esc(p.sat)}</div>${row("Time", p.when)}${row("Seen", ago(+p.age))}${row("Confidence", p.conf === "h" ? "high" : p.conf === "n" ? "nominal" : p.conf)}${row("Fire power", p.frp ? p.frp + " MW" : "")}${row("Day or night", p.dn === "D" ? "day" : p.dn === "N" ? "night" : p.dn)}<div class="tip-note">Persistent gas flares are filtered out.</div>`;
    if (p.kind === "opt") return `<div class="tip-kind">Optical ship detection</div><div class="tip-title">Sentinel-2, ${+p.m === 1 ? "broadcasting (AIS match)" : "no AIS match"}</div>${row("Pass", p.when)}${row("Seen", ago(+p.age))}${row("Ships in this cell", p.n)}<div class="tip-note">${+p.m === 1 ? "Seen in the optical image and matched to a ship broadcasting its position." : "Seen in the optical image with no matching AIS broadcast: switched off, spoofed elsewhere, or not matched."}</div><div class="tip-src">Global Fishing Watch, Sentinel-2 vessel detections (10 m optical). Pass time from the Sentinel-2 catalogue.</div>`;
    if (p.kind === "det") { const len = p.size && p.size !== "null" ? `about ${Math.round(Math.sqrt(+p.size) * 31 / 10) * 10} m across` : ""; return `<div class="tip-kind">Radar ship detection</div><div class="tip-title">${esc(p.sat)}, track ${esc(p.track)}</div>${row("Pass", p.when)}${row("Seen", ago(+p.age))}${row("Bright area", len)}${row("Detection", p.id)}<div class="tip-note">A bright object on open water in the radar image. Our first-pass detector; not matched to a ship's identity.</div>`; }
    return `<div class="tip-kind">${p.ctx === true || p.ctx === "true" ? "Context (not narrated)" : "Ship incident"}</div><div class="tip-title">${esc(p.name)}</div>${row("Time", p.when)}<div class="tip-note">${esc(p.what)}</div><div class="tip-src">${esc(p.src)}</div>`;
  }
  function planeHTML(o) {
    const [flight, reg, type, gs] = o.d.info || [];
    const mm = Math.max(0, Math.round(o.m - Math.floor(o.m / 60) * 60)), hh = tickDate(Math.floor(o.m / 60)).getUTCHours();
    const row = (k, v) => (v || v === 0 ? `<div class="tip-row"><span>${k}</span><b>${esc(v)}</b></div>` : "");
    return `<div class="tip-kind">Aircraft (ADS-B, adsb.lol)</div><div class="tip-title">${esc(flight || reg || "Unidentified")}</div>` +
      row("Registration", reg) + row("Type", type) + row("Altitude", o.d.alt ? `${o.d.alt.toLocaleString("en-GB")} ft` : "") +
      row("Ground speed", gs != null ? `${gs} kt` : "") + row("Heading", `${Math.round((o.h + 360) % 360)}°`) +
      row("Time (UTC)", `${fmtTick(Math.floor(o.m / 60)).split(", ")[0]}, ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`) +
      `<div class="tip-src">Position interpolated between 10-minute samples; altitude drawn ×${ALT_EXAG}.</div>`;
  }
  // ---------- map interaction: areas feed a fixed readout; objects get a light hover label; click pins the Inspector ----------
  // Areas (ship density, airspace, satellite footprints) never pop up: what is under the cursor shows in one fixed
  // status line along the bottom of the map. Discrete objects get a one-line label after a short pause, with a
  // highlight ring. Clicking pins full details in the Inspector panel; several objects close together become a list.
  const OBJ_LAYERS = ["inc", "dets", "opt", "heat"];
  const hm = (x) => `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
  const clockOf = (when) => (String(when || "").match(/\d{2}:\d{2}/g) || []).join(" to ");
  function featItem(f) {
    const p = f.properties, c = f.geometry.coordinates;
    const label = p.kind === "det" ? `Radar ship ${String(p.id || "").split("-").pop()} · ${p.sat} ${clockOf(p.when)}`
      : p.kind === "opt" ? `Optical ship · ${+p.m === 1 ? "broadcasting" : "no AIS match"}`
      : p.kind === "heat" ? `Heat · ${p.sat} ${clockOf(p.when)}`
      : (p.ctx === true || p.ctx === "true") ? `Context · ${p.name}` : `${p.name} · ${String(p.when || "").replace(" UTC", "")}`;
    return { key: `${p.kind || "inc"}:${c[0].toFixed(3)},${c[1].toFixed(3)}:${p.id || p.name || ""}`, label, html: tipHTML(p), lngLat: c, kind: p.kind || "inc" };
  }
  function planeItem(o) {
    const [flight, reg, type] = o.d.info || [];
    const id = flight || reg || "Unidentified";
    return { key: `plane:${(o.d.info || [])[4] || id}`, label: `${id}${type ? " · " + type : ""}${o.d.alt ? " · " + o.d.alt.toLocaleString("en-GB") + " ft" : ""}`,
      html: planeHTML(o), lngLat: [o.p[0], o.p[1]], kind: "plane" };
  }
  function satItem(o) {
    const sg = o.sg || (o.sat ? o : null);
    let props = o.props, path = false;
    if (!props && sg) {
      const a = sg.ts[0], b2 = sg.ts[sg.ts.length - 1];
      props = { ...satProps(sg.sat, a, false), when: `${dayKey(Math.floor(a / 60))} ${hm(a)} to ${hm(b2)} UTC (this pass)` }; path = true;
    }
    if (!props) return null;
    let html = tipHTML(props);
    if (path) html = html.replace(/<div class="tip-kind">Satellite position( \(modelled\))?<\/div>/, '<div class="tip-kind">Satellite pass$1</div>');
    const pos = o.p || (sg && sg.path[Math.floor(sg.path.length / 2)]);
    return { key: `sat:${props.name}`, label: `${props.name} · ${path ? "pass " : ""}${clockOf(props.when)}`, html, lngLat: pos ? [pos[0], pos[1]] : null, kind: "sat" };
  }
  // All discrete objects within r pixels of a point, nearest layer first; duplicates removed.
  function objectsAt(pt, r) {
    const out = [], seen = new Set(), add = (it) => { if (it && it.lngLat && !seen.has(it.key)) { seen.add(it.key); out.push(it); } };
    if (layersOn.satpos !== false) for (const h of deckOverlay.pickMultipleObjects({ x: pt.x, y: pt.y, radius: r, depth: 6, layerIds: ["sat-icons", "sat-trails", "sat-ahead"] }) || []) add(satItem(h.object));
    if (layersOn.flights !== false) for (const h of deckOverlay.pickMultipleObjects({ x: pt.x, y: pt.y, radius: r, depth: 6, layerIds: ["planes"] }) || []) add(planeItem(h.object));
    const layers = OBJ_LAYERS.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none");
    for (const f of map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers })) add(featItem(f));
    return out;
  }

  // Highlight rings: one for the hovered object, one for the pinned object.
  map.addSource("hl", { type: "geojson", data: fc([]) });
  map.addLayer({ id: "hl-pin", type: "circle", source: "hl", filter: ["==", ["get", "w"], "pin"], paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#f0c766", "circle-stroke-width": 2 } });
  map.addLayer({ id: "hl-hover", type: "circle", source: "hl", filter: ["==", ["get", "w"], "hover"], paint: { "circle-radius": 11, "circle-color": "rgba(240,199,102,0.12)", "circle-stroke-color": "#f0c766", "circle-stroke-width": 1.2, "circle-stroke-opacity": 0.8 } });
  let hoverItem = null, pinItem = null;
  const drawHl = () => map.getSource("hl").setData(fc([pinItem && pt(pinItem.lngLat[0], pinItem.lngLat[1], { w: "pin" }), hoverItem && pt(hoverItem.lngLat[0], hoverItem.lngLat[1], { w: "hover" })].filter(Boolean)));

  const label = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "hoverlabel", offset: 14, maxWidth: "320px" });
  let hoverTimer = null, pendingKey = null;
  function setHover(it, lngLat) {
    if (!it) { clearTimeout(hoverTimer); pendingKey = null; if (hoverItem) { hoverItem = null; label.remove(); drawHl(); } return; }
    if (hoverItem && hoverItem.key === it.key) { label.setLngLat(lngLat); return; }
    if (pendingKey === it.key) return;
    clearTimeout(hoverTimer); pendingKey = it.key;
    hoverTimer = setTimeout(() => { pendingKey = null; hoverItem = it; label.setLngLat(lngLat).setText(it.label).addTo(map); drawHl(); }, 120);
  }

  // Fixed readout: what the area layers say about the point under the cursor.
  const fmtLL = (ll) => `${Math.abs(ll.lat).toFixed(2)}°${ll.lat >= 0 ? "N" : "S"} ${Math.abs(ll.lng).toFixed(2)}°${ll.lng >= 0 ? "E" : "W"}`;
  function readout(pt, ll) {
    const vis = (id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none";
    const q = (id) => (vis(id) ? map.queryRenderedFeatures(pt, { layers: [id] }) : []);
    const parts = [`<b>${fmtLL(ll)}</b>`];
    const fir = q("airspace-fill")[0];
    if (fir) parts.push(`Airspace <b>${esc(fir.properties.name)}</b>: ${esc(fir.properties.statusLabel || "open")}${fir.properties.since ? ` since ${esc(fir.properties.since)}` : ""}`);
    const g = q("shipgrid")[0];
    if (!g && vis("shipgrid-land")) {
      const gl = map.queryRenderedFeatures([[pt.x - 4, pt.y - 4], [pt.x + 4, pt.y + 4]], { layers: ["shipgrid-land"] })[0];
      if (gl) parts.push(`Ships (AIS) <b>${esc(gl.properties.h)} vessel-hours reported on land</b> <i>port, inland waterway or false GPS position</i>`);
    }
    if (parts.length > 1 && /reported on land/.test(parts[parts.length - 1])) { /* land cell already described */ } else
    parts.push(g ? `Ships (AIS) <b>${esc(g.properties.h)} vessel-hours</b>, ${esc(g.properties.v)} vessels <i>date only</i>` : `Ships (AIS) <span class="ro-none">none recorded</span>`);
    const sats = q("sats-fill").map((f) => f.properties).sort((x, y) => +x.age - +y.age);
    parts.push(sats.length ? `Imaged by <b>${esc(sats[0].title)}</b> ${esc(clockOf(sats[0].when))} (${ago(+sats[0].age)})${sats.length > 1 ? `, +${sats.length - 1} more` : ""}` : `Imaged <span class="ro-none">no capture in last 6 h</span>`);
    $("readout").innerHTML = parts.join('<span class="ro-sep"></span>');
  }
  const READOUT_IDLE = '<span class="ro-none">Point at the map: airspace, ship density and satellite coverage under the cursor show here. Click an object for full details.</span>';

  let moveQueued = null, rafPending = false;
  map.on("mousemove", (e) => {
    moveQueued = e;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const ev = moveQueued; moveQueued = null; if (!ev) return;
      readout(ev.point, ev.lngLat);
      if (playing) { setHover(null); map.getCanvas().style.cursor = ""; return; }  // hover labels off while playing; click still works
      const objs = objectsAt(ev.point, 7);
      map.getCanvas().style.cursor = objs.length ? "pointer" : "crosshair";
      setHover(objs[0] || null, ev.lngLat);
    });
  });
  map.getCanvas().addEventListener("mouseleave", () => { setHover(null); $("readout").innerHTML = READOUT_IDLE; });

  // Inspector: click pins full details; a cluster becomes a list to choose from; Esc or the close button clears it.
  function openInspector(items) {
    const box = $("inspector"), body = $("inspBody");
    box.hidden = false;
    if (items.length === 1) {
      pinItem = items[0]; body.innerHTML = `<div class="insp-card">${items[0].html}</div>`;
      $("inspSub").textContent = "pinned";
    } else {
      pinItem = null;
      $("inspSub").textContent = `${items.length} objects here`;
      body.innerHTML = `<ul class="insp-list">${items.map((it, i) => `<li><button type="button" data-i="${i}">${esc(it.label)}</button></li>`).join("")}</ul>`;
      body.querySelectorAll("button[data-i]").forEach((btn) => btn.onclick = () => openInspector([items[+btn.dataset.i]]));
    }
    drawHl();
  }
  function closeInspector() { $("inspector").hidden = true; pinItem = null; drawHl(); }
  map.on("click", (e) => {
    const objs = objectsAt(e.point, 9);
    if (objs.length) openInspector(objs); else closeInspector();
  });
  $("inspClose").onclick = closeInspector;
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("inspector").hidden) closeInspector(); });
  $("readout").innerHTML = READOUT_IDLE;

  // Layer toggles
  // ---------- major airports and ports (always on; labels hide when zoomed far out) ----------
  // Coordinates are approximate (to about 1 km). Notes cite only events already in the replay's data.
  const PLACES = [
    ["air", "Dubai International", "DXB", 25.253, 55.365, "Flightradar24: 1,257 flights on 27 Feb, 20 on 2 Mar, 310 on 5 Mar. Terminal 3 reported minor damage on 28 Feb."],
    ["air", "Abu Dhabi", "AUH", 24.433, 54.651, "Etihad departures halted on 28 Feb."],
    ["air", "Doha Hamad", "DOH", 25.273, 51.608, "Qatar partially reopened airspace on 6 Mar for evacuation and cargo flights."],
    ["air", "Bahrain", "BAH", 26.271, 50.634, "Drones reported hitting airport fuel tanks on 12 Mar."],
    ["air", "Kuwait", "KWI", 29.227, 47.969, "A drone hit Terminal 1 on 28 Feb; radar damaged on 14 Mar."],
    ["air", "Muscat", "MCT", 23.593, 58.284, "Escape hub: 280 flights on 5 Mar, double the 140 of 1 Mar (Flightradar24)."],
    ["air", "Tehran Imam Khomeini", "IKA", 35.416, 51.152, "Iran closed its airspace on 28 Feb."],
    ["air", "Bandar Abbas", "BND", 27.218, 56.378, "Iran's main airport on the strait."],
    ["air", "Riyadh", "RUH", 24.958, 46.699, "Saudi Arabia reported intercepting missiles aimed at King Khalid airport on 1 Mar."],
    ["air", "Shiraz", "SYZ", 29.539, 52.590, "Southern Iran."],
    ["port", "Jebel Ali", "Dubai", 25.011, 55.061, "Busiest port in the Gulf."],
    ["port", "Fujairah", "UAE", 25.174, 56.364, "Bunkering hub outside the strait: 116 vessels at anchor and a storage-tank fire on 3 Mar (Windward)."],
    ["port", "Khor Fakkan", "UAE", 25.350, 56.357, "Container port outside the strait."],
    ["port", "Shahid Rajaee", "Bandar Abbas", 27.110, 56.060, "Iran's largest container port, on the strait."],
    ["port", "Khasab", "Oman", 26.201, 56.248, "Musandam tip; the tanker Skylight was hit about 5 nm north on 1 Mar."],
    ["port", "Ras Tanura", "Saudi Arabia", 26.644, 50.159, "Aramco shut the refinery after a fire on 2 Mar."],
    ["port", "Ras Laffan", "Qatar", 25.905, 51.545, "QatarEnergy halted LNG production on 2 Mar."],
    ["port", "Kharg Island", "Iran", 29.245, 50.310, "Iran's main crude export terminal; US strikes on military targets on 13 to 14 Mar."],
    ["port", "Assaluyeh", "Iran", 27.475, 52.610, "South Pars gas complex."],
    ["port", "Sohar", "Oman", 24.508, 56.628, "Drone attack reported on 13 Mar."],
    ["port", "Mina Salman", "Bahrain", 26.200, 50.610, "US Fifth Fleet base nearby; the tanker Stena Imperative was struck in port on 1 to 2 Mar."],
  ];
  const placeMarkers = PLACES.map(([kind, name, code, lat, lon, note]) => {
    const el = document.createElement("div");
    el.className = "place " + kind + (["Shahid Rajaee", "Khor Fakkan", "Mina Salman", "Shiraz", "Assaluyeh"].includes(name) ? " minor" : "") + (["Dubai International", "Doha Hamad", "Kuwait", "Tehran Imam Khomeini", "Muscat", "Riyadh", "Kharg Island", "Bandar Abbas"].includes(name) ? "" : " local");
    el.innerHTML = `<i>${kind === "air" ? "✈" : "⚓"}</i><span>${esc(name)}${kind === "air" ? ` <em>${esc(code)}</em>` : ""}</span>`;
    const placeItem = { key: `place:${name}`, label: `${name}${kind === "air" ? " (" + code + ")" : ", " + code}`, html: `<div class="tip-kind">${kind === "air" ? "Airport" : "Port"}</div><div class="tip-title">${esc(name)}</div><div class="tip-row"><span>${kind === "air" ? "Code" : "Where"}</span><b>${esc(code)}</b></div><div class="tip-note">${esc(note)}</div>`, lngLat: [lon, lat], kind };
    el.addEventListener("mouseenter", () => { if (!playing) setHover(placeItem, [lon, lat]); });
    el.addEventListener("mouseleave", () => setHover(null));
    el.addEventListener("click", (ev) => { ev.stopPropagation(); openInspector([placeItem]); });
    return new maplibregl.Marker({ element: el, anchor: "left", offset: [-6, 0] }).setLngLat([lon, lat]).addTo(map);
  });
  const placeZoom = () => { const c = map.getContainer().classList, z = map.getZoom(); c.toggle("places-far", z < 4.4); c.toggle("places-mid", z < 7.4); c.toggle("places-wide", z < 5.9); };
  map.on("zoom", placeZoom); placeZoom();

  const toggleDefs = [["shipgrid", "Ship density (AIS, daily)", ["shipgrid", "shipgrid-land"]], ["airspace", "Airspace closures", ["airspace-fill", "airspace-line", "airspace-dash"]], ["places", "Airports and ports", []], ["satpos", "Satellite positions and paths", []], ["daily", "Daily satellite photo (NASA)", ["daily"]], ["flights", "Aircraft and flight paths", []], ["sats", "Satellite captures", ["sats-fill", "sats-line"]], ["radar", "Radar chip and ships", ["chip", "dets"]], ["optical", "Optical ship detections", ["opt"]], ["incidents", "Ship incidents", ["inc", "inc-label"]], ["heat", "Heat detections", ["heat"]]];
  // Layers panel doubles as the legend: one row per layer with its symbol; collapsed by default.
  const SWATCH = {
    shipgrid: '<i class="sw sw-grid"></i>',
    places: '<i class="sw sw-place">✈</i>', satpos: '<i class="sw sw-satpos"></i>', daily: '<i class="sw sw-daily"></i>',
    flights: '<i class="sw sw-plane">✈</i>', sats: '<i class="sw sw-sat"></i>', radar: '<i class="sw sw-radar"></i>',
    optical: '<i class="sw sw-opt"></i>', incidents: '<i class="sw sw-inc"></i>', heat: '<i class="sw sw-heat"></i>',
    airspace: '<i class="sw sw-air"></i>',
  };
  // Layers that start switched off (the user can turn them on in the Layers panel).
  const DEFAULT_OFF = new Set(["daily"]);
  $("layerToggles").innerHTML = `<button type="button" class="lt-head" id="ltHead"><span>Layers</span><b id="ltCount"></b><i class="chev"></i></button>
    <div class="lt-list">${toggleDefs.map(([k, label]) => `<label><input type="checkbox" data-k="${k}"${DEFAULT_OFF.has(k) ? "" : " checked"}>${SWATCH[k] || '<i class="sw"></i>'}<span>${label}</span></label>`).join("")}
    <div class="lt-note">Grey diamond: context marker (not narrated)</div></div>`;
  $("layerToggles").classList.add("collapsed");
  const ltCount = () => { const all = $("layerToggles").querySelectorAll("input"); $("ltCount").textContent = `${[...all].filter((x) => x.checked).length}/${all.length} on`; };
  ltCount();
  $("ltHead").onclick = () => $("layerToggles").classList.toggle("collapsed");
  $("layerToggles").addEventListener("change", ltCount);
  function applyLayer(k, on) {
    layersOn[k] = on;
    if (k === "places") placeMarkers.forEach((m) => (m.getElement().style.display = on ? "" : "none"));
    toggleDefs.find((d) => d[0] === k)[2].forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    if (k === "daily") $("dailyCap").hidden = !on;
    if (k === "shipgrid") $("gridLegend").hidden = !on;
  }
  const redrawDeck = () => { updateFlights(tick, 0); updateSatellites(tick, 0); };
  DEFAULT_OFF.forEach((k) => applyLayer(k, false));
  $("layerToggles").addEventListener("change", (e) => { applyLayer(e.target.dataset.k, e.target.checked); redrawDeck(); });
  // Layer focus: hovering a row shows that layer alone (plus the basemap) until the pointer leaves the row.
  let focusKey = null;
  function setFocus(k) {
    if (focusKey === k) return;
    focusKey = k;
    $("layerToggles").querySelectorAll("input[data-k]").forEach((inp) => applyLayer(inp.dataset.k, inp.checked && (k == null || inp.dataset.k === k)));
    redrawDeck();
  }
  $("layerToggles").querySelectorAll(".lt-list label").forEach((lab) => {
    lab.addEventListener("mouseenter", () => { const inp = lab.querySelector("input"); if (inp.checked) setFocus(inp.dataset.k); });
    lab.addEventListener("mouseleave", () => setFocus(null));
  });

  function renderDaily(t) {
    const d = dailyDateFor(t);
    if (d !== dailyShown) { map.getSource("daily").setTiles([dailyUrl(d)]); dailyShown = d; }
    const dt = new Date(d + "T00:00:00Z");
    $("dailyCap").textContent = `Daily photo: NASA VIIRS, ${dt.getUTCDate()} ${MON[dt.getUTCMonth()]}, about 10:00 UTC`;
    $("dailyCap").hidden = map.getLayoutProperty("daily", "visibility") === "none";
  }

  // ---------- per-tick rendering ----------
  function renderMap(t) {

    // Satellite captures: this tick bright, fading over 6 ticks
    const sats = [];
    for (const s of B.satellites) {
      if (s.tick > t) break;
      const age = t - s.tick;
      if (age <= 6) {
        const info = SAT_INFO[s.sat] || { name: s.sat, sensor: s.mission };
        sats.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [[...s.ring, s.ring[0]]] },
          properties: { a: Math.max(0.12, 1 - age / 6), kind: "sat", title: info.name, sensor: info.sensor, when: `${dayKey(s.tick)} ${s.time} UTC`, products: s.n || 1, age } });
      }
    }
    map.getSource("sats").setData(fc(sats));

    // Heat: detections in the last 24 ticks, fading
    const heat = [];
    for (const f of B.firms) {
      const age = t - f[0];
      if (age >= 0 && age < 24) heat.push(pt(f[1], f[2], { a: 0.9 - age / 30, kind: "heat", when: `${f[3]} UTC`, sat: f[4] === "VIIRS_SNPP_" ? "Suomi NPP (VIIRS)" : f[4] === "VIIRS_NOAA2" ? "NOAA-20 (VIIRS)" : f[4], conf: f[5], frp: f[6], dn: f[7], age }));
    }
    map.getSource("heat").setData(fc(heat));

    // Optical detections: shown in the pass hour, fading over the next 2 hours, like radar (D19)
    const opt = [];
    for (const o of B.optical || []) {
      const age = t - o[0];
      if (age < 0) break;
      if (age < 3) opt.push(pt(o[1], o[2], { kind: "opt", m: o[3], n: o[4], a: 1 - age / 3, age, when: `${dayKey(o[0])} about ${o[5]} UTC` }));
    }
    map.getSource("opt").setData(fc(opt));

    // Radar: a pass is a snapshot of a few seconds, so its image and blips show in the pass hour
    // and fade out over the next 2 hours (D19). The count gauge in the side panel stays held with its age (D16).
    const RADAR_FADE = 3;
    let chip = null;
    for (const c of B.chips) if (c.tick <= t && (!chip || c.tick > chip.tick)) chip = c;
    if (chip && t - chip.tick >= RADAR_FADE) chip = null;
    if (chip) {
      const age = t - chip.tick;
      const a = 1 - age / RADAR_FADE;
      if (currentChipKey !== chip.key) { map.getSource("chip").updateImage({ url: "data/" + chip.file, coordinates: chipCoords(chip.bbox) }); currentChipKey = chip.key; }
      map.setPaintProperty("chip", "raster-opacity", 0.75 * a);
      const passSat = B.satellites.find((s) => s.mission === "SENTINEL-1" && Math.abs(s.tick - chip.tick) <= 1);
      const satName = passSat ? (SAT_INFO[passSat.sat] || {}).name || passSat.sat : "Sentinel-1";
      map.getSource("dets").setData(fc((B.radarDets[chip.key] || []).map((d) => pt(d[0], d[1], {
        a, kind: "det", id: d[3] || "", size: d[2] || null, sat: satName, track: chip.slot, when: `${chip.date} ${({ A: "02:15", B: "02:05", C: "14:16" })[chip.slot]} UTC`, age,
      }))));
    } else {
      map.setPaintProperty("chip", "raster-opacity", 0);
      map.getSource("dets").setData(fc([]));
    }

    // Incidents (timed: from their tick; date only: from day start) and context markers
    const inc = [];
    for (const i of B.incidents) {
      if (i.lat == null) continue;
      const start = i.dayOnly ? Math.floor(i.tick / 24) * 24 : i.tick;
      if (start > t) continue;
      const age = t - start;
      inc.push(pt(i.lon, i.lat, { name: i.vessel, what: i.what, when: `${i.date} ${i.time || "(date only)"} UTC`, src: i.source, ctx: false, a: age < 12 ? 1 : 0.55 }));
    }
    for (const e of B.events) {
      if (!e.context || e.tick > t) continue;
      inc.push(pt(e.lon, e.lat, { name: e.place, what: e.event, when: `${e.date} ${e.time || "(date only)"} UTC, ${e.timeNote}`, src: e.confidence, ctx: true, a: 0.8 }));
    }
    map.getSource("inc").setData(fc(inc));
  }

  // ---------- side panel ----------
  const fmtN = (v) => (v == null ? "no data" : v.toLocaleString("en-GB"));
  // Instrument strip over the map: the headline numbers at a glance, each with a baseline to read against.
  const HUD_BASE = { gulf: B.flightCounts.gulf[48 + 12], hormuz: B.ships.hormuz[48 + 12], imf: B.daily["IMF PortWatch"]["2026-02-24"] };
  function renderHud(t) {
    const dk = dayKey(t), fc_ = B.flightCounts;
    let lastA = null; for (const r of B.radar) if (r.slot === "A" && r.tick <= t) lastA = r;
    const cell = (label, val, base, unit, note) => `<div class="hud-cell"><span class="hud-l">${label}</span><b class="hud-v${val == null ? " nodata" : ""}">${val == null ? "–" : val.toLocaleString("en-GB")}</b>${base != null && val != null ? `<span class="hud-b">${unit}${base.toLocaleString("en-GB")}</span>` : note ? `<span class="hud-b">${note}</span>` : ""}</div>`;
    $("hud").innerHTML =
      cell("Aircraft · Gulf", fc_.gulf[t], HUD_BASE.gulf, "26 Feb noon: ") +
      cell("Aircraft · Iran", fc_.iran[t], null, "", "this hour") +
      cell("Ships AIS · strait", B.ships.hormuz[t], HUD_BASE.hormuz, "26 Feb noon: ") +
      cell("Crossings · IMF", B.daily["IMF PortWatch"][dk] ?? null, HUD_BASE.imf, "24 Feb: ") +
      cell("Radar ships · track A", lastA ? lastA.perSea : null, null, "", lastA ? `${t - lastA.tick} h old` : "no pass yet");
  }
  function renderStats(t) {
    const fc_ = B.flightCounts;
    $("sGulf").textContent = fmtN(fc_.gulf[t]);
    $("sIran").textContent = fmtN(fc_.iran[t]);
    $("sHormuz").textContent = fmtN(B.ships.hormuz[t]);
    $("sGoo").textContent = fmtN(B.ships.goo[t]);
    const dk = dayKey(t);
    $("sImf").textContent = fmtN(B.daily["IMF PortWatch"][dk]);
    $("sSp").textContent = fmtN(B.daily["S&P (via JMIC)"][dk]);
    $("sWw").textContent = fmtN(B.daily["Windward"][dk]);

    // Radar per track: latest pass at or before t, with age and fade
    const rows = ["A", "C", "B"].map((slot) => {
      let last = null;
      for (const r of B.radar) if (r.slot === slot && r.tick <= t) last = r;
      if (!last) return `<div class="stat-row"><span>Track ${slot}</span><b>no pass yet</b></div>`;
      const age = t - last.tick;
      const op = Math.max(0.35, 1 - age / 144);
      const partial = last.valid < 0.8 ? " (partial)" : "";
      return `<div class="stat-row" style="opacity:${op}"><span>Track ${slot}, ${last.date.slice(8)} ${MON[+last.date.slice(5, 7) - 1]} ${last.time}${partial}</span><b>${last.perSea}<span class="age">${age} h ago</span></b></div>`;
    });
    $("radarRows").innerHTML = rows.join("");
    // Optical (Sentinel-2): latest pass at or before t, held with its age (D16)
    let lastOpt = null;
    for (const o of B.optical || []) { if (o[0] > t) break; lastOpt = o; }
    if (lastOpt) {
      const d = dayKey(lastOpt[0]), [m, u] = (B.opticalDaily || {})[d] || [0, 0], age = t - lastOpt[0], tot = m + u;
      const op = Math.max(0.35, 1 - age / 144), dt = tickDate(lastOpt[0]);
      $("opticalRow").innerHTML = `<div class="stat-row" style="opacity:${op}"><span>${dt.getUTCDate()} ${MON[dt.getUTCMonth()]} pass: ${m} broadcasting, ${u} no AIS</span><b>${tot ? Math.round((100 * u) / tot) : 0}% dark<span class="age">${age} h ago</span></b></div>`;
    } else $("opticalRow").innerHTML = `<div class="stat-row"><span>No pass yet</span><b>–</b></div>`;

    // Day band: date-only items for this day
    const items = [];
    for (const e of B.events) if (e.date === dk && e.dayOnly && !e.context) items.push(`${md(e.event)} <span class="src">(${esc(e.confidence)})</span>`);
    for (const i of B.incidents) if (i.date === dk && i.dayOnly) items.push(`${esc(i.vessel)}: ${esc(i.what)} <span class="src">(${esc(i.confidence)})</span>`);
    for (const g of B.gnss) if (g.date === dk && g.value) items.push(`GPS interference: ${esc(g.metric)} ${esc(g.value)} <span class="src">(${esc(g.provider)})</span>`);
    $("dayBand").innerHTML = items.length ? items.map((x) => `<li>${x}</li>`).join("") : `<li style="color:${MUTED}">Nothing date-only recorded for this day.</li>`;

    drawSpark("sparkAir", [fc_.gulf, fc_.iran], t);
    drawSpark("sparkShips", [B.ships.goo, B.ships.hormuz], t);
    drawSpark("sparkCross", [dailySeries("IMF PortWatch"), dailySeries("S&P (via JMIC)")], t);
  }
  const dailyCache = {};
  function dailySeries(p) {
    if (dailyCache[p]) return dailyCache[p];
    const s = new Array(NT).fill(null);
    for (let t = 0; t < NT; t++) { const v = B.daily[p][dayKey(t)]; s[t] = v == null ? null : v; }
    return (dailyCache[p] = s);
  }
  function drawSpark(id, series, t) {
    const c = $(id), dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const max = Math.max(1, ...series.flat().filter((v) => v != null));
    series.forEach((s, i) => {
      g.strokeStyle = i === 0 ? GOLD : MUTED; g.lineWidth = 1.2; g.beginPath(); let pen = false;
      s.forEach((v, k) => { if (v == null) { pen = false; return; } const x = (k / (NT - 1)) * w, y = h - 2 - (v / max) * (h - 4); pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; });
      g.stroke();
    });
    const x = (t / (NT - 1)) * w; g.strokeStyle = IVORY; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.globalAlpha = 1;
  }

  const GRADE_CLASS = { corroborated: "corroborated", consistent: "consistent", "reported only": "reported", contested: "contested", contradicted: "contradicted" };
  function currentBeat(t) { let b = null; for (const x of B.beats) if (x.tick <= t) b = x; return b; }
  function renderBeat(b) {
    $("introCard").hidden = !!b; $("beatCard").hidden = !b;
    if (!b) { $("dispatchSub").textContent = "start here"; return; }
    $("beatLane").textContent = b.lane;
    $("beatPrecision").textContent = b.precision;
    $("beatId").textContent = `claim ${B.beats.indexOf(b) + 1} of ${B.beats.length}`;
    $("beatNarrator").textContent = b.narrator;
    $("dispatchSub").textContent = `claim ${B.beats.indexOf(b) + 1} of ${B.beats.length} · ${b.gradeKey}`;
    $("beatClaim").innerHTML = md(b.claim);
    $("beatEvidence").innerHTML = mdList(b.evidence);
    const g = $("beatGrade"); g.className = "grade " + (GRADE_CLASS[b.gradeKey] || "consistent");
    const [head, ...rest] = b.grade.split(" (");
    g.innerHTML = `<b>${esc(head)}</b>${rest.length ? " (" + esc(rest.join(" (")) : ""}`;
    lastBeatShown = b.id;
  }

  // ---------- lanes timeline ----------
  const lanes = $("lanes");
  let beatHits = [];
  function drawLanes(t) {
    const dpr = window.devicePixelRatio || 1, w = lanes.clientWidth, h = lanes.clientHeight;
    if (lanes.width !== w * dpr || lanes.height !== h * dpr) { lanes.width = w * dpr; lanes.height = h * dpr; }
    const g = lanes.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const L = 78, top = 32, rowH = (h - top - 4) / LANES.length, X = (k) => L + (k / (NT - 1)) * (w - L - 8);
    // scenes
    B.scenes.forEach((s, i) => { g.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.0)"; g.fillRect(X(s.start), top, X(s.end + 1) - X(s.start), h - top); });
    // days
    g.font = "10px JetBrains Mono"; g.textBaseline = "top";
    for (let d = 0; d <= NT / 24; d++) {
      const x = X(d * 24); g.strokeStyle = INK2; g.beginPath(); g.moveTo(x, top); g.lineTo(x, h); g.stroke();
      if (d < NT / 24 && (d % 2 === 0)) { const dt = tickDate(d * 24); g.fillStyle = MUTED; g.fillText(`${dt.getUTCDate()} ${MON[dt.getUTCMonth()]}`, x + 2, 2); }
    }
    // scene names along the top, clipped to each scene's width; the current scene is highlighted
    g.font = "500 11.5px Inter";
    B.scenes.forEach((sc) => {
      const x0 = X(sc.start), x1 = X(sc.end + 1), cur = t >= sc.start && t <= sc.end;
      g.strokeStyle = cur ? GOLD : INK3; g.lineWidth = cur ? 2 : 1; g.beginPath(); g.moveTo(x0 + 1, top - 3); g.lineTo(x1 - 1, top - 3); g.stroke(); g.lineWidth = 1;
      g.save(); g.beginPath(); g.rect(x0 + 2, 14, Math.max(0, x1 - x0 - 4), 14); g.clip();
      if (x1 - x0 > 70) { g.fillStyle = cur ? "#f0c766" : MUTED; g.fillText(sc.title, x0 + 3, 15); } g.restore();
    });
    // lanes
    g.font = "11px Inter"; g.textBaseline = "middle";
    LANES.forEach((ln, i) => { const y = top + rowH * (i + 0.5); g.fillStyle = MUTED; g.fillText(ln, 6, y); g.strokeStyle = INK2; g.beginPath(); g.moveTo(L, top + rowH * (i + 1)); g.lineTo(w, top + rowH * (i + 1)); g.stroke(); });
    // incidents in Attacks lane
    const yA = top + rowH * 1.5;
    B.incidents.forEach((i) => { const x = X(i.tick); g.fillStyle = "rgba(200,162,74,0.45)"; g.fillRect(x - 0.5, yA - 5, 1.5, 10); });
    // satellite passes as faint ticks under Fog
    // context markers
    const yC = top + rowH * 5.5;
    B.context.forEach((c) => { const x = X(c.tick); g.fillStyle = "#6b7380"; diamond(g, x, yC, 4); });
    // beats
    beatHits = [];
    const curBeat = currentBeat(t);
    B.beats.forEach((b) => {
      const i = LANES.indexOf(b.lane), y = top + rowH * (i + 0.5), x = X(b.tick);
      beatHits.push({ x, y, b });
      if (curBeat && curBeat.id === b.id) { g.beginPath(); g.arc(x, y, 8.5, 0, Math.PI * 2); g.strokeStyle = "rgba(240,199,102,0.55)"; g.lineWidth = 1; g.stroke(); }
      g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2);
      const gk = b.gradeKey;
      g.fillStyle = gk === "corroborated" ? GOLD : gk === "contradicted" ? IVORY : gk === "reported only" ? INK3 : "rgba(0,0,0,0)";
      g.fill(); g.strokeStyle = gk === "reported only" ? MUTED : gk === "contradicted" ? IVORY : GOLD; g.lineWidth = 1.5; g.stroke();
    });
    // cursor
    const x = X(t); g.strokeStyle = IVORY; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, top - 2); g.lineTo(x, h); g.stroke();
  }
  function diamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); }
  function tickAtX(px) { const w = lanes.clientWidth, L = 78; return Math.max(0, Math.min(NT - 1, Math.round(((px - L) / (w - L - 8)) * (NT - 1)))); }
  let dragging = false;
  // Beats are the index of the story: hover a dot for its line and grade, click to jump there (camera follows).
  const laneTip = $("laneTip");
  const beatAt = (x, y) => { let best = null, bd = 10; for (const h of beatHits) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } } return best; };
  lanes.addEventListener("mousemove", (e) => {
    if (dragging) { laneTip.hidden = true; return; }
    const h = beatAt(e.offsetX, e.offsetY), r = lanes.getBoundingClientRect();
    if (h) {
      lanes.style.cursor = "pointer";
      laneTip.innerHTML = `<div class="lt-when">${esc(fmtTick(h.b.tick).split(",")[0])}${h.b.precision === "date only" ? "" : ", " + fmtTick(h.b.tick).split(", ")[1] + " UTC"} · ${esc(h.b.lane)}</div><div class="lt-line">${esc(h.b.narrator)}</div><div class="lt-grade">${esc(h.b.grade)}</div><div class="lt-hint">Click to jump here</div>`;
      laneTip.hidden = false;
      const w = laneTip.offsetWidth, x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + h.x - w / 2));
      laneTip.style.left = x + "px"; laneTip.style.top = (r.top + h.y - laneTip.offsetHeight - 14) + "px";
    } else {
      laneTip.hidden = true; lanes.style.cursor = "ew-resize";
      const sc = e.offsetY < 32 ? B.scenes.find((q) => { const t = tickAtX(e.offsetX); return t >= q.start && t <= q.end; }) : null;
      lanes.title = sc ? `${sc.title} (${sc.utc})` : "";
    }
  });
  lanes.addEventListener("mouseleave", () => { laneTip.hidden = true; });
  lanes.addEventListener("mousedown", (e) => {
    const h = beatAt(e.offsetX, e.offsetY);
    if (h) { laneTip.hidden = true; seek(h.b.tick, true); return; }
    dragging = true; seek(tickAtX(e.offsetX));
  });
  window.addEventListener("mousemove", (e) => { if (dragging) { const r = lanes.getBoundingClientRect(); seek(tickAtX(e.clientX - r.left)); } });
  window.addEventListener("mouseup", () => (dragging = false));

  // ---------- flights (deck.gl) ----------
  const ALT_EXAG = 5; // metres per metre of real altitude, so cruising aircraft lift visibly off the terrain
  const tripCache = new Map();
  // One continuous track per aircraft across the previous and current hour, joined by ICAO hex,
  // so aircraft do not vanish and reappear at each hour boundary.
  function tripsFor(t) {
    if (tripCache.has(t)) return tripCache.get(t);
    const byHex = new Map();
    for (const tt of [t - 1, t]) {
      for (const [alt, track, flat, info = ["", "", "", null, null]] of FL[String(tt)] || []) {
        const key = info[4] || `${tt}:${byHex.size}`;
        const z = Math.max(0, alt) * 0.3048 * ALT_EXAG;
        let d = byHex.get(key);
        if (!d) { d = { path: [], ts: [], track, alt, info }; byHex.set(key, d); }
        for (let i = 0; i < flat.length; i += 3) { d.path.push([flat[i + 1], flat[i + 2], z]); d.ts.push(tt * 60 + flat[i]); }
        if (tt === t) { d.track = track; d.alt = alt; d.info = info; }
      }
    }
    const out = [...byHex.values()];
    if (tripCache.size > 60) tripCache.clear();
    tripCache.set(t, out);
    return out;
  }
  // Fade instead of popping: in over 4 minutes after the first sample (unless continuing), out over 10 after the last.
  function alphaAt(d, m) {
    const first = d.ts[0], last = d.ts[d.ts.length - 1];
    const fadeIn = first % 60 === 0 || first < Math.floor(m / 60) * 60 ? 1 : Math.min(1, (m - first) / 4 + 0.15);
    const fadeOut = m > last ? Math.max(0, 1 - (m - last) / 10) : 1;
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }
  function posAt(d, m) {
    const ts = d.ts;
    if (m < ts[0] || m > ts[ts.length - 1] + 10) return null;
    if (m >= ts[ts.length - 1]) return d.path[d.path.length - 1];
    for (let i = 1; i < ts.length; i++) if (m <= ts[i]) {
      const f = (m - ts[i - 1]) / Math.max(1, ts[i] - ts[i - 1]), a = d.path[i - 1], b = d.path[i];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2]];
    }
    return d.path[0];
  }
  function headingAt(d, m) {
    const ts = d.ts; let i = ts.findIndex((x) => x >= m); if (i <= 0) i = Math.min(1, ts.length - 1);
    const a = d.path[Math.max(0, i - 1)], b = d.path[i];
    if (!a || !b || (a[0] === b[0] && a[1] === b[1])) return d.track;
    const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), dy = b[1] - a[1];
    return (Math.atan2(dx, dy) * 180) / Math.PI;
  }
  function updateFlights(t, frac) {
    if (!layersOn.flights) { flightLayers = []; pushDeck(); return; }
    const data = tripsFor(t), m = t * 60 + frac * 60;
    const planes = [];
    for (const d of data) { const p = posAt(d, m); if (p) { const a = alphaAt(d, m); if (a > 0.02) planes.push({ p, h: headingAt(d, m), d, m, a }); } }
    flightLayers = [
      new deck.TripsLayer({ id: "trails", data, getPath: (d) => d.path, getTimestamps: (d) => d.ts, getColor: [236, 231, 218], opacity: 0.22,
        widthMinPixels: 0.6, widthMaxPixels: 1, jointRounded: true, capRounded: true, trailLength: 18, currentTime: m, fadeTrail: true }),
      new deck.ScatterplotLayer({ id: "shadows", data: planes, getPosition: (d) => [d.p[0], d.p[1], 0], getRadius: 1, radiusMinPixels: 2.2,
        getFillColor: (o) => [5, 7, 10, Math.round(150 * o.a)], updateTriggers: { getFillColor: m } }),
      new deck.IconLayer({ id: "planes", data: planes, iconAtlas: PLANE, iconMapping: { plane: { x: 0, y: 0, width: 64, height: 64, mask: true } },
        getIcon: () => "plane", getPosition: (d) => d.p, getAngle: (d) => -d.h, getSize: 15, sizeMinPixels: 11, sizeMaxPixels: 26,
        getColor: (o) => [236, 231, 218, Math.round(255 * o.a)], updateTriggers: { getColor: m }, billboard: false, pickable: true, autoHighlight: true, highlightColor: [227, 199, 125, 255] }),
    ];
    pushDeck();
  }

  // ---------- clock ----------
  function render() {
    $("clockTime").textContent = fmtTick(tick);
    $("clockTick").textContent = `hour ${tick + 1} of ${NT}`;
    $("sceneTitle").textContent = sceneOf(tick).title;
    renderMap(tick); renderDaily(tick); renderAirspace(tick); renderShipGrid(tick); renderStats(tick); renderHud(tick); renderBeat(currentBeat(tick)); drawLanes(tick);
    updateFlights(tick, 0); updateSatellites(tick, 0);
  }
  // ---------- camera ----------
  // Three fixed views; the camera moves only at a narrated beat that needs another view (about six moves in
  // the whole replay), slowly, and the clock holds until it lands. Tilt and bearing belong to the viewer:
  // story moves never change them. Scrubbing the timeline never moves the camera.
  const VIEWS = { theater: { name: "Theater", center: [52.8, 27.0], zoom: 4.7 }, strait: { name: "Strait", center: [56.3, 26.3], zoom: 6.9 }, goo: { name: "Gulf of Oman", center: [57.9, 24.6], zoom: 6.0 } };
  const BEAT_VIEW = { "1.1": "theater", "2.1": "strait", "1.4": "theater", "5.2": "strait", "4.1": "goo", "6.3": "strait" };
  const VIEW_AT = B.beats.filter((b) => BEAT_VIEW[b.id]).map((b) => [b.tick, BEAT_VIEW[b.id]]).sort((x, y) => x[0] - y[0]);
  const storyView = (t) => { let v = "strait"; for (const [tt, name] of VIEW_AT) if (tt <= t) v = name; return v; };
  const CAM_MS = 4000;
  let curView = null, follow = true, camBusyUntil = 0;
  let savedCam = {}; try { savedCam = JSON.parse(localStorage.getItem("hormuz-cam") || "{}"); } catch (e) {}
  const saveCam = () => { try { localStorage.setItem("hormuz-cam", JSON.stringify({ pitch: Math.round(map.getPitch()), bearing: Math.round(map.getBearing()) })); } catch (e) {} };
  function goView(name, ms = CAM_MS) {
    const v = VIEWS[name]; if (!v) return false;
    const moved = curView !== name; curView = name; syncViewUi();
    if (!moved) return false;
    if (ms <= 0) map.jumpTo({ center: v.center, zoom: v.zoom });
    else { map.easeTo({ center: v.center, zoom: v.zoom, duration: ms, easing: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), essential: true }); camBusyUntil = performance.now() + ms; }
    return ms > 0;
  }
  function setFollow(on) { follow = on; syncViewUi(); if (on) goView(storyView(tick)); }
  function syncViewUi() {
    document.querySelectorAll("#viewBar [data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === curView));
    const f = $("followBtn"); if (f) { f.classList.toggle("on", follow); f.textContent = follow ? "Following story" : "Follow story"; }
  }
  $("viewBar").innerHTML = Object.entries(VIEWS).map(([k, v]) => `<button type="button" data-view="${k}">${v.name}</button>`).join("") +
    `<button type="button" id="followBtn" class="follow"></button>
     <label class="tilt" title="Tilt the map (also: right-drag or Ctrl-drag on the map)">Tilt <input type="range" id="tilt" min="0" max="70" step="1"><b id="tiltVal"></b></label>
     <button type="button" id="northBtn" title="Reset rotation to the default bearing">Reset rotation</button>`;
  $("viewBar").addEventListener("click", (e) => { const v = e.target.dataset.view; if (v) { follow = false; curView = null; goView(v, 2500); } });
  $("followBtn").onclick = () => setFollow(!follow);
  $("northBtn").onclick = () => map.easeTo({ bearing: -14, duration: 800 });
  const syncTilt = () => { $("tilt").value = Math.round(map.getPitch()); $("tiltVal").textContent = Math.round(map.getPitch()) + "°"; };
  $("tilt").addEventListener("input", (e) => { map.setPitch(+e.target.value); });
  map.on("pitch", syncTilt); map.on("pitchend", saveCam); map.on("rotateend", saveCam);
  // Panning or zooming by hand hands the camera to the viewer until "Follow story" is pressed again.
  const userTook = (e) => { if (e.originalEvent && follow) { follow = false; curView = null; syncViewUi(); } };
  map.on("dragstart", userTook); map.on("zoomstart", userTook);
  if (savedCam.pitch != null) map.jumpTo({ pitch: savedCam.pitch, bearing: savedCam.bearing ?? -14 });
  syncTilt(); goView(storyView(0), 0);
  function seek(t, cam) { tick = Math.max(0, Math.min(NT - 1, t)); acc = 0; holdUntil = 0; if (cam && follow) goView(storyView(tick), 2500); render(); }
  function setPlaying(p) { playing = p; $("playBtn").textContent = p ? "❚❚" : "▶"; lastFrame = performance.now(); }

  // Satellites run on their own loop inside the current hour (the story tick is one hour, D10):
  // the hour's passes replay continuously at 3 minutes per second, so a 10-minute pass takes about 3 seconds,
  // whether the story is playing or paused. Positions and hover times stay true to the minute shown.
  const SAT_MIN_PER_SEC = 3;
  let satHourKey = -1, satT0 = 0;
  function satFrac(now) {
    if (satHourKey !== tick) { satHourKey = tick; satT0 = now; }
    return (((now - satT0) / 1000) * SAT_MIN_PER_SEC % 60) / 60;
  }
  function frame(now) {
    const dt = (now - lastFrame) / 1000; lastFrame = now;
    updateSatellites(tick, satFrac(now));
    if (playing && now >= holdUntil) {
      // Time-based: advance as many ticks as the elapsed time covers (fast scenes need several per frame),
      // stopping at any tick that holds the clock (a beat or a camera move).
      acc += Math.min(dt, 1) * parseFloat($("speed").value);
      let advanced = false;
      while (playing && acc >= sceneOf(tick).secPerTick) {
        acc -= sceneOf(tick).secPerTick;
        if (tick >= NT - 1) { setPlaying(false); acc = 0; break; }
        tick += 1; advanced = true;
        const beatHere = B.beats.find((b) => b.tick === tick);
        if (beatHere && $("pauseBeats").checked) holdUntil = now + 4500 / parseFloat($("speed").value);
        // Story camera: move only when this tick's view differs, and hold the clock until it lands.
        if (follow && goView(storyView(tick))) holdUntil = Math.max(holdUntil, now + CAM_MS + 300);
        if (holdUntil > now) { acc = 0; break; }
      }
      if (advanced) render();
      updateFlights(tick, Math.min(1, acc / sceneOf(tick).secPerTick));
    }
    requestAnimationFrame(frame);
  }

  $("playBtn").onclick = () => { if (tick >= NT - 1) seek(0, true); setPlaying(!playing); };
  $("nextBeat").onclick = () => { const b = B.beats.find((x) => x.tick > tick); if (b) seek(b.tick, true); };
  $("prevBeat").onclick = () => { const bs = B.beats.filter((x) => x.tick < tick); if (bs.length) seek(bs[bs.length - 1].tick, true); };
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
    if (e.code === "Space") { e.preventDefault(); $("playBtn").click(); }
    if (e.code === "ArrowRight") seek(tick + (e.shiftKey ? 24 : 1));
    if (e.code === "ArrowLeft") seek(tick - (e.shiftKey ? 24 : 1));
    if (e.code === "BracketRight") $("nextBeat").click();
    if (e.code === "BracketLeft") $("prevBeat").click();
  });
  window.addEventListener("resize", () => render());

  // ---------- agent chat (local model via /api/ask) ----------
  const chat = [];
  const log = $("chatLog");
  function addMsg(role, text, meta) {
    const hint = log.querySelector(".chat-hint"); if (hint) hint.remove();
    const el = document.createElement("div"); el.className = "msg " + role;
    el.innerHTML = (meta ? `<span class="msg-meta">${esc(meta)}</span>` : "") + esc(text);
    log.appendChild(el); log.scrollTop = log.scrollHeight; return el;
  }
  function openChat(open = true) {
    $("chatWin").hidden = !open;
    $("chatFab").hidden = open;
    if (open) setTimeout(() => $("chatInput").focus(), 50);
  }
  // The launcher is a round icon floating at the bottom right of the map; the chat window opens above it.
  $("chatFab").innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 8.2h7M8.5 11.2h4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  $("chatFab").title = "Ask the evidence (local model)";
  $("chatFab").setAttribute("aria-label", "Ask the evidence");
  const setTl = () => document.documentElement.style.setProperty("--tl", document.querySelector(".timeline").offsetHeight + "px");
  setTl(); window.addEventListener("resize", setTl);
  $("chatFab").onclick = () => openChat(true);
  $("chatClose").onclick = () => openChat(false);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("chatWin").hidden) openChat(false); });

  // Collapsible panels; open or closed state remembered per viewer
  const PANEL_KEY = "hormuz-panels";
  let panelState = {};
  try { panelState = JSON.parse(localStorage.getItem(PANEL_KEY) || "{}"); } catch (e) { panelState = {}; }
  document.querySelectorAll(".panel").forEach((el) => {
    const id = el.dataset.panel;
    if (!id) return;  // the Inspector is not collapsible: it opens on click and closes with Esc or ×
    // Default: only Dispatch open (the map's instrument strip carries the headline numbers).
    const openByDefault = id === "dispatch" || (window.innerHeight >= 860 && (id === "crossings" || id === "day"));
    if (panelState[id] === false || (panelState[id] === undefined && !openByDefault)) el.classList.add("closed");
    el.querySelector(".panel-head").addEventListener("click", () => {
      el.classList.toggle("closed");
      panelState[id] = !el.classList.contains("closed");
      try { localStorage.setItem(PANEL_KEY, JSON.stringify(panelState)); } catch (e) {}
      render();
    });
  });

  async function ask(question) {
    openChat(true);
    const b = currentBeat(tick);
    setPlaying(false);
    chat.push({ role: "user", content: question });
    addMsg("user", question, fmtTick(tick));
    const pending = addMsg("assistant", "Checking the evidence…");
    pending.classList.add("pending");
    try {
      const r = await fetch("api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ beatId: b ? b.id : null, tick, messages: chat }) });
      const j = await r.json();
      const text = r.ok ? j.answer : (j.error || "The agent is unavailable.");
      pending.textContent = text; pending.classList.remove("pending");
      if (r.ok) chat.push({ role: "assistant", content: text });
    } catch (e) { pending.textContent = "The agent is unavailable (no server running)."; pending.classList.remove("pending"); }
    log.scrollTop = log.scrollHeight;
  }
  $("askBtn").onclick = () => {
    const b = currentBeat(tick); if (!b) return;
    ask(`The replay says: "${b.narrator}" and grades it ${b.grade}. Why, and what could not be checked?`);
  };
  $("chatForm").addEventListener("submit", (e) => {
    e.preventDefault(); const q = $("chatInput").value.trim(); if (!q) return;
    $("chatInput").value = ""; ask(q);
  });

  // Keyboard shortcut help: the ? button in the top bar, or the ? key.
  const toggleHelp = (on) => { $("helpPop").hidden = on === undefined ? !$("helpPop").hidden : !on; };
  $("helpBtn").onclick = (e) => { e.stopPropagation(); toggleHelp(); };
  document.addEventListener("click", (e) => { if (!$("helpPop").hidden && !$("helpPop").contains(e.target)) toggleHelp(false); });
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.key === "?") toggleHelp(); else if (e.key === "Escape") toggleHelp(false);
  });

  window.__replay = { seek, get tick() { return tick; }, B, map, deckOverlay, satAt: (t, f) => updateSatellites(t, f) };
  render();
  requestAnimationFrame((n) => { lastFrame = n; frame(n); });
})();
