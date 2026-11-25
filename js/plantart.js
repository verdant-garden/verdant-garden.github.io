/* Verdant — watercolour plant painter.
   Branching species are grown with real L-systems (rewrite rules → turtle → auto-fit);
   rosettes use golden-angle phyllotaxis; everything is painted with layered translucent
   washes, pigment-pooled edges and jittered "bleeds" so no two plants are identical. */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var PI = Math.PI;
  var YEL = '#d8bf58', YDK = '#9b7d2f';

  function rngOf(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b), r = [0, 0, 0];
    for (var i = 0; i < 3; i++) r[i] = Math.round(A[i] + (B[i] - A[i]) * t);
    return '#' + r.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  function setup(canvas, w, h) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cw = Math.max(1, Math.round(w * dpr)), ch = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    return ctx;
  }

  /* ---------- watercolour primitives ---------- */
  function path(ctx, pts, j, rng) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var x = pts[i][0], y = pts[i][1];
      if (j) { x += (rng() - 0.5) * j; y += (rng() - 0.5) * j; }
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  function wash(ctx, pts, col, dark, rng, quick) {
    ctx.fillStyle = col;
    ctx.globalAlpha = quick ? 0.78 : 0.58; path(ctx, pts, 0); ctx.fill();
    if (!quick) {
      ctx.globalAlpha = 0.2; path(ctx, pts, 2, rng); ctx.fill();
      ctx.globalAlpha = 0.12; ctx.fillStyle = dark; path(ctx, pts, 2.6, rng); ctx.fill();
    }
    ctx.globalAlpha = quick ? 0.35 : 0.5; ctx.strokeStyle = dark; ctx.lineWidth = quick ? 0.6 : 0.9;
    path(ctx, pts, 0); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function curve(ctx, x1, y1, cx, cy, x2, y2, w, col, alpha) {
    ctx.globalAlpha = alpha == null ? 0.8 : alpha; ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function rot(x, y, a, lx, ly) { var c = Math.cos(a), s = Math.sin(a); return [x + lx * c - ly * s, y + lx * s + ly * c]; }

  /* ---------- leaf outlines (local space: base at 0,0, tip at 0,-len) ---------- */
  function prof(shape, t) {
    var s = Math.sin(PI * t);
    switch (shape) {
      case 'lance': return Math.pow(Math.sin(PI * Math.pow(t, 0.75)), 1.15);
      case 'strap': return Math.min(1, t * 7) * Math.min(1, (1 - t) * 3.2);
      case 'grass': return Math.min(1, t * 8) * Math.pow(1 - t, 0.7);
      case 'heart': case 'monstera': return Math.pow(s, 0.55) * (1 - 0.25 * t);
      case 'ivy': return Math.pow(s, 0.55) * (0.7 + 0.3 * Math.cos(t * PI * 4.4));
      case 'round': case 'fuzzy': case 'peltate': case 'jade': return Math.pow(s, 0.6);
      case 'wavy': return Math.min(1, t * 4) * Math.min(1, (1 - t) * 2.5) * (1 + 0.09 * Math.sin(t * 38));
      case 'spoon': return Math.pow(t, 0.55) * Math.pow(1 - t, 0.35) * 1.5;
      case 'spiky': return Math.min(1, t * 6) * (1 - t);
      case 'aloe': return Math.min(1, t * 5) * Math.pow(1 - t, 0.9);
      case 'segment': return Math.min(1, t * 3) * Math.min(1, (1 - t) * 5) * (0.78 + 0.22 * Math.abs(Math.sin(t * PI * 2)));
      default: return Math.pow(s, 0.85) * (1 - 0.12 * t);
    }
  }
  function outline(shape, len, wid, bend) {
    var N = 18, R = [], L = [], heart = shape === 'heart' || shape === 'monstera' || shape === 'ivy';
    var off = heart ? 0.12 * len : 0, span = heart ? 1.12 * len : len;
    for (var i = 0; i <= N; i++) {
      var t = i / N, w = wid * prof(shape, t);
      if (shape === 'aloe' && i % 3 === 1 && i < N - 1) w *= 1.14;
      var cx = bend * len * t * t, cy = off - span * t;
      var nx = 1, ny = 2 * bend * t, nl = Math.sqrt(nx * nx + ny * ny); nx /= nl; ny /= nl;
      R.push([cx + nx * w, cy + ny * w]); L.push([cx - nx * w, cy - ny * w]);
    }
    if (heart) { R[0] = [0, -0.03 * len]; L[0] = [0, -0.03 * len]; }
    return R.concat(L.reverse());
  }

  /* paint one leaf; returns world-space centre for hit testing */
  function leaf(ctx, rng, x, y, ang, len, wid, shape, col, o) {
    o = o || {};
    var bend = o.bend || 0;
    var base = o.yellow ? YEL : col[0], dark = o.yellow ? YDK : col[1];
    if (o.golden && !o.yellow) { base = mix(base, '#e8c860', 0.35); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    var pts = outline(shape, len, wid, bend);
    wash(ctx, pts, base, dark, rng, o.quick);
    if (!o.quick) {
      // highlight bleed toward the midrib
      ctx.globalAlpha = 0.2; ctx.fillStyle = '#fffbe6';
      path(ctx, pts.map(function (p) { return [p[0] * 0.42 + bend * len * 0.05, p[1] * 0.92]; }), 0); ctx.fill();
      ctx.globalAlpha = 1;
    }
    var v = o.yellow ? null : o.v;
    if (v || o.pattern || o.band) {
      ctx.save(); path(ctx, pts, 0); ctx.clip();
      if (o.pattern === 'silver') {
        ctx.globalAlpha = 0.55; ctx.fillStyle = v;
        path(ctx, pts.map(function (p) { return [p[0] * 0.62, p[1] * 0.95]; }), 3, rng); ctx.fill();
      } else if (o.pattern === 'maranta') {
        ctx.fillStyle = col[1]; ctx.globalAlpha = 0.55;
        for (var k = 1; k < 6; k++) {
          var ty = -len * (0.15 + k * 0.13), side = k % 2 ? 1 : -1;
          ctx.beginPath(); ctx.ellipse(side * wid * 0.45, ty, wid * 0.22, len * 0.05, side * 0.4, 0, PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(-side * wid * 0.45, ty - len * 0.04, wid * 0.2, len * 0.045, -side * 0.4, 0, PI * 2); ctx.fill();
        }
        ctx.strokeStyle = v; ctx.globalAlpha = 0.75; ctx.lineWidth = 0.7;
        for (var q = 1; q < 9; q++) {
          var vy = -len * q / 10;
          ctx.beginPath(); ctx.moveTo(0, vy); ctx.quadraticCurveTo(wid * 0.5, vy - len * 0.05, wid, vy - len * 0.12); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, vy); ctx.quadraticCurveTo(-wid * 0.5, vy - len * 0.05, -wid, vy - len * 0.12); ctx.stroke();
        }
      } else if (o.pattern === 'stripe') {
        ctx.globalAlpha = 0.7; ctx.fillStyle = v;
        path(ctx, pts.map(function (p) { return [p[0] * 0.35, p[1]]; }), 0); ctx.fill();
      } else if (o.pattern === 'streak') {
        ctx.strokeStyle = v; ctx.globalAlpha = 0.55;
        for (var st = 0; st < 4; st++) {
          var sy = -len * (0.2 + rng() * 0.6), sx = (rng() - 0.5) * wid;
          ctx.lineWidth = 1 + rng() * 2.2;
          ctx.beginPath(); ctx.moveTo(sx * 0.2, sy); ctx.quadraticCurveTo(sx, sy - len * 0.05, sx * 1.6, sy - len * 0.16); ctx.stroke();
        }
      } else if (o.pattern === 'dots') {
        ctx.fillStyle = v; ctx.globalAlpha = 0.75;
        for (var dd = 0; dd < len / 3; dd++) { var t2 = rng(); ctx.beginPath(); ctx.arc((rng() - 0.5) * wid * 1.4 * prof(shape, t2), -len * t2, 0.6 + rng() * 0.6, 0, PI * 2); ctx.fill(); }
      } else if (o.pattern === 'tuber') {
        ctx.fillStyle = v; ctx.globalAlpha = 0.85;
        for (var r = 1; r < 9; r++) { var ry = -len * r / 9.5; ctx.fillRect(-wid, ry, wid * 2, 0.9); }
      } else if (o.pattern === 'edge') {
        ctx.strokeStyle = v; ctx.globalAlpha = 0.55; ctx.lineWidth = 2.4; path(ctx, pts, 0); ctx.stroke();
      } else if (o.pattern === 'veins') {
        ctx.strokeStyle = v; ctx.globalAlpha = 0.7; ctx.lineWidth = 0.8;
        [-1.1, -0.5, 0, 0.5, 1.1].forEach(function (aa) { ctx.beginPath(); ctx.moveTo(0, -len * 0.05); ctx.lineTo(Math.sin(aa) * wid, -len * 0.05 - Math.cos(aa) * len * 0.8); ctx.stroke(); });
      }
      if (o.band) {
        ctx.strokeStyle = col[1]; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.6;
        for (var b = 1; b < 12; b++) { var by = -len * b / 12; ctx.beginPath(); ctx.moveTo(-wid, by); ctx.quadraticCurveTo(0, by - 3, wid, by + 1); ctx.stroke(); }
        if (v) { ctx.strokeStyle = v; ctx.globalAlpha = 0.65; ctx.lineWidth = 2.2; path(ctx, pts, 0); ctx.stroke(); }
      }
      ctx.restore();
    }
    if (shape !== 'spoon' && shape !== 'spiky' && shape !== 'segment' && shape !== 'grass' && len > 10) {
      ctx.globalAlpha = 0.38; ctx.strokeStyle = dark; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(bend * len * 0.25, -len * 0.5, bend * len * 0.85, -len * 0.9); ctx.stroke();
      if (len > 26 && shape !== 'strap' && shape !== 'wavy' && shape !== 'aloe') {
        ctx.globalAlpha = 0.22;
        for (var vn = 1; vn < 6; vn++) {
          var t3 = vn / 6.5, yy = -len * t3, ww = wid * prof(shape, t3) * 0.85, cxm = bend * len * t3 * t3;
          ctx.beginPath(); ctx.moveTo(cxm, yy); ctx.lineTo(cxm + ww, yy - len * 0.08); ctx.moveTo(cxm, yy); ctx.lineTo(cxm - ww, yy - len * 0.08); ctx.stroke();
        }
      }
    }
    if (o.holes) {
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
      for (var hI = 0; hI < o.holes; hI++) {
        var ht = 0.25 + 0.6 * (hI / Math.max(1, o.holes - 1)), hs = hI % 2 ? 1 : -1;
        var hw = wid * prof(shape, ht);
        ctx.beginPath(); ctx.ellipse(hs * hw * 0.45, 0.12 * len - 1.12 * len * ht, hw * 0.12 + 0.6, len * 0.035 + 0.4, hs * 0.5, 0, PI * 2); ctx.fill();
        if (hI % 2 === 0 && o.holes > 2) {
          ctx.beginPath(); ctx.moveTo(-hs * hw * 1.05, 0.12 * len - 1.12 * len * ht);
          ctx.lineTo(-hs * hw * 0.55, 0.12 * len - 1.12 * len * (ht + 0.02)); ctx.lineTo(-hs * hw * 1.05, 0.12 * len - 1.12 * len * (ht + 0.07)); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (o.gloss && !o.quick) {
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(-wid * 0.3, -len * 0.3); ctx.quadraticCurveTo(-wid * 0.45, -len * 0.5, -wid * 0.2, -len * 0.72); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.restore();
    return rot(x, y, ang, bend * len * 0.25, -len * 0.5);
  }

  function needle(ctx, x, y, ang, len, col, yellow) {
    var e = rot(x, y, ang, 0, -len);
    ctx.globalAlpha = 0.75; ctx.strokeStyle = yellow ? YEL : col[0]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(e[0], e[1]); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.strokeStyle = yellow ? YDK : col[1]; ctx.lineWidth = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
    return [(x + e[0]) / 2, (y + e[1]) / 2];
  }

  function trap(ctx, rng, x, y, ang, size, col, o) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    var dead = o.yellow, inner = dead ? '#4a3a26' : col[2] || '#c0403a';
    [-1, 1].forEach(function (s) {
      ctx.save(); ctx.rotate(s * 0.5);
      var pts = []; for (var i = 0; i <= 12; i++) { var t = i / 12 * PI; pts.push([s * Math.sin(t) * size * 0.42, -Math.cos(t) * size * 0.5 - size * 0.5]); }
      wash(ctx, pts, dead ? '#6b5a3a' : col[0], dead ? '#3b2f1f' : col[1], rng, true);
      ctx.globalAlpha = 0.6; ctx.fillStyle = inner; path(ctx, pts.map(function (p) { return [p[0] * 0.7, p[1] * 0.9 - size * 0.05]; }), 0); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = dead ? '#3b2f1f' : col[0]; ctx.lineWidth = 0.6;
      for (var c = 1; c < 12; c++) { var tt = c / 12 * PI, ex = s * Math.sin(tt) * size * 0.42, ey = -Math.cos(tt) * size * 0.5 - size * 0.5;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex * 1.28, ey * 1.08 - 1); ctx.stroke(); }
      ctx.restore();
    });
    ctx.globalAlpha = 1; ctx.restore();
    return rot(x, y, ang, 0, -size * 0.5);
  }

  /* ---------- flowers ---------- */
  function flower(ctx, rng, type, x, y, size, c, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
    var i;
    if (type === 'spathe') {
      var pts = outline('lance', size * 1.5, size * 0.45, 0.08);
      wash(ctx, pts, c, '#c9c6a8', rng);
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#e9dc8a';
      ctx.beginPath(); ctx.ellipse(1, -size * 0.55, size * 0.1, size * 0.33, 0.1, 0, PI * 2); ctx.fill();
    } else if (type === 'orchid') {
      for (i = 0; i < 5; i++) {
        var a = i * PI * 2 / 5 + PI;
        var p = outline('round', size * (i % 2 ? 0.9 : 0.75), size * (i % 2 ? 0.5 : 0.3), 0);
        ctx.save(); ctx.rotate(a); wash(ctx, p, c, '#c7a5c4', rng, true); ctx.restore();
      }
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#c4527a'; ctx.beginPath(); ctx.ellipse(0, size * 0.2, size * 0.22, size * 0.28, 0, 0, PI * 2); ctx.fill();
      ctx.fillStyle = '#f2d36b'; ctx.beginPath(); ctx.arc(0, -size * 0.05, size * 0.09, 0, PI * 2); ctx.fill();
    } else if (type === 'violet') {
      for (i = 0; i < 5; i++) { ctx.save(); ctx.rotate(i * PI * 2 / 5); wash(ctx, outline('round', size * 0.6, size * 0.32, 0), c, '#5a3a80', rng, true); ctx.restore(); }
      ctx.globalAlpha = 1; ctx.fillStyle = '#f3cf3f'; ctx.beginPath(); ctx.arc(0, 0, size * 0.13, 0, PI * 2); ctx.fill();
    } else if (type === 'star') {
      for (i = 0; i < 9; i++) {
        var fa = i / 9 * PI * 2, fx = Math.cos(fa) * size * 0.55, fy = Math.sin(fa) * size * 0.35;
        ctx.globalAlpha = 0.85; ctx.fillStyle = c;
        ctx.beginPath(); for (var k = 0; k < 10; k++) { var rr = k % 2 ? size * 0.09 : size * 0.22, aa = k / 10 * PI * 2; ctx.lineTo(fx + Math.cos(aa) * rr, fy + Math.sin(aa) * rr); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a3384e'; ctx.beginPath(); ctx.arc(fx, fy, size * 0.05, 0, PI * 2); ctx.fill();
      }
    } else if (type === 'tube') {
      var tp = outline('lance', size * 1.3, size * 0.22, 0);
      wash(ctx, tp, c, '#9a2850', rng, true);
      [-1, 1].forEach(function (s) { ctx.save(); ctx.translate(0, -size * 1.0); ctx.rotate(s * 1.1); wash(ctx, outline('lance', size * 0.6, size * 0.14, s * 0.3), c, '#9a2850', rng, true); ctx.restore(); });
      ctx.strokeStyle = '#f6d6e0'; ctx.globalAlpha = 0.9; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(0, -size * 1.55); ctx.stroke();
    } else if (type === 'spike' || type === 'dots') {
      var n = type === 'spike' ? 9 : 5;
      for (i = 0; i < n; i++) {
        var sy = -i * size * 0.22, s2 = size * (type === 'spike' ? 0.16 : 0.13) * (1 - i / (n * 1.6));
        ctx.globalAlpha = 0.8; ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(-s2 * 0.8, sy, s2, 0, PI * 2); ctx.arc(s2 * 0.8, sy - s2 * 0.3, s2, 0, PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  /* ---------- geometry shared by pot + plant ---------- */
  function geom(w, h, size) {
    var pw = w * (size === 's' ? 0.36 : size === 'l' ? 0.5 : 0.43);
    return { by: h * 0.675, top: h * 0.655, bottom: h * 0.915, pw: pw, cx: w / 2 };
  }

  var POTS = [['#c97a5c', '#8b4a34'], ['#a9bfa0', '#5f7a5a'], ['#e9dcc4', '#a5916f'], ['#7f93b0', '#46597a'], ['#d9a86a', '#94693a']];

  function drawPot(canvas, w, h, sp, p, opts) {
    var ctx = setup(canvas, w, h);
    var G = geom(w, h, sp ? sp.size : 'm');
    var rng = rngOf((p ? p.seed : 7) + 99);
    var pal = POTS[(p ? p.seed : (opts && opts.potIndex) || 0) % POTS.length];
    var cx = G.cx, tw = G.pw, bw = tw * 0.76, top = G.top, bot = G.bottom;
    // shadow
    ctx.globalAlpha = 0.16; ctx.fillStyle = '#3c4a32';
    ctx.beginPath(); ctx.ellipse(cx + 4, bot + 6, tw * 0.62, 6, 0, 0, PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    // saucer
    var sauc = [[cx - tw * 0.58, bot - 2], [cx + tw * 0.58, bot - 2], [cx + tw * 0.5, bot + 6], [cx - tw * 0.5, bot + 6]];
    wash(ctx, sauc, pal[0], pal[1], rng);
    if (p && p.hyd > 1.05) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#7fb4cf'; ctx.beginPath(); ctx.ellipse(cx, bot - 1, tw * 0.55, 3, 0, 0, PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    // body
    var body = [[cx - tw / 2, top + 6], [cx + tw / 2, top + 6], [cx + bw / 2, bot], [cx - bw / 2, bot]];
    wash(ctx, body, pal[0], pal[1], rng);
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff8ea';
    path(ctx, [[cx - tw * 0.38, top + 8], [cx - tw * 0.18, top + 8], [cx - bw * 0.2, bot - 3], [cx - bw * 0.36, bot - 3]], 0); ctx.fill();
    ctx.globalAlpha = 0.14; ctx.fillStyle = pal[1];
    path(ctx, [[cx + tw * 0.2, top + 8], [cx + tw / 2, top + 8], [cx + bw / 2, bot], [cx + bw * 0.15, bot]], 0); ctx.fill();
    // rim
    var rim = [[cx - tw * 0.54, top - 2], [cx + tw * 0.54, top - 2], [cx + tw * 0.52, top + 9], [cx - tw * 0.52, top + 9]];
    wash(ctx, rim, mix(pal[0], '#ffffff', 0.12), pal[1], rng);
    // soil
    var hyd = p ? clamp(p.hyd, 0, 1.2) : 0.5;
    ctx.globalAlpha = 0.95; ctx.fillStyle = mix('#a8875f', '#3f2c20', clamp(hyd, 0, 1));
    ctx.beginPath(); ctx.ellipse(cx, top + 0.5, tw * 0.47, 3.6, 0, 0, PI * 2); ctx.fill();
    ctx.globalAlpha = 0.4; ctx.fillStyle = '#2c1e15';
    for (var i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(cx + (rng() - 0.5) * tw * 0.8, top + (rng() - 0.5) * 4, 0.8, 0, PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    return G;
  }

  /* ---------- L-system engine ---------- */
  function expand(ax, rules, it) {
    var s = ax;
    for (var i = 0; i < it; i++) {
      var o = '';
      for (var j = 0; j < s.length; j++) { var c = s.charAt(j); o += rules[c] !== undefined ? rules[c] : c; }
      s = o; if (s.length > 3000) break;
    }
    return s;
  }
  function turtle(str, ang, rng, decay, upright) {
    var x = 0, y = 0, a = 0, len = 1, w = 1, d = 0, st = [], ops = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (c === 'F' || c === 'S') {
        var l = len * (0.85 + 0.3 * rng());
        var nx = x + Math.sin(a) * l, ny = y - Math.cos(a) * l;
        ops.push({ t: c === 'F' ? 's' : 'g', x1: x, y1: y, x2: nx, y2: ny, w: w, d: d, a: a, l: l });
        x = nx; y = ny; a += (rng() - 0.5) * 0.12 - a * (upright || 0);
      } else if (c === '+') a += ang * (0.75 + 0.5 * rng());
      else if (c === '-') a -= ang * (0.75 + 0.5 * rng());
      else if (c === '[') { st.push([x, y, a, len, w, d]); d++; len *= decay; w *= 0.66; }
      else if (c === ']') { var s = st.pop(); if (s) { x = s[0]; y = s[1]; a = s[2]; len = s[3]; w = s[4]; d = s[5]; } }
      else if (c === 'L' || c === 'J' || c === 'P') ops.push({ t: c, x: x, y: y, a: a, d: d });
      else if (c === 'X' || c === 'A' || c === 'C') ops.push({ t: 'tip', x: x, y: y, a: a, d: d });
    }
    return ops;
  }
  var GRAM = {
    trunk: { ax: 'A', r: { A: 'F[+L]F[-L]A' }, ang: 0.8, it: [1, 6], decay: 0.9, up: 0.05 },
    bush: { ax: 'X', r: { X: 'F[+XL][-XL]FL' }, ang: 0.6, it: [1, 3], decay: 0.8, up: 0.02 },
    jade: { ax: 'X', r: { X: 'F[+X][-X]FJ' }, ang: 0.5, it: [1, 4], decay: 0.75, up: 0.03 },
    crown: { ax: 'AC', r: { A: 'FA', C: '[+P][-P][P]C' }, ang: 0.9, it: [2, 6], decay: 1, up: 0.08 },
    herb: { ax: 'X', r: { X: 'F[+XL]F[-XL]+XL' }, ang: 0.42, it: [1, 4], decay: 0.82, up: 0.04 },
    segments: { ax: 'X', r: { X: 'S[+X][-X]' }, ang: 0.55, it: [1, 4], decay: 0.92, up: 0 }
  };

  function habitLsys(E, gramName) {
    var F = E.F, g = E.g, G = GRAM[gramName];
    var it = Math.round(G.it[0] + (G.it[1] - G.it[0]) * g);
    var str = expand(G.ax, G.r, it);
    var ops = turtle(str, G.ang, E.rng, G.decay, G.up);
    var minX = 0, maxX = 0, minY = 0;
    ops.forEach(function (o) { if (o.t === 's' || o.t === 'g') { minX = Math.min(minX, o.x2); maxX = Math.max(maxX, o.x2); minY = Math.min(minY, o.y2); } });
    var targetH = E.availH * F.h * (0.25 + 0.75 * g) * (gramName === 'segments' ? 0.7 : 0.82);
    var hgt = -minY || 1, wid = Math.max(-minX, maxX) || 1;
    var sc = Math.min(targetH / hgt, (E.W * 0.4 * F.spread) / wid);
    var X = function (v) { return E.bx + v * sc; }, Y = function (v) { return E.by + v * sc; };
    var stem = mix(F.c[1], '#6b4a2f', gramName === 'jade' || gramName === 'crown' ? 0.55 : 0.2);
    var baseW = gramName === 'jade' ? 3 + 7 * g : gramName === 'crown' ? 3 + 6 * g : gramName === 'trunk' ? 2 + 3.5 * g : 1.2 + 2 * g;
    // stems
    ops.forEach(function (o) {
      if (o.t !== 's') return;
      var w = Math.max(0.8, baseW * o.w);
      var mx = (X(o.x1) + X(o.x2)) / 2 + (E.rng() - 0.5) * 2, my = (Y(o.y1) + Y(o.y2)) / 2;
      curve(E.ctx, X(o.x1), Y(o.y1), mx, my, X(o.x2), Y(o.y2), w, stem, 0.85);
      if (w > 3) curve(E.ctx, X(o.x1) - w * 0.25, Y(o.y1), mx - w * 0.25, my, X(o.x2) - w * 0.25, Y(o.y2), w * 0.3, '#f4ead2', 0.25);
    });
    // leaves, oldest (lowest) yellow first
    var leafOps = ops.filter(function (o) { return o.t === 'L' || o.t === 'J' || o.t === 'P'; });
    var order = leafOps.slice().sort(function (a, b) { return b.y - a.y; });
    var yset = {}; for (var i = 0; i < Math.min(E.p.yellow, order.length); i++) yset[leafOps.indexOf(order[i])] = 1;
    var leafLen = E.availH * (F.leaf === 'oval' && gramName === 'trunk' ? 0.2 : gramName === 'bush' ? 0.14 : gramName === 'jade' ? 0.07 : gramName === 'crown' ? 0.17 : F.leaf === 'needle' ? 0.06 : 0.075) * (0.6 + 0.4 * g);
    var droop = 0.35 * E.thirst;
    leafOps.forEach(function (o, idx) {
      var x = X(o.x), y = Y(o.y), yel = !!yset[idx], c;
      var s = o.a >= 0 ? 1 : -1;
      if (o.t === 'J') {
        [-1.2, -0.45, 0.45, 1.2].forEach(function (da, k) {
          var hc = leaf(E.ctx, E.rng, x, y, o.a + da + s * droop, leafLen * (k % 3 ? 1 : 0.8), leafLen * 0.4, 'jade', F.c, { yellow: yel && k === 0, pattern: 'edge', v: F.red, golden: E.p.golden, gloss: true });
          if (k === 0) E.hit(hc, leafLen, yel);
        });
      } else if (o.t === 'P') {
        var pl = leafLen * 0.9, pa = o.a + (E.rng() - 0.5) * 0.6 + s * droop;
        var pe = rot(x, y, pa, 0, -pl);
        curve(E.ctx, x, y, (x + pe[0]) / 2, (y + pe[1]) / 2 - 3, pe[0], pe[1], 1.2, F.c[1], 0.8);
        for (var lf = 0; lf < 5; lf++) leaf(E.ctx, E.rng, pe[0], pe[1], pa + (lf - 2) * 0.55, leafLen * (lf === 2 ? 1 : 0.8), leafLen * 0.22, 'lance', F.c, { yellow: yel, golden: E.p.golden, quick: lf % 2 === 1 });
        E.hit(pe, leafLen, yel);
      } else {
        var la = o.a + s * (gramName === 'trunk' ? 0.25 : 0.85) * (o.d ? 1 : 0.5) + s * droop;
        if (gramName === 'herb' || gramName === 'bush') {
          for (var side = -1; side <= 1; side += 2) {
            var a2 = o.a + side * 0.95 + side * droop;
            if (F.leaf === 'needle') c = needle(E.ctx, x, y, a2, leafLen, F.c, yel);
            else c = leaf(E.ctx, E.rng, x, y, a2, leafLen, leafLen * (F.leaf === 'round' ? 0.42 : 0.33), F.leaf, F.c, { yellow: yel && side < 0, bend: side * 0.12, golden: E.p.golden, quick: E.small, gloss: F.leaf === 'round' });
            if (side < 0) E.hit(c, leafLen, yel);
          }
        } else {
          c = leaf(E.ctx, E.rng, x, y, la, leafLen, leafLen * 0.33, F.leaf, F.c, { yellow: yel, bend: s * 0.1, golden: E.p.golden, gloss: true });
          E.hit(c, leafLen, yel);
        }
      }
    });
    // segments (Christmas cactus) & tips
    ops.forEach(function (o) {
      if (o.t === 'g') {
        var segL = Math.hypot(X(o.x2) - X(o.x1), Y(o.y2) - Y(o.y1)) * 1.08;
        var c2 = leaf(E.ctx, E.rng, X(o.x1), Y(o.y1), o.a, segL, segL * 0.36, 'segment', F.c, { yellow: false, golden: E.p.golden, quick: E.small });
        E.hit(c2, segL, false);
      }
    });
    ops.forEach(function (o) {
      if (o.t !== 'tip') return;
      var x = X(o.x), y = Y(o.y);
      if (F.red && gramName === 'trunk' && o.d === 0) leaf(E.ctx, E.rng, x, y, o.a, leafLen * 0.45, leafLen * 0.08, 'lance', [F.red, '#6e2522'], {});
      if (E.p.bloom && F.bloom && (gramName === 'herb' || gramName === 'segments') && E.rng() < 0.75) {
        var fs = E.availH * 0.06;
        if (gramName === 'segments') flower(E.ctx, E.rng, F.bloom.type, x, y, fs, F.bloom.c, o.a + 0.4);
        else flower(E.ctx, E.rng, F.bloom.type, x, y, fs, F.bloom.c, o.a);
      }
    });
  }

  /* draw a plant into its own canvas. Returns leaf hit areas (CSS px) */
  function drawPlant(canvas, w, h, sp, p, opts) {
    opts = opts || {};
    var ctx = setup(canvas, w, h);
    var G = geom(w, h, sp.size);
    var E = {
      ctx: ctx, rng: rngOf(p.seed), sp: sp, p: p, F: sp.form, g: clamp(p.growth, 0.02, 1), W: w, H: h, G: G,
      bx: G.cx, by: G.by, availH: G.by - 6, thirst: clamp((0.3 - p.hyd) / 0.3, 0, 1) * (p.health < 0.4 ? 1.3 : 1),
      night: !!opts.night, small: w < 120, hits: []
    };
    E.hit = function (c, r, yellow) { if (c) E.hits.push({ x: c[0], y: c[1], r: Math.max(8, r * 0.45), yellow: !!yellow }); };
    if (!sp.trail && sp.form.habit !== 'spider' && sp.form.habit !== 'orchid') {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, G.by + 1.5); ctx.clip();
      V.art.HABITS[sp.form.habit](E); ctx.restore();
    } else V.art.HABITS[sp.form.habit](E);
    return E.hits;
  }

  /* pot + plant in one canvas (encyclopedia, quiz, packet) */
  function drawSpecimen(canvas, w, h, sp, growth, seed, opts) {
    var p = { seed: seed || 4242, growth: growth == null ? 1 : growth, hyd: 0.8, health: 1, yellow: 0, bloom: !!(sp.form.bloom && (growth == null || growth > 0.7)), golden: false };
    drawPot(canvas, w, h, sp, p);
    var off = document.createElement('canvas');
    drawPlant(off, w, h, sp, p, opts || {});
    var ctx = canvas.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, 0, 0); ctx.restore();
  }

  V.art = { _: { leaf: leaf, curve: curve, rot: rot, flower: flower, trap: trap, mix: mix, clamp: clamp, needle: needle, habitLsys: habitLsys, YEL: YEL, YDK: YDK },
    drawPlant: drawPlant, drawPot: drawPot, drawSpecimen: drawSpecimen, geom: geom, rngOf: rngOf, mix: mix, setup: setup, leaf: leaf, wash: wash, outline: outline };
})();
