/*!
 * sfx.js — every sound is synthesised live with the Web Audio API (no files).
 * Sound is ON by default (the visitor can mute it in the nav; the choice is
 * remembered in localStorage "meg:sound"). Browsers still block audio until the
 * first user gesture, so we try to start right away and resume on the first tap/key.
 */
(function () {
  'use strict';
  var ctx = null, master = null, noiseBuf = null, last = {};
  var muted = false;
  try { muted = localStorage.getItem('meg:sound') === 'off'; } catch (e) {}

  function unlock() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.42;
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        master.connect(comp);
        comp.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        ctx.onstatechange = function () { document.dispatchEvent(new CustomEvent('meg:sound', { detail: !muted && ctx.state === 'running' })); };
      } catch (e) { ctx = null; return; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
  }
  var ok = function () { return ctx && !muted && ctx.state === 'running'; };
  var gap = function (k, ms) { var n = performance.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; };
  function env(g, t0, a, dur, v) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  function tone(o) {
    if (!ok()) return;
    var f = o.f || 440, f2 = o.f2, t = o.t || 0.12, v = o.v || 0.2, a = o.a || 0.004, d = o.d || 0;
    var t0 = ctx.currentTime + d, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + t);
    env(g, t0, a, t, v);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + t + 0.05);
  }
  function noise(o) {
    if (!ok()) return;
    var t = o.t || 0.1, v = o.v || 0.2, a = o.a || 0.003, d = o.d || 0;
    var t0 = ctx.currentTime + d, src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    fl.type = o.type || 'bandpass';
    fl.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t0 + t);
    fl.Q.value = o.q || 1;
    env(g, t0, a, t, v);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + t + 0.05);
  }

  var S = {
    key: function () { if (gap('key', 42)) noise({ t: 0.028, v: 0.07, type: 'highpass', f: 2600 + Math.random() * 1500 }); },
    soft: function () { if (gap('soft', 70)) noise({ t: 0.025, v: 0.035, type: 'highpass', f: 3500 }); },
    tick: function () { tone({ f: 1900, t: 0.025, v: 0.05, type: 'square' }); },
    click: function () { noise({ t: 0.03, v: 0.18, type: 'highpass', f: 1800 }); tone({ f: 2400, t: 0.02, v: 0.05, type: 'square' }); },
    glitch: function (k) { k = k || 1; noise({ t: 0.09 + 0.08 * k, v: 0.2, f: 600 + Math.random() * 3000, q: 3 }); tone({ f: 50 + Math.random() * 90, type: 'sawtooth', t: 0.08 + 0.05 * k, v: 0.09 }); },
    ping: function () { tone({ f: 1320, f2: 1760, t: 0.18, v: 0.1 }); },
    notify: function () { tone({ f: 880, t: 0.09, v: 0.11 }); tone({ f: 1318, t: 0.16, v: 0.09, d: 0.08 }); },
    statik: function (t) { noise({ t: t || 0.9, v: 0.07, type: 'highpass', f: 3000 }); },
    alarm: function () { tone({ f: 720, f2: 1150, type: 'sawtooth', t: 0.44, v: 0.075 }); tone({ f: 1150, f2: 720, type: 'sawtooth', t: 0.44, v: 0.075, d: 0.45 }); },
    count: function (n) { if (n) tone({ f: 1046, t: 0.14, v: 0.16, type: 'square' }); else tone({ f: 262, t: 0.6, v: 0.18, type: 'square' }); },
    panic: function () { tone({ f: 55, type: 'sawtooth', t: 0.9, v: 0.16 }); noise({ t: 0.6, v: 0.12, type: 'lowpass', f: 500 }); },
    crack: function () {
      noise({ t: 0.4, v: 0.55, type: 'highpass', f: 1400, a: 0.001 });
      for (var i = 0; i < 7; i++) noise({ t: 0.035, v: 0.28, type: 'highpass', f: 3000, d: i * 0.028 + Math.random() * 0.03 });
      tone({ f: 3400, f2: 500, t: 0.18, v: 0.08, type: 'triangle' });
    },
    whoosh: function (up, t, v) { up = up !== false; t = t || 0.9; noise({ t: t, v: v || 0.14, f: up ? 250 : 3200, f2: up ? 3600 : 220, q: 0.9, a: t * 0.4 }); },
    chime: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, t: 0.7, v: 0.08, d: i * 0.09 }); }); },
    success: function () { tone({ f: 880, t: 0.12, v: 0.1 }); tone({ f: 1318, t: 0.25, v: 0.1, d: 0.1 }); },
    error: function () { tone({ f: 233, type: 'square', t: 0.17, v: 0.12 }); tone({ f: 175, type: 'square', t: 0.32, v: 0.12, d: 0.17 }); },
    buzz: function (t) { t = t || 0.9; tone({ f: 110, type: 'sawtooth', t: t, v: 0.09, a: 0.001 }); tone({ f: 111.6, type: 'square', t: t, v: 0.05, a: 0.001 }); },
    rumble: function (t) { noise({ t: t || 0.6, v: 0.18, type: 'lowpass', f: 180 }); },
    thud: function (size) {
      if (!gap('thud', 28)) return;
      var s = Math.max(0.2, Math.min(1.5, size || 0.5));
      tone({ f: 80 + Math.random() * 70 / s, f2: 38, t: 0.13, v: Math.min(0.3, 0.06 + s * 0.12) });
      noise({ t: 0.05, v: 0.05 + 0.06 * s, type: 'lowpass', f: 900 });
    },
    post: function () { tone({ f: 1000, t: 0.2, v: 0.14, type: 'square' }); },
    hdd: function () { noise({ t: 0.014, v: 0.1, f: 2600, q: 5 }); },
    lock: function () { if (gap('lock', 35)) tone({ f: 1500 + Math.random() * 300, t: 0.05, v: 0.06, type: 'triangle' }); },
    power: function () { tone({ f: 110, f2: 880, t: 0.65, v: 0.12 }); noise({ t: 0.6, v: 0.06, f: 400, f2: 3000, a: 0.25 }); },
    zap: function () { tone({ f: 2600, f2: 160, type: 'sawtooth', t: 0.35, v: 0.09 }); },
    radar: function () { if (gap('radar', 500)) tone({ f: 2100, f2: 1650, t: 0.22, v: 0.06 }); },
    blip: function () { if (gap('blip', 55)) tone({ f: 1500 + Math.random() * 500, t: 0.022, v: 0.03, type: 'square' }); }
  };

  function setMute(m) {
    muted = !!m;
    try { localStorage.setItem('meg:sound', muted ? 'off' : 'on'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.42, ctx.currentTime, 0.05);
    document.dispatchEvent(new CustomEvent('meg:sound', { detail: !muted }));
  }
  // Any gesture may (re)start the context; it stays silent only if the visitor muted it.
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { addEventListener(ev, unlock, { passive: true, capture: true }); });
  // Try right away: plays from the first second wherever the browser allows autoplay.
  if (!muted) { try { unlock(); } catch (e) {} }

  window.SFX = Object.assign({
    unlock: unlock,
    setMute: setMute,
    get muted() { return muted; },
    get running() { return !!ctx && ctx.state === 'running'; }
  }, S);
})();
