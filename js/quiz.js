/* Verdant — "Which plant suits my room?" quiz. */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return V.fmt.esc(s); };

  var Q = [
    { id: 'light', q: 'Where will your plant live?', a: [
      ['dim', 'A dim corner or a north-facing room', 'Low light'],
      ['medium', 'A few metres from a window', 'Medium light'],
      ['bright', 'Right by a bright window, no harsh sun', 'Bright, indirect'],
      ['sun', 'A sunny windowsill or balcony', 'Direct sun']] },
    { id: 'water', q: 'Be honest: how are you with watering?', a: [
      ['forget', 'I forget plants exist', 'Neglect-friendly'],
      ['weekly', 'Once a week, give or take', 'Steady'],
      ['daily', 'I love a daily little ritual', 'Doting']] },
    { id: 'pets', q: 'Any cats or dogs who like a nibble?', a: [
      ['yes', 'Yes — pet-safe plants only, please', 'Pet-safe'],
      ['no', 'No nibblers here', 'No pets']] },
    { id: 'air', q: 'What is the air like?', a: [
      ['steamy', 'Steamy — bathroom or kitchen', 'Humid'],
      ['normal', 'Normal room', 'Average'],
      ['dry', 'Dry — heating or air-con runs a lot', 'Dry']] },
    { id: 'space', q: 'How much space do you have?', a: [
      ['hang', 'Somewhere high — a shelf or a hanging pot', 'Trailing'],
      ['small', 'A desk or windowsill', 'Small'],
      ['floor', 'Floor space — I want a statement', 'Large'],
      ['any', 'Surprise me', 'Any size']] },
    { id: 'exp', q: 'Your plant experience?', a: [
      ['new', 'This is my first plant', 'Beginner'],
      ['some', 'I\u2019ve kept a few alive', 'Intermediate'],
      ['pro', 'Bring on the divas', 'Expert']] }
  ];
  var LIGHT = { dim: 0, medium: 1, bright: 2, sun: 3 };
  var ans = {}, step = 0;

  function score(sp) {
    var s = 0, why = [];
    var L = LIGHT[ans.light];
    if (L >= sp.light[0] && L <= sp.light[1]) { s += 6; why.push('happy in ' + V.LIGHT_NAMES[L].toLowerCase()); }
    else s -= 7;
    var d = sp.water.days;
    if (ans.water === 'forget') { s += d >= 12 ? 5 : d >= 8 ? 1 : -5; if (d >= 12) why.push('shrugs off forgotten waterings'); }
    if (ans.water === 'weekly') { s += d >= 6 && d <= 10 ? 4 : d > 10 ? 1 : -1; if (d >= 6 && d <= 10) why.push('fits a weekly routine'); }
    if (ans.water === 'daily') { s += d <= 5 ? 4 : d >= 12 ? -4 : 0; if (d <= 5) why.push('enjoys frequent attention'); }
    if (ans.pets === 'yes') { if (!sp.pets.safe) s -= 100; else why.push('pet-safe'); }
    if (ans.air === 'steamy') { s += sp.humid === 2 ? 4 : sp.humid === 1 ? 1 : -1; if (sp.humid === 2) why.push('loves humidity'); }
    if (ans.air === 'dry') { s += sp.humid === 0 ? 3 : sp.humid === 2 ? -4 : 0; if (sp.humid === 0) why.push('fine in dry air'); }
    if (ans.space === 'hang') { s += sp.trail ? 5 : sp.form.habit === 'spider' ? 4 : -1; if (sp.trail || sp.form.habit === 'spider') why.push('looks gorgeous trailing'); }
    if (ans.space === 'small') { s += sp.size === 's' ? 3 : sp.size === 'l' ? -4 : 0; if (sp.size === 's') why.push('compact'); }
    if (ans.space === 'floor') { s += sp.size === 'l' ? 5 : sp.size === 'm' ? 1 : -3; if (sp.size === 'l') why.push('makes a statement'); }
    if (ans.exp === 'new') { s += sp.diff === 1 ? 3 : sp.diff === 3 ? -5 : -1; if (sp.diff === 1) why.push('forgiving for beginners'); }
    if (ans.exp === 'some') s += sp.diff <= 2 ? 1 : 0;
    if (ans.exp === 'pro') { s += sp.diff === 3 ? 4 : sp.diff === 2 ? 2 : 0; if (sp.diff >= 2) why.push('a rewarding challenge'); }
    return { sp: sp, s: s, why: why };
  }

  function renderQ() {
    var box = $('#quizBox'), q = Q[step];
    var html = '<div class="quiz-progress" aria-hidden="true">' + Q.map(function (_, i) { return '<i class="' + (i < step ? 'done' : i === step ? 'cur' : '') + '"></i>'; }).join('') + '</div>' +
      '<p class="eyebrow">Question ' + (step + 1) + ' of ' + Q.length + '</p><h3 class="quiz-q" tabindex="-1" id="quizQ">' + esc(q.q) + '</h3><div class="quiz-opts" role="group" aria-labelledby="quizQ">';
    q.a.forEach(function (a) {
      html += '<button class="quiz-opt' + (ans[q.id] === a[0] ? ' chosen' : '') + '" data-v="' + a[0] + '"><span>' + esc(a[1]) + '</span><small>' + esc(a[2]) + '</small></button>';
    });
    html += '</div><div class="btn-row">' + (step ? '<button class="btn ghost" id="quizBack">\u2190 Back</button>' : '') + '</div>';
    box.innerHTML = html;
    box.classList.remove('turn'); void box.offsetWidth; box.classList.add('turn');
    Array.prototype.forEach.call(box.querySelectorAll('.quiz-opt'), function (b) {
      b.addEventListener('click', function () {
        ans[q.id] = b.dataset.v; V.audio.play('tick');
        step++; if (step >= Q.length) results(); else renderQ();
        var h = $('#quizQ'); if (h) h.focus();
      });
    });
    var back = $('#quizBack'); if (back) back.addEventListener('click', function () { step--; renderQ(); });
  }

  function results() {
    var ranked = V.SPECIES.map(score).sort(function (a, b) { return b.s - a.s; });
    var top = ranked.slice(0, 3).filter(function (r) { return r.s > -50; });
    var box = $('#quizBox');
    var html = '<p class="eyebrow">Your matches</p><h3 class="quiz-q" tabindex="-1" id="quizQ">' + (top.length && top[0].s > 8 ? 'We found your plant soulmates' : 'Tricky room! These have the best chance') + '</h3><div class="quiz-results">';
    top.forEach(function (r, i) {
      html += '<div class="match"><span class="rank">' + (i + 1) + '</span><canvas data-sp="' + r.sp.id + '" aria-hidden="true"></canvas><div><h4>' + esc(r.sp.name) + '</h4><p class="latin">' + esc(r.sp.latin) + '</p>' +
        '<p class="why">' + esc(r.why.slice(0, 3).join(' \u00b7 ') || 'a solid all-rounder') + '</p>' +
        '<div class="btn-row"><button class="btn small" data-plant="' + r.sp.id + '">Plant it</button><button class="btn small ghost" data-read="' + r.sp.id + '">Read more</button></div></div></div>';
    });
    html += '</div><p class="fine">' + (ans.pets === 'yes' ? 'Only plants regarded as non-toxic to cats & dogs were considered. ' : '') + 'Matches are friendly suggestions, not botanical prophecy.</p><div class="btn-row"><button class="btn ghost" id="quizRestart">Take it again</button></div>';
    box.innerHTML = html;
    box.classList.remove('turn'); void box.offsetWidth; box.classList.add('turn');
    Array.prototype.forEach.call(box.querySelectorAll('.match canvas'), function (c, i) { V.art.drawSpecimen(c, 110, 126, V.SPECIES_BY_ID[c.dataset.sp], 1, 500 + i); });
    Array.prototype.forEach.call(box.querySelectorAll('[data-plant]'), function (b) { b.addEventListener('click', function () { V.garden.plantSpecies(b.dataset.plant); }); });
    Array.prototype.forEach.call(box.querySelectorAll('[data-read]'), function (b) { b.addEventListener('click', function () { V.library.open(b.dataset.read); }); });
    $('#quizRestart').addEventListener('click', function () { ans = {}; step = 0; renderQ(); });
    V.audio.play('chime');
  }

  V.quiz = { init: function () { renderQ(); } };
})();
