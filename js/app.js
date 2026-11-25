/* Verdant — app shell: routing, toasts, modals, themes, sound, seed-packet view, easter eggs. */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return V.fmt.esc(s); };
  var VIEWS = ['garden', 'calendar', 'library', 'quiz', 'packet', 'about'];
  var THEMES = [['auto', 'Auto (follows the sun)'], ['morning', 'Morning paper'], ['herbarium', 'Pressed herbarium'], ['moonlit', 'Moonlit greenhouse']];
  var lastFocus = null;

  /* ---------- toasts ---------- */
  var ui = {
    toast: function (msg, tone) {
      var host = $('#toasts'), t = document.createElement('div');
      t.className = 'toast ' + (tone || ''); t.setAttribute('role', 'status');
      t.innerHTML = '<span class="toast-leaf" aria-hidden="true"></span><span></span>';
      t.lastChild.textContent = msg;
      host.appendChild(t);
      while (host.children.length > 4) host.removeChild(host.firstChild);
      setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 450); }, 3800);
    },
    modal: function (html, opts) {
      opts = opts || {};
      var m = $('#modal'), card = $('#modalCard'), body = $('#modalBody');
      lastFocus = document.activeElement;
      body.innerHTML = html;
      card.classList.toggle('wide', !!opts.wide);
      if (!body.querySelector('#modalTitle')) card.setAttribute('aria-label', 'Dialog'); else card.removeAttribute('aria-label');
      m.hidden = false; ui._gen = (ui._gen || 0) + 1;
      requestAnimationFrame(function () { m.classList.add('open'); });
      Array.prototype.forEach.call(body.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', ui.close); });
      setTimeout(function () { var f = body.querySelector('input, button, [href]') || $('#modalClose'); try { f.focus(); } catch (e) { /* ignore */ } }, 60);
      document.body.classList.add('modal-open');
      return body;
    },
    close: function () {
      var m = $('#modal'); if (m.hidden) return;
      m.classList.remove('open'); document.body.classList.remove('modal-open');
      var gen = ui._gen;
      setTimeout(function () { if (gen !== ui._gen) return; m.hidden = true; $('#modalBody').innerHTML = ''; }, 280);
      if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* ignore */ }
    },
    confirm: function (title, text, okLabel, onOk) {
      var body = ui.modal('<h2 id="modalTitle">' + title + '</h2><p>' + text + '</p><div class="btn-row"><button class="btn danger" id="cfOk">' + esc(okLabel) + '</button><button class="btn ghost" data-close="1">Keep it</button></div>', {});
      body.querySelector('#cfOk').addEventListener('click', function () { ui.close(); onOk(); });
    }
  };
  V.ui = ui;

  /* ---------- routing ---------- */
  var app = {
    view: 'garden',
    go: function (v, noHash) {
      if (VIEWS.indexOf(v) < 0) v = 'garden';
      app.view = v;
      VIEWS.forEach(function (x) {
        var sec = $('#view-' + x); var on = x === v;
        sec.hidden = !on; if (on) { sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter'); }
      });
      Array.prototype.forEach.call(document.querySelectorAll('.navbtn'), function (b) {
        if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      if (!noHash && location.hash !== '#' + v) { try { history.replaceState(null, '', '#' + v); } catch (e) { location.hash = v; } }
      V.scene.setVisible(v === 'garden');
      if (v === 'garden') setTimeout(function () { V.scene.resize(); V.garden.renderAll(true); }, 30);
      if (v === 'calendar') V.calendar.render();
      if (v === 'packet') renderPacket();
      if (v !== 'garden') V.garden.closePanel();
      window.scrollTo(0, 0);
      V.audio.play('page');
    },
    download: function (blob, name) {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    }
  };
  V.app = app;

  /* ---------- theme ---------- */
  function applyTheme() {
    var t = V.store.state.settings.theme || 'auto';
    var eff = t === 'auto' ? (V.sim.isNight(Date.now(), V.store.state.settings.hemi) ? 'moonlit' : 'morning') : t;
    document.body.dataset.theme = eff;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', eff === 'moonlit' ? '#1f2a30' : eff === 'herbarium' ? '#b89a6a' : '#6f9a6a');
  }
  function cycleTheme() {
    var s = V.store.state.settings, i = 0;
    for (var k = 0; k < THEMES.length; k++) if (THEMES[k][0] === s.theme) i = k;
    var nx = THEMES[(i + 1) % THEMES.length];
    s.theme = nx[0]; applyTheme(); V.store.save();
    document.body.classList.add('repaint'); setTimeout(function () { document.body.classList.remove('repaint'); }, 900);
    ui.toast('Paper: ' + nx[1]);
  }

  /* ---------- sound ---------- */
  function setSound(on) {
    var s = V.store.state.settings; s.sound = on; s.ambient = on;
    V.audio.setEnabled(on);
    var b = $('#soundBtn'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on');
    b.classList.toggle('on', on);
    V.store.save();
    if (on) { V.audio.play('chime'); V.garden.tick(); }
  }

  /* ---------- seed packet view ---------- */
  function renderPacket() {
    var st = V.store.state;
    var names = st.plants.map(function (p) { return (V.SPECIES_BY_ID[p.sp] || {}).name; });
    var uniq = names.filter(function (n, i) { return names.indexOf(n) === i; });
    var star = st.plants.slice().sort(function (a, b) { return b.growth - a.growth; })[0];
    var card = $('#packetCard');
    card.innerHTML = '<div class="packet-flap" aria-hidden="true"></div><div class="packet-face">' +
      '<p class="packet-brand">Verdant Seed Co.</p><canvas id="packetArt" aria-hidden="true"></canvas>' +
      '<h3 class="packet-title">The garden of ' + esc(st.name || 'an anonymous gardener') + '</h3>' +
      '<p class="packet-list">' + (uniq.length ? esc(uniq.slice(0, 8).join(' \u00b7 ')) + (uniq.length > 8 ? ' \u2026' : '') : 'Contents: hope, mostly. (No plants yet.)') + '</p>' +
      '<p class="packet-fine">Net wt. ' + st.plants.length + ' plant' + (st.plants.length === 1 ? '' : 's') + ' \u00b7 schema v' + st.v + ' \u00b7 sow by ' + new Date(Date.now() + 365 * 864e5).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) + '</p></div>';
    var c = $('#packetArt'), sp = star ? V.SPECIES_BY_ID[star.sp] : V.SPECIES_BY_ID.monstera;
    V.art.drawSpecimen(c, 150, 170, sp, star ? Math.max(0.5, star.growth) : 1, star ? star.seed : 11);
    var info = [
      ['Schema version', 'v' + st.v + (V.store.migratedFrom ? ' (upgraded from v' + V.store.migratedFrom + ' this visit)' : '')],
      ['Garden dug', new Date(st.created).toLocaleString()],
      ['Last tended', new Date(st.lastSeen).toLocaleString()],
      ['Plants', st.plants.length + ' of 12 pots'],
      ['Save size', (V.store.bytes() / 1024).toFixed(1) + ' KB in localStorage'],
      ['Backup kept', V.store.hasBackup() ? 'Yes (previous save)' : 'Not yet'],
      ['Storage', V.store.storageOK ? 'Working' : 'Unavailable — private mode? Export a packet to keep your garden!'],
      ['Care log', st.stats.water + ' waterings \u00b7 ' + st.stats.prune + ' snips \u00b7 ' + st.stats.mist + ' mists \u00b7 ' + st.stats.feed + ' feeds \u00b7 ' + st.stats.nap + ' naps']
    ];
    $('#saveInfo').innerHTML = info.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    $('#gardenerName').value = st.name || '';
    $('#hemiSelect').value = st.settings.hemi;
    $('#schemaVer').textContent = V.store.SCHEMA;
  }
  function exportPacket() {
    var pk = V.store.makePacket();
    var d = new Date(), stamp = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    app.download(new Blob([JSON.stringify(pk, null, 2)], { type: 'application/json' }), 'verdant-seed-packet-' + stamp + '.json');
    ui.toast('Seed packet folded and ready. Keep it somewhere dry.', 'good');
    V.audio.play('page');
  }
  function sowPacket(text, label) {
    var res;
    try { res = V.store.readPacket(text); }
    catch (e) { ui.toast('That packet is empty or torn: ' + e.message, 'bad'); return; }
    var st = res.state, n = st.plants.length;
    var html = '<h2 id="modalTitle">Sow this seed packet?</h2><p>' + esc(label) + ' contains <b>' + n + '</b> plant' + (n === 1 ? '' : 's') + ' from the garden of <b>' + esc(st.name || 'an anonymous gardener') + '</b>.</p>' +
      (res.log.length ? '<p class="pill warn">Upgraded: ' + esc(res.log.join(', ')) + '</p>' : '<p class="pill good">Already on the current schema (v' + V.store.SCHEMA + ').</p>') +
      (res.warn ? '<p class="pill warn">' + esc(res.warn) + '</p>' : '') +
      '<p class="fine">Your current garden is backed up first. Plants will catch up on growth for the time since the packet was made.</p>' +
      '<div class="btn-row"><button class="btn" id="sowOk">Replace my garden</button><button class="btn ghost" data-close="1">Not now</button></div>';
    var body = ui.modal(html, {});
    body.querySelector('#sowOk').addEventListener('click', function () {
      try { localStorage.setItem('verdant:save:backup', JSON.stringify(V.store.state)); } catch (e) { /* ignore */ }
      var keep = V.store.state.settings;
      st.settings.sound = keep.sound; st.settings.ambient = keep.ambient;
      V.store.state = st; V.store.journal('Sowed a seed packet (' + n + ' plants).');
      V.store.save();
      ui.close();
      applyTheme(); V.garden.awayCheck(); V.garden.reload(); renderPacket();
      setTimeout(function () { if ($('#modal').hidden) ui.toast('Packet sown! ' + n + ' plant' + (n === 1 ? '' : 's') + ' settling in.', 'good'); }, 400);
      if (V.calendar) V.calendar.refresh();
    });
  }

  /* ---------- easter eggs ---------- */
  var bugTaps = 0, bugT = 0, typed = '';
  function ladybird() {
    var b = $('#ladybird'); b.classList.remove('hop'); void b.offsetWidth; b.classList.add('hop');
    V.audio.play('tick');
    if (Date.now() - bugT > 2500) bugTaps = 0;
    bugT = Date.now(); bugTaps++;
    if (bugTaps === 3) ui.toast('The ladybird looks at you expectantly.');
    if (bugTaps >= 7) {
      bugTaps = 0;
      var st = V.store.state;
      if (!st.plants.length) { ui.toast('The ladybird wants to bless a garden, but there are no plants yet. It sighs in Latin.'); return; }
      st.plants.forEach(function (p) { p.golden = true; p.health = 1; });
      st.eggs.golden = Date.now();
      V.store.journal('The Golden Ladybird blessed the garden.');
      V.store.save(); V.garden.renderAll(true);
      var r = b.getBoundingClientRect();
      V.garden.burst('spark', r.left + r.width / 2, r.top + r.height / 2, 60);
      V.audio.play('magic');
      ui.toast('\u2728 The Golden Ladybird has blessed your garden: golden leaves and +15% growth, forever.', 'good');
    }
  }
  function onType(e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (!e.key || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-14);
    if (typed === 'photosynthesis') {
      typed = '';
      document.body.classList.add('sunburst'); setTimeout(function () { document.body.classList.remove('sunburst'); }, 2600);
      V.store.state.plants.forEach(function (p) { p.growth = Math.min(1, p.growth + 0.02); });
      V.garden.renderAll(); V.store.saveSoon();
      ui.toast('\u2600\ufe0e You said the magic word. Every plant photosynthesised a little harder (+2%).', 'good');
      V.audio.play('chime');
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    V.store.load();
    var st = V.store.state;
    applyTheme();
    V.scene.init($('#skyCanvas'));
    V.garden.init();
    V.calendar.init();
    V.library.init();
    V.quiz.init();

    Array.prototype.forEach.call(document.querySelectorAll('.navbtn'), function (b) { b.addEventListener('click', function () { app.go(b.dataset.view); }); });
    window.addEventListener('hashchange', function () { var h = location.hash.slice(1); if (h && h !== app.view) app.go(h, true); });
    $('.brand').addEventListener('click', function (e) { e.preventDefault(); app.go('garden'); });
    $('#themeBtn').addEventListener('click', cycleTheme);
    $('#soundBtn').addEventListener('click', function () { setSound(!V.store.state.settings.sound); });
    $('#ladybird').addEventListener('click', ladybird);
    $('#modalClose').addEventListener('click', ui.close);
    $('#modal').addEventListener('click', function (e) { if (e.target && e.target.dataset && e.target.dataset.close) ui.close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#modal').hidden) { ui.close(); return; }
      if (e.key === 'Tab' && !$('#modal').hidden) {
        var f = $('#modalCard').querySelectorAll('button, [href], input, select, textarea');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      onType(e);
    });
    // unlock audio on first gesture (iOS)
    var unlock = function () { V.audio.unlock(); document.removeEventListener('pointerdown', unlock); };
    document.addEventListener('pointerdown', unlock);

    // packet view controls
    $('#exportBtn').addEventListener('click', exportPacket);
    $('#importFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (f.size > 2e6) { ui.toast('That file is far too heavy to be a seed packet.', 'bad'); this.value = ''; return; }
      var rd = new FileReader();
      rd.onload = function () { sowPacket(String(rd.result), 'The packet \u201c' + f.name + '\u201d'); };
      rd.onerror = function () { ui.toast('Couldn\u2019t read that file.', 'bad'); };
      rd.readAsText(f); this.value = '';
    });
    $('#migrateDemoBtn').addEventListener('click', function () { sowPacket(JSON.stringify(V.store.legacyDemo()), 'This vintage v1 packet (found in a fictional shed)'); });
    $('#resetBtn').addEventListener('click', function () {
      ui.confirm('Compost the whole garden?', 'Every plant returns to the soil. A backup of the current save is kept in this browser, but exporting a seed packet first is wiser.', 'Compost everything', function () {
        var keep = V.store.state.settings; V.store.reset(); V.store.state.settings.sound = keep.sound;
        V.garden.reload(); renderPacket(); ui.toast('Fresh soil. Infinite possibilities.');
      });
    });
    $('#gardenerName').addEventListener('change', function () { V.store.state.name = this.value.trim().slice(0, 40); V.store.save(); renderPacket(); $('#gardenGreeting').dataset.phase = ''; V.garden.tick(); });
    $('#hemiSelect').addEventListener('change', function () { V.store.state.settings.hemi = this.value === 'S' ? 'S' : 'N'; V.store.save(); V.garden.tick(); renderPacket(); ui.toast('Seasons flipped to the ' + (this.value === 'S' ? 'southern' : 'northern') + ' hemisphere.'); });

    // footer jokes
    var fj = $('#footerJoke'), ji = 0;
    setInterval(function () { ji = (ji + 1) % V.JOKES.length; fj.classList.add('fade'); setTimeout(function () { fj.textContent = V.JOKES[ji]; fj.classList.remove('fade'); }, 400); }, 12000);
    setInterval(applyTheme, 5 * 60000);

    if (st.settings.sound) { V.audio.setEnabled(true); var sb = $('#soundBtn'); sb.setAttribute('aria-pressed', 'true'); sb.classList.add('on'); sb.setAttribute('aria-label', 'Sound on. Turn sound off'); }

    var h = location.hash.slice(1);
    app.go(VIEWS.indexOf(h) >= 0 ? h : 'garden', true);

    if (V.store.isNew) setTimeout(function () { ui.toast('Welcome to Verdant! Tap an empty pot to plant your first seedling.', 'good'); }, 900);
    if (V.store.corrupt) ui.toast('Your old save looked muddy, so we started fresh (a backup was kept).', 'warn');
    if (V.store.migratedFrom) ui.toast('Your garden was upgraded from schema v' + V.store.migratedFrom + ' to v' + V.store.SCHEMA + '.', 'good');
    if (!V.store.storageOK) ui.toast('Saving is unavailable in this browser mode — export a seed packet to keep your garden.', 'warn');
    try { console.log('%cVerdant %c\u2014 psst, try typing "photosynthesis" on the garden. And be nice to the ladybird.', 'color:#4f7f4a;font:bold 16px Georgia', 'color:#777'); } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
