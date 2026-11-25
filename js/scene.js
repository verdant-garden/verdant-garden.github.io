/* Verdant — the sky window: watercolour sky that follows real local time,
   seasons of your hemisphere and the simulated garden weather. */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var PI = Math.PI;
  var cv, ctx, W = 0, H = 0, dpr = 1, raf = 0, last = 0, hills = [], clouds = [], parts = [], stars = [], birds = [];
  var info = { season: 'spring', weather: null, hemi: 'N', phase: 'morning' };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lowPower = (navigator.hardwareConcurrency || 4) <= 4 || /Mobi|Android/i.test(navigator.userAgent);
  var flashT = 0, visible = true;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function mixc(a, b, t) { var A = hex(a), B = hex(b); return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')'; }
  function mixh(a, b, t) { var A = hex(a), B = hex(b); return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.round(lerp(A[i], B[i], t)).toString(16)).slice(-2); }).join(''); }

  var SKY = {
    night: ['#1c2742', '#3b4b6e'], dawn: ['#9db4d4', '#f4c7a0'], morning: ['#a6cbe0', '#eef2e2'],
    afternoon: ['#9fc6de', '#f1efdc'], evening: ['#8c8cc0', '#f3b28c']
  };
  var HILL = { spring: ['#b7d3a3', '#93bb84', '#6f9e67'], summer: ['#a3c98f', '#7fb070', '#5d8f55'], autumn: ['#d8bf86', '#c39a5e', '#9a7a4a'], winter: ['#d5dde0', '#b8c7c9', '#93a8a8'] };

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildHills(); buildStars();
    if (!clouds.length) buildClouds();
    if (reduced) frame(performance.now());
  }

  function buildHills() {
    hills = [];
    var rng = V.art ? V.art.rngOf(77) : Math.random;
    for (var l = 0; l < 3; l++) {
      var pts = [], base = H * (0.62 + l * 0.12), amp = H * (0.12 - l * 0.025), ph = rng() * 6;
      for (var x = -20; x <= W + 20; x += 18) pts.push([x, base - Math.sin(x / (W * (0.28 + l * 0.1)) + ph) * amp - Math.sin(x / 47 + ph * 2) * 3]);
      var trees = [];
      if (l < 2) for (var t = 0; t < Math.max(3, W / 160); t++) { var tx = rng() * W, ti = Math.min(pts.length - 1, Math.max(0, Math.round((tx + 20) / 18))); trees.push([tx, pts[ti][1], 6 + rng() * 10 * (l ? 1.3 : 1)]); }
      hills.push({ pts: pts, trees: trees });
    }
  }
  function buildStars() {
    stars = []; var n = Math.round(W * H / (lowPower ? 5000 : 2600));
    for (var i = 0; i < n; i++) stars.push([Math.random() * W, Math.random() * H * 0.6, Math.random() * 1.3 + 0.3, Math.random() * 6]);
  }
  function buildClouds() {
    clouds = [];
    for (var i = 0; i < 9; i++) clouds.push({ x: Math.random() * 1.4 - 0.2, y: rnd(0.08, 0.45), s: rnd(0.6, 1.4), v: rnd(0.004, 0.012), seed: Math.random() * 100 });
  }

  function cloudBlob(x, y, s, col, alpha) {
    ctx.fillStyle = col;
    for (var i = 0; i < 6; i++) {
      ctx.globalAlpha = alpha * (0.55 + (i % 3) * 0.15);
      ctx.beginPath(); ctx.ellipse(x + (i - 2.5) * 16 * s, y + Math.sin(i * 1.7) * 5 * s, 26 * s, 15 * s, 0, 0, PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function wash(pts, col, alpha) {
    ctx.fillStyle = col; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(pts[0][0], H + 2);
    pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.lineTo(pts[pts.length - 1][0], H + 2); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = alpha * 0.5; ctx.strokeStyle = mixh(col, '#203020', 0.25); ctx.lineWidth = 1.2;
    ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1] + 1); else ctx.moveTo(p[0], p[1] + 1); }); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function spawn(dt) {
    var w = info.weather || { kind: 'sun', intensity: 0 }, s = info.season, night = info.phase === 'night';
    var k = lowPower ? 0.5 : 1, want = 0, type = null;
    if (w.kind === 'rain' || w.kind === 'drizzle' || w.kind === 'storm') { type = 'rain'; want = 140 * w.intensity * k; }
    else if (w.kind === 'snow') { type = 'snow'; want = 90 * k; }
    else if (s === 'spring' && !night) { type = 'petal'; want = 12 * k; }
    else if (s === 'autumn') { type = 'leaf'; want = 14 * k; }
    else if (s === 'summer' && night) { type = 'firefly'; want = 18 * k; }
    var count = 0; for (var i = 0; i < parts.length; i++) if (parts[i].type === type) count++;
    var n = Math.min(8, Math.ceil((want - count) * 0.2));
    for (var j = 0; j < n; j++) {
      var p = { type: type, x: Math.random() * W, y: -10, vx: 0, vy: 0, r: 1, a: Math.random() * 6, life: 1 };
      if (type === 'rain') { p.vy = rnd(380, 560); p.vx = -60 - w.wind * 80; p.r = rnd(6, 12); }
      else if (type === 'snow') { p.vy = rnd(20, 45); p.vx = rnd(-10, 10); p.r = rnd(1.2, 2.8); }
      else if (type === 'petal') { p.vy = rnd(14, 30); p.vx = rnd(10, 30); p.r = rnd(2.5, 4); p.x = Math.random() * W * 0.8; }
      else if (type === 'leaf') { p.vy = rnd(18, 36); p.vx = rnd(-15, 25); p.r = rnd(3, 5); p.c = ['#c96a3a', '#d9a24a', '#a8552e'][j % 3]; }
      else if (type === 'firefly') { p.y = rnd(H * 0.5, H * 0.95); p.vx = rnd(-8, 8); p.vy = rnd(-6, 6); p.r = rnd(1.2, 2); p.life = rnd(4, 9); }
      if (type) parts.push(p);
    }
    for (var q = parts.length - 1; q >= 0; q--) {
      var P = parts[q];
      P.x += P.vx * dt; P.y += P.vy * dt; P.a += dt * 2;
      if (P.type === 'petal' || P.type === 'leaf' || P.type === 'snow') P.x += Math.sin(P.a) * 12 * dt;
      if (P.type === 'firefly') { P.life -= dt; P.vx += rnd(-20, 20) * dt; P.vy += rnd(-20, 20) * dt; }
      if (P.y > H + 12 || P.x < -30 || P.x > W + 30 || P.life <= 0 || (P.type !== type && Math.random() < 0.05)) parts.splice(q, 1);
    }
  }

  function frame(t) {
    raf = 0;
    if (!ctx || !visible) return;
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    var now = Date.now(), hemi = info.hemi;
    var d = new Date(now), hr = d.getHours() + d.getMinutes() / 60, st = V.sim.sunTimes(now, hemi);
    var phase = info.phase = V.sim.dayPhase(now, hemi);
    var w = info.weather || { kind: 'sun', intensity: 0 };
    var grey = w.kind === 'cloud' ? 0.35 : w.kind === 'fog' ? 0.55 : w.kind === 'drizzle' ? 0.45 : w.kind === 'rain' ? 0.6 : w.kind === 'storm' ? 0.75 : w.kind === 'snow' ? 0.5 : 0;
    var c = SKY[phase];
    var top = mixh(c[0], phase === 'night' ? '#2a3040' : '#9aa3a8', grey), bot = mixh(c[1], phase === 'night' ? '#3a4050' : '#cfd3cf', grey);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var night = phase === 'night';
    if (night || phase === 'evening' || phase === 'dawn') {
      var sa = night ? 1 : 0.35;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i]; ctx.globalAlpha = sa * (1 - grey) * (0.45 + 0.4 * Math.sin(t / 700 + s[3]));
        ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // sun
    var dayF = (hr - st.rise) / (st.set - st.rise);
    if (dayF > -0.08 && dayF < 1.08) {
      var sx = dayF * W, sy = H * 0.82 - Math.sin(PI * Math.max(0, Math.min(1, dayF))) * H * 0.62;
      var rg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 70);
      rg.addColorStop(0, 'rgba(255,240,190,' + (0.85 - grey * 0.6) + ')'); rg.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = rg; ctx.fillRect(sx - 80, sy - 80, 160, 160);
      ctx.globalAlpha = 0.85 - grey * 0.6; ctx.fillStyle = phase === 'evening' || phase === 'dawn' ? '#f6b77a' : '#fbe3a0';
      ctx.beginPath(); ctx.arc(sx, sy, 17, 0, PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    // moon
    if (night || phase === 'evening') {
      var nightLen = 24 - (st.set - st.rise), nf = ((hr - st.set + 24) % 24) / nightLen;
      if (nf >= 0 && nf <= 1) {
        var mx = nf * W, my = H * 0.78 - Math.sin(PI * nf) * H * 0.56, mp = V.sim.moonPhase(now);
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff8e0'; ctx.beginPath(); ctx.arc(mx, my, 26, 0, PI * 2); ctx.fill();
        ctx.globalAlpha = 0.95 - grey * 0.5; ctx.fillStyle = '#f6f0d8'; ctx.beginPath(); ctx.arc(mx, my, 12, 0, PI * 2); ctx.fill();
        // terminator shadow: offset disc (approximation of the phase)
        ctx.save(); ctx.beginPath(); ctx.arc(mx, my, 12.3, 0, PI * 2); ctx.clip();
        ctx.globalAlpha = 0.82; ctx.fillStyle = mixh(top, '#1a2238', 0.4);
        ctx.beginPath(); ctx.arc(mx + (mp.frac < 0.5 ? -1 : 1) * 24 * mp.illum, my, 12.5, 0, PI * 2); ctx.fill();
        ctx.restore(); ctx.globalAlpha = 1;
      }
    }
    // clouds
    var cc = Math.round(w.kind === 'sun' ? 3 : w.kind === 'cloud' ? 7 : 9);
    var ccol = night ? '#56607a' : grey > 0.5 ? '#b9bec2' : '#ffffff';
    for (var k = 0; k < Math.min(cc, clouds.length); k++) {
      var C = clouds[k];
      if (!reduced) C.x += C.v * dt * (0.5 + (w.wind || 0.3));
      if (C.x > 1.3) C.x = -0.3;
      cloudBlob(C.x * W, C.y * H, C.s * Math.max(0.7, W / 900), ccol, night ? 0.35 : 0.5 + grey * 0.3);
    }
    // birds
    if (!night && !reduced && grey < 0.5 && Math.random() < 0.002 && birds.length < 3) birds.push({ x: -20, y: rnd(H * 0.15, H * 0.4), v: rnd(30, 55), f: Math.random() * 6 });
    ctx.strokeStyle = '#4a5a4a'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.6;
    for (var b = birds.length - 1; b >= 0; b--) {
      var B = birds[b]; B.x += B.v * dt; B.f += dt * 9; var wy = Math.sin(B.f) * 3;
      ctx.beginPath(); ctx.moveTo(B.x - 6, B.y - wy); ctx.quadraticCurveTo(B.x - 2, B.y - 2, B.x, B.y); ctx.quadraticCurveTo(B.x + 2, B.y - 2, B.x + 6, B.y - wy); ctx.stroke();
      if (B.x > W + 20) birds.splice(b, 1);
    }
    ctx.globalAlpha = 1;
    // hills
    var hc = HILL[info.season] || HILL.spring;
    for (var h = 0; h < hills.length; h++) {
      var col = night ? mixh(hc[h], '#1e2a3a', 0.62) : mixh(hc[h], '#a0a8a8', grey * 0.4);
      wash(hills[h].pts, col, 0.92);
      for (var tI = 0; tI < hills[h].trees.length; tI++) {
        var T = hills[h].trees[tI];
        ctx.globalAlpha = 0.75; ctx.fillStyle = mixh(col, '#24381f', 0.35);
        ctx.beginPath(); ctx.ellipse(T[0], T[1] - T[2], T[2] * 0.6, T[2], 0, 0, PI * 2); ctx.fill();
        ctx.fillRect(T[0] - 0.8, T[1] - 2, 1.6, 4);
      }
    }
    ctx.globalAlpha = 1;
    // fog
    if (w.kind === 'fog') { for (var f = 0; f < 4; f++) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#f4f4ee'; ctx.fillRect(0, H * (0.4 + f * 0.13) + Math.sin(t / 3000 + f) * 6, W, H * 0.09); } ctx.globalAlpha = 1; }
    // particles
    if (!reduced) spawn(dt);
    for (var q = 0; q < parts.length; q++) {
      var P = parts[q];
      if (P.type === 'rain') { ctx.globalAlpha = 0.45; ctx.strokeStyle = night ? '#9fb0c8' : '#6f8aa6'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + P.vx * 0.02, P.y + P.r); ctx.stroke(); }
      else if (P.type === 'snow') { ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, PI * 2); ctx.fill(); }
      else if (P.type === 'petal') { ctx.globalAlpha = 0.75; ctx.fillStyle = '#f2b8c6'; ctx.beginPath(); ctx.ellipse(P.x, P.y, P.r, P.r * 0.55, P.a, 0, PI * 2); ctx.fill(); }
      else if (P.type === 'leaf') { ctx.globalAlpha = 0.8; ctx.fillStyle = P.c; ctx.beginPath(); ctx.ellipse(P.x, P.y, P.r, P.r * 0.45, P.a, 0, PI * 2); ctx.fill(); }
      else if (P.type === 'firefly') { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 200 + P.a); ctx.fillStyle = '#f6f09a'; ctx.beginPath(); ctx.arc(P.x, P.y, P.r * 2.2, 0, PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // lightning
    if (w.kind === 'storm' && !reduced && Math.random() < 0.0025) flashT = 1;
    if (flashT > 0) { ctx.globalAlpha = flashT * 0.55; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; flashT -= dt * 3; }
    if (!reduced) raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && !reduced) { last = performance.now(); raf = requestAnimationFrame(frame); } else if (reduced) frame(performance.now()); }

  V.scene = {
    init: function (canvas) {
      cv = canvas; ctx = cv.getContext('2d');
      resize();
      window.addEventListener('resize', function () { clearTimeout(V.scene._rt); V.scene._rt = setTimeout(resize, 150); });
      document.addEventListener('visibilitychange', function () { visible = !document.hidden; if (visible) start(); });
      start();
      if (reduced) setInterval(function () { frame(performance.now()); }, 60000);
    },
    update: function (season, weather, hemi) {
      var changed = !info.weather || info.weather.kind !== weather.kind || info.season !== season;
      info.season = season; info.weather = weather; info.hemi = hemi;
      if (changed) parts.length = 0;
      if (reduced && ctx) frame(performance.now());
    },
    setVisible: function (v) { visible = v; if (v) start(); },
    info: info, lowPower: lowPower, reduced: reduced, resize: resize
  };
})();
