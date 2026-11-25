/* Verdant — the plant encyclopedia. */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return V.fmt.esc(s); };
  var filt = { q: '', light: 'any', pets: false, easy: false };
  var DIFF = ['', 'Easy-going', 'Needs a little attention', 'Diva (in the nicest way)'];

  function lightIcons(sp) {
    var out = '';
    for (var i = 0; i < 4; i++) out += '<i class="sun' + (i >= sp.light[0] && i <= sp.light[1] ? ' on' : '') + '" title="' + esc(V.LIGHT_NAMES[i]) + '"></i>';
    return '<span class="suns" aria-label="Light: ' + esc(V.LIGHT_NAMES[sp.light[0]] + ' to ' + V.LIGHT_NAMES[sp.light[1]]) + '">' + out + '</span>';
  }
  function matches(sp) {
    if (filt.pets && !sp.pets.safe) return false;
    if (filt.easy && sp.diff !== 1) return false;
    if (filt.light !== 'any') { var L = +filt.light; if (L < sp.light[0] || L > sp.light[1]) return false; }
    if (filt.q) {
      var q = filt.q, hay = (sp.name + ' ' + sp.latin + ' ' + sp.origin + ' ' + sp.soil + ' ' + (sp.pets.safe ? 'pet-safe pet safe non-toxic' : 'toxic') + ' ' + sp.form.habit + ' ' + (sp.herb ? 'herb' : '') + ' ' + (sp.form.habit === 'fern' || sp.id === 'birdsnest' ? 'fern' : '') + ' ' + (sp.water.days >= 12 ? 'succulent drought' : '')).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  var io = null;
  function paintCard(c) {
    if (c.dataset.painted) return;
    c.dataset.painted = '1';
    var sp = V.SPECIES_BY_ID[c.dataset.sp];
    V.art.drawSpecimen(c, 150, 170, sp, 1, 900 + V.SPECIES.indexOf(sp));
  }
  function render() {
    var grid = $('#libGrid'), list = V.SPECIES.filter(matches);
    $('#libCount').textContent = list.length + ' of ' + V.SPECIES.length + ' species';
    if (!list.length) { grid.innerHTML = '<p class="empty-note hand center">No plant matches that. Even the snake plant can\u2019t survive these filters.</p>'; return; }
    grid.innerHTML = list.map(function (sp) {
      return '<button class="lib-card" data-sp="' + sp.id + '" aria-label="' + esc(sp.name + ', ' + sp.latin + '. Open details') + '">' +
        '<span class="plate"><canvas data-sp="' + sp.id + '" aria-hidden="true"></canvas></span>' +
        '<span class="lib-name">' + esc(sp.name) + '</span><span class="latin">' + esc(sp.latin) + '</span>' +
        '<span class="lib-meta">' + lightIcons(sp) + '<span class="drops" title="Water roughly every ' + sp.water.days + ' days">\u{1F4A7} ~' + sp.water.days + 'd</span>' +
        (sp.pets.safe ? '<span class="pet safe">Pet-safe</span>' : '<span class="pet toxic">Toxic to pets</span>') + '</span></button>';
    }).join('');
    var cvs = grid.querySelectorAll('canvas');
    if ('IntersectionObserver' in window) {
      if (io) io.disconnect();
      io = new IntersectionObserver(function (ents) { ents.forEach(function (e) { if (e.isIntersecting) { paintCard(e.target); io.unobserve(e.target); } }); }, { rootMargin: '200px' });
      Array.prototype.forEach.call(cvs, function (c) { io.observe(c); });
    } else Array.prototype.forEach.call(cvs, paintCard);
    Array.prototype.forEach.call(grid.querySelectorAll('.lib-card'), function (b) { b.addEventListener('click', function () { open(b.dataset.sp); }); });
  }

  function open(id) {
    var sp = V.SPECIES_BY_ID[id]; if (!sp) return;
    var html = '<article class="plate-detail"><div class="pd-art"><canvas id="pdCanvas" aria-hidden="true"></canvas><p class="plate-no">Plate ' + (V.SPECIES.indexOf(sp) + 1) + ' of ' + V.SPECIES.length + '</p></div>' +
      '<div class="pd-text"><h2 id="modalTitle">' + esc(sp.name) + '</h2><p class="latin big">' + esc(sp.latin) + '</p>' +
      '<p class="fine">Native to: ' + esc(sp.origin) + ' \u00b7 ' + DIFF[sp.diff] + '</p>' +
      '<dl class="facts">' +
      '<dt>Light</dt><dd>' + lightIcons(sp) + ' ' + esc(sp.lightText) + '</dd>' +
      '<dt>Water</dt><dd>' + esc(sp.water.text) + ' <span class="fine">Rule of thumb: about every ' + sp.water.days + ' days in warm months, less in winter.</span></dd>' +
      '<dt>Soil</dt><dd>' + esc(sp.soil) + '</dd>' +
      '<dt>Humidity</dt><dd>' + ['Average room air is fine', 'Appreciates moderate humidity', 'Loves high humidity — bathrooms & kitchens are great'][sp.humid] + '</dd>' +
      '<dt>Pets</dt><dd class="' + (sp.pets.safe ? 'safe' : 'toxic') + '">' + esc(sp.pets.text) + '</dd>' +
      '</dl><p class="fact hand">' + esc(sp.fact) + '</p>' +
      '<div class="btn-row"><button class="btn" id="pdPlant">Plant one in my garden</button><button class="btn ghost" data-close="1">Close</button></div></div></article>';
    var body = V.ui.modal(html, { wide: true });
    var c = body.querySelector('#pdCanvas');
    var w = Math.min(300, Math.max(200, Math.round(window.innerWidth * 0.32)));
    V.art.drawSpecimen(c, w, Math.round(w * 1.15), sp, 1, 31337);
    c.style.width = w + 'px'; c.style.height = Math.round(w * 1.15) + 'px';
    body.querySelector('#pdPlant').addEventListener('click', function () { V.ui.close(); V.garden.plantSpecies(sp.id); });
    V.audio.play('page');
  }

  V.library = {
    init: function () {
      $('#libSearch').addEventListener('input', function () { filt.q = this.value.toLowerCase().trim(); render(); });
      $('#libLight').addEventListener('change', function () { filt.light = this.value; render(); });
      $('#libPets').addEventListener('click', function () { filt.pets = !filt.pets; this.setAttribute('aria-pressed', filt.pets); render(); });
      $('#libEasy').addEventListener('click', function () { filt.easy = !filt.easy; this.setAttribute('aria-pressed', filt.easy); render(); });
      render();
    },
    open: open, render: render, lightIcons: lightIcons
  };
})();
