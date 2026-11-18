(function () {
  var media = document.querySelector(".opening-media");
  if (!media) return;
  var frames = Array.prototype.slice.call(media.querySelectorAll("img"));
  if (frames.length < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var index = 0;
  var timer = null;

  function show(next) {
    index = next;
    frames.forEach(function (img, i) {
      img.classList.toggle("is-shown", i === index);
    });
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    timer = setInterval(function () {
      show((index + 1) % frames.length);
    }, 5500);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  start();
})();

/* A quiet Signal over the photograph: a few pale threads in the open part of the frame. */
(function () {
  var canvas = document.querySelector(".opening-signal");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var INK = "#f7f4ee";
  var TAU = Math.PI * 2;
  var SEED = 42;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smoothstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function range(r, a, b) { return a + (b - a) * r(); }

  function field(w, h) {
    var mobile = w <= 768;
    if (mobile) {
      return {
        w: w, h: h, mobile: true,
        x0: 0, x1: w,
        center: function (x) { return h * (0.2 - 0.28 * smoothstep(0.35, 1.1, x / w)); },
        thick: h * 0.04
      };
    }
    // Same smoothstep as before. The left stays put; the rise leaves through the top of the photograph.
    return {
      w: w, h: h, mobile: false,
      x0: 0, x1: w,
      center: function (x) { return h * (0.28 - 0.36 * smoothstep(0.35, 1.1, x / w)); },
      thick: h * 0.055
    };
  }

  function build(F, r) {
    var n = F.mobile ? 3 : 5;
    var threads = [];
    var i;
    for (i = 0; i < n; i++) {
      threads.push({
        off: (n > 1 ? i / (n - 1) - 0.5 : 0) * F.thick * 2,
        amp: F.h * range(r, 0.004, 0.008),
        k1: TAU / (F.w * range(r, 0.9, 1.5)),
        w1: range(r, 0.04, 0.08),
        p1: r() * TAU,
        k2: TAU / (F.w * range(r, 0.55, 0.95)),
        w2: range(r, 0.025, 0.05),
        p2: r() * TAU,
        alpha: range(r, 0.42, 0.58),
        lead: 0.01 + i * 0.028,
        next: range(r, 800, 2400)
      });
    }
    return {
      r: r,
      tw: { k: TAU / (F.w * range(r, 0.85, 1.35)), w: range(r, 0.025, 0.05), ph: r() * TAU },
      threads: threads,
      pulses: []
    };
  }

  function yAt(th, F, x, s) {
    var spread = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(S.tw.k * x + S.tw.w * s + S.tw.ph));
    return F.center(x) + th.off * spread +
      th.amp * Math.sin(th.k1 * x + th.w1 * s + th.p1) +
      0.45 * th.amp * Math.sin(th.k2 * x - th.w2 * s + th.p2);
  }

  function enterAt(th, F, x) {
    return smoothstep(F.w * th.lead, F.w * (th.lead + 0.16), x);
  }

  function trace(th, F, s, x0, x1) {
    ctx.beginPath();
    var x, first = true;
    for (x = x0; x <= x1 + 6; x += 6) {
      var y = yAt(th, F, x, s);
      if (first) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      first = false;
    }
    ctx.stroke();
  }

  function stroke(th, F, s, x0, x1) {
    var a = F.w * th.lead;
    var b = F.w * (th.lead + 0.16);
    var ink = ctx.createLinearGradient(a, 0, b, 0);
    ink.addColorStop(0, "rgba(247, 244, 238, 0)");
    ink.addColorStop(0.4, "rgba(247, 244, 238, 0.4)");
    ink.addColorStop(1, INK);
    ctx.strokeStyle = ink;
    trace(th, F, s, x0, x1);
  }

  function strokeTrail(th, F, s, x0, x1) {
    var ink = ctx.createLinearGradient(x0, 0, x1, 0);
    ink.addColorStop(0, "rgba(247, 244, 238, 0)");
    ink.addColorStop(0.32, "rgba(247, 244, 238, 0.45)");
    ink.addColorStop(0.68, INK);
    ink.addColorStop(1, "rgba(247, 244, 238, 0)");
    ctx.strokeStyle = ink;
    trace(th, F, s, x0, x1);
  }

  var F = null;
  var S = null;
  var sim = 0;
  var last = 0;
  var raf = 0;
  var visible = true;

  function frame(t, dt) {
    var s = t / 1000;
    ctx.clearRect(0, 0, F.w, F.h);
    ctx.lineCap = "round";
    ctx.lineWidth = 1;
    S.threads.forEach(function (th) {
      ctx.globalAlpha = th.alpha;
      ctx.lineWidth = 1;
      stroke(th, F, s, F.x0, F.x1);
      if (reduced.matches || t < th.next || S.pulses.length > 1) return;
      S.pulses.push({
        th: th,
        x: F.w * range(S.r, 0.12, 0.62),
        d: 0,
        life: range(S.r, 1100, 1900),
        v: range(S.r, 36, 64),
        len: range(S.r, 70, 130)
      });
      th.next = t + range(S.r, 2800, 6200);
    });
    S.pulses = S.pulses.filter(function (q) { return q.d < q.life; });
    S.pulses.forEach(function (q) {
      q.d += q.v * dt / 1000;
      var x = q.x + q.d;
      if (x > F.x1) return;
      var a = smoothstep(0, 0.2, q.d / q.life) * (1 - smoothstep(0.72, 1, q.d / q.life));
      a *= enterAt(q.th, F, x);
      ctx.globalAlpha = a * 0.85;
      ctx.lineWidth = 1.15;
      strokeTrail(q.th, F, s, Math.max(F.x0, x - q.len), x);
      ctx.globalAlpha = a;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x, yAt(q.th, F, x, s), 1.7, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function rebuild() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (w < 2 || h < 2) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    F = field(w, h);
    S = build(F, mulberry32(SEED));
    if (reduced.matches) frame(8000, 0);
  }

  function loop(now) {
    raf = 0;
    if (!visible || document.hidden || reduced.matches || !F) { last = 0; return; }
    var dt = last ? Math.min(50, now - last) : 16;
    last = now;
    sim += dt;
    frame(sim, dt);
    raf = requestAnimationFrame(loop);
  }

  function start() { if (!raf && !reduced.matches) raf = requestAnimationFrame(loop); }

  rebuild();
  start();

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(function () { rebuild(); start(); }).observe(canvas.parentElement);
  } else {
    window.addEventListener("resize", function () { rebuild(); start(); });
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }).observe(canvas.parentElement);
  }
  document.addEventListener("visibilitychange", start);
})();
