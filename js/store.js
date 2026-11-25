/* Verdant — saving: versioned localStorage schema, step-by-step migrations,
   backup-before-upgrade, and "seed packet" JSON export/import. */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var KEY = 'verdant:save';
  var BAK = 'verdant:save:backup';
  var SCHEMA = 3;

  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  function fresh() {
    var now = Date.now();
    return {
      v: SCHEMA, created: now, lastSeen: now, name: '',
      settings: { sound: false, ambient: false, theme: 'auto', hemi: 'N', notify: false },
      plants: [], journal: [{ t: now, msg: 'A new garden was dug. The worms held a welcome party.' }],
      stats: { water: 0, prune: 0, plant: 0, nap: 0, mist: 0, feed: 0 },
      eggs: {}
    };
  }

  function newPlant(sp, zone, plot) {
    var now = Date.now();
    return { id: uid(), sp: sp, zone: zone, plot: plot, planted: now, growth: 0.12, hyd: 0.85, health: 1,
      yellow: 0, seed: Math.floor(Math.random() * 1e9), lastWater: now, lastFeed: 0, lastMist: 0,
      fedUntil: 0, real: false, nick: '', bloom: false, notified: 0, golden: false };
  }

  /* ---------- migrations: each takes schema N and returns schema N+1 ---------- */
  var ZONE_ORDER = ['corner', 'nook', 'window', 'terrace'];
  var MIGRATIONS = {
    // v1 (legacy): { version:1, garden:[{species, spot, water(0-100), plantedAt}], savedAt }
    1: function (o) {
      var plants = (o.garden || []).map(function (g, i) {
        var spot = typeof g.spot === 'number' ? g.spot : i;
        return { id: uid(), sp: g.species, zone: ZONE_ORDER[Math.floor(spot / 3) % 4], plot: spot % 3,
          planted: g.plantedAt || Date.now(), growth: clamp((g.size || 10) / 100, 0.02, 1), hyd: clamp((g.water == null ? 70 : g.water) / 100, 0, 1.2) };
      });
      return { v: 2, lastSeen: o.savedAt || Date.now(), created: o.savedAt || Date.now(), plants: plants, settings: { sound: !!o.sound } };
    },
    // v2 -> v3: adds health, yellow leaves, care timestamps, journal, stats, hemisphere, theme
    2: function (o) {
      var now = Date.now();
      var plants = (o.plants || []).map(function (p) {
        return { id: p.id || uid(), sp: p.sp, zone: p.zone, plot: p.plot, planted: p.planted || now,
          growth: clamp(+p.growth || 0.04, 0, 1), hyd: clamp(p.hyd == null ? 0.8 : +p.hyd, 0, 1.4), health: 1, yellow: 0,
          seed: Math.floor(Math.random() * 1e9), lastWater: p.planted || now, lastFeed: 0, lastMist: 0, fedUntil: 0,
          real: false, nick: p.nick || '', bloom: false, notified: 0, golden: false };
      });
      var s = o.settings || {};
      return { v: 3, created: o.created || now, lastSeen: o.lastSeen || now, name: o.name || '',
        settings: { sound: !!s.sound, ambient: false, theme: 'auto', hemi: 'N', notify: false },
        plants: plants, journal: [{ t: now, msg: 'Garden upgraded to schema v3 — the soil got a fresh layer of compost.' }],
        stats: { water: 0, prune: 0, plant: plants.length, nap: 0, mist: 0, feed: 0 }, eggs: {} };
    }
  };

  function detectVersion(o) {
    if (!o || typeof o !== 'object') return 0;
    if (typeof o.v === 'number') return o.v;
    if (o.version === 1) return 1;
    return 0;
  }

  function migrate(o, log) {
    var ver = detectVersion(o);
    if (!ver) throw new Error('This does not look like a Verdant garden.');
    if (ver > SCHEMA) throw new Error('This packet is from a newer Verdant (v' + ver + '). Please update.');
    while (ver < SCHEMA) {
      o = MIGRATIONS[ver](o);
      if (log) log.push('v' + ver + ' → v' + (ver + 1));
      ver = o.v;
    }
    return sanitize(o);
  }

  function sanitize(o) {
    var base = fresh();
    var s = Object.assign({}, base, o);
    s.settings = Object.assign({}, base.settings, o.settings || {});
    s.stats = Object.assign({}, base.stats, o.stats || {});
    s.eggs = Object.assign({}, o.eggs || {});
    s.journal = Array.isArray(o.journal) ? o.journal.slice(-80) : base.journal;
    var used = {};
    s.plants = (Array.isArray(o.plants) ? o.plants : []).filter(function (p) {
      if (!p || !V.SPECIES_BY_ID[p.sp]) return false;
      if (ZONE_ORDER.indexOf(p.zone) < 0) return false;
      p.plot = clamp(p.plot | 0, 0, 2);
      var k = p.zone + p.plot;
      if (used[k]) return false;
      used[k] = 1;
      var d = newPlant(p.sp, p.zone, p.plot);
      for (var key in d) if (p[key] === undefined) p[key] = d[key];
      p.growth = clamp(+p.growth || 0, 0, 1); p.hyd = clamp(+p.hyd || 0, 0, 1.4); p.health = clamp(+p.health, 0, 1);
      p.yellow = clamp(p.yellow | 0, 0, 9);
      return true;
    });
    s.v = SCHEMA;
    return s;
  }

  /* ---------- checksum (FNV-1a) ---------- */
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  var store = {
    SCHEMA: SCHEMA, state: null, migratedFrom: null, migrationLog: [], storageOK: true, _t: 0,
    load: function () {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { this.storageOK = false; }
      if (!raw) { this.state = fresh(); this.isNew = true; return this.state; }
      try {
        var o = JSON.parse(raw);
        var ver = detectVersion(o);
        if (ver && ver < SCHEMA) {
          try { localStorage.setItem(BAK, raw); } catch (e) { /* ignore */ }
          this.migratedFrom = ver;
        }
        this.state = migrate(o, this.migrationLog);
      } catch (err) {
        try { localStorage.setItem(BAK, raw); } catch (e) { /* ignore */ }
        this.state = fresh();
        this.corrupt = true;
      }
      return this.state;
    },
    save: function () {
      if (!this.state) return false;
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); this.storageOK = true; return true; }
      catch (e) { this.storageOK = false; return false; }
    },
    saveSoon: function () {
      var self = this; clearTimeout(this._t);
      this._t = setTimeout(function () { self.save(); }, 400);
    },
    bytes: function () { try { return (localStorage.getItem(KEY) || '').length; } catch (e) { return 0; } },
    hasBackup: function () { try { return !!localStorage.getItem(BAK); } catch (e) { return false; } },
    journal: function (msg) {
      var j = this.state.journal; j.push({ t: Date.now(), msg: msg });
      if (j.length > 80) j.splice(0, j.length - 80);
      this.saveSoon();
    },
    reset: function () {
      try { localStorage.setItem(BAK, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
      this.state = fresh(); this.save();
    },
    newPlant: newPlant,
    /* ---------- seed packets ---------- */
    makePacket: function () {
      var st = JSON.parse(JSON.stringify(this.state));
      var body = JSON.stringify(st);
      return { kind: 'verdant.seedpacket', schema: SCHEMA, app: 'Verdant', exportedAt: new Date().toISOString(),
        gardener: st.name || 'Anonymous gardener', plants: st.plants.length, checksum: hash(body), garden: st };
    },
    readPacket: function (text) {
      var o = JSON.parse(text);
      var log = [];
      var warn = null;
      var g;
      if (o && o.kind === 'verdant.seedpacket' && o.garden) {
        if (o.checksum && hash(JSON.stringify(o.garden)) !== o.checksum) warn = 'The packet\u2019s checksum does not match — it may have been edited by hand. Sowing anyway.';
        g = o.garden;
      } else {
        g = o; // also accept a raw save (any version)
      }
      var st = migrate(g, log);
      return { state: st, log: log, warn: warn };
    },
    legacyDemo: function () {
      var t = Date.now() - 3 * 86400000;
      return { version: 1, savedAt: t, sound: false, garden: [
        { species: 'pothos', spot: 3, water: 40, size: 30, plantedAt: t - 5 * 86400000 },
        { species: 'snake', spot: 0, water: 20, size: 45, plantedAt: t - 9 * 86400000 },
        { species: 'basil', spot: 9, water: 60, size: 25, plantedAt: t - 2 * 86400000 },
        { species: 'bostonfern', spot: 7, water: 55, size: 35, plantedAt: t - 4 * 86400000 }
      ] };
    },
    hash: hash
  };

  V.store = store;
  V.uid = uid;
  V.clamp = clamp;
})();
