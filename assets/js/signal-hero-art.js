/*
 * Signal hero art
 *
 * Faint threads along a soft diagonal, with small particles moving along them.
 * The page only declares a host. This script finds it, draws into a canvas,
 * and rebuilds that canvas when the host changes size.
 *
 *   <div class="hero-art"></div>
 *   <script src="signal-hero-art.js" data-target=".hero-art"></script>
 *
 * A <canvas> host is used directly. Any other element gets a canvas appended.
 * The host needs a width and height.
 *
 * Optional attributes on the script tag:
 *   data-ink      thread colour   (default #1a635f)
 *   data-accent   pulse colour    (default #e07a5f)
 *   data-density  thread count    (default 1, range 0.5–1.6)
 *   data-speed    motion rate     (default 1, range 0.25–2)
 *   data-seed     layout seed     (default random)
 *
 * prefers-reduced-motion draws one settled frame and stops.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var TARGET = (script && script.getAttribute("data-target")) || ".hero-art";

  function attr(name) {
    return script && script.getAttribute(name);
  }
  function numAttr(name, fallback, lo, hi) {
    var v = parseFloat(attr(name));
    return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  }
  function colorAttr(name, fallback) {
    var v = attr(name);
    return v && /^#?[0-9a-f]{6}$/i.test(v.trim()) ? (v.trim().charAt(0) === "#" ? v.trim() : "#" + v.trim()) : fallback;
  }

  var INK = colorAttr("data-ink", "#1a635f");
  var ACCENT = colorAttr("data-accent", "#e07a5f");
  var DENSITY = numAttr("data-density", 1, 0.5, 1.6);
  var SPEED = numAttr("data-speed", 1, 0.25, 2);
  var SEED = parseInt(attr("data-seed"), 10) || ((Math.random() * 2147483647) | 0);

  var PACE = { introSpread: 3200 };
  var MOBILE_BP = 768;
  var TAU = Math.PI * 2;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function smoothstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function fadeIn(t, start, dur) { return ease(clamp01((t - start) / dur)); }
  function range(r, a, b) { return a + (b - a) * r(); }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  // Mark weight grows with viewport width so strokes keep pace with the type:
  // 1× on phones, ~1.5× at 1440, capped at 2×.
  function markWeight(w) { return w <= MOBILE_BP ? 1 : Math.min(2, 1 + (w - MOBILE_BP) / 1280); }

  // Low on the left, rising through the open space on the right.
  function makeLayout(w, h) {
    var mobile = w <= MOBILE_BP;
    if (mobile) {
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

  function makeTwist(r, L) {
    return { k: TAU / (L.w * range(r, 0.7, 1.2)), w: range(r, 0.05, 0.09), ph: r() * TAU };
  }
  function makeThread(r, L, i, n) {
    return {
      off: (n > 1 ? i / (n - 1) - 0.5 : 0) * L.thick * 2,
      amp: L.h * range(r, 0.012, 0.028),
      k1: TAU / (L.w * range(r, 0.55, 1.1)), w1: range(r, 0.08, 0.16), p1: r() * TAU,
      k2: TAU / (L.w * range(r, 0.25, 0.5)), w2: range(r, 0.05, 0.12), p2: r() * TAU,
      start: r() * PACE.introSpread, dur: range(r, 1400, 2600)
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

  function buildSignal(L, r) {
    var n = Math.max(2, Math.round((L.mobile ? 3 : 5) * DENSITY)), threads = [];
    for (var i = 0; i < n; i++) {
      var th = makeThread(r, L, i, n);
      th.alpha = range(r, 0.16, 0.3);
      th.next = th.start + range(r, 600, 2400);
      threads.push(th);
    }
    return { r: r, tw: makeTwist(r, L), threads: threads, pulses: [] };
  }

  function frameSignal(S, L, t, dt) {
    var s = t / 1000;
    ctx.lineCap = "round";
    ctx.lineWidth = L.wt;
    ctx.strokeStyle = INK;
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
      var x = q.x + q.d;
      var a = smoothstep(0, 0.15, q.d / q.life) * (1 - smoothstep(0.7, 1, q.d / q.life));
      var col = q.accent ? ACCENT : INK;
      var g = ctx.createLinearGradient(x - q.len, 0, x, 0);
      g.addColorStop(0, hexA(col, 0));
      g.addColorStop(1, hexA(col, 0.9));
      ctx.globalAlpha = a;
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.25 * L.wt;
      strokeThread(q.th, S.tw, L, s, x - q.len, x);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, threadY(q.th, S.tw, L, x, s), (q.accent ? 2.8 : 2.2) * L.wt, 0, TAU);
      ctx.fill();
    });
  }

  var host = null, canvas = null, ctx = null;
  var L = null, S = null, simTime = 0, t0 = 0, last = 0, raf = 0, visible = true;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function ensureCanvas() {
    host = document.querySelector(TARGET);
    if (!host) return null;
    if (host.tagName === "CANVAS") {
      canvas = host;
    } else {
      canvas = host.querySelector("canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        if (window.getComputedStyle(host).position === "static") host.style.position = "relative";
        canvas.style.position = "absolute";
        canvas.style.inset = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        host.appendChild(canvas);
      }
    }
    ctx = canvas.getContext("2d");
    return ctx ? canvas : null;
  }

  function hostSize() {
    var el = canvas === host ? canvas : host;
    return { w: el.clientWidth, h: el.clientHeight };
  }

  function rebuild(resetTime) {
    var size = hostSize();
    if (size.w < 2 || size.h < 2) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = makeLayout(size.w, size.h);
    S = buildSignal(L, mulberry32(SEED));
    // A resize rebuilds with the same seed, already past the intro, so nothing replays.
    t0 = resetTime ? simTime : simTime - (PACE.introSpread + 3000);
    if (reduced.matches) { t0 = simTime - 12000; draw(0); }
    return true;
  }

  function draw(dt) {
    ctx.clearRect(0, 0, L.w, L.h);
    frameSignal(S, L, simTime - t0, dt);
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    raf = 0;
    if (!visible || document.hidden || reduced.matches || !L) { last = 0; return; }
    var dt = last ? Math.min(50, now - last) : 16;
    last = now;
    simTime += dt * SPEED;
    draw(dt * SPEED);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !reduced.matches) raf = requestAnimationFrame(loop); }

  var resizeTimer = 0, lastW = 0, lastH = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var size = hostSize();
      if (size.w === lastW && Math.abs(size.h - lastH) / (lastH || 1) < 0.015) return;
      lastW = size.w;
      lastH = size.h;
      if (rebuild(false)) start();
    }, 120);
  }

  function init() {
    if (!ensureCanvas()) return;
    var size = hostSize();
    if (size.w < 2 || size.h < 2) { requestAnimationFrame(init); return; }
    lastW = size.w;
    lastH = size.h;
    rebuild(true);
    start();
    var watch = canvas === host ? canvas : host;
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(onResize).observe(watch);
    else window.addEventListener("resize", onResize);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) start();
      }).observe(watch);
    }
    document.addEventListener("visibilitychange", start);
    if (reduced.addEventListener) reduced.addEventListener("change", function () { rebuild(false); start(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
