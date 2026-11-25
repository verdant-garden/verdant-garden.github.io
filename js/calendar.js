/* Verdant — care calendar, reminders (optional Notification API) and .ics export. */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var $ = function (s) { return document.querySelector(s); };
  var DAY = 86400000, HOUR = 3600000;
  var view = new Date(); view.setDate(1);
  var selDay = null, toastedThisSession = {};
  var COLORS = ['#5f9a5c', '#c97a5c', '#7f93b0', '#d9a86a', '#8c6bc2', '#4f8a8a', '#b8577a', '#8a9a3a', '#6a7fd0', '#c4554a', '#3f7a45', '#a07040'];
  var DRY = { spring: 1, summer: 1.3, autumn: 0.85, winter: 0.65 };

  function S() { return V.store.state; }
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

  /* predicted events for a plant between [from, to) */
  function events(p, idx, from, to) {
    var sp = V.SPECIES_BY_ID[p.sp], out = [], now = Date.now(), hemi = S().settings.hemi;
    var nm = p.nick || sp.name, col = COLORS[idx % COLORS.length];
    if (p.lastWater >= from && p.lastWater < to) out.push({ t: p.lastWater, kind: 'watered', name: nm, col: col, p: p });
    var due = now + V.sim.hoursUntilThirsty(p, now, hemi) * HOUR, guard = 0;
    while (due < to && guard++ < 60) {
      if (due >= from) out.push({ t: due, kind: 'water', name: nm, col: col, p: p });
      var season = V.sim.seasonAt(due, hemi);
      due += Math.max(1, Math.round(sp.water.days / DRY[season] * (V.sim.zoneOf(p.zone).outdoor ? 0.8 : 1))) * DAY;
    }
    if (!sp.noFeed) {
      var f = Math.max(now, (p.lastFeed || 0) + 28 * DAY); guard = 0;
      while (f < to && guard++ < 12) {
        var ss = V.sim.seasonAt(f, hemi);
        if (f >= from && (ss === 'spring' || ss === 'summer')) out.push({ t: f, kind: 'feed', name: nm, col: col, p: p });
        f += 28 * DAY;
      }
    }
    if (sp.humid === 2 && !V.sim.zoneOf(p.zone).outdoor) {
      var m = Math.max(now, (p.lastMist || 0) + 3 * DAY); guard = 0;
      while (m < to && guard++ < 20) { if (m >= from) out.push({ t: m, kind: 'mist', name: nm, col: col, p: p }); m += 3 * DAY; }
    }
    return out;
  }

  function render() {
    var st = S(), y = view.getFullYear(), mo = view.getMonth();
    $('#calTitle').textContent = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    var first = new Date(y, mo, 1), startDow = (first.getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
    var from = first.getTime(), to = new Date(y, mo + 1, 1).getTime();
    var byDay = {};
    st.plants.forEach(function (p, i) {
      events(p, i, from, to).forEach(function (e) { var k = dayKey(new Date(e.t)); (byDay[k] = byDay[k] || []).push(e); });
    });
    var grid = $('#calGrid'), html = '', today = dayKey(new Date());
    for (var b = 0; b < startDow; b++) html += '<span class="cal-cell blank" aria-hidden="true"></span>';
    for (var d = 1; d <= days; d++) {
      var dt = new Date(y, mo, d), k = dayKey(dt), evs = byDay[k] || [];
      var dots = evs.slice(0, 5).map(function (e) { return '<i class="ev ' + e.kind + '" style="--c:' + e.col + '" title="' + V.fmt.esc(e.kind + ': ' + e.name) + '"></i>'; }).join('');
      if (evs.length > 5) dots += '<em>+' + (evs.length - 5) + '</em>';
      var lbl = dt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + (evs.length ? ', ' + evs.length + ' care tasks' : ', nothing planned');
      html += '<button class="cal-cell' + (k === today ? ' today' : '') + (k === selDay ? ' sel' : '') + (evs.length ? ' busy' : '') + '" data-day="' + k + '" aria-label="' + V.fmt.esc(lbl) + '"><b>' + d + '</b><span class="dots">' + dots + '</span></button>';
    }
    grid.innerHTML = html;
    Array.prototype.forEach.call(grid.querySelectorAll('.cal-cell[data-day]'), function (c) {
      c.addEventListener('click', function () { selDay = c.dataset.day; render(); });
    });
    var leg = '<div class="legend"><span><i class="ev water"></i>Water (predicted)</span><span><i class="ev watered"></i>Watered</span><span><i class="ev feed"></i>Feed</span><span><i class="ev mist"></i>Mist</span></div>';
    if (selDay && byDay[selDay]) {
      leg += '<ul class="day-list">' + byDay[selDay].sort(function (a, b) { return a.t - b.t; }).map(function (e) {
        var verb = { water: 'Water', watered: 'Watered', feed: 'Feed', mist: 'Mist' }[e.kind];
        return '<li><i class="sw" style="background:' + e.col + '"></i>' + verb + ' <b>' + V.fmt.esc(e.name) + '</b>' + (e.p.real ? ' \u2605' : '') + '</li>';
      }).join('') + '</ul>';
    } else if (selDay) leg += '<p class="fine">Nothing planned that day. A rest day for everyone.</p>';
    if (!st.plants.length) leg += '<p class="empty-note hand">No plants, no chores. Suspiciously relaxing. Plant something in the garden first!</p>';
    $('#calLegend').innerHTML = leg;
    renderReminders();
  }

  function renderReminders() {
    var st = S(), now = Date.now(), hemi = st.settings.hemi;
    var items = st.plants.map(function (p) {
      var sp = V.SPECIES_BY_ID[p.sp];
      return { p: p, sp: sp, h: p.hyd < 0.3 ? 0 : V.sim.hoursUntilThirsty(p, now, hemi) };
    }).sort(function (a, b) { return a.h - b.h; });
    var box = $('#remindList');
    if (!items.length) { box.innerHTML = '<p class="empty-note hand">Your reminder list is emptier than a cactus\u2019s water bill.</p>'; return; }
    box.innerHTML = items.map(function (it) {
      var nm = V.fmt.esc(it.p.nick || it.sp.name);
      var due = it.h <= 0 ? '<b class="due now">Water now</b>' : it.h < 24 ? '<b class="due soon">in ' + V.fmt.dur(it.h * HOUR) + '</b>' : '<span class="due">in ' + V.fmt.dur(it.h * HOUR) + '</span>';
      return '<div class="remind"><span class="r-name">' + nm + (it.p.real ? ' <span class="real-star" title="Real plant">\u2605</span>' : '') + '<small>' + V.fmt.esc(it.sp.latin) + ' \u00b7 ' + V.fmt.esc(V.sim.zoneOf(it.p.zone).name) + '</small></span>' + due +
        '<button class="btn small ghost r-go" data-id="' + it.p.id + '" aria-label="Show ' + nm + ' in the garden">Go</button></div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.r-go'), function (b) {
      b.addEventListener('click', function () { V.app.go('garden'); V.garden.select(b.dataset.id); });
    });
    var nb = $('#notifyBtn');
    var perm = ('Notification' in window) ? Notification.permission : 'unsupported';
    nb.textContent = perm === 'unsupported' ? 'Notifications unsupported here' : st.settings.notify && perm === 'granted' ? 'Reminders on \u2713 (tap to turn off)' : perm === 'denied' ? 'Notifications blocked in browser' : 'Enable reminders';
    nb.disabled = perm === 'unsupported' || perm === 'denied';
  }

  function checkReminders() {
    var st = S(), thirsty = 0, now = Date.now();
    st.plants.forEach(function (p) {
      if (p.hyd >= 0.3) return;
      thirsty++;
      var sp = V.SPECIES_BY_ID[p.sp], nm = p.nick || sp.name;
      if (!p.notified || now - p.notified > 12 * HOUR) {
        if (st.settings.notify && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification('Verdant \u2014 thirsty plant', { body: nm + ' would love a drink. ' + sp.water.text, icon: 'favicon.svg', tag: 'verdant-' + p.id }); } catch (e) { /* some mobile browsers only allow SW notifications */ }
        }
        p.notified = now;
      }
      if (!toastedThisSession[p.id] && V.ui) { toastedThisSession[p.id] = 1; V.ui.toast(nm + ' is thirsty. \u{1F4A7}', 'warn'); }
    });
    document.title = (thirsty ? '(' + thirsty + ') ' : '') + 'Verdant \u2014 grow a living garden';
  }

  function toggleNotify() {
    var st = S();
    if (!('Notification' in window)) { V.ui.toast('This browser doesn\u2019t support notifications. In-page reminders still work.', 'warn'); return; }
    if (st.settings.notify && Notification.permission === 'granted') { st.settings.notify = false; V.store.save(); renderReminders(); V.ui.toast('Reminders off. The plants will just stare at you instead.'); return; }
    var answered = false;
    var done = function (perm) {
      if (answered) return; answered = true;
      st.settings.notify = perm === 'granted'; V.store.save(); renderReminders();
      V.ui.toast(perm === 'granted' ? 'Reminders on! Keep a Verdant tab open and we\u2019ll nudge you.' : 'No worries — you\u2019ll still see reminders here.', perm === 'granted' ? 'good' : 'warn');
    };
    try { var pr = Notification.requestPermission(done); if (pr && pr.then) pr.then(done); } catch (e) { done('default'); }
  }

  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); }
  function ymd(ts) { var d = new Date(ts); return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
  function exportIcs() {
    var st = S();
    if (!st.plants.length) { V.ui.toast('Nothing to schedule yet — plant something first.', 'warn'); return; }
    var now = Date.now(), lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Verdant//Plant care//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Verdant plant care'];
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    st.plants.forEach(function (p) {
      var sp = V.SPECIES_BY_ID[p.sp], due = now + V.sim.hoursUntilThirsty(p, now, st.settings.hemi) * HOUR;
      var start = ymd(due), end = ymd(startOfDay(due) + DAY + HOUR);
      lines.push('BEGIN:VEVENT', 'UID:' + p.id + '-water@verdant', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + start, 'DTEND;VALUE=DATE:' + end,
        'RRULE:FREQ=DAILY;INTERVAL=' + sp.water.days + ';COUNT=12',
        'SUMMARY:' + icsEsc('Check & water ' + (p.nick || sp.name) + ' \u{1F331}'),
        'DESCRIPTION:' + icsEsc(sp.water.text + ' (Interval is a rule of thumb — feel the soil first.)'),
        'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    V.app.download(blob, 'verdant-care.ics');
    V.ui.toast('Calendar file ready. Your plants now have a PA.', 'good');
  }

  V.calendar = {
    init: function () {
      $('#calPrev').addEventListener('click', function () { view.setMonth(view.getMonth() - 1); selDay = null; render(); V.audio.play('page'); });
      $('#calNext').addEventListener('click', function () { view.setMonth(view.getMonth() + 1); selDay = null; render(); V.audio.play('page'); });
      $('#notifyBtn').addEventListener('click', toggleNotify);
      $('#icsBtn').addEventListener('click', exportIcs);
      selDay = dayKey(new Date());
      render();
    },
    refresh: function () { if (V.app && V.app.view === 'calendar') render(); else renderReminders(); },
    render: render, checkReminders: checkReminders
  };
})();
