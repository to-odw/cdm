/*
 * Cambridge Digital Minds — hero art
 *
 * Follows the approach of the EPDM hero-art.js, drawn to canvas instead of SVG:
 *  - a seeded, generative layout concentrated along a soft diagonal band
 *    (low on the left, rising to the right), leaving most of the hero empty;
 *  - opacity-led motion with ease-in-out-cubic, so nothing jumps or races;
 *  - entrances staggered across the first ~3.2s, then slow irregular "events"
 *    (EPDM: squares subdividing; here: threads glowing, signals, links forming);
 *  - a ~4% accent colour; prefers-reduced-motion renders a still frame.
 *
 * Four styles live here so the client can compare them. The explorer panel
 * (bottom-right) writes its settings into the URL so a look can be shared.
 */
(function () {
  "use strict";

  var band = document.querySelector(".hero-band");
  var canvas = band && band.querySelector(".hero-art");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  // ---------- Pacing, carried over from EPDM hero-art.js ----------
  var PACE = {
    introSpread: 3200,       // entrances staggered over the first 3.2s
    fadeMin: 320,            // each element fades in over 320–800ms
    fadeMax: 800,
    eventMin: 100,           // gaps between events: 0.1–9s, per element
    eventMax: 9000,
    pulseFloor: 0.28,        // breathing never drops below 28% opacity
    pulseSpeedMin: 0.85,     // rad/s, i.e. a ~5–7s breathing period
    pulseSpeedMax: 1.35,
    accentChance: 0.04       // share of elements in the accent colour
  };
  var MOBILE_BP = 768;       // same breakpoint as EPDM
  var SAFE_MIN = 0.2;        // art opacity kept directly behind the copy
  var SAFE_FEATHER = 80;     // px over which the art returns to full strength
  var GRID = 80;             // EPDM grid-line spacing

  // Brand colours. Each carries a recommended accent, used for the hero accent and site --accent.
  var BRANDS = [
    { id: "1a635f", name: "Teal",        primary: "#1a635f", accent: "#e07a5f", accentName: "Terracotta",
      why: "Warm near-complement to the teal; reads on white and on deep teal." },
    { id: "043230", name: "Deep teal",   primary: "#043230", accent: "#e3b341", accentName: "Brass",
      buttons: "accent",
      why: "Deep teal is almost black-green; brass gives it a quiet, academic glint." },
    { id: "4225ff", name: "Ultramarine", primary: "#4225ff", accent: "#ff8a4c", accentName: "Tangerine",
      why: "Opposite the blue-violet; keeps the electric feel without clashing." },
    { id: "861618", name: "Oxblood",     primary: "#861618", accent: "#e4be7c", accentName: "Champagne",
      why: "A soft metallic against oxblood; classic and calm rather than loud." },
    { id: "5c5d27", name: "Olive",       primary: "#5c5d27", accent: "#c9663b", accentName: "Clay",
      why: "Earthy, warm partner to the olive; stays natural and understated." }
  ];
  var TONES = { light: "Light mode", dark: "Dark mode" };

  // Type options (loaded from Google Fonts only when picked)
  var FONTS = {
    "Spectral":         { stack: '"Spectral", "Times New Roman", serif', css: null },
    "Brawler":          { stack: '"Brawler", Georgia, serif', css: "Brawler:wght@400;700" },
    "Tinos":            { stack: '"Tinos", "Times New Roman", serif', css: "Tinos:ital,wght@0,400;0,700;1,400;1,700" },
    "Strichpunkt Sans": { stack: '"Strichpunkt Sans", "Inter", sans-serif', css: "Strichpunkt+Sans:wdth,wght@100..200,400..900" },
    "Inter":            { stack: '"Inter", "Helvetica Neue", sans-serif', css: null }
  };
  var HEAD_FONTS = ["Spectral", "Brawler", "Tinos", "Strichpunkt Sans"];
  var BODY_FONTS = ["Inter", "Strichpunkt Sans", "Tinos", "Brawler"];

  // ---------- Helpers ----------
  var TAU = Math.PI * 2;
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function smoothstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function fadeIn(t, start, dur) { return ease(clamp01((t - start) / dur)); }
  function range(r, a, b) { return a + (b - a) * r(); }
  function gauss(r) { var u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); }
  function hash(a, b) { var n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function breathe(s, el) {
    return PACE.pulseFloor + (1 - PACE.pulseFloor) * 0.5 * (1 + Math.sin(s * el.pulseSpeed + el.pulsePhase));
  }
  function hexToRgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHex(c) { return "#" + c.map(function (v) { return ("0" + Math.round(v).toString(16)).slice(-2); }).join(""); }
  function mix(a, b, t) { var x = hexToRgb(a), y = hexToRgb(b); return rgbToHex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  // The band everything is drawn along (EPDM: the piecewise curve the squares cluster on).
  // It runs low beneath the copy, then sweeps up through the open space on the right.
  // Mark weight grows with viewport width so strokes keep pace with the type:
  // 1× on phones, ~1.5× at 1440, 1.6× at 1536 (the export viewport), capped at 2×
  function markWeight(w) { return w <= MOBILE_BP ? 1 : Math.min(2, 1 + (w - MOBILE_BP) / 1280); }

  function makeLayout(w, h) {
    var mobile = w <= MOBILE_BP;
    if (mobile) {
      // Phones: a gentle rise across the strip reserved below the copy
      var thick = 34;
      return {
        w: w, h: h, mobile: true, thick: thick, wt: 1,
        center: function (x) { return h - thick * 2.2 - 40 * smoothstep(0, 1, x / w); }
      };
    }
    return {
      w: w, h: h, mobile: false, wt: markWeight(w),
      thick: h * 0.12,
      center: function (x) { return h * (0.88 - 0.58 * smoothstep(0.35, 1.1, x / w)); }
    };
  }

  // One shared "twist" lets the thread styles pinch and swell together like a ribbon
  function makeTwist(r, L) {
    return { k: TAU / (L.w * range(r, 0.7, 1.2)), w: range(r, 0.05, 0.09), ph: r() * TAU };
  }
  function makeThread(r, L, i, n) {
    return {
      off: (n > 1 ? i / (n - 1) - 0.5 : 0) * L.thick * 2,
      amp: L.h * range(r, 0.012, 0.028),
      k1: TAU / (L.w * range(r, 0.55, 1.1)), w1: range(r, 0.08, 0.16), p1: r() * TAU,
      k2: TAU / (L.w * range(r, 0.25, 0.5)), w2: range(r, 0.05, 0.12), p2: r() * TAU,
      start: r() * PACE.introSpread, dur: range(r, 1400, 2600), glowStart: -1, glowDur: 0
    };
  }
  function threadY(th, tw, L, x, s) {
    var spread = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(tw.k * x + tw.w * s + tw.ph));
    return L.center(x) + th.off * spread +
      th.amp * Math.sin(th.k1 * x + th.w1 * s + th.p1) +
      0.5 * th.amp * Math.sin(th.k2 * x - th.w2 * s + th.p2);
  }
  function strokeThread(th, tw, L, s, x0, x1) {
    ctx.beginPath();
    for (var x = x0, first = true; x <= x1 + 6; x += 6, first = false) {
      var y = threadY(th, tw, L, x, s);
      if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // ---------- Styles ----------
  var STYLES = {};

  STYLES.threads = {
    label: "Threads",
    blurb: "A loose ribbon of hairlines that slowly twists and swells. Now and then one thread brightens.",
    build: function (L, r, o) {
      var n = Math.max(3, Math.round((L.mobile ? 4 : 7) * o.density));
      var accentIdx = Math.floor(r() * n), threads = [];
      for (var i = 0; i < n; i++) {
        var th = makeThread(r, L, i, n);
        th.accent = i === accentIdx;
        th.alpha = th.accent ? 0.9 : range(r, 0.22, 0.6);
        th.next = th.start + th.dur + range(r, PACE.eventMin, PACE.eventMax) * 2;
        threads.push(th);
      }
      return { r: r, tw: makeTwist(r, L), threads: threads };
    },
    frame: function (S, L, t, dt, pal) {
      var s = t / 1000;
      ctx.lineCap = "round";
      S.threads.forEach(function (th) {
        if (t >= th.next) { th.glowStart = t; th.glowDur = range(S.r, 2400, 4800); th.next = t + th.glowDur + range(S.r, PACE.eventMin, PACE.eventMax) * 2; }
        var p = fadeIn(t, th.start, th.dur);
        if (p <= 0) return;
        var a = th.alpha * p;
        if (th.glowStart >= 0) a *= 1 + 0.9 * Math.sin(Math.PI * clamp01((t - th.glowStart) / th.glowDur));
        ctx.globalAlpha = Math.min(1, a);
        ctx.strokeStyle = th.accent ? pal.accent : pal.ink;
        ctx.lineWidth = (th.accent ? 1.25 : 1) * L.wt;
        strokeThread(th, S.tw, L, s, -10, L.w * p);
      });
    }
  };

  STYLES.signal = {
    label: "Signal",
    blurb: "Faint threads with small particles moving along them, like signals on a wire.",
    build: function (L, r, o) {
      var n = Math.max(2, Math.round((L.mobile ? 3 : 5) * o.density)), threads = [];
      for (var i = 0; i < n; i++) {
        var th = makeThread(r, L, i, n);
        th.alpha = range(r, 0.16, 0.3);
        th.next = th.start + range(r, 600, 2400);
        threads.push(th);
      }
      return { r: r, tw: makeTwist(r, L), threads: threads, pulses: [] };
    },
    frame: function (S, L, t, dt, pal) {
      var s = t / 1000;
      ctx.lineCap = "round";
      ctx.lineWidth = L.wt;
      ctx.strokeStyle = pal.ink;
      S.threads.forEach(function (th) {
        var p = fadeIn(t, th.start, th.dur);
        if (p <= 0) return;
        ctx.globalAlpha = th.alpha * p;
        strokeThread(th, S.tw, L, s, -10, L.w * p);
        if (t >= th.next) {
          S.pulses.push({
            th: th, x: range(S.r, -0.05, 0.85) * L.w, d: 0,
            life: range(S.r, 320, 900), v: range(S.r, 18, 34), len: range(S.r, 80, 200),
            accent: S.r() < 0.1
          });
          th.next = t + range(S.r, 1500, 8000);
        }
      });
      S.pulses = S.pulses.filter(function (q) { return q.d < q.life; });
      S.pulses.forEach(function (q) {
        q.d += q.v * dt / 1000;
        var x = q.x + q.d, a = smoothstep(0, 0.15, q.d / q.life) * (1 - smoothstep(0.7, 1, q.d / q.life));
        var col = q.accent ? pal.accent : pal.ink;
        // fading tail
        var g = ctx.createLinearGradient(x - q.len, 0, x, 0);
        g.addColorStop(0, hexA(col, 0)); g.addColorStop(1, hexA(col, 0.9));
        ctx.globalAlpha = a; ctx.strokeStyle = g; ctx.lineWidth = 1.25 * L.wt;
        strokeThread(q.th, S.tw, L, s, x - q.len, x);
        // head
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, threadY(q.th, S.tw, L, x, s), (q.accent ? 2.8 : 2.2) * L.wt, 0, TAU); ctx.fill();
      });
    }
  };

  STYLES.constellation = {
    label: "Constellation",
    blurb: "Still particles that breathe in and out. Faint links draw between neighbors, hold, and dissolve.",
    build: function (L, r, o) {
      var n = Math.round((L.mobile ? 34 : 90) * o.density), pts = [], tries = 0;
      while (pts.length < n && tries++ < n * 40) {
        var x = Math.round(r() * L.w / 8) * 8;
        var y = Math.round((L.center(x) + gauss(r) * L.thick * 0.6) / 8) * 8;
        if (y < 8 || y > L.h - 8) continue;
        if (pts.some(function (p) { return Math.abs(p.x - x) < 18 && Math.abs(p.y - y) < 18; })) continue;
        var start = r() * PACE.introSpread, dur = range(r, PACE.fadeMin, PACE.fadeMax);
        pts.push({
          x: x, y: y, rad: 1.1 + 1.9 * Math.pow(r(), 2.5), accent: r() < PACE.accentChance,
          start: start, dur: dur, next: start + dur + range(r, PACE.eventMin, PACE.eventMax),
          pulsePhase: r() * TAU, pulseSpeed: range(r, PACE.pulseSpeedMin, PACE.pulseSpeedMax)
        });
      }
      if (pts.length && !pts.some(function (p) { return p.accent; })) pts[Math.floor(r() * pts.length)].accent = true;
      pts.forEach(function (p) {
        p.nb = pts.filter(function (q) { return q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 200; })
          .sort(function (a, b) { return Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y); })
          .slice(0, 4);
      });
      return { r: r, pts: pts, links: [], maxLinks: Math.max(3, Math.round(n / 12)) };
    },
    frame: function (S, L, t, dt, pal) {
      var s = t / 1000;
      S.pts.forEach(function (p) {
        if (t < p.next) return;
        p.next = t + range(S.r, PACE.eventMin, PACE.eventMax);
        if (S.links.length >= S.maxLinks || !p.nb.length) return;
        var q = p.nb[Math.floor(S.r() * Math.min(3, p.nb.length))];
        if (S.links.some(function (l) { return (l.a === p && l.b === q) || (l.a === q && l.b === p); })) return;
        S.links.push({ a: p, b: q, start: t, grow: 1600, hold: range(S.r, 2500, 6000), fade: 1800, accent: p.accent || q.accent });
      });
      ctx.lineWidth = L.wt;
      S.links = S.links.filter(function (l) { return t - l.start < l.grow + l.hold + l.fade; });
      S.links.forEach(function (l) {
        var e = t - l.start, frac = fadeIn(e, 0, l.grow), a = 0.45;
        if (e > l.grow + l.hold) a *= 1 - fadeIn(e, l.grow + l.hold, l.fade);
        ctx.globalAlpha = a;
        ctx.strokeStyle = l.accent ? pal.accent : pal.ink;
        ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y);
        ctx.lineTo(l.a.x + (l.b.x - l.a.x) * frac, l.a.y + (l.b.y - l.a.y) * frac); ctx.stroke();
      });
      S.pts.forEach(function (p) {
        var a = fadeIn(t, p.start, p.dur);
        if (a <= 0) return;
        ctx.globalAlpha = a * breathe(s, p) * (p.accent ? 1 : 0.85);
        ctx.fillStyle = p.accent ? pal.accent : pal.ink;
        ctx.beginPath(); ctx.arc(p.x, p.y, (p.accent ? p.rad + 1 : p.rad) * L.wt, 0, TAU); ctx.fill();
      });
    }
  };

  STYLES.dotwave = {
    label: "Dot wave",
    blurb: "A sparse square-dot grid, a nod to the EPDM grid. A slow wave travels through it and lights the dots it passes.",
    build: function (L, r, o) {
      var k1 = TAU / (L.w * range(r, 0.8, 1.2)), k2 = TAU / (L.w * range(r, 0.35, 0.55)), kE = TAU / (L.w * 0.6);
      return {
        g: (L.mobile ? 26 : 34) / Math.sqrt(o.density), amp: L.thick * 0.55, seed: r() * 1000,
        k1: k1, w1: range(r, 16, 26) * k1, p1: r() * TAU,       // phase speeds in px/s
        k2: k2, w2: range(r, 8, 14) * k2, p2: r() * TAU,
        kE: kE, wE: range(r, 10, 18) * kE, pE: r() * TAU
      };
    },
    frame: function (S, L, t, dt, pal) {
      var s = t / 1000, g = S.g, reach = L.thick * 2.6;
      for (var ix = 0, x = g / 2; x < L.w; ix++, x += g) {
        var reveal = fadeIn(t, (x / L.w) * PACE.introSpread, 900);
        if (reveal <= 0) continue;
        var wy = L.center(x) + S.amp * Math.sin(S.k1 * x - S.w1 * s + S.p1) + 0.4 * S.amp * Math.sin(S.k2 * x + S.w2 * s + S.p2);
        var env = 0.5 + 0.5 * Math.sin(S.kE * x - S.wE * s + S.pE);
        var iy0 = Math.max(0, Math.floor((wy - reach) / g)), iy1 = Math.ceil((wy + reach) / g);
        for (var iy = iy0; iy <= iy1; iy++) {
          var y = g / 2 + iy * g;
          if (y > L.h) break;
          var d = (y - wy) / (L.thick * 0.6);
          var I = Math.exp(-d * d) * (0.35 + 0.65 * env) * reveal;
          if (I < 0.05) continue;
          var accent = I > 0.5 && hash(ix + S.seed, iy) < PACE.accentChance * 2;
          var size = (1 + 2.4 * I) * L.wt;
          ctx.globalAlpha = Math.min(1, 0.12 + 0.88 * I);
          ctx.fillStyle = accent ? pal.accent : pal.ink;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
    }
  };

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  // ---------- Settings (URL-backed so a look can be shared) ----------
  var params = new URLSearchParams(location.search);
  function hexParam(k, fallback) { var v = params.get(k); return v && /^[0-9a-f]{6}$/i.test(v) ? "#" + v.toLowerCase() : fallback; }
  function numParam(k, fallback, lo, hi) { var v = parseFloat(params.get(k)); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback; }
  function brandById(id) { return BRANDS.filter(function (b) { return b.id === id; })[0] || BRANDS[0]; }
  // Hero colours derived from a brand + tone
  function toneColors(brand, tone) {
    if (tone === "dark") {
      var bg = luminance(brand.primary) < 0.02 ? brand.primary : mix(brand.primary, "#000000", 0.72);
      return { bg: bg, ink: mix(brand.primary, "#ffffff", 0.78), accent: brand.accent };
    }
    return { bg: "#ffffff", ink: brand.primary, accent: brand.accent };
  }
  function pick(list, v, fallback) { return list.indexOf(v) >= 0 ? v : fallback; }

  var brand0 = brandById(params.get("brand"));
  var tone0 = TONES[params.get("tone")] ? params.get("tone") : "light";
  var derived0 = toneColors(brand0, tone0);
  var opts = {
    style: STYLES[params.get("art")] ? params.get("art") : "threads",
    brand: brand0.id, tone: tone0,
    bg: hexParam("bg", derived0.bg), ink: hexParam("ink", derived0.ink), accent: hexParam("ac", derived0.accent),
    headFont: pick(HEAD_FONTS, params.get("hf"), "Spectral"),
    bodyFont: pick(BODY_FONTS, params.get("bf"), "Inter"),
    density: numParam("d", 1, 0.5, 1.6),
    speed: numParam("s", 1, 0.25, 2),
    grid: params.get("grid") === "1",
    seed: parseInt(params.get("seed"), 10) || ((Math.random() * 2147483647) | 0)
  };
  // ?at=9000 opens the art 9s in (handy for screenshots and side-by-side reviews)
  var startAt = numParam("at", 0, 0, 600000);

  var urlTimer = 0;
  function writeUrl() { clearTimeout(urlTimer); urlTimer = setTimeout(writeUrlNow, 250); }
  function writeUrlNow() {
    clearTimeout(urlTimer);
    var q = new URLSearchParams(location.search);
    q.delete("pal");
    q.set("art", opts.style); q.set("brand", opts.brand); q.set("tone", opts.tone);
    q.set("bg", opts.bg.slice(1)); q.set("ink", opts.ink.slice(1)); q.set("ac", opts.accent.slice(1));
    q.set("hf", opts.headFont); q.set("bf", opts.bodyFont);
    q.set("d", String(opts.density)); q.set("s", String(opts.speed));
    q.set("grid", opts.grid ? "1" : "0"); q.set("seed", String(opts.seed));
    history.replaceState(null, "", location.pathname + "?" + q.toString() + location.hash);
  }

  // ---------- Engine ----------
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  // simTime runs at opts.speed; each build gets its own clock origin (t0)
  var L = null, S = null, mask = null, simTime = 0, t0 = 0, last = 0, raf = 0, visible = true;

  var root = document.documentElement, loadedFonts = {};
  function loadFont(name) {
    var f = FONTS[name];
    if (!f.css || loadedFonts[name]) return;
    loadedFonts[name] = true;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" + f.css + "&display=swap";
    // New metrics move the copy, so recut the text-safe mask once the font is in
    link.onload = function () { document.fonts.ready.then(function () { if (L) { mask = buildMask(); if (!raf) draw(0); } }); };
    document.head.appendChild(link);
  }
  function applyColors() {
    var b = brandById(opts.brand);
    var btn = b.buttons === "accent" ? b.accent : b.primary;
    var dark = opts.tone === "dark";
    root.style.setProperty("--primary", b.primary);
    root.style.setProperty("--accent", b.accent);
    root.style.setProperty("--btn", btn);
    root.style.setProperty("--btn-ink", luminance(btn) > 0.18 ? "#09090b" : "#ffffff");
    root.style.setProperty("--bg", opts.bg);
    root.dataset.tone = opts.tone;
    band.style.setProperty("--hero-bg", opts.bg);
    band.classList.toggle("is-dark", dark);
    var brandImg = document.querySelector(".brand img");
    if (brandImg) {
      var next = "assets/img/CDM-Logo-" + (dark ? "Negative" : "Positive") + ".svg";
      if (brandImg.getAttribute("src") !== next) brandImg.setAttribute("src", next);
    }
  }
  function applyFonts() {
    loadFont(opts.headFont); loadFont(opts.bodyFont);
    root.style.setProperty("--font-serif", FONTS[opts.headFont].stack);
    root.style.setProperty("--font-sans", FONTS[opts.bodyFont].stack);
  }

  // Soft cut-out behind the copy so text always sits on a quiet patch
  function buildMask() {
    var bandRect = band.getBoundingClientRect();
    var rects = Array.prototype.map.call(band.querySelectorAll(".hero-copy h1, .hero-copy .lede, .hero-foot > *"), function (el) {
      var r = el.getBoundingClientRect();
      return { l: r.left - bandRect.left, r: r.right - bandRect.left, t: r.top - bandRect.top, b: r.bottom - bandRect.top };
    }).filter(function (r) { return r.r > r.l && r.b > r.t; });
    var sc = 4, mw = Math.ceil(L.w / sc), mh = Math.ceil(L.h / sc);
    var c = document.createElement("canvas"); c.width = mw; c.height = mh;
    var g = c.getContext("2d"), img = g.createImageData(mw, mh), data = img.data;
    for (var y = 0; y < mh; y++) {
      for (var x = 0; x < mw; x++) {
        var px = x * sc, py = y * sc, k = 1;
        for (var i = 0; i < rects.length; i++) {
          var rc = rects[i];
          var dx = Math.max(rc.l - px, 0, px - rc.r), dy = Math.max(rc.t - py, 0, py - rc.b);
          k = Math.min(k, clamp01(Math.hypot(dx, dy) / SAFE_FEATHER));
        }
        data[(y * mw + x) * 4 + 3] = Math.round((1 - (SAFE_MIN + (1 - SAFE_MIN) * ease(k))) * 255);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function rebuild(resetTime) {
    var w = band.clientWidth, h = band.clientHeight;
    if (w < 2 || h < 2) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = makeLayout(w, h);
    S = STYLES[opts.style].build(L, mulberry32(opts.seed), opts);
    mask = buildMask();
    // A resize rebuilds with the same seed, already past the intro, so nothing replays
    t0 = resetTime ? simTime : simTime - (PACE.introSpread + 3000);
    if (resetTime && startAt) { t0 = simTime - startAt; startAt = 0; }
    if (reduced.matches) { t0 = simTime - 12000; draw(0); }
  }

  function drawGrid() {
    ctx.globalAlpha = 0.07; ctx.strokeStyle = opts.ink; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = GRID; x < L.w; x += GRID) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, L.h); }
    for (var y = GRID; y < L.h; y += GRID) { ctx.moveTo(0, y + 0.5); ctx.lineTo(L.w, y + 0.5); }
    ctx.stroke();
  }

  function draw(dt) {
    ctx.clearRect(0, 0, L.w, L.h);
    if (opts.grid) drawGrid();
    STYLES[opts.style].frame(S, L, simTime - t0, dt, { ink: opts.ink, accent: opts.accent });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(mask, 0, 0, L.w, L.h);
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    raf = 0;
    if (!visible || document.hidden || reduced.matches || !L) { last = 0; return; }
    var dt = last ? Math.min(50, now - last) : 16;
    last = now;
    simTime += dt * opts.speed;
    draw(dt * opts.speed);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !reduced.matches) raf = requestAnimationFrame(loop); }

  var resizeTimer = 0, lastW = 0, lastH = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var w = band.clientWidth, h = band.clientHeight;
      if (w === lastW && Math.abs(h - lastH) / (lastH || 1) < 0.015) return;   // ignore mobile URL-bar jitter
      lastW = w; lastH = h;
      rebuild(false); start();
    }, 120);
  }

  applyColors();
  applyFonts();
  lastW = band.clientWidth; lastH = band.clientHeight;
  rebuild(true);
  start();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(onResize).observe(band);
  else window.addEventListener("resize", onResize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }).observe(band);
  }
  document.addEventListener("visibilitychange", start);
  if (reduced.addEventListener) reduced.addEventListener("change", function () { rebuild(false); start(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (L) mask = buildMask(); });

  // ---------- Explorer panel ----------
  if (params.get("controls") === "0" || band.dataset.controls === "off") return;

  var panel = document.createElement("div");
  panel.className = "art-panel";
  panel.innerHTML =
    '<div class="art-panel-body" id="art-panel-body">' +
      '<section><h4>Brand color</h4><div class="art-swatches" role="group" aria-label="Brand color"></div>' +
        '<div class="art-tones" role="group" aria-label="Color mode"></div></section>' +
      '<section><h4>Style</h4><div class="art-styles" role="group" aria-label="Style"></div></section>' +
      '<section><h4>Type</h4>' +
        '<label class="art-select"><span>Headings</span><select data-key="headFont"></select></label>' +
        '<label class="art-select"><span>Body</span><select data-key="bodyFont"></select></label>' +
      '</section>' +
      '<section><h4>Feel</h4>' +
        '<label class="art-check"><input type="checkbox" data-key="grid"> Grid lines (as on EPDM)</label>' +
      '</section>' +
    '</div>' +
    '<button type="button" class="art-panel-toggle" aria-expanded="false" aria-controls="art-panel-body">Aa</button>';
  document.body.appendChild(panel);

  var stylesEl = panel.querySelector(".art-styles");
  Object.keys(STYLES).forEach(function (id) {
    if (id === "constellation") return;
    var b = document.createElement("button");
    b.type = "button"; b.textContent = STYLES[id].label; b.dataset.style = id;
    b.addEventListener("click", function () { opts.style = id; changed(true); });
    stylesEl.appendChild(b);
  });
  var swatchesEl = panel.querySelector(".art-swatches");
  function useDerived() { var c = toneColors(brandById(opts.brand), opts.tone); opts.bg = c.bg; opts.ink = c.ink; opts.accent = c.accent; }
  BRANDS.forEach(function (br) {
    var b = document.createElement("button");
    b.type = "button"; b.dataset.brand = br.id;
    b.title = br.name + " #" + br.id.toUpperCase() + " · accent " + br.accentName + " " + br.accent.toUpperCase();
    b.setAttribute("aria-label", br.name + " brand color");
    b.style.background = br.primary; b.style.setProperty("--sw-accent", br.accent);
    b.addEventListener("click", function () { opts.brand = br.id; useDerived(); changed(false); });
    swatchesEl.appendChild(b);
  });
  var tonesEl = panel.querySelector(".art-tones");
  Object.keys(TONES).forEach(function (id) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = TONES[id]; b.dataset.tone = id;
    b.addEventListener("click", function () { opts.tone = id; useDerived(); changed(false); });
    tonesEl.appendChild(b);
  });
  panel.querySelectorAll("select").forEach(function (sel) {
    (sel.dataset.key === "headFont" ? HEAD_FONTS : BODY_FONTS).forEach(function (name) {
      var o = document.createElement("option"); o.value = o.textContent = name; sel.appendChild(o);
    });
    sel.addEventListener("change", function () { opts[sel.dataset.key] = sel.value; applyFonts(); changed(false); });
  });
  panel.querySelectorAll("input[type=range]").forEach(function (inp) {
    inp.addEventListener("input", function () {
      opts[inp.dataset.key] = parseFloat(inp.value);
      if (inp.dataset.key === "density") { rebuild(false); start(); }
      changed(false);
    });
  });
  panel.querySelector("input[type=checkbox]").addEventListener("change", function (e) { opts.grid = e.target.checked; changed(false); });
  var toggle = panel.querySelector(".art-panel-toggle");
  toggle.addEventListener("click", function () {
    var open = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  function syncPanel() {
    stylesEl.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.style === opts.style)); });
    swatchesEl.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.brand === opts.brand)); });
    tonesEl.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tone === opts.tone)); });
    panel.querySelectorAll("select").forEach(function (sel) { sel.value = opts[sel.dataset.key]; });
    panel.querySelectorAll("input[type=range]").forEach(function (inp) {
      inp.value = String(opts[inp.dataset.key]);
      inp.nextElementSibling.textContent = +opts[inp.dataset.key].toFixed(2) + "×";
    });
    panel.querySelector("input[type=checkbox]").checked = opts.grid;
  }

  if (params.get("panel") === "1") { panel.classList.add("open"); toggle.setAttribute("aria-expanded", "true"); }

  function changed(restart) {
    applyColors();
    if (restart) { rebuild(true); start(); }
    else if (reduced.matches || !raf) { if (L) draw(0); }
    syncPanel();
    writeUrl();
  }
  syncPanel();
})();
