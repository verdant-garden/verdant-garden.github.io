/* Verdant — plant habits: how each growth form arranges its leaves
   (basal fans, golden-angle rosettes, trailing vines, fronds, canes…). */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var A = V.art._, PI = Math.PI;
  var leaf = A.leaf, curve = A.curve, rot = A.rot, flower = A.flower, trap = A.trap, mix = A.mix, clamp = A.clamp, habitLsys = A.habitLsys;
  var YEL = A.YEL, YDK = A.YDK;

  /* ---------- basal habit (fans from the crown) ---------- */
  function habitBasal(E) {
    var F = E.F, g = E.g, n = Math.max(2, Math.round(F.n * (0.3 + 0.7 * g)));
    var maxL = E.availH * F.h * (0.3 + 0.7 * g), spread = F.spread * 0.95;
    var list = [];
    for (var i = 0; i < n; i++) {
      var r = E.rng(), r2 = E.rng(), s = i % 2 ? 1 : -1;
      var frac = (i + 0.5) / n;
      list.push({ i: i, s: s, a: s * spread * (1 - frac) * (0.55 + 0.45 * r) * (1 + 0.4 * E.thirst), l: maxL * (0.65 + 0.35 * r2) * (i === n - 1 && n > 3 ? 0.65 : 1) });
    }
    var bloomDone = 0;
    list.forEach(function (L, k) {
      var yel = k < E.p.yellow;
      var x = E.bx + L.s * (k % 3), y = E.by;
      var sh = F.leaf, c, bend = L.s * (0.06 + 0.25 * E.thirst);
      if (F.petiole) {
        var pr = sh === 'maranta' ? 0.28 : sh === 'trap' ? 0.42 : 0.5;
        var sl = L.l * pr, pa = L.a * (sh === 'trap' ? 1.1 : 0.85);
        var pe = rot(x, y, pa, L.s * sl * 0.12, -sl);
        var pc = rot(x, y, pa, 0, -sl * 0.55);
        if (sh === 'trap') {
          leaf(E.ctx, E.rng, x, y, pa, sl, sl * 0.16, 'lance', F.c, { yellow: yel, quick: true });
        } else curve(E.ctx, x, y, pc[0], pc[1], pe[0], pe[1], sh === 'monstera' ? 2.2 : 1.4, F.c[1], 0.75);
        var ba = pa * 1.25 + L.s * 0.22 + L.s * E.thirst * 0.5;
        if (sh === 'maranta') ba = E.night && E.sp.nightFold ? pa * 0.25 : clamp(L.a * 1.9, -1.45, 1.45);
        var bl = L.l * (sh === 'monstera' ? 0.55 : sh === 'maranta' ? 0.55 : 0.6);
        if (sh === 'trap') c = trap(E.ctx, E.rng, pe[0], pe[1], pa, L.l * 0.32, [F.c[0], F.c[1], F.v], { yellow: yel });
        else if (sh === 'monstera') {
          var holes = g > 0.35 && k < n - 1 ? Math.min(8, 2 + Math.round(5 * g)) : 0;
          c = leaf(E.ctx, E.rng, pe[0], pe[1], ba, bl, bl * 0.62, 'monstera', F.c, { yellow: yel, holes: holes, bend: L.s * 0.08, golden: E.p.golden });
        } else if (sh === 'maranta') {
          c = leaf(E.ctx, E.rng, pe[0], pe[1], ba, bl, bl * 0.3, 'oval', F.c, { yellow: yel, pattern: 'maranta', v: F.v, bend: L.s * 0.05, golden: E.p.golden });
        } else {
          c = leaf(E.ctx, E.rng, pe[0], pe[1], ba, bl, bl * (F.pattern === 'silver' ? 0.22 : 0.2), 'lance', F.c, { yellow: yel, pattern: F.pattern, v: F.v, bend: bend, golden: E.p.golden, gloss: true });
        }
        E.hit(c, bl, yel);
      } else {
        var w = sh === 'strap' ? L.l * 0.085 + 3 : sh === 'aloe' ? L.l * 0.13 : L.l * 0.15;
        var b2 = sh === 'strap' ? L.s * 0.03 : L.s * (0.14 + 0.3 * E.thirst);
        var pat = sh === 'aloe' ? 'dots' : null;
        c = leaf(E.ctx, E.rng, x, y, L.a, L.l * (sh === 'aloe' ? 0.8 : 1), w, sh, F.c, { yellow: yel, bend: b2, band: !!F.band, v: F.v, pattern: pat, golden: E.p.golden });
        E.hit(c, L.l, yel);
      }
      if (E.p.bloom && F.bloom && F.bloom.type === 'spathe' && bloomDone < 2 && k === Math.floor(n / 2) + bloomDone) {
        bloomDone++;
        var fa = (E.rng() - 0.5) * 0.5, fl = maxL * 1.02;
        var fe = rot(E.bx, E.by, fa, 0, -fl);
        curve(E.ctx, E.bx, E.by, E.bx + Math.sin(fa) * fl * 0.5, E.by - fl * 0.5, fe[0], fe[1], 1.3, F.c[1], 0.8);
        flower(E.ctx, E.rng, 'spathe', fe[0], fe[1], maxL * 0.16, F.bloom.c, fa + 0.15);
      }
    });
  }

  /* ---------- rosette habit (golden-angle phyllotaxis) ---------- */
  function habitRosette(E) {
    var F = E.F, g = E.g, n = Math.max(3, Math.round(F.n * (0.35 + 0.65 * g)));
    var L = E.availH * F.h * (0.5 + 0.5 * g) * 1.25, list = [];
    for (var i = 0; i < n; i++) {
      var fr = i / n, th = i * 2.39996, side = Math.sin(th);
      list.push({ i: i, a: side * (1.45 - 1.1 * fr), l: L * (1 - 0.55 * fr) * (0.88 + 0.24 * E.rng()), z: Math.cos(th) * (1 - fr) + fr * 1.2, fr: fr, side: side });
    }
    list.sort(function (a, b) { return a.z - b.z; });
    list.forEach(function (o) {
      var yel = o.i < E.p.yellow, sh = F.leaf, c;
      var x = E.bx + o.side * 3, y = E.by - 1 - o.fr * 4;
      if (sh === 'spoon') c = leaf(E.ctx, E.rng, x, y, o.a, o.l * 0.7, o.l * 0.28, 'spoon', F.c, { yellow: yel, pattern: 'edge', v: F.v, golden: E.p.golden, quick: E.small });
      else if (sh === 'spiky') c = leaf(E.ctx, E.rng, x, y, o.a * 0.8, o.l * 0.85, o.l * 0.12, 'spiky', F.c, { yellow: yel, pattern: 'tuber', v: F.v, bend: o.side * 0.1, golden: E.p.golden, quick: E.small });
      else {
        var pe = rot(x, y, o.a, 0, -o.l * 0.3);
        curve(E.ctx, x, y, (x + pe[0]) / 2, (y + pe[1]) / 2, pe[0], pe[1], 1.2, F.c[1], 0.7);
        c = leaf(E.ctx, E.rng, pe[0], pe[1], o.a * 1.05, o.l * 0.48, o.l * 0.2, 'round', F.c, { yellow: yel, golden: E.p.golden, quick: E.small });
        if (!E.small) { E.ctx.globalAlpha = 0.18; E.ctx.fillStyle = '#ffffff'; for (var f = 0; f < 8; f++) { E.ctx.beginPath(); E.ctx.arc(c[0] + (E.rng() - 0.5) * 8, c[1] + (E.rng() - 0.5) * 8, 0.6, 0, PI * 2); E.ctx.fill(); } E.ctx.globalAlpha = 1; }
      }
      E.hit(c, o.l * 0.6, yel);
    });
    if (E.p.bloom && F.bloom) {
      var k = 3 + Math.round(3 * g);
      for (var j = 0; j < k; j++) {
        var fx = E.bx + (E.rng() - 0.5) * L * 0.7, fy = E.by - L * (0.55 + E.rng() * 0.2);
        curve(E.ctx, E.bx, E.by - 4, (E.bx + fx) / 2, fy + 6, fx, fy, 0.9, F.c[1], 0.7);
        flower(E.ctx, E.rng, F.bloom.type, fx, fy, L * 0.12, F.bloom.c, (E.rng() - 0.5));
      }
    }
  }

  /* ---------- trailing vines (pothos, philodendron, ivy, hoya) ---------- */
  function bez(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  }
  function habitTrail(E) {
    var F = E.F, g = E.g, half = E.G.pw / 2;
    var vines = Math.min(F.n, 1 + Math.floor(g * F.n * 1.15));
    var ls = E.availH * 0.075 * (0.75 + 0.25 * g) + 4;
    var yLeft = E.p.yellow, opts = function (yel) {
      return { yellow: yel, v: F.v, pattern: F.leaf === 'ivy' ? 'veins' : F.v ? (F.leaf === 'oval' ? 'dots' : 'streak') : null, golden: E.p.golden, quick: E.small, gloss: F.leaf === 'oval' };
    };
    // crown
    for (var c = 0; c < 3; c++) {
      var ca = (c - 1) * 0.5 + (E.rng() - 0.5) * 0.2;
      var hc = leaf(E.ctx, E.rng, E.bx + (c - 1) * 4, E.by, ca, ls * 1.2, ls * (F.leaf === 'oval' ? 0.42 : 0.6), F.leaf, F.c, opts(false));
      E.hit(hc, ls, false);
    }
    var floorY = E.H - 4;
    for (var v = 0; v < vines; v++) {
      var side = v % 2 ? 1 : -1, r = E.rng();
      var hang = (0.2 + 0.8 * g) * (floorY - E.by) * (0.55 + 0.45 * r);
      var out = half + 6 + r * 14 + v * 2;
      var p0 = [E.bx + side * 4, E.by - 2], p1 = [E.bx + side * half * 0.9, E.by - 14 - r * 10];
      var p2 = [E.bx + side * (out + 10), E.by + hang * 0.25], p3 = [E.bx + side * out, E.by + hang];
      if (v >= 4) { p2 = [E.bx + side * (out + 24), E.by - 30]; p3 = [E.bx + side * Math.min(E.W / 2 - 8, out + 30), E.by - 10 - hang * 0.2]; }
      E.ctx.globalAlpha = 0.8; E.ctx.strokeStyle = F.c[1]; E.ctx.lineWidth = 1.3;
      E.ctx.beginPath(); E.ctx.moveTo(p0[0], p0[1]); E.ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]); E.ctx.stroke(); E.ctx.globalAlpha = 1;
      var steps = Math.max(2, Math.floor((hang + half) / (ls * 0.9)));
      for (var k = 1; k <= steps; k++) {
        var t = k / (steps + 0.3), pt = bez(p0, p1, p2, p3, t), pn = bez(p0, p1, p2, p3, Math.min(1, t + 0.02));
        var dx = pn[0] - pt[0], dy = pn[1] - pt[1];
        var tang = Math.atan2(dx, -dy), alt = k % 2 ? 1 : -1;
        var la = tang + alt * 1.0 + side * 0.25;
        var yel = yLeft > 0 && k === steps - (v % 3); if (yel) yLeft--;
        var lsz = ls * (1 - 0.35 * t);
        var hh = leaf(E.ctx, E.rng, pt[0], pt[1], la, lsz, lsz * (F.leaf === 'oval' ? 0.42 : 0.6), F.leaf, F.c, opts(yel));
        E.hit(hh, lsz, yel);
        if (E.p.bloom && F.bloom && k % 4 === 2) flower(E.ctx, E.rng, F.bloom.type, pt[0] + side * 6, pt[1] + 6, ls * 1.1, F.bloom.c, 0);
      }
    }
    while (yLeft-- > 0) { /* extra yellow leaves sit in the crown */
      var yh = leaf(E.ctx, E.rng, E.bx + (E.rng() - 0.5) * 10, E.by, (E.rng() - 0.5) * 1.6, ls, ls * 0.55, F.leaf, F.c, { yellow: true });
      E.hit(yh, ls, true);
    }
  }

  /* ---------- spider plant ---------- */
  function habitSpider(E) {
    var F = E.F, g = E.g, n = Math.max(4, Math.round(F.n * (0.3 + 0.7 * g)));
    var L = E.availH * F.h * (0.35 + 0.65 * g);
    var list = [];
    for (var i = 0; i < n; i++) { var a = (E.rng() * 2 - 1) * 1.35; list.push({ a: a, l: L * (0.6 + 0.4 * E.rng()), i: i }); }
    list.sort(function (p, q) { return Math.abs(q.a) - Math.abs(p.a); });
    list.forEach(function (o, k) {
      var s = o.a >= 0 ? 1 : -1, yel = k < E.p.yellow;
      var c = leaf(E.ctx, E.rng, E.bx, E.by, o.a * 0.8, o.l, 2.2 + o.l * 0.035, 'grass', F.c, { yellow: yel, bend: s * (0.25 + Math.abs(o.a) * 0.3) * (1 + E.thirst), pattern: 'stripe', v: F.v, quick: E.small, golden: E.p.golden });
      E.hit(c, o.l * 0.5, yel);
    });
    if (g > 0.55) {
      var runners = Math.min(3, Math.floor((g - 0.5) * 7));
      for (var r = 0; r < runners; r++) {
        var side = r % 2 ? 1 : -1, ex = E.bx + side * (E.G.pw * 0.55 + 14 + r * 8), ey = E.by + 18 + r * 16;
        E.ctx.globalAlpha = 0.75; E.ctx.strokeStyle = '#c7c39a'; E.ctx.lineWidth = 1;
        E.ctx.beginPath(); E.ctx.moveTo(E.bx, E.by - 4); E.ctx.bezierCurveTo(E.bx + side * 20, E.by - L * 0.7, ex + side * 14, E.by - 20, ex, ey); E.ctx.stroke(); E.ctx.globalAlpha = 1;
        for (var b = 0; b < 6; b++) leaf(E.ctx, E.rng, ex, ey, (b - 2.5) * 0.45, 9 + E.rng() * 6, 1.8, 'grass', F.c, { bend: (b < 3 ? -1 : 1) * 0.3, pattern: 'stripe', v: F.v, quick: true });
        E.ctx.fillStyle = '#ffffff'; E.ctx.globalAlpha = 0.9;
        var mid = bez([E.bx, E.by - 4], [E.bx + side * 20, E.by - L * 0.7], [ex + side * 14, E.by - 20], [ex, ey], 0.45);
        for (var f = 0; f < 3; f++) { E.ctx.beginPath(); E.ctx.arc(mid[0] + (f - 1) * 3, mid[1] + f, 1.4, 0, PI * 2); E.ctx.fill(); }
        E.ctx.globalAlpha = 1;
      }
    }
  }

  /* ---------- fern & palm fronds ---------- */
  function frond(E, x, y, a, len, curv, pinnaL, pinnaAng, yel, palm) {
    var K = palm ? 14 : 16, px = x, py = y, ang = a, seg = len / K, s = a >= 0 ? 1 : -1;
    var col = yel ? [YEL, YDK] : E.F.c, mid = null;
    for (var k = 0; k < K; k++) {
      var nx = px + Math.sin(ang) * seg, ny = py - Math.cos(ang) * seg;
      E.ctx.globalAlpha = 0.85; E.ctx.strokeStyle = col[1]; E.ctx.lineWidth = palm ? 1.2 : 1;
      E.ctx.beginPath(); E.ctx.moveTo(px, py); E.ctx.lineTo(nx, ny); E.ctx.stroke(); E.ctx.globalAlpha = 1;
      if (k > 1 || palm) {
        var pl = pinnaL * Math.pow(1 - k / K, palm ? 0.4 : 0.6) * (0.75 + 0.25 * E.rng()) + 1.5;
        for (var sd = -1; sd <= 1; sd += 2) {
          var pa = ang + sd * pinnaAng;
          if (palm) pa += s * 0.25 + (E.rng() - 0.5) * 0.2;
          leaf(E.ctx, E.rng, nx, ny, pa, pl, pl * (palm ? 0.1 : 0.24), 'lance', col, { quick: true, bend: sd * (palm ? 0.25 : 0.12), golden: E.p.golden });
        }
      }
      if (k === Math.floor(K / 2)) mid = [nx, ny];
      px = nx; py = ny; ang += s * curv;
    }
    E.hit(mid, len * 0.3, yel);
  }
  function habitFern(E) {
    var F = E.F, g = E.g, n = Math.max(3, Math.round(F.n * (0.3 + 0.7 * g)));
    var L = E.availH * F.h * (0.35 + 0.65 * g) * 1.15, list = [];
    for (var i = 0; i < n; i++) list.push({ a: (E.rng() * 2 - 1) * 1.3, l: L * (0.6 + 0.4 * E.rng()) });
    list.sort(function (p, q) { return Math.abs(q.a) - Math.abs(p.a); });
    list.forEach(function (o, k) {
      frond(E, E.bx + (E.rng() - 0.5) * 4, E.by, o.a * 0.85, o.l, (0.05 + 0.04 * Math.abs(o.a)) * (1 + E.thirst), o.l * 0.13, 1.15, k < E.p.yellow, false);
    });
  }
  function habitPalm(E) {
    var F = E.F, g = E.g, n = Math.max(1, Math.round(F.n * (0.3 + 0.7 * g)));
    var L = E.availH * F.h * (0.35 + 0.65 * g);
    for (var i = 0; i < n; i++) {
      var lean = (E.rng() - 0.5) * 0.7, sl = L * (0.45 + 0.25 * E.rng());
      var top = rot(E.bx, E.by, lean, 0, -sl);
      curve(E.ctx, E.bx, E.by, E.bx + Math.sin(lean) * sl * 0.4, E.by - sl * 0.6, top[0], top[1], 1.6, mix(F.c[1], '#7a6a3a', 0.3), 0.85);
      var s = lean >= 0 ? 1 : -1;
      frond(E, top[0], top[1], lean + s * 0.3, L * 0.55, 0.1 * (1 + E.thirst), L * 0.22, 0.62, i < E.p.yellow, true);
    }
  }

  /* ---------- Chinese money plant ---------- */
  function habitPilea(E) {
    var F = E.F, g = E.g, n = Math.max(3, Math.round(F.n * (0.3 + 0.7 * g)));
    var L = E.availH * F.h * (0.4 + 0.6 * g), sh = L * 0.55;
    curve(E.ctx, E.bx, E.by, E.bx + 2, E.by - sh * 0.5, E.bx - 1, E.by - sh, 2.2, F.c[1], 0.85);
    for (var i = 0; i < n; i++) {
      var t = i / n, s = i % 2 ? 1 : -1;
      var nx = E.bx, ny = E.by - sh * (0.1 + 0.9 * t);
      var pa = s * (0.55 + 0.9 * (1 - t)) + (E.rng() - 0.5) * 0.3 + s * E.thirst * 0.5;
      var pl = L * 0.32 * (0.6 + 0.4 * (1 - t));
      var pe = rot(nx, ny, pa, 0, -pl);
      curve(E.ctx, nx, ny, (nx + pe[0]) / 2, (ny + pe[1]) / 2 - 4, pe[0], pe[1], 0.9, F.c[1], 0.7);
      var ll = L * 0.22 * (0.65 + 0.35 * (1 - t)), yel = i < E.p.yellow;
      var c = leaf(E.ctx, E.rng, pe[0], pe[1] + ll * 0.5, pa * 0.3, ll, ll * 0.5, 'round', F.c, { yellow: yel, golden: E.p.golden, gloss: true, quick: E.small });
      E.ctx.globalAlpha = 0.5; E.ctx.fillStyle = F.c[1]; E.ctx.beginPath(); E.ctx.arc(c[0], c[1] + ll * 0.05, 1.1, 0, PI * 2); E.ctx.fill(); E.ctx.globalAlpha = 1;
      E.hit(c, ll * 0.6, yel);
    }
    if (g > 0.6) for (var p = 0; p < 2; p++) {
      var px = E.bx + (p ? 1 : -1) * E.G.pw * 0.3;
      leaf(E.ctx, E.rng, px, E.by, (p ? 0.4 : -0.4), L * 0.1, L * 0.05, 'round', F.c, { quick: true });
    }
  }

  /* ---------- ZZ canes ---------- */
  function habitCane(E) {
    var F = E.F, g = E.g, n = Math.max(1, Math.round(F.n * (0.3 + 0.7 * g)));
    var L = E.availH * F.h * (0.35 + 0.65 * g);
    for (var i = 0; i < n; i++) {
      var s = i % 2 ? 1 : -1, a = s * F.spread * 0.6 * ((i + 1) / n) * (0.6 + 0.4 * E.rng()) * (1 + E.thirst * 0.5);
      var l = L * (0.7 + 0.3 * E.rng()), yel = i < E.p.yellow;
      var top = rot(E.bx, E.by, a, s * l * 0.05, -l);
      curve(E.ctx, E.bx, E.by, E.bx + Math.sin(a) * l * 0.45, E.by - l * 0.5, top[0], top[1], 3.2, yel ? YDK : F.c[1], 0.85);
      var pairs = 4 + Math.round(3 * g);
      for (var k = 0; k < pairs; k++) {
        var t = 0.3 + 0.7 * (k / pairs);
        var pt = [E.bx + (top[0] - E.bx) * t, E.by + (top[1] - E.by) * t];
        for (var sd = -1; sd <= 1; sd += 2) {
          var ll = l * 0.14 * (1 - 0.3 * t) + 3;
          leaf(E.ctx, E.rng, pt[0], pt[1], a + sd * 0.95, ll, ll * 0.38, 'oval', F.c, { yellow: yel, gloss: true, golden: E.p.golden, quick: E.small });
        }
      }
      leaf(E.ctx, E.rng, top[0], top[1], a, l * 0.12, l * 0.04, 'oval', F.c, { yellow: yel, quick: true });
      E.hit([E.bx + (top[0] - E.bx) * 0.7, E.by + (top[1] - E.by) * 0.7], l * 0.3, yel);
    }
  }

  /* ---------- orchid ---------- */
  function habitOrchid(E) {
    var F = E.F, g = E.g, n = Math.max(2, Math.round(F.n * (0.4 + 0.6 * g)));
    var L = E.availH * F.h;
    E.ctx.globalAlpha = 0.65; E.ctx.strokeStyle = '#b9c7a8'; E.ctx.lineWidth = 2.2;
    for (var r = 0; r < 2 + Math.round(g * 2); r++) { var s0 = r % 2 ? 1 : -1; E.ctx.beginPath(); E.ctx.moveTo(E.bx, E.by - 2); E.ctx.bezierCurveTo(E.bx + s0 * 14, E.by - 10, E.bx + s0 * (E.G.pw * 0.55), E.by - 4, E.bx + s0 * (E.G.pw * 0.6 + 4), E.by + 14 + r * 4); E.ctx.stroke(); }
    E.ctx.globalAlpha = 1;
    if (g > 0.55 || E.p.bloom) {
      var sh = L * (0.6 + 0.4 * g), s = E.p.seed % 2 ? 1 : -1;
      var tip = [E.bx + s * L * 0.28, E.by - sh * 0.82];
      E.ctx.globalAlpha = 0.85; E.ctx.strokeStyle = '#6a7a4a'; E.ctx.lineWidth = 1.4;
      E.ctx.beginPath(); E.ctx.moveTo(E.bx, E.by - 2); E.ctx.bezierCurveTo(E.bx - s * 6, E.by - sh * 0.6, E.bx + s * L * 0.1, E.by - sh * 1.05, tip[0], tip[1]); E.ctx.stroke(); E.ctx.globalAlpha = 1;
      var fl = E.p.bloom ? 3 + Math.round(3 * g) : 3;
      for (var f = 0; f < fl; f++) {
        var t = 0.6 + 0.4 * (f / fl), pt = bez([E.bx, E.by - 2], [E.bx - s * 6, E.by - sh * 0.6], [E.bx + s * L * 0.1, E.by - sh * 1.05], tip, t);
        if (E.p.bloom) flower(E.ctx, E.rng, 'orchid', pt[0] + s * 4, pt[1] + 6, L * 0.09 * (1 - f * 0.06), F.bloom.c, 0);
        else { E.ctx.fillStyle = '#9fb27a'; E.ctx.globalAlpha = 0.85; E.ctx.beginPath(); E.ctx.ellipse(pt[0], pt[1] + 3, 2.6, 3.4, 0, 0, PI * 2); E.ctx.fill(); E.ctx.globalAlpha = 1; }
      }
    }
    for (var i = 0; i < n; i++) {
      var sd = i % 2 ? 1 : -1, a = sd * (1.05 + 0.3 * E.rng()) * (1 + 0.15 * E.thirst), l = L * 0.42 * (0.55 + 0.45 * g) * (1 - i * 0.06);
      var c = leaf(E.ctx, E.rng, E.bx, E.by - i * 1.5, a, l, l * 0.36, 'oval', F.c, { yellow: i < E.p.yellow, bend: sd * 0.25, gloss: true, golden: E.p.golden });
      E.hit(c, l * 0.5, i < E.p.yellow);
    }
  }

  var HABITS = {
    basal: habitBasal, rosette: habitRosette, trail: habitTrail, spider: habitSpider, fern: habitFern, palm: habitPalm,
    pilea: habitPilea, cane: habitCane, orchid: habitOrchid,
    tree: function (E) { habitLsys(E, E.F.gram || 'trunk'); },
    herb: function (E) { habitLsys(E, 'herb'); },
    segments: function (E) { habitLsys(E, 'segments'); }
  };


  V.art.HABITS = HABITS;
})();
