/*
 * Constellation.
 * Stars sit still across the field. One figure at a time draws a chain
 * and a short branch, holds, and fades. The figure does not cross itself.
 * A still frame is drawn when the visitor prefers reduced motion.
 */
(function () {
  "use strict";

  var canvas = document.querySelector("canvas.constellation");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var stage = canvas.parentElement;

  var INK = "#d7e6e2";
  var ACCENT = "#e3b341";
  var TAU = Math.PI * 2;
  var SEED = 42;

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

  function makeLayout(w, h) {
    var mobile = w <= 768;
    var wt = mobile ? 1 : Math.min(1.6, 1 + (w - 768) / 1800);
    return { w: w, h: h, mobile: mobile, wt: wt };
  }

  /* Ease the stars behind the centered headline and the line at the bottom. */
  function room(L, x, y) {
    var titleBand = 1 - smoothstep(0.05, 0.16, Math.abs(y / L.h - 0.5));
    var title = titleBand * (1 - smoothstep(L.w * (L.mobile ? 0.08 : 0.18), L.w * (L.mobile ? 0.78 : 0.5), x));
    var foot = smoothstep(L.h * 0.84, L.h * 0.94, y) * (1 - smoothstep(L.w * 0.02, L.w * (L.mobile ? 0.96 : 0.7), x));
    return 1 - 0.5 * Math.max(title, foot);
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function orient(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  /* Proper crossing only. Shared endpoints are a corner, not a cross. */
  function segmentsCross(a, b, c, d) {
    var o1 = orient(a, b, c);
    var o2 = orient(a, b, d);
    var o3 = orient(c, d, a);
    var o4 = orient(c, d, b);
    if (!o1 || !o2 || !o3 || !o4) return false;
    return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
  }

  function segsOf(spine, branches) {
    var segs = [];
    var i;
    for (i = 1; i < spine.length; i++) segs.push([spine[i - 1], spine[i]]);
    branches.forEach(function (b) {
      for (i = 1; i < b.pts.length; i++) segs.push([b.pts[i - 1], b.pts[i]]);
    });
    return segs;
  }

  function blocked(segs, a, b) {
    var i;
    for (i = 0; i < segs.length; i++) {
      if (segs[i][0] === a || segs[i][1] === a) continue;
      if (segmentsCross(segs[i][0], segs[i][1], a, b)) return true;
    }
    return false;
  }

  function alongSpine(spine, at) {
    var near = [];
    if (at > 0) near.push(spine[at - 1]);
    if (at < spine.length - 1) near.push(spine[at + 1]);
    return near;
  }

  function nextStar(S, cur, prev, used, segs, along) {
    var cands = [];
    var i;
    for (i = 0; i < S.pts.length; i++) {
      var q = S.pts[i];
      if (used.indexOf(q) !== -1) continue;
      var d = dist(cur, q);
      if (d < 56 || d > 220) continue;
      var wx = q.x - cur.x;
      var wy = q.y - cur.y;
      var wlen = Math.hypot(wx, wy) || 1;
      if (prev) {
        var vx = cur.x - prev.x;
        var vy = cur.y - prev.y;
        var dot = (vx * wx + vy * wy) / ((Math.hypot(vx, vy) || 1) * wlen);
        if (dot < -0.25) continue;
      }
      if (along) {
        var parallel = false;
        var j;
        for (j = 0; j < along.length; j++) {
          var ax = along[j].x - cur.x;
          var ay = along[j].y - cur.y;
          var ad = Math.abs((ax * wx + ay * wy) / ((Math.hypot(ax, ay) || 1) * wlen));
          if (ad > 0.8) parallel = true;
        }
        if (parallel) continue;
      }
      if (blocked(segs, cur, q)) continue;
      cands.push(q);
    }
    if (!cands.length) return null;
    cands.sort(function (a, b) { return dist(cur, a) - dist(cur, b); });
    var pool = cands.slice(0, Math.min(4, cands.length));
    return pool[Math.floor(S.r() * pool.length)];
  }

  /* Scattered over the whole field, with a gap so they do not pile up. */
  function place(r, L) {
    return {
      x: L.w * (0.025 + 0.95 * r()),
      y: L.h * (0.03 + 0.94 * r())
    };
  }

  function build(L, r) {
    var n = Math.round(L.mobile ? 48 : 96);
    var pts = [];
    var tries = 0;
    var gap = L.mobile ? 36 : 52;
    while (pts.length < n && tries++ < n * 60) {
      var spot = place(r, L);
      if (pts.some(function (p) { return dist(p, spot) < gap; })) continue;
      pts.push({
        x: spot.x,
        y: spot.y,
        rad: 0.5 + 1.05 * r(),
        accent: r() < 0.05,
        start: r() * 2600,
        dur: range(r, 700, 1400)
      });
    }
    if (pts.length && !pts.some(function (p) { return p.accent; })) pts[0].accent = true;
    return { r: r, pts: pts, link: null, wait: 500, lastStart: null };
  }

  function growPath(S, chain, want, used, segs) {
    var guard = 0;
    while (chain.length < want && guard++ < 40) {
      var cur = chain[chain.length - 1];
      var prev = chain.length > 1 ? chain[chain.length - 2] : null;
      var q = nextStar(S, cur, prev, used, segs, null);
      if (!q) break;
      chain.push(q);
      used.push(q);
      segs.push([cur, q]);
    }
    return chain;
  }

  function buildFigure(S) {
    var attempt;
    for (attempt = 0; attempt < 24; attempt++) {
      var start = S.pts[Math.floor(S.r() * S.pts.length)];
      if (start === S.lastStart) continue;
      var spine = [start];
      var used = [start];
      var segs = [];
      growPath(S, spine, 5 + Math.floor(S.r() * 4), used, segs);
      if (spine.length < 5) continue;
      var branches = [];
      var wantBranches = S.r() < 0.4 ? 2 : 1;
      var b;
      for (b = 0; b < wantBranches; b++) {
        var at = 1 + Math.floor(S.r() * (spine.length - 2));
        var arm = [spine[at]];
        var extra = 2 + Math.floor(S.r() * 2);
        var guard = 0;
        while (arm.length < 1 + extra && guard++ < 16) {
          var cur = arm[arm.length - 1];
          var prev = arm.length > 1 ? arm[arm.length - 2] : null;
          var along = arm.length === 1 ? alongSpine(spine, at) : null;
          var q = nextStar(S, cur, prev, used, segs, along);
          if (!q) break;
          arm.push(q);
          used.push(q);
          segs.push([cur, q]);
        }
        if (arm.length >= 3) branches.push({ pts: arm });
      }
      if (!branches.length) continue;
      S.lastStart = start;
      return { spine: spine, branches: branches };
    }
    return null;
  }

  function figurePoints(fig) {
    var pts = fig.spine.slice();
    fig.branches.forEach(function (b) {
      b.pts.forEach(function (p) { if (pts.indexOf(p) === -1) pts.push(p); });
    });
    return pts;
  }

  function beginPath(S, t) {
    var fig = buildFigure(S);
    if (!fig) {
      S.wait = t + 280;
      return;
    }
    var count = figurePoints(fig).length;
    S.link = {
      fig: fig,
      start: t,
      grow: 2400 + 640 * count,
      hold: range(S.r, 2400, 3600),
      fade: 2400,
      accent: figurePoints(fig).some(function (p) { return p.accent; })
    };
  }

  function strokePart(pts, budget) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    var i;
    for (i = 1; i < pts.length; i++) {
      var seg = dist(pts[i - 1], pts[i]);
      if (budget >= seg - 0.01) {
        ctx.lineTo(pts[i].x, pts[i].y);
        budget -= seg;
      } else {
        var u = seg ? Math.max(0, budget) / seg : 0;
        ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u);
        ctx.stroke();
        return 0;
      }
    }
    ctx.stroke();
    return budget;
  }

  function strokeFigure(fig, frac) {
    var parts = [fig.spine];
    var i;
    for (i = 0; i < fig.branches.length; i++) parts.push(fig.branches[i].pts);
    var total = 0;
    var lengths = [];
    for (i = 0; i < parts.length; i++) {
      var len = 0;
      var j;
      for (j = 1; j < parts[i].length; j++) len += dist(parts[i][j - 1], parts[i][j]);
      lengths.push(len);
      total += len;
    }
    var budget = total * frac;
    for (i = 0; i < parts.length; i++) {
      if (budget <= 0) break;
      budget = strokePart(parts[i], budget);
      budget -= 0;
    }
  }

  function frame(S, L, t) {
    if (!S.link) {
      if (t >= S.wait) beginPath(S, t);
    } else if (t - S.link.start >= S.link.grow + S.link.hold + S.link.fade) {
      S.link = null;
      S.wait = t + range(S.r, 280, 620);
    }

    var link = S.link;
    if (link) {
      var e = t - link.start;
      var frac = fadeIn(e, 0, link.grow);
      var quiet = 1;
      var drawn = figurePoints(link.fig);
      var i;
      for (i = 0; i < drawn.length; i++) quiet = Math.min(quiet, room(L, drawn[i].x, drawn[i].y));
      var a = (link.accent ? 0.5 : 0.38) * quiet;
      if (e > link.grow + link.hold) a *= 1 - fadeIn(e, link.grow + link.hold, link.fade);
      ctx.globalAlpha = a;
      ctx.strokeStyle = link.accent ? ACCENT : INK;
      ctx.lineWidth = Math.max(0.7, L.wt * 0.75);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      strokeFigure(link.fig, frac);
    }

    S.pts.forEach(function (p) {
      var shown = fadeIn(t, p.start, p.dur);
      if (shown <= 0) return;
      ctx.globalAlpha = shown * (p.accent ? 0.95 : 0.72) * room(L, p.x, p.y);
      ctx.fillStyle = p.accent ? ACCENT : INK;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.accent ? p.rad + 0.35 : p.rad) * Math.min(L.wt, 1.25), 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var L = null;
  var S = null;
  var sim = 0;
  var t0 = 0;
  var last = 0;
  var raf = 0;
  var visible = true;

  function rebuild(resetTime) {
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    if (w < 2 || h < 2) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = makeLayout(w, h);
    S = build(L, mulberry32(SEED));
    t0 = resetTime ? sim : sim - 5000;
    if (reduced.matches) {
      beginPath(S, 0);
      if (S.link) S.link.start = -S.link.grow - 400;
      frame(S, L, 8000);
    }
  }

  function loop(now) {
    raf = 0;
    if (!visible || document.hidden || reduced.matches || !L) { last = 0; return; }
    var dt = last ? Math.min(50, now - last) : 16;
    last = now;
    sim += dt;
    ctx.clearRect(0, 0, L.w, L.h);
    frame(S, L, sim - t0);
    raf = requestAnimationFrame(loop);
  }

  function start() { if (!raf && !reduced.matches) raf = requestAnimationFrame(loop); }

  rebuild(true);
  start();

  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { rebuild(false); start(); }, 120);
  }
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(onResize).observe(stage);
  else window.addEventListener("resize", onResize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }).observe(stage);
  }
  document.addEventListener("visibilitychange", start);
  if (reduced.addEventListener) reduced.addEventListener("change", function () { rebuild(false); start(); });
})();
