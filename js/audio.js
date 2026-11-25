/* Verdant — synthesized sounds (Web Audio). Muted until the user turns sound on. */
(function () {
  'use strict';
  var V = window.V = window.V || {};
  var ctx = null, master = null, noiseBuf = null, enabled = false, ambient = null, pourNode = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function noise(loop) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; return s; }
  function env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }
  function tone(freq, dur, type, vol, when, glideTo) {
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    env(g, t, 0.01, vol || 0.2, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  var SFX = {
    tick: function () { tone(1320, 0.05, 'triangle', 0.06); },
    plant: function () {
      var t = ctx.currentTime, n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 500; env(g, t, 0.005, 0.35, 0.25);
      n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.3);
      [523.25, 659.25, 783.99].forEach(function (fr, i) { tone(fr, 0.5, 'sine', 0.09, 0.12 + i * 0.09); });
    },
    snip: function () {
      for (var i = 0; i < 2; i++) {
        var t = ctx.currentTime + i * 0.07, n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'highpass'; f.frequency.value = 3500; env(g, t, 0.002, 0.4, 0.05);
        n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.08);
      }
      tone(2400, 0.04, 'square', 0.03, 0.02);
    },
    mist: function () {
      var t = ctx.currentTime, n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 6000; f.Q.value = 0.8; env(g, t, 0.02, 0.18, 0.35);
      n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.4);
    },
    feed: function () { [392, 494, 587].forEach(function (fr, i) { tone(fr, 0.25, 'triangle', 0.07, i * 0.06); }); },
    chime: function () { [659.25, 783.99, 987.77, 1318.5].forEach(function (fr, i) { tone(fr, 1.1, 'sine', 0.07, i * 0.12); }); },
    sad: function () { tone(330, 0.3, 'sine', 0.08, 0, 247); },
    bird: function () {
      var base = 2200 + Math.random() * 1200;
      for (var i = 0; i < 3; i++) tone(base, 0.09, 'sine', 0.05, i * 0.13, base * (1.25 + Math.random() * .3));
    },
    magic: function () { for (var i = 0; i < 8; i++) tone(880 * Math.pow(2, i / 7), 0.4, 'sine', 0.05, i * 0.06); },
    page: function () {
      var t = ctx.currentTime, n = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 0.5; env(g, t, 0.03, 0.08, 0.18);
      n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.25);
    }
  };

  var audio = {
    get on() { return enabled; },
    unlock: function () { if (enabled) ensure(); },
    setEnabled: function (v) {
      enabled = !!v;
      if (enabled) ensure();
      if (!enabled) { this.stopPour(); this.setAmbient(null); }
    },
    play: function (name) {
      if (!enabled || !ensure() || !SFX[name]) return;
      try { SFX[name](); } catch (e) { /* never break the garden for a sound */ }
    },
    startPour: function () {
      if (!enabled || !ensure() || pourNode) return;
      var n = noise(true), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2; f2.type = 'lowpass'; f2.frequency.value = 2500;
      lfo.frequency.value = 7; lg.gain.value = 300; lfo.connect(lg); lg.connect(f.frequency);
      g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.12);
      n.connect(f); f.connect(f2); f2.connect(g); g.connect(master); n.start(); lfo.start();
      pourNode = { n: n, g: g, lfo: lfo };
    },
    stopPour: function () {
      if (!pourNode || !ctx) { pourNode = null; return; }
      var p = pourNode; pourNode = null;
      try { p.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06); p.n.stop(ctx.currentTime + 0.3); p.lfo.stop(ctx.currentTime + 0.3); } catch (e) { /* ignore */ }
    },
    /* ambient bed: 'day' (birds), 'night' (crickets), 'rain' */
    setAmbient: function (kind) {
      if (ambient && ambient.kind === kind) return;
      if (ambient) { try { ambient.stop(); } catch (e) { /* ignore */ } ambient = null; }
      if (!kind || !enabled || !ensure()) return;
      var timers = [], nodes = [];
      if (kind === 'rain') {
        var n = noise(true), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.value = 1400; g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 1.5);
        n.connect(f); f.connect(g); g.connect(master); n.start(); nodes.push(n);
        timers.push(setInterval(function () { if (Math.random() < .5) tone(1800 + Math.random() * 1500, 0.03, 'sine', 0.02); }, 180));
      } else if (kind === 'day') {
        timers.push(setInterval(function () { if (Math.random() < .35) SFX.bird(); }, 2600));
      } else if (kind === 'night') {
        timers.push(setInterval(function () {
          for (var i = 0; i < 3; i++) tone(4300, 0.025, 'sine', 0.018, i * 0.05);
        }, 900));
      }
      ambient = { kind: kind, stop: function () { timers.forEach(clearInterval); nodes.forEach(function (x) { try { x.stop(); } catch (e) { /* ignore */ } }); } };
    }
  };
  V.audio = audio;
})();
