/* Verdant — the garden: zones, pots, tools (water / prune / mist / feed),
   real-time ticking, the planting picker, the plant panel and "while you were away". */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var DAY = 86400000, HOUR = 3600000;
  var tool = 'hand', selected = null, lastTick = Date.now(), plotCache = {}, pour = null, nightNow = false;
  var fx = { cv: null, ctx: null, parts: [], raf: 0 };

  /* ---------- formatting helpers (shared) ---------- */
  V.fmt = {
    dur: function (ms) {
      ms = Math.max(0, ms);
      var d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / 60000);
      if (d) return d + (d === 1 ? ' day' : ' days') + (h ? ', ' + h + ' h' : '');
      if (h) return h + ' h' + (m ? ' ' + m + ' min' : '');
      return Math.max(1, m) + ' min';
    },
    pct: function (x) { return Math.round(x * 100) + '%'; },
    when: function (ts) {
      return new Date(ts).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  };
  var esc = V.fmt.esc;

  function S() { return V.store.state; }
  function plantAt(zone, plot) { var ps = S().plants; for (var i = 0; i < ps.length; i++) if (ps[i].zone === zone && ps[i].plot === plot) return ps[i]; return null; }
  function plantById(id) { var ps = S().plants; for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i]; return null; }
  function spOf(p) { return V.SPECIES_BY_ID[p.sp]; }
  function nameOf(p) { return p.nick || spOf(p).name; }
  function fitText(sp, zone) {
    var d = V.sim.lightDiff(sp, zone);
    return d === 0 ? { k: 'good', t: 'Perfect light' } : d === 1 ? { k: 'warn', t: 'Will cope' } : { k: 'bad', t: 'Wrong light' };
  }

  /* ---------- zones & plots ---------- */
  function buildZones() {
    var host = $('#zones'); host.innerHTML = '';
    V.ZONES.forEach(function (z) {
      var el = document.createElement('div');
      el.className = 'zone zone-' + z.id; el.dataset.zone = z.id;
      var html = '<div class="zone-head"><h3>' + esc(z.name) + '</h3><span class="zone-light">' + esc(z.note) + '</span></div><div class="zone-plots">';
      for (var i = 0; i < z.plots; i++) {
        html += '<div class="plot" role="button" tabindex="0" data-zone="' + z.id + '" data-plot="' + i + '">' +
          '<canvas class="pot-cv" aria-hidden="true"></canvas><canvas class="plant-cv" aria-hidden="true"></canvas>' +
          '<span class="plot-badges" aria-hidden="true"></span><span class="plot-tag"></span>' +
          '<span class="plot-meter" aria-hidden="true"><i></i></span></div>';
      }
      html += '</div>';
      if (z.outdoor) html += '<div class="rain-overlay" aria-hidden="true"></div>';
      el.innerHTML = html;
      host.appendChild(el);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.plot'), bindPlot);
  }

  function renderPlot(el, force) {
    var zone = V.sim.zoneOf(el.dataset.zone), idx = +el.dataset.plot, p = plantAt(zone.id, idx);
    var r = el.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    var key = el.dataset.zone + idx;
    var potCv = el.querySelector('.pot-cv'), plantCv = el.querySelector('.plant-cv');
    var tag = el.querySelector('.plot-tag'), badges = el.querySelector('.plot-badges'), meter = el.querySelector('.plot-meter i');
    if (!p) {
      if (plotCache[key] !== 'empty' + w + 'x' + h || force) {
        V.art.drawPot(potCv, w, h, null, null, { potIndex: idx + zone.light });
        V.art.setup(plantCv, w, h);
        plotCache[key] = 'empty' + w + 'x' + h;
      }
      el.classList.add('empty'); el.classList.remove('thirsty', 'golden', 'wilt');
      tag.textContent = 'Plant something';
      badges.innerHTML = '';
      meter.style.width = '0%';
      el.setAttribute('aria-label', zone.name + ', pot ' + (idx + 1) + ': empty. Press to plant.');
      el._hits = [];
      return;
    }
    var sp = spOf(p);
    el.classList.remove('empty');
    var thirstB = p.hyd < 0.15 ? 2 : p.hyd < 0.3 ? 1 : 0;
    var night = !!(sp.nightFold && nightNow);
    var ck = [p.id, w, h, Math.round(p.growth * 160), p.yellow, p.bloom, thirstB, night, p.golden, p.health < 0.4].join('|');
    if (plotCache[key] !== ck || force) {
      el._hits = V.art.drawPlant(plantCv, w, h, sp, p, { night: night });
      plotCache[key] = ck;
      el.classList.remove('grown'); void el.offsetWidth; el.classList.add('grown');
    }
    var potKey = p.id + Math.round(Math.min(p.hyd, 1.2) * 12) + w + 'x' + h;
    if (el._potKey !== potKey || force) { V.art.drawPot(potCv, w, h, sp, p); el._potKey = potKey; }
    tag.textContent = nameOf(p);
    var st = V.sim.status(p), b = '';
    if (p.hyd < 0.3) b += '<span class="bdg water" title="Thirsty">\u{1F4A7}</span>';
    if (p.yellow >= 2) b += '<span class="bdg prune" title="Yellow leaves">\u2702\ufe0e</span>';
    if (p.bloom) b += '<span class="bdg bloom" title="In flower">\u273F</span>';
    if (p.real) b += '<span class="bdg real" title="You own this plant in real life">\u2605</span>';
    badges.innerHTML = b;
    meter.style.width = Math.round(Math.min(1, p.hyd) * 100) + '%';
    meter.parentNode.classList.toggle('over', p.hyd > 1.05);
    el.classList.toggle('thirsty', p.hyd < 0.3);
    el.classList.toggle('golden', !!p.golden);
    el.classList.toggle('wilt', p.health < 0.3);
    el.setAttribute('aria-label', zone.name + ', pot ' + (idx + 1) + ': ' + nameOf(p) + '. ' + st.text + '. Water ' + V.fmt.pct(Math.min(1, p.hyd)) + ', grown ' + V.fmt.pct(p.growth) + '.');
  }
  function renderAll(force) {
    Array.prototype.forEach.call(document.querySelectorAll('.plot'), function (el) { renderPlot(el, force); });
    var host = $('#zones');
    host.classList.toggle('has-plants', S().plants.length > 0);
  }

  /* ---------- tools ---------- */
  var HINTS = {
    hand: 'Tap a plant to inspect it, or tap an empty pot to plant something.',
    water: 'Press and hold over a plant to pour. Let go before the saucer overflows!',
    prune: 'Tap the yellowing leaves to snip them off. Healthy leaves stay, please.',
    mist: 'Tap a humidity-loving plant to give it a fine mist.',
    feed: 'Tap a plant to feed it. Spring & summer only — plants rest in winter.'
  };
  function setTool(t) {
    tool = t;
    Array.prototype.forEach.call(document.querySelectorAll('.tool[data-tool]'), function (b) { b.setAttribute('aria-pressed', b.dataset.tool === t ? 'true' : 'false'); });
    $('#toolHint').textContent = HINTS[t];
    document.body.dataset.tool = t;
    var ct = $('#cursorTool');
    var src = document.querySelector('.tool[data-tool="' + t + '"] svg');
    ct.innerHTML = t === 'hand' || !src ? '' : src.outerHTML;
    V.audio.play('tick');
  }

  function bindPlot(el) {
    el.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      var zone = el.dataset.zone, idx = +el.dataset.plot, p = plantAt(zone, idx);
      if (!p) return;
      if (tool === 'water') { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } startPour(el, p, e); }
    });
    el.addEventListener('pointerup', function () { if (pour && pour.el === el) stopPour(); });
    el.addEventListener('pointercancel', function () { if (pour && pour.el === el) stopPour(); });
    el.addEventListener('lostpointercapture', function () { if (pour && pour.el === el) stopPour(); });
    el.addEventListener('click', function (e) { useTool(el, e, false); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); useTool(el, null, true); }
    });
  }

  function useTool(el, e, keyboard) {
    var zone = V.sim.zoneOf(el.dataset.zone), idx = +el.dataset.plot, p = plantAt(zone.id, idx);
    if (!p) { openPicker(zone, idx); return; }
    var sp = spOf(p), r = el.getBoundingClientRect();
    var px = e ? e.clientX : r.left + r.width / 2, py = e ? e.clientY : r.top + r.height * 0.4;
    if (tool === 'hand') { select(p.id); V.audio.play('page'); wiggle(el); return; }
    if (tool === 'water') {
      if (keyboard) { addWater(p, 0.25, el); burst('drop', px, py - 30, 18); V.audio.play('mist'); }
      return;
    }
    if (tool === 'prune') {
      if (!p.yellow) { V.ui.toast('No yellow leaves on your ' + nameOf(p) + '. Shears down, slowly.', 'warn'); wiggle(el); return; }
      var hit = null;
      if (!keyboard && el._hits) {
        var lx = px - r.left, ly = py - r.top, best = 1e9;
        el._hits.forEach(function (hh) { var d = Math.hypot(hh.x - lx, hh.y - ly); if (d < hh.r + 14 && d < best) { best = d; hit = hh; } });
        if (hit && !hit.yellow) { V.ui.toast('That leaf is perfectly healthy! Aim for the yellow ones.', 'warn'); return; }
        if (!hit) { V.ui.toast('Snip the yellow leaves — they\u2019re marked in gold.', 'warn'); return; }
      }
      p.yellow--; p.health = Math.min(1, p.health + 0.05); S().stats.prune++;
      burst('snip', hit ? r.left + hit.x : px, hit ? r.top + hit.y : py, 10);
      V.audio.play('snip');
      if (!p.yellow) V.ui.toast(pick(['Snip! Your ' + nameOf(p) + ' looks ten years younger.', 'Tidy as a botanical plate.', 'Pruned to perfection. Shear genius.']), 'good');
      commit(p);
      return;
    }
    if (tool === 'mist') {
      p.lastMist = Date.now(); S().stats.mist++;
      burst('mist', px, py - 20, 26); V.audio.play('mist');
      if (sp.humid === 0) V.ui.toast(sp.name + ' doesn\u2019t need misting — it prefers drier air.', 'warn');
      else if (sp.humid === 2) V.ui.toast('Ahh. Your ' + nameOf(p) + ' feels like a rainforest morning.', 'good');
      else V.ui.toast('A light mist. Appreciated, mildly.', 'good');
      commit(p); return;
    }
    if (tool === 'feed') {
      var season = V.sim.seasonAt(Date.now(), S().settings.hemi);
      if (sp.noFeed) { V.ui.toast('Never fertilise a Venus flytrap — it gets its nutrients from insects.', 'bad'); V.audio.play('sad'); return; }
      if (season === 'winter') { V.ui.toast('It\u2019s winter: your ' + nameOf(p) + ' is resting. Feeding now is like serving dinner at 3 a.m.', 'warn'); return; }
      if (Date.now() - (p.lastFeed || 0) < 14 * DAY) { V.ui.toast('Already fed recently. Too much fertiliser can burn roots.', 'warn'); return; }
      p.lastFeed = Date.now(); p.fedUntil = Date.now() + 14 * DAY; S().stats.feed++;
      burst('feed', px, py - 10, 16); V.audio.play('feed');
      V.ui.toast('Fed! Growth boost for two weeks. ' + pick(['Nom.', 'Compliments to the chef.', 'Five-star soil.']), 'good');
      commit(p);
    }
  }

  function addWater(p, amt, el) {
    var before = p.hyd;
    p.hyd = Math.min(1.4, p.hyd + amt);
    if (before < 0.6 && p.hyd >= 0.6) { p.lastWater = Date.now(); S().stats.water++; p.notified = 0; }
    if (before < 1 && p.hyd >= 1) V.ui.toast('That\u2019s plenty for your ' + nameOf(p) + '.', 'good');
    if (before < 1.1 && p.hyd >= 1.1) { V.ui.toast(spOf(p).water.days >= 12 ? 'Whoa — succulents hate wet feet! The saucer is overflowing.' : 'The saucer is overflowing. Overwatering is just love with poor drainage.', 'bad'); V.audio.play('sad'); }
    if (el) renderPlot(el);
    if (selected === p.id) renderPanel();
  }
  function startPour(el, p, e) {
    stopPour();
    el.classList.add('pouring'); document.body.classList.add('pouring');
    V.audio.startPour();
    var pt = { x: e.clientX, y: e.clientY };
    var move = function (ev) { pt.x = ev.clientX; pt.y = ev.clientY; moveCursor(ev); };
    el.addEventListener('pointermove', move);
    pour = { el: el, p: p, move: move, pt: pt, start: p.hyd, iv: setInterval(function () {
      addWater(p, 0.025, el);
      burst('drop', pt.x - 18, pt.y - 34, 3);
    }, 90) };
  }
  function stopPour() {
    if (!pour) return;
    clearInterval(pour.iv); pour.el.removeEventListener('pointermove', pour.move);
    pour.el.classList.remove('pouring'); document.body.classList.remove('pouring');
    V.audio.stopPour();
    var p = pour.p, gained = p.hyd - pour.start;
    if (gained > 0.05 && p.hyd < 1 && p.hyd >= 0.6) V.ui.toast(pick(['Glug glug. Your ' + nameOf(p) + ' says thanks.', 'Water you know — that hit the spot.', 'Refreshing!']), 'good');
    pour = null;
    commit(p);
  }

  function commit(p) {
    V.store.saveSoon();
    var el = document.querySelector('.plot[data-zone="' + p.zone + '"][data-plot="' + p.plot + '"]');
    if (el) renderPlot(el);
    if (selected === p.id) renderPanel();
    if (V.calendar && V.calendar.refresh) V.calendar.refresh();
  }
  function wiggle(el) { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------- particle FX (full-screen overlay) ---------- */
  function fxInit() {
    fx.cv = $('#fxCanvas'); fx.ctx = fx.cv.getContext('2d');
    var rs = function () { var d = Math.min(2, window.devicePixelRatio || 1); fx.cv.width = innerWidth * d; fx.cv.height = innerHeight * d; fx.ctx.setTransform(d, 0, 0, d, 0, 0); };
    rs(); window.addEventListener('resize', rs);
  }
  function burst(type, x, y, n) {
    if (V.scene.reduced) n = Math.min(n, 3);
    if (V.scene.lowPower) n = Math.ceil(n * 0.6);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = Math.random();
      var P = { type: type, x: x, y: y, vx: 0, vy: 0, life: 1, r: 2, a: a };
      if (type === 'drop') { P.vx = 30 + Math.random() * 40; P.vy = 40 + Math.random() * 60; P.r = 1.6 + s * 1.6; }
      else if (type === 'mist') { P.vx = Math.cos(a) * 40 * s; P.vy = Math.sin(a) * 30 * s - 10; P.r = 1 + s * 2; }
      else if (type === 'snip') { P.vx = (Math.random() - 0.5) * 60; P.vy = -40 - Math.random() * 40; P.r = 3 + s * 3; }
      else if (type === 'feed') { P.vx = (Math.random() - 0.5) * 40; P.vy = 20 + Math.random() * 30; P.r = 1.5 + s; }
      else if (type === 'spark') { P.vx = Math.cos(a) * 90 * s; P.vy = Math.sin(a) * 90 * s; P.r = 1.5 + s * 2; }
      else if (type === 'soil') { P.vx = (Math.random() - 0.5) * 80; P.vy = -60 * s; P.r = 1.5 + s * 2; }
      fx.parts.push(P);
    }
    if (!fx.raf) { fx.last = performance.now(); fx.raf = requestAnimationFrame(fxFrame); }
  }
  function fxFrame(t) {
    var dt = Math.min(0.05, (t - fx.last) / 1000); fx.last = t;
    var c = fx.ctx; c.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = fx.parts.length - 1; i >= 0; i--) {
      var P = fx.parts[i];
      var grav = P.type === 'mist' ? 5 : P.type === 'spark' ? 20 : 260;
      P.vy += grav * dt; P.x += P.vx * dt; P.y += P.vy * dt; P.a += dt * 6;
      P.life -= dt * (P.type === 'mist' ? 0.9 : P.type === 'snip' ? 0.6 : 1.4);
      if (P.life <= 0) { fx.parts.splice(i, 1); continue; }
      c.globalAlpha = Math.max(0, P.life);
      if (P.type === 'drop') { c.fillStyle = '#6fa6c8'; c.beginPath(); c.ellipse(P.x, P.y, P.r * 0.7, P.r * 1.4, -0.4, 0, 6.3); c.fill(); }
      else if (P.type === 'mist') { c.fillStyle = '#e6f2f6'; c.beginPath(); c.arc(P.x, P.y, P.r * (2 - P.life), 0, 6.3); c.fill(); }
      else if (P.type === 'snip') { c.fillStyle = '#d8bf58'; c.save(); c.translate(P.x, P.y); c.rotate(P.a); c.beginPath(); c.ellipse(0, 0, P.r, P.r * 0.45, 0, 0, 6.3); c.fill(); c.restore(); }
      else if (P.type === 'feed') { c.fillStyle = '#8a6a3c'; c.fillRect(P.x, P.y, P.r, P.r); }
      else if (P.type === 'spark') { c.fillStyle = '#f2cf5b'; c.beginPath(); c.arc(P.x, P.y, P.r, 0, 6.3); c.fill(); }
      else if (P.type === 'soil') { c.fillStyle = '#6b4a2f'; c.beginPath(); c.arc(P.x, P.y, P.r, 0, 6.3); c.fill(); }
    }
    c.globalAlpha = 1;
    fx.raf = fx.parts.length ? requestAnimationFrame(fxFrame) : 0;
    if (!fx.raf) c.clearRect(0, 0, innerWidth, innerHeight);
  }
  function moveCursor(e) {
    if (tool === 'hand') return;
    var ct = $('#cursorTool');
    ct.style.transform = 'translate(' + (e.clientX + 6) + 'px,' + (e.clientY - 40) + 'px)';
    ct.classList.add('on');
  }

  /* ---------- plant panel ---------- */
  function select(id) {
    selected = id;
    var panel = $('#plantPanel');
    panel.hidden = false; renderPanel();
    requestAnimationFrame(function () { panel.classList.add('open'); });
    Array.prototype.forEach.call(document.querySelectorAll('.plot'), function (el) {
      var p = plantAt(el.dataset.zone, +el.dataset.plot); el.classList.toggle('selected', !!p && p.id === id);
    });
  }
  function closePanel() {
    var panel = $('#plantPanel'); panel.classList.remove('open'); selected = null;
    setTimeout(function () { if (!selected) panel.hidden = true; }, 320);
    Array.prototype.forEach.call(document.querySelectorAll('.plot.selected'), function (el) { el.classList.remove('selected'); });
  }
  function meter(label, v, cls) {
    return '<div class="meter ' + cls + '"><span>' + label + '</span><b><i style="width:' + Math.round(Math.min(1, v) * 100) + '%"></i></b><em>' + V.fmt.pct(Math.min(v, 1.4)) + '</em></div>';
  }
  function renderPanel() {
    var p = plantById(selected); if (!p) { closePanel(); return; }
    var sp = spOf(p), zone = V.sim.zoneOf(p.zone), st = V.sim.status(p), fit = fitText(sp, zone);
    var hrs = V.sim.hoursUntilThirsty(p, Date.now(), S().settings.hemi);
    var next = p.hyd < 0.3 ? 'now' : 'in about ' + V.fmt.dur(hrs * HOUR);
    $('#panelBody').innerHTML =
      '<p class="eyebrow">' + esc(zone.name) + ' \u00b7 pot ' + (p.plot + 1) + '</p>' +
      '<h3 class="panel-title">' + esc(nameOf(p)) + '</h3><p class="latin">' + esc(sp.latin) + '</p>' +
      '<p class="pill ' + st.tone + '">' + esc(st.text) + '</p>' +
      meter('Water', p.hyd, p.hyd > 1.05 ? 'over' : p.hyd < 0.3 ? 'low' : 'ok') + meter('Health', p.health, 'health') + meter('Growth', p.growth, 'grow') +
      '<dl class="facts">' +
      '<dt>Next drink</dt><dd>' + next + '</dd>' +
      '<dt>Age</dt><dd>' + V.fmt.dur(Date.now() - p.planted) + '</dd>' +
      '<dt>This spot</dt><dd><span class="fit ' + fit.k + '">' + fit.t + '</span> ' + esc(V.LIGHT_NAMES[zone.light]) + '</dd>' +
      '<dt>Light</dt><dd>' + esc(sp.lightText) + '</dd>' +
      '<dt>Water</dt><dd>' + esc(sp.water.text) + ' <span class="fine">(roughly every ' + sp.water.days + ' days in warm months)</span></dd>' +
      '<dt>Soil</dt><dd>' + esc(sp.soil) + '</dd>' +
      '<dt>Pets</dt><dd class="' + (sp.pets.safe ? 'safe' : 'toxic') + '">' + esc(sp.pets.text) + '</dd>' +
      '</dl><p class="fact hand">' + esc(sp.fact) + '</p>' +
      '<label class="field"><span>Nickname</span><input id="nickInput" type="text" maxlength="24" value="' + esc(p.nick) + '" placeholder="e.g. Sir Leafalot"></label>' +
      '<label class="check"><input id="realToggle" type="checkbox"' + (p.real ? ' checked' : '') + '> I own this plant in real life (track it in the care calendar)</label>' +
      '<div class="btn-row"><button class="btn small" id="panelWater">Quick water</button><button class="btn small ghost" id="panelLib">Encyclopedia</button><button class="btn small danger" id="panelCompost">Compost</button></div>';
    $('#nickInput').addEventListener('change', function () { p.nick = this.value.trim().slice(0, 24); commit(p); renderPanel(); });
    $('#realToggle').addEventListener('change', function () { p.real = this.checked; commit(p); V.ui.toast(p.real ? 'Linked to your real ' + sp.name + '. Watering here logs a real watering.' : 'Unlinked. It\u2019s a game plant again.', 'good'); });
    $('#panelWater').addEventListener('click', function () { var el = document.querySelector('.plot[data-zone="' + p.zone + '"][data-plot="' + p.plot + '"]'); addWater(p, 0.3, el); V.audio.play('mist'); commit(p); });
    $('#panelLib').addEventListener('click', function () { V.app.go('library'); V.library.open(sp.id); });
    $('#panelCompost').addEventListener('click', function () {
      V.ui.confirm('Compost your ' + esc(nameOf(p)) + '?', 'It will return to the soil and become very good soil. This cannot be undone (unless you exported a seed packet).', 'Compost', function () {
        S().plants = S().plants.filter(function (x) { return x.id !== p.id; });
        V.store.journal('Composted a ' + sp.name + '. Circle of life.');
        closePanel(); renderAll(true); V.store.save(); V.ui.toast('Back to the earth it goes. \u{1F331}');
        if (V.calendar) V.calendar.refresh();
      });
    });
  }

  /* ---------- planting picker ---------- */
  function openPicker(zone, idx) {
    var list = V.SPECIES.slice().sort(function (a, b) { return V.sim.lightDiff(a, zone) - V.sim.lightDiff(b, zone) || a.name.localeCompare(b.name); });
    var html = '<h2 id="modalTitle">Plant in the ' + esc(zone.name.toLowerCase()) + '</h2><p class="hand">' + esc(zone.note) + '. Best matches first.</p>' +
      '<label class="field"><span>Search species</span><input id="pickSearch" type="search" placeholder="Search 30 species…" autocomplete="off"></label><div class="pick-grid" id="pickGrid">';
    list.forEach(function (sp) {
      var f = fitText(sp, zone);
      html += '<button class="pick" data-sp="' + sp.id + '" data-q="' + esc((sp.name + ' ' + sp.latin).toLowerCase()) + '"><canvas width="10" height="10" aria-hidden="true"></canvas>' +
        '<span class="pick-name">' + esc(sp.name) + '</span><span class="pick-latin">' + esc(sp.latin) + '</span>' +
        '<span class="fit ' + f.k + '">' + f.t + '</span>' + (sp.pets.safe ? '<span class="pet safe">Pet-safe</span>' : '<span class="pet toxic">Toxic to pets</span>') + '</button>';
    });
    html += '</div>';
    var body = V.ui.modal(html, { wide: true });
    var cvs = body.querySelectorAll('.pick canvas'), i = 0;
    (function paint() {
      for (var k = 0; k < 4 && i < cvs.length; k++, i++) {
        var c = cvs[i], spx = V.SPECIES_BY_ID[c.parentNode.dataset.sp];
        V.art.drawSpecimen(c, 96, 110, spx, 0.85, 1234 + i);
      }
      if (i < cvs.length && !$('#modal').hidden) requestAnimationFrame(paint);
    })();
    body.querySelector('#pickSearch').addEventListener('input', function () {
      var q = this.value.toLowerCase().trim();
      Array.prototype.forEach.call(body.querySelectorAll('.pick'), function (b) { b.hidden = q && b.dataset.q.indexOf(q) < 0; });
    });
    Array.prototype.forEach.call(body.querySelectorAll('.pick'), function (b) {
      b.addEventListener('click', function () { V.ui.close(); sow(b.dataset.sp, zone.id, idx); });
    });
  }
  function sow(spId, zoneId, idx) {
    var sp = V.SPECIES_BY_ID[spId], zone = V.sim.zoneOf(zoneId);
    var p = V.store.newPlant(spId, zoneId, idx);
    S().plants.push(p); S().stats.plant++;
    V.store.journal('Planted a ' + sp.name + ' in the ' + zone.name.toLowerCase() + '.');
    V.store.save();
    var el = document.querySelector('.plot[data-zone="' + zoneId + '"][data-plot="' + idx + '"]');
    renderAll();
    if (el) { var r = el.getBoundingClientRect(); burst('soil', r.left + r.width / 2, r.top + r.height * 0.66, 18); el.classList.add('sprout'); setTimeout(function () { el.classList.remove('sprout'); }, 900); }
    V.audio.play('plant');
    var f = fitText(sp, zone);
    V.ui.toast(f.k === 'bad' ? 'Planted — but a ' + sp.name + ' wants ' + V.LIGHT_NAMES[sp.light[0]].toLowerCase() + ' to ' + V.LIGHT_NAMES[sp.light[1]].toLowerCase() + '. It may sulk.' : pick(['Planted! Welcome home, little ' + sp.name + '.', 'A ' + sp.name + ' has entered the chat.', 'Seed in, hope up. ' + sp.name + ' planted.']), f.k === 'bad' ? 'warn' : 'good');
    if (V.calendar) V.calendar.refresh();
    return p;
  }
  /* plant a species in the best free plot (used by quiz/encyclopedia) */
  function plantSpecies(spId) {
    var sp = V.SPECIES_BY_ID[spId], best = null, bd = 9;
    V.ZONES.forEach(function (z) {
      for (var i = 0; i < z.plots; i++) if (!plantAt(z.id, i)) { var d = V.sim.lightDiff(sp, z); if (d < bd) { bd = d; best = [z.id, i]; } }
    });
    if (!best) { V.ui.toast('Every pot is full! Compost something or admire what you have.', 'warn'); return null; }
    V.app.go('garden');
    return sow(spId, best[0], best[1]);
  }

  /* ---------- time: ticks, nap, away report ---------- */
  function tick() {
    var now = Date.now(), st = S();
    if (now - lastTick > 1000) V.sim.simulate(st, lastTick, now);
    lastTick = now; st.lastSeen = now;
    var w = V.sim.weatherAt(now, st.settings.hemi), season = V.sim.seasonAt(now, st.settings.hemi);
    var wasNight = nightNow; nightNow = V.sim.isNight(now, st.settings.hemi);
    V.scene.update(season, w, st.settings.hemi);
    updateChips(now, w, season);
    renderAll(wasNight !== nightNow);
    if (selected) renderPanel();
    var terr = document.querySelector('.zone-terrace');
    if (terr) { terr.classList.toggle('raining', w.wet && w.kind !== 'snow'); terr.classList.toggle('snowing', w.kind === 'snow'); }
    document.body.dataset.season = season;
    document.body.dataset.phase = V.sim.dayPhase(now, st.settings.hemi);
    if (st.settings.ambient && V.audio.on) V.audio.setAmbient(w.wet && w.kind !== 'snow' ? 'rain' : nightNow ? 'night' : 'day');
    V.store.saveSoon();
    if (V.calendar && V.calendar.checkReminders) V.calendar.checkReminders();
  }
  function updateChips(now, w, season) {
    var mp = V.sim.moonPhase(now);
    $('#seasonLabel').textContent = season.charAt(0).toUpperCase() + season.slice(1) + (S().settings.hemi === 'S' ? ' (S)' : '');
    $('#weatherLabel').textContent = w.icon + ' ' + w.label;
    $('#clockLabel').textContent = new Date(now).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    $('#moonLabel').textContent = '\u263D ' + mp.name;
    var phase = V.sim.dayPhase(now, S().settings.hemi);
    var g = $('#gardenGreeting');
    if (g.dataset.phase !== phase) {
      var arr = V.GREETINGS[phase]; var nm = S().name ? ', ' + S().name : '';
      g.textContent = arr[Math.floor(Math.random() * arr.length)].replace('gardener', S().name || 'gardener').replace('{n}', nm);
      g.dataset.phase = phase;
    }
  }
  function nap() {
    if (!S().plants.length) { V.ui.toast('Nothing to dream about yet — plant something first.', 'warn'); return; }
    var now = Date.now();
    var before = S().plants.map(function (p) { return p.growth; });
    var reps = V.sim.simulate(S(), now, now + 6 * HOUR);
    S().stats.nap++;
    document.body.classList.add('napping');
    setTimeout(function () { document.body.classList.remove('napping'); }, 1400);
    renderAll(); V.store.save();
    if (selected) renderPanel();
    var grew = 0; S().plants.forEach(function (p, i) { grew += p.growth - before[i]; });
    showReport(reps, 6 * HOUR, 'Six hours of beauty sleep later\u2026', true);
    if (V.calendar) V.calendar.refresh();
    return grew;
  }
  function showReport(reps, span, title, isNap) {
    var lines = [];
    reps.forEach(function (r) {
      var p = plantById(r.id); if (!p) return;
      var sp = spOf(p), nm = esc(nameOf(p)), dg = r.g1 - r.g0;
      if (dg >= 0.005) lines.push('<li class="grew">Your <b>' + nm + '</b> grew <b>' + Math.round(dg * 100) + '%</b>' + (isNap ? '' : ' while you were away') + '.' + (r.g1 >= 1 && r.g0 < 1 ? ' It\u2019s fully grown!' : '') + '</li>');
      if (r.rain > 0.05) lines.push('<li class="rain">The rain watered your ' + nm + '. Free water — nature\u2019s subscription.</li>');
      if (r.thirstyAt) lines.push('<li class="thirst">' + nm + ' got thirsty' + (isNap ? '' : ' around ' + V.fmt.when(r.thirstyAt)) + '. Water it soon!</li>');
      if (r.yellow) lines.push('<li class="yellow">' + r.yellow + ' leaf' + (r.yellow > 1 ? 'ves' : '') + ' on your ' + nm + ' turned yellow — shears at the ready.</li>');
      if (r.bloomed) lines.push('<li class="bloom">' + nm + ' burst into flower! \u273F</li>');
      if (r.frost) lines.push('<li class="frost">Frost nipped your ' + nm + ' (' + esc(sp.name) + ' isn\u2019t frost-hardy — bring it indoors in winter).</li>');
      if (r.h1 < r.h0 - 0.1) lines.push('<li class="sad">' + nm + ' is feeling a bit neglected.</li>');
    });
    if (!lines.length) lines.push('<li>Everything stayed calm. The plants mostly gossiped.</li>');
    var html = '<div class="away"><p class="eyebrow">' + (isNap ? 'Nap report' : 'Away for ' + V.fmt.dur(span)) + '</p><h2 id="modalTitle">' + title + '</h2>' +
      '<ul class="away-list">' + lines.slice(0, 14).join('') + '</ul><div class="btn-row"><button class="btn" data-close="1">Back to the garden</button></div></div>';
    V.ui.modal(html, {});
  }
  function awayCheck() {
    var st = S(), now = Date.now(), span = now - (st.lastSeen || now);
    lastTick = now;
    if (span < 60000 || !st.plants.length) { st.lastSeen = now; return; }
    var reps = V.sim.simulate(st, st.lastSeen, now);
    st.lastSeen = now; V.store.save();
    if (span >= 10 * 60000) {
      V.store.journal('Returned after ' + V.fmt.dur(span) + '.');
      setTimeout(function () { showReport(reps, span, 'Your garden grew while you were away', false); }, 700);
    }
  }

  V.garden = {
    init: function () {
      fxInit(); buildZones();
      Array.prototype.forEach.call(document.querySelectorAll('.tool[data-tool]'), function (b) { b.addEventListener('click', function () { setTool(b.dataset.tool); }); });
      $('#napBtn').addEventListener('click', nap);
      $('#panelClose').addEventListener('click', closePanel);
      document.addEventListener('pointermove', moveCursor, { passive: true });
      document.addEventListener('pointerleave', function () { $('#cursorTool').classList.remove('on'); });
      document.addEventListener('keydown', function (e) {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (V.app && V.app.view !== 'garden') return;
        var m = { h: 'hand', w: 'water', p: 'prune', m: 'mist', f: 'feed' }[e.key.toLowerCase()];
        if (m) setTool(m);
        if (e.key === 'Escape' && selected) closePanel();
      });
      var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { renderAll(true); }, 200); });
      nightNow = V.sim.isNight(Date.now(), S().settings.hemi);
      awayCheck();
      setTool('hand');
      tick();
      setInterval(tick, 30000);
      window.addEventListener('pagehide', function () { S().lastSeen = Date.now(); V.store.save(); });
      document.addEventListener('visibilitychange', function () { if (document.hidden) { S().lastSeen = Date.now(); V.store.save(); } else { tick(); } });
    },
    renderAll: renderAll, tick: tick, select: select, closePanel: closePanel, plantSpecies: plantSpecies, burst: burst,
    reload: function () { selected = null; $('#plantPanel').hidden = true; plotCache = {}; lastTick = Date.now(); renderAll(true); tick(); },
    awayCheck: awayCheck, showReport: showReport
  };
})();
