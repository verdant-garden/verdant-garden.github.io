/* Verdant — the living simulation: seasons, simulated weather, day/night, and
   hour-by-hour growth computed from time deltas (so plants grow while you are away). */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var HOUR = 3600000, DAY = 86400000;
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };

  var SEASONS = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
  var FLIP = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' };
  function seasonAt(ts, hemi) {
    var s = SEASONS[new Date(ts).getMonth()];
    return hemi === 'S' ? FLIP[s] : s;
  }

  function hash32(n) {
    n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }

  var W_TABLE = {
    spring: [['sun', .38], ['cloud', .27], ['drizzle', .15], ['rain', .14], ['storm', .03], ['fog', .03]],
    summer: [['sun', .55], ['cloud', .2], ['drizzle', .07], ['rain', .09], ['storm', .09]],
    autumn: [['sun', .27], ['cloud', .3], ['drizzle', .14], ['rain', .17], ['fog', .08], ['storm', .04]],
    winter: [['sun', .25], ['cloud', .3], ['snow', .17], ['frost', .13], ['rain', .1], ['fog', .05]]
  };
  var W_LABEL = { sun: 'Sunny', cloud: 'Cloudy', drizzle: 'Drizzle', rain: 'Rain', storm: 'Thunderstorm', fog: 'Misty', snow: 'Snow', frost: 'Frosty' };
  var W_ICON = { sun: '\u2600\ufe0e', cloud: '\u2601\ufe0e', drizzle: '\u2602\ufe0e', rain: '\u2602\ufe0e', storm: '\u26a1\ufe0e', fog: '\u2248', snow: '\u2744\ufe0e', frost: '\u2744\ufe0e' };

  /* weather changes in 3-hour blocks, deterministic from the date (so it is the same on every device) */
  function weatherAt(ts, hemi) {
    var block = Math.floor(ts / (3 * HOUR));
    var season = seasonAt(ts, hemi);
    var r = hash32(block * 7919 + 13);
    var table = W_TABLE[season], acc = 0, kind = table[0][0];
    for (var i = 0; i < table.length; i++) { acc += table[i][1]; if (r <= acc) { kind = table[i][0]; break; } }
    var h = new Date(ts).getHours();
    if (kind === 'frost' && h > 11 && h < 17) kind = 'cloud';
    return { kind: kind, label: W_LABEL[kind], icon: W_ICON[kind], season: season,
      wet: kind === 'rain' || kind === 'drizzle' || kind === 'storm' || kind === 'snow',
      intensity: kind === 'storm' ? 1 : kind === 'rain' ? .7 : kind === 'drizzle' ? .35 : kind === 'snow' ? .6 : 0,
      wind: hash32(block * 31 + 7) };
  }

  /* simple sunrise/sunset model (labelled as approximate in the UI) */
  function sunTimes(ts, hemi) {
    var d = new Date(ts);
    var start = new Date(d.getFullYear(), 0, 0);
    var doy = Math.floor((d - start) / DAY);
    var swing = Math.cos(((doy - 172) / 365) * 2 * Math.PI) * 1.6; // longest day ~ late June (north)
    if (hemi === 'S') swing = -swing;
    return { rise: 6.25 - swing, set: 18.25 + swing };
  }
  function dayPhase(ts, hemi) {
    var d = new Date(ts), h = d.getHours() + d.getMinutes() / 60, st = sunTimes(ts, hemi);
    if (h < st.rise - 0.7 || h >= st.set + 1) return 'night';
    if (h < st.rise + 1) return 'dawn';
    if (h < 12) return 'morning';
    if (h < st.set - 1.5) return 'afternoon';
    return 'evening';
  }
  function isNight(ts, hemi) {
    var d = new Date(ts), h = d.getHours() + d.getMinutes() / 60, st = sunTimes(ts, hemi);
    return h < st.rise - 0.3 || h > st.set + 0.4;
  }

  var SYN = 29.530588853;
  function moonPhase(ts) {
    var ref = Date.UTC(2000, 0, 6, 18, 14);
    var age = (((ts - ref) / DAY) % SYN + SYN) % SYN;
    var f = age / SYN;
    var names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    return { age: age, frac: f, name: names[Math.floor(f * 8 + 0.5) % 8], illum: (1 - Math.cos(2 * Math.PI * f)) / 2 };
  }

  var GROW = { spring: 1.15, summer: 1.25, autumn: .8, winter: .45 };
  var DRY = { spring: 1, summer: 1.3, autumn: .85, winter: .65 };
  var BLOOM_SEASON = { xmascactus: ['autumn', 'winter'], orchid: ['winter', 'spring'], peacelily: 0, violet: 0, hoya: ['spring', 'summer'] };

  function zoneOf(id) { for (var i = 0; i < V.ZONES.length; i++) if (V.ZONES[i].id === id) return V.ZONES[i]; return V.ZONES[0]; }
  function lightDiff(sp, zone) {
    var L = zone.light;
    return L < sp.light[0] ? sp.light[0] - L : L > sp.light[1] ? L - sp.light[1] : 0;
  }
  function dryRate(sp, zone, season) {
    return 0.7 / (sp.water.days * 24) * DRY[season] * (zone.outdoor ? 1.25 : 1);
  }

  function stepPlant(p, ts, hours, hemi, rep) {
    var sp = V.SPECIES_BY_ID[p.sp]; if (!sp) return;
    var zone = zoneOf(p.zone);
    var season = seasonAt(ts, hemi);
    var w = weatherAt(ts, hemi);
    var night = isNight(ts, hemi);
    var d = lightDiff(sp, zone);
    var lf = d === 0 ? 1 : d === 1 ? .55 : .25;

    // water balance
    p.hyd -= dryRate(sp, zone, season) * hours;
    if (zone.outdoor && w.wet) {
      var add = (w.kind === 'storm' ? .08 : w.kind === 'rain' ? .05 : w.kind === 'snow' ? .01 : .025) * hours;
      if (p.hyd < 1) { var before = p.hyd; p.hyd = Math.min(1, p.hyd + add); if (rep) rep.rain += p.hyd - before; }
    }
    if (p.hyd > 1) p.hyd -= 0.004 * hours; // saucer slowly drains
    p.hyd = clamp(p.hyd, 0, 1.4);

    // health
    var hurt = 0;
    if (p.hyd < 0.15) hurt += 0.006;
    if (p.hyd > 1.05) hurt += 0.004 * (sp.water.days >= 12 ? 2.5 : 1);
    if (d >= 2) hurt += 0.0015;
    var misted = ts - (p.lastMist || 0) < DAY;
    if (sp.humid === 2 && !zone.outdoor && ts - (p.lastMist || 0) > 3 * DAY) hurt += 0.0005;
    if (zone.outdoor && (w.kind === 'frost' || w.kind === 'snow') && !sp.hardy) { hurt += 0.01; if (rep) rep.frost = true; }
    if (hurt) p.health -= hurt * hours; else p.health += 0.003 * hours;
    p.health = clamp(p.health, 0.05, 1);

    // growth
    var wf = p.hyd < 0.15 ? 0 : p.hyd < 0.3 ? .5 : p.hyd > 1.05 ? .6 : 1;
    var fed = (p.fedUntil || 0) > ts ? 1.25 : 1;
    var rate = 1 / (sp.matureDays * 24) * lf * GROW[season] * wf * (0.3 + 0.7 * p.health) * fed * (misted ? 1.08 : 1) * (night ? .8 : 1) * (1 - 0.04 * Math.min(p.yellow, 6));
    if (p.golden) rate *= 1.15;
    p.growth = clamp(p.growth + rate * hours, 0, 1);

    // old leaves yellow over time, faster under stress
    var stress = (p.hyd < 0.15 || p.hyd > 1.05 || d >= 2) ? 1 / 14 : 0;
    p.yAcc = (p.yAcc || 0) + (1 / 70 + stress) * hours * (p.growth > .15 ? 1 : 0);
    while (p.yAcc >= 1) { p.yAcc -= 1; if (p.yellow < 6) { p.yellow++; if (rep) rep.yellow++; } }

    // flowering
    if (sp.form.bloom) {
      var bs = BLOOM_SEASON[sp.id];
      var okSeason = bs === 0 || (bs ? bs.indexOf(season) >= 0 : (season === 'spring' || season === 'summer'));
      var nb = p.growth > 0.72 && p.health > 0.55 && okSeason && d <= 1;
      if (nb && !p.bloom && rep) rep.bloomed = true;
      p.bloom = nb;
    }
    if (rep && p.hyd < 0.3 && !rep.thirstyAt) rep.thirstyAt = ts;
  }

  /* simulate from -> to (ms). Returns per-plant reports. Capped at 90 days. */
  function simulate(state, from, to, opts) {
    opts = opts || {};
    var hemi = state.settings.hemi;
    var span = Math.min(to - from, 90 * DAY);
    if (span <= 0) return [];
    var t = to - span;
    var reports = state.plants.map(function (p) {
      return { id: p.id, g0: p.growth, h0: p.health, rain: 0, yellow: 0, frost: false, bloomed: false, thirstyAt: 0 };
    });
    while (t < to) {
      var step = Math.min(HOUR, to - t);
      var hours = step / HOUR;
      var mid = opts.fixedTime ? opts.fixedTime : t + step / 2;
      for (var i = 0; i < state.plants.length; i++) stepPlant(state.plants[i], mid, hours, hemi, reports[i]);
      t += step;
    }
    reports.forEach(function (r, i) { var p = state.plants[i]; r.g1 = p.growth; r.h1 = p.health; });
    return reports;
  }

  function status(p) {
    var sp = V.SPECIES_BY_ID[p.sp];
    if (p.health < 0.25) return { key: 'sulk', text: 'Sulking dramatically', tone: 'bad' };
    if (p.hyd < 0.15) return { key: 'parched', text: 'Parched — water me!', tone: 'bad' };
    if (p.hyd > 1.05) return { key: 'soggy', text: sp.water.days >= 12 ? 'Soggy roots — let me dry out' : 'A bit waterlogged', tone: 'warn' };
    if (p.hyd < 0.3) return { key: 'thirsty', text: 'Getting thirsty', tone: 'warn' };
    if (p.yellow >= 3) return { key: 'tidy', text: 'Could use a trim', tone: 'warn' };
    if (p.bloom) return { key: 'bloom', text: 'In flower!', tone: 'good' };
    if (p.growth >= 1) return { key: 'mature', text: 'Fully grown & proud', tone: 'good' };
    return { key: 'happy', text: 'Happy & growing', tone: 'good' };
  }

  /* hours until the plant reaches the "needs water" level at today's drying rate */
  function hoursUntilThirsty(p, ts, hemi) {
    var sp = V.SPECIES_BY_ID[p.sp], zone = zoneOf(p.zone);
    var r = dryRate(sp, zone, seasonAt(ts, hemi));
    return Math.max(0, (p.hyd - 0.3) / r);
  }

  V.sim = { HOUR: HOUR, DAY: DAY, seasonAt: seasonAt, weatherAt: weatherAt, sunTimes: sunTimes, dayPhase: dayPhase,
    isNight: isNight, moonPhase: moonPhase, simulate: simulate, status: status, lightDiff: lightDiff, zoneOf: zoneOf,
    hoursUntilThirsty: hoursUntilThirsty, dryRate: dryRate, hash32: hash32 };
})();
