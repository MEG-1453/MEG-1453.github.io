/*!
 * fx.js — intro (Linux boot → fake intrusion → "3 seconds" joke → doors),
 * handwritten notes, keyboard typing, live audit, camera HUD.
 * Zero dependencies. Respects prefers-reduced-motion. Nothing leaves the
 * browser: the "fingerprint" only reads what the visitor's own browser exposes
 * and shows it back to them; no camera is ever requested.
 * URL: ?boot=1 force the intro · ?boot=0 skip it
 */
(function () {
  'use strict';

  var root = document.documentElement;
  window.__megFx = true;
  var MEG = window.MEG = window.MEG || {};
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var raf = function (f) { return requestAnimationFrame(f); };
  var pad = function (n, l) { return String(n).padStart(l || 2, '0'); };
  var lang = function () { return (MEG.lang || root.getAttribute('data-lang')) === 'en' ? 'en' : 'tr'; };
  var x = function (tr, en) { return lang() === 'en' ? en : tr; };
  var canAnimate = typeof Element.prototype.animate === 'function';
  var narrow = function () { return innerWidth < 760; };

  /* =====================================================================
     helpers: wait until the agents placed an element / it is on screen
     ===================================================================== */
  function gateOf(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      var p = n.parentElement;
      if (p && p.getAttribute('data-b') === 'group') return n;
      if (n.hasAttribute('data-b') && n.getAttribute('data-b') !== 'group') return n;
    }
    return null;
  }
  function whenPlaced(el) {
    return new Promise(function (res) {
      var g = gateOf(el);
      if (!g || !root.classList.contains('build-on') || g.classList.contains('is-built')) return res();
      var on = function (e) { if (e.target === g) { g.removeEventListener('meg:built', on); res(); } };
      g.addEventListener('meg:built', on);
      document.addEventListener('meg:build-done', function () { res(); }, { once: true });
    });
  }
  function whenVisible(el, ratio) {
    return new Promise(function (res) {
      if (!('IntersectionObserver' in window)) return res();
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { io.disconnect(); res(); }
      }, { threshold: ratio || 0.4, rootMargin: '0px 0px -6% 0px' });
      io.observe(el);
    });
  }
  function settle(anims) { return Promise.all(anims.map(function (a) { return a.finished.catch(function () {}); })); }

  /* =====================================================================
     handwriting: notes are "written" left → right, marks are drawn
     ===================================================================== */
  function writeHand(el, dur) {
    var len = (el.textContent || '').trim().length;
    var d = dur || Math.max(480, Math.min(1800, len * 52));
    return el.animate([{ clipPath: 'inset(-30% 100% -30% -6%)' }, { clipPath: 'inset(-30% -6% -30% -6%)' }],
      { duration: d, easing: 'cubic-bezier(.42,.08,.5,.95)', fill: 'forwards' });
  }
  function drawMark(svg) {
    return $$('path', svg).map(function (p, i) {
      return p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        { duration: 560, delay: i * 120, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    });
  }
  async function playAnno(a) {
    if (a.__played) return;
    a.__played = true;
    // An element hidden by its own clip-path never "intersects": watch its parent instead.
    await whenVisible(a.matches('.hand') ? a.parentElement : a);
    await whenPlaced(a);
    await sleep(240);
    var items = (a.matches('.hand, .mark') ? [a] : []).concat($$('.hand, .mark', a));
    var all = [];
    for (var i = 0; i < items.length; i++) {
      var anims = items[i].classList.contains('mark') ? drawMark(items[i]) : [writeHand(items[i])];
      all = all.concat(anims);
      await settle(anims);
      await sleep(90);
    }
    a.classList.add('anno-done');
    all.forEach(function (an) { an.cancel(); });
  }

  /* =====================================================================
     decrypt: labels resolve from random glyphs into text
     ===================================================================== */
  var GLYPHS = '!<>-_\\/[]{}=+*^?#%&01ABCDEFXZ';
  var rg = function () { return GLYPHS[(Math.random() * GLYPHS.length) | 0]; };
  function scrambleTo(el, txt, dur) {
    return new Promise(function (res) {
      var t0 = performance.now(), n = txt.length;
      (function f(now) {
        if (el.__stop) { el.textContent = txt; return res(); }
        var p = Math.min(1, (now - t0) / dur), k = Math.floor(p * n), s = txt.slice(0, k);
        for (var i = k; i < n; i++) s += txt[i] === ' ' ? ' ' : rg();
        el.textContent = s;
        if (p < 1) raf(f); else { el.textContent = txt; res(); }
      })(t0);
    });
  }
  function keepTr(el) {
    if (lang() !== 'tr') return;
    $$('[data-i18n]', el).concat(el.matches('[data-i18n]') ? [el] : []).forEach(function (n) { if (n.__tr == null) n.__tr = n.innerHTML; });
  }
  function decrypt(el, dur) {
    if (el.__dec) return;
    keepTr(el);
    el.__dec = true;
    el.__stop = false;
    scrambleTo(el, el.textContent, dur || 720).then(function () { el.__dec = false; });
  }
  document.addEventListener('meg:lang', function () { $$('.sec-idx [data-i18n]').forEach(function (n) { n.__stop = true; }); });

  /* =====================================================================
     keyboard typing: retypes an element's text nodes one key at a time,
     keeping every span (syntax colours, prompts) intact
     ===================================================================== */
  function typeNode(el, ms, onChar) {
    keepTr(el);
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push([n, n.nodeValue]);
    nodes.forEach(function (p) { p[0].nodeValue = ''; });
    el.classList.add('typing');
    return new Promise(function (res) {
      var i = 0, j = 0, last = 0, acc = 0;
      function done() {
        nodes.forEach(function (p) { p[0].nodeValue = p[1]; });
        el.classList.remove('typing');
        el.classList.add('typed');
        res();
      }
      function step(now) {
        if (!last) last = now;
        acc += Math.min(64, now - last);
        last = now;
        while (acc >= ms) {
          if (i >= nodes.length) return done();
          var full = nodes[i][1];
          if (j >= full.length) { i++; j = 0; continue; }
          var ch = full.charAt(j++);
          nodes[i][0].nodeValue = full.slice(0, j);
          acc -= ch === '\n' ? ms * 6 : ch === ' ' ? ms * 0.6 : ms * (0.7 + Math.random() * 0.6);
          if (onChar) onChar(ch);
          if (window.SFX && ch !== ' ' && ch !== '\n') window.SFX.soft();
        }
        raf(step);
      }
      raf(step);
    });
  }

  /* ----- target lock: a YOLO-style box follows what you hover (fine pointers) ----- */
  function targetLock() {
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches || reduced || root.classList.contains('lite')) return;
    var box = document.createElement('div');
    box.id = 'trk';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<i></i><i></i><i></i><i></i><span class="trk-l"></span>';
    document.body.appendChild(box);
    var lab = box.lastChild, cur = null, ids = new WeakMap(), n = 0, lx = 0, ly = 0, speed = 0, ev = null, busy = 0;
    var SEL = '.btn, button, a, .chips li, .shot, .video-wrap, .term, .stat, .kpi-row > div, .kpi, .repo, .proj, .defs li, .task, .skill, .chap, .doc, .portrait, .editor';
    function kind(el) {
      if (el.matches('.btn, button')) return x('buton', 'button');
      if (el.matches('a, .doc')) return x('bağlantı', 'link');
      if (el.matches('.chips li')) return x('etiket', 'tag');
      if (el.matches('.shot, .chap')) return x('görsel', 'image');
      if (el.matches('.portrait')) return x('insan', 'person');
      if (el.matches('.video-wrap')) return 'video';
      if (el.matches('.term, .editor')) return 'terminal';
      if (el.matches('.stat, .kpi-row > div, .kpi')) return x('metrik', 'metric');
      return x('kart', 'card');
    }
    function meta(el) {
      var m = ids.get(el);
      if (!m) { m = { id: ++n, c: (0.9 + Math.random() * 0.09).toFixed(2) }; ids.set(el, m); }
      return m;
    }
    function place() {
      if (!cur) return;
      var r = cur.getBoundingClientRect(), p = 6;
      box.style.transform = 'translate(' + Math.round(r.left - p) + 'px,' + Math.round(r.top - p) + 'px)';
      box.style.width = Math.round(r.width + p * 2) + 'px';
      box.style.height = Math.round(r.height + p * 2) + 'px';
    }
    function text() {
      var m = meta(cur);
      lab.textContent = kind(cur) + ' ' + m.c + ' · ID:' + pad(m.id) + ' · ' + (speed > 12 ? x('hareketli', 'moving') : x('sabit', 'static'));
    }
    function set(el) {
      if (el && (el.closest('#boot, #doors, .nav, .build-hud') || el.getBoundingClientRect().height > innerHeight * 0.8)) el = null;
      if (el === cur) return;
      cur = el;
      if (!el) { box.classList.remove('on'); return; }
      text();
      place();
      box.classList.add('on');
    }
    document.addEventListener('pointermove', function (e) {
      speed = Math.hypot(e.clientX - lx, e.clientY - ly);
      lx = e.clientX; ly = e.clientY; ev = e;
      if (busy) return;
      busy = raf(function () {
        busy = 0;
        var t = ev.target && ev.target.closest ? ev.target.closest(SEL) : null;
        set(t);
        if (cur) text();
      });
    }, { passive: true });
    window.addEventListener('scroll', function () { if (cur) raf(place); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { set(null); });
  }

  /* ----- easter egg: ↑ ↑ ↓ ↓ ← → ← → B A ----- */
  var KON = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'], kpos = 0;
  document.addEventListener('keydown', function (e) {
    var k = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = k === KON[kpos] ? kpos + 1 : (k === KON[0] ? 1 : 0);
    if (kpos < KON.length) return;
    kpos = 0;
    var t = $('#toast');
    if (t) {
      t.textContent = 'GOD MODE · ' + x('tüm agentlar sayfayı yeniden inşa ediyor', 'every agent is rebuilding the page');
      t.classList.add('on');
      setTimeout(function () { t.classList.remove('on'); }, 2800);
    }
    if (window.MEGBuild) window.MEGBuild.replay();
  });

  /* ----- live security audit: 0 → 281 checks, then the findings drop in ----- */
  var CHECKS = ['auth.jwt.access_ttl_15m', 'auth.refresh.rotation', 'auth.refresh.reuse_revokes', 'ws.stomp.subscribe_acl', 'ws.stomp.send_acl',
    'mqtt.acl.topic_owner', 'mqtt.publish.rate_limit', 'invite.code.length_8', 'invite.code.ttl_7d', 'invite.code.attempts_10h', 'invite.admin_approval',
    'search.exact_match_only', 'db.fields.aes_256_gcm', 'push.payload.hpke_x25519', 'lock.pin.pbkdf2', 'lock.duress_pin.silent_sos', 'device.new_login.approval',
    'device.lost_mode', 'device.remote_wipe', 'docker.cap_drop_all', 'docker.no_new_privileges', 'panels.localhost_only', 'caddy.single_port_https',
    'backup.integrity_signed', 'deps.vulnerability_scan', 'ratelimit.per_user', 'lockout.progressive', 'proxy.trusted_list'];
  var auBody = $('#audit-body'), auCount = $('#au-count'), auBar = $('#au-bar'), auStream = $('#au-stream');
  function countText(n) { return pad(n, 3) + '<small>/281 PASS</small>'; }
  async function runAudit() {
    var host = auBody.closest('.audit');
    await whenVisible(host, 0.35);
    await whenPlaced(host);
    await sleep(200);
    await typeNode($('[data-type]', auBody), 24);
    await new Promise(function (res) {
      var t0 = 0, shown = 0, D = 1900;
      (function f(now) {
        if (!t0) t0 = now;
        var p = Math.min(1, (now - t0) / D), target = Math.round(281 * (1 - Math.pow(1 - p, 2)));
        while (shown < target) {
          shown++;
          var d = document.createElement('div');
          d.innerHTML = '<span class="t-ok">✓</span> ' + pad(shown, 4) + '  ' + CHECKS[(shown * 7) % CHECKS.length] + ' <span class="t-dim">PASS</span>';
          auStream.appendChild(d);
          while (auStream.childElementCount > 5) auStream.firstChild.remove();
        }
        auCount.innerHTML = countText(shown);
        auBar.style.transform = 'scaleX(' + p + ')';
        p < 1 ? raf(f) : res();
      })(performance.now());
    });
    var fin = document.createElement('div');
    fin.innerHTML = '<span class="t-ok">281/281 PASS · 0 FAIL</span> <span class="t-dim">· ' + x('4 açık bulundu ve kapatıldı', '4 issues found and fixed') + '</span>';
    auStream.appendChild(fin);
    while (auStream.childElementCount > 5) auStream.firstChild.remove();
    var rest = Array.prototype.filter.call(auBody.children, function (c) { return !c.classList.contains('cmd') && c !== auStream; });
    for (var i = 0; i < rest.length; i++) { rest[i].classList.add('in'); await sleep(230); }
    auBody.classList.add('au-done');
  }

  /* ----- camera HUD on the portrait: frame counter + confidence count-up ----- */
  function cameraHud() {
    var fig = $('#portrait'), fr = $('#cam-frame');
    if (!fig || !fr) return;
    var f = 1, iv = 0;
    var tick = function () { if (document.hidden) return; f = f % 2250 + 1; fr.textContent = x('kare ', 'frame ') + pad(f, 4) + ' / 2250'; };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      clearInterval(iv);
      if (es[0].isIntersecting) iv = setInterval(tick, 66);
    }).observe(fig);
    var confs = $$('[data-conf]', fig);
    confs.forEach(function (b) { b.textContent = '0.00'; });
    whenVisible(fig, 0.3).then(function () { return whenPlaced(fig); }).then(function () {
      confs.forEach(function (b, k) {
        var to = +b.getAttribute('data-conf'), t0 = 0, d = 1100 + k * 300;
        (function g(now) {
          if (!t0) t0 = now;
          var p = Math.min(1, (now - t0) / d), v = to * (1 - Math.pow(1 - p, 3)) + (p < 1 ? (Math.random() - 0.5) * 0.04 : 0);
          b.textContent = Math.max(0, Math.min(0.99, v)).toFixed(2);
          if (p < 1) raf(g); else b.textContent = to.toFixed(2);
        })(performance.now());
      });
    });
  }

  /* =====================================================================
     INTRO
     1 Linux boot  →  2 simulated intrusion (visitor's own browser info, radar,
     fake exfil, TV-noise "feed")  →  3 CRITICAL_SYSTEM_BREACH, 3-2-1, kernel
     panic, crack  →  4 the joke  →  5 doors  →  6 the site stutters, freezes,
     shatters and recovers  →  JARVIS greets.
     Everything is labelled as a simulation; nothing leaves the browser.
     ===================================================================== */
  var bootRes;
  MEG.bootDone = new Promise(function (r) { bootRes = r; });
  var bootEl = $('#boot'), doors = $('#doors');
  var sfx = function (name, a, b, c) { var S = window.SFX; if (S && S[name]) { try { S[name](a, b, c); } catch (e) {} } };
  var fmt1 = function (v) { return lang() === 'en' ? v.toFixed(1) : v.toFixed(1).replace('.', ','); };

  function fingerprint() {
    var ua = navigator.userAgent, os = 'unknown', dev = 'Desktop', br = 'unknown', m;
    if (/iPhone/.test(ua)) { dev = 'iPhone'; os = 'iOS ' + ((ua.match(/OS (\d+)_(\d+)/) || []).slice(1, 3).join('.')); }
    else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) { dev = 'iPad'; os = 'iPadOS'; }
    else if (/Android/.test(ua)) { os = 'Android ' + ((ua.match(/Android ([\d.]+)/) || [])[1] || ''); m = ua.match(/Android [\d.]+; ([^;)]+)/); var nm = m ? m[1].replace(/Build.*/, '').trim() : ''; dev = nm.length > 2 ? nm : 'Android phone'; }
    else if (/Windows NT/.test(ua)) { os = 'Windows ' + (/Windows NT 10/.test(ua) ? '10/11' : ''); dev = 'PC'; }
    else if (/Mac OS X/.test(ua)) { os = 'macOS'; dev = 'Mac'; }
    else if (/CrOS/.test(ua)) { os = 'ChromeOS'; dev = 'Chromebook'; }
    else if (/Linux/.test(ua)) { os = 'Linux'; dev = 'PC'; }
    if ((m = ua.match(/Edg\/(\d+)/))) br = 'Edge ' + m[1];
    else if ((m = ua.match(/OPR\/(\d+)/))) br = 'Opera ' + m[1];
    else if ((m = ua.match(/SamsungBrowser\/(\d+)/))) br = 'Samsung Internet ' + m[1];
    else if ((m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/))) br = 'Firefox ' + m[1];
    else if ((m = ua.match(/CriOS\/(\d+)/))) br = 'Chrome ' + m[1];
    else if ((m = ua.match(/Chrome\/(\d+)/))) br = 'Chrome ' + m[1];
    else if ((m = ua.match(/Version\/([\d.]+).*Safari/))) br = 'Safari ' + m[1];
    var gpu = '';
    try {
      var c = document.createElement('canvas'), gl = c.getContext('webgl');
      if (gl) {
        var e = gl.getExtension('WEBGL_debug_renderer_info');
        gpu = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        var lc = gl.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext();
      }
    } catch (err) {}
    gpu = String(gpu || '').replace(/^ANGLE \(/, '').replace(/\)$/, '');
    if (gpu.indexOf(',') !== -1) { var gp = gpu.split(','); gpu = gp[1] || gp[0]; }
    gpu = gpu.replace(/ANGLE Metal Renderer:\s*/i, '').replace(/Direct3D.*$/i, '').replace(/\(0x[0-9a-f]+\)/ig, '').replace(/\s+/g, ' ').trim() || 'masked';
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (err) {}
    var now = new Date(), scr = screen.width + '×' + screen.height + ' @' + (+(window.devicePixelRatio || 1).toFixed(1)) + 'x';
    var h = 2166136261, s = ua + scr + gpu + tz;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    var hash = (h >>> 0).toString(16).toUpperCase().padStart(8, '0') + (((h * 7) >>> 0) % 65536).toString(16).toUpperCase().padStart(4, '0');
    var info = { dev: dev, os: os.trim(), br: br, gpu: gpu, cores: navigator.hardwareConcurrency || '?', scr: scr, lang: navigator.language || 'tr-TR',
      city: tz.split('/').pop().replace(/_/g, ' ') || '—', time: pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()),
      bat: '', hash: hash, mobile: /iPhone|Android|iPad/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) };
    if (!navigator.getBattery) return Promise.resolve(info);
    return Promise.race([navigator.getBattery(), sleep(300)]).then(function (b) {
      if (b && typeof b.level === 'number') info.bat = Math.round(b.level * 100) + '%' + (b.charging ? ' · charging' : ' · on battery');
      return info;
    }, function () { return info; });
  }

  async function runIntro() {
    var log = $('#boot-log'), hello = $('#boot-hello'), fxc = $('#b-fx'), fxx = fxc.getContext('2d');
    var done = false, skipped = false, stops = [];
    var stop = function () { return skipped || done; };
    var wait = function (ms) { return stop() ? Promise.resolve() : sleep(ms); };
    var red = 'rgba(255,42,74,';
    fxc.width = Math.ceil(innerWidth / 2);
    fxc.height = Math.ceil(innerHeight / 2);
    $('#boot-skip').textContent = x('atla: tıkla ya da bir tuşa bas', 'skip: click or press any key');
    $('#boot-sim').textContent = x('SİMÜLASYON · gerçek bir saldırı değil', 'SIMULATION · not a real attack');
    $('#bh-hand').textContent = x('Merak etme, sadece benim:', "Don't worry, it's just me:");
    $('#bh-role').textContent = x('Yapay Zekâ · Bilgisayarlı Görü · Güvenli Backend', 'AI · Computer Vision · Secure Backend');

    var cinematic = false, ctaPress = null;
    var result = new Promise(function (res) { exit.res = res; });
    function exit() {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      stops.forEach(function (f) { f(); });
      sfx('whoosh', true, 1.3, 0.16);
      openDoors();
      exit.res({ skipped: skipped, cinematic: cinematic });
    }
    function skip() { if (!done) { skipped = true; exit(); } }
    // Sound is on by default; if the browser is still blocking audio, the first
    // tap/key only turns the sound on instead of skipping the intro.
    var sndHint = $('#boot-snd');
    var needsUnlock = function () { return !!(window.SFX && !window.SFX.muted && !window.SFX.running); };
    var unlocked = function () { if (window.SFX) window.SFX.unlock(); sndHint.classList.remove('on'); };
    function onKey(e) {
      if (e.key === 'Tab') return;
      if (ctaPress && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ctaPress(); return; }
      if (needsUnlock()) { unlocked(); return; }
      skip();
    }
    var fromCta = function (e) { return e.target && e.target.closest && e.target.closest('.b-cta'); };
    // AudioContext.resume() is async, so remember at press time that this gesture was the unlock.
    var swallow = false;
    bootEl.addEventListener('pointerdown', function (e) { if (!fromCta(e) && needsUnlock()) swallow = true; });
    bootEl.addEventListener('click', function (e) {
      if (fromCta(e)) return;
      if (swallow || needsUnlock()) { swallow = false; return unlocked(); }
      skip();
    });
    bootEl.addEventListener('touchstart', function (e) {
      if (fromCta(e)) return;
      if (needsUnlock()) { swallow = true; return; }
      if (!swallow) skip();
    }, { passive: true });
    bootEl.addEventListener('touchend', function () { if (swallow) unlocked(); }, { passive: true });
    sndHint.textContent = x('♪ sesi açmak için ekrana bir kez dokun', '♪ tap the screen once to turn the sound on');
    setTimeout(function () { if (!done && needsUnlock()) sndHint.classList.add('on'); }, 400);
    document.addEventListener('meg:sound', function () { if (!needsUnlock()) sndHint.classList.remove('on'); });
    window.addEventListener('keydown', onKey, true);
    setTimeout(exit, 60000); // hard safety net

    function line(html, cls) {
      var d = document.createElement('div');
      if (cls) d.className = cls;
      d.innerHTML = html || '&nbsp;';
      log.appendChild(d);
      while (log.childElementCount > 120) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
      return d;
    }
    function typeLine(txt, cls, cps) {
      return new Promise(function (res) {
        var d = line('', cls), i = 0, last = performance.now();
        d.textContent = '';
        (function f(t) {
          if (stop()) { d.textContent = txt; return res(d); }
          i = Math.min(txt.length, i + Math.max(1, Math.round((t - last) / 1000 * (cps || 1000))));
          last = t;
          d.textContent = txt.slice(0, i);
          log.scrollTop = log.scrollHeight;
          sfx('key');
          i < txt.length ? raf(f) : res(d);
        })(last);
      });
    }
    async function typeTo(el, s, ms) {
      for (var i = 1; i <= s.length; i++) { if (stop()) { el.textContent = s; return; } el.textContent = s.slice(0, i); sfx('soft'); await sleep(ms); }
    }
    function glitch(ms, k) {
      return new Promise(function (res) {
        if (stop()) return res();
        sfx('glitch', k);
        var t0 = performance.now();
        (function f(t) {
          fxx.clearRect(0, 0, fxc.width, fxc.height);
          if (t - t0 > ms || stop()) { log.style.transform = ''; return res(); }
          var n = ((5 + Math.random() * 12) * k) | 0;
          for (var i = 0; i < n; i++) {
            var y = Math.random() * fxc.height, hh = 1 + Math.random() * fxc.height * 0.06, r = Math.random();
            fxx.fillStyle = r < 0.5 ? 'rgba(61,255,143,' + (Math.random() * 0.32) + ')' : r < 0.65 ? red + (Math.random() * 0.3) + ')' : 'rgba(0,0,0,' + (0.5 + Math.random() * 0.5) + ')';
            fxx.fillRect(0, y, fxc.width, hh);
          }
          log.style.transform = 'translate3d(' + ((Math.random() - 0.5) * 10 * k) + 'px,' + ((Math.random() - 0.5) * 4 * k) + 'px,0)';
          raf(f);
        })(t0);
      });
    }
    function radar(c) {
      var cx = c.getContext('2d'), S = c.width, c0 = S / 2, a = 0, on = true;
      var blips = [0, 1, 2, 3, 4].map(function () { return { r: (0.12 + Math.random() * 0.3) * S, t: Math.random() * 6.283 }; });
      (function f() {
        if (!on) return;
        raf(f);
        a += 0.07;
        cx.clearRect(0, 0, S, S);
        cx.strokeStyle = 'rgba(61,255,143,.25)'; cx.lineWidth = 1; cx.beginPath();
        for (var k = 1; k <= 3; k++) { cx.moveTo(c0 + S * 0.15 * k, c0); cx.arc(c0, c0, S * 0.15 * k, 0, 6.283); }
        cx.moveTo(c0, 0); cx.lineTo(c0, S); cx.moveTo(0, c0); cx.lineTo(S, c0); cx.stroke();
        cx.fillStyle = 'rgba(61,255,143,.16)'; cx.beginPath(); cx.moveTo(c0, c0); cx.arc(c0, c0, S * 0.46, a - 0.6, a); cx.closePath(); cx.fill();
        cx.strokeStyle = '#3dff8f'; cx.beginPath(); cx.moveTo(c0, c0); cx.lineTo(c0 + Math.cos(a) * S * 0.46, c0 + Math.sin(a) * S * 0.46); cx.stroke();
        blips.forEach(function (b) {
          var d = ((a - b.t) % 6.283 + 6.283) % 6.283, al = Math.max(0, 1 - d / 3);
          if (al > 0) { cx.fillStyle = red + al + ')'; cx.beginPath(); cx.arc(c0 + Math.cos(b.t) * b.r, c0 + Math.sin(b.t) * b.r, S * 0.03, 0, 6.283); cx.fill(); }
        });
      })();
      return function () { on = false; };
    }
    function feedLoop(c, tcEl) {
      var cx = c.getContext('2d'), img = cx.createImageData(128, 72), d = img.data, on = true, roll = 0, fc = 0, t0 = performance.now();
      (function f(t) {
        if (!on) return;
        raf(f);
        if (fc++ & 1) return;
        for (var i = 0; i < d.length; i += 4) { var v = (Math.random() * 200) | 0; d[i] = v * 0.45; d[i + 1] = v; d[i + 2] = v * 0.65; d[i + 3] = 255; }
        cx.putImageData(img, 0, 0);
        roll = (roll + 1.4) % 82;
        cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fillRect(0, roll - 10, 128, 10);
        if (Math.random() < 0.15) { var y = (Math.random() * 72) | 0, hh = (2 + Math.random() * 10) | 0; cx.drawImage(c, 0, y, 128, hh, (Math.random() - 0.5) * 24, y, 128, hh); }
        var s = (t - t0) / 1000;
        tcEl.textContent = '00:' + pad((s / 60) | 0) + ':' + pad(s % 60 | 0);
      })(t0);
      return function () { on = false; };
    }
    function crack() {
      return new Promise(function (res) {
        if (stop()) return res();
        sfx('crack');
        var W = fxc.width, H = fxc.height, cx0 = W * (0.38 + Math.random() * 0.24), cy0 = H * (0.38 + Math.random() * 0.24), paths = [], n = narrow() ? 10 : 15, R = Math.hypot(W, H);
        for (var i = 0; i < n; i++) {
          var a = i / n * 6.283 + Math.random() * 0.35, px = cx0, py = cy0, len = 0, pts = [[px, py]], L = (0.35 + Math.random() * 0.7) * R;
          while (len < L) {
            var st = 6 + Math.random() * 18;
            a += (Math.random() - 0.5) * 0.55; px += Math.cos(a) * st; py += Math.sin(a) * st; len += st; pts.push([px, py]);
            if (Math.random() < 0.07) {
              var bx = px, by = py, ba = a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), bp = [[bx, by]];
              for (var k = 0; k < 6 + Math.random() * 8; k++) { var s2 = 5 + Math.random() * 12; ba += (Math.random() - 0.5) * 0.6; bx += Math.cos(ba) * s2; by += Math.sin(ba) * s2; bp.push([bx, by]); }
              paths.push(bp);
            }
          }
          paths.push(pts);
        }
        for (var r = 1; r <= 3; r++) {
          var rr = r * (14 + Math.random() * 10), ring = [];
          for (var q = 0; q <= 18; q++) { var aa = q / 18 * 6.283, jj = rr * (0.75 + Math.random() * 0.5); ring.push([cx0 + Math.cos(aa) * jj, cy0 + Math.sin(aa) * jj]); }
          paths.push(ring);
        }
        function drawP(p) {
          fxx.beginPath();
          paths.forEach(function (pt) {
            var kk = Math.max(1, (pt.length * p) | 0);
            fxx.moveTo(pt[0][0], pt[0][1]);
            for (var z = 1; z < kk; z++) fxx.lineTo(pt[z][0], pt[z][1]);
          });
          fxx.stroke();
        }
        var t0 = performance.now();
        (function f(t) {
          var p = Math.min(1, (t - t0) / 280);
          fxx.clearRect(0, 0, W, H); fxx.lineJoin = 'round';
          fxx.strokeStyle = 'rgba(61,255,143,.35)'; fxx.lineWidth = 3; drawP(p);
          fxx.strokeStyle = 'rgba(240,255,246,.95)'; fxx.lineWidth = 0.9; drawP(p);
          p < 1 ? raf(f) : res();
        })(t0);
      });
    }
    var show = function (el) { el.classList.add('on'); };

    var fp = await fingerprint();
    var nr = narrow(), COLS = nr ? 36 : 58;
    var dl = function (a, b) { return a + ' ' + '.'.repeat(Math.max(2, COLS - a.length - String(b).length - 2)) + ' ' + b; };
    var OK = '<span class="ok">[  OK  ]</span> ';

    // 1 — Linux boot
    sfx('post');
    var hd = line('', 'b-hd');
    await typeTo(hd, x('Sistem açılıyor', 'System is booting'), 34);
    for (var dot = 0; dot < 3 && !stop(); dot++) { hd.textContent += '.'; sfx('tick'); await sleep(140); }
    var bootL = [
      ['<span class="wh">MEG-1453 BIOS v20.26</span>  ·  Nişantaşı Labs  ·  İstanbul, TR', 'dm'],
      ['Memory test: 26002 labelled boxes .......... <span class="ok">OK</span>', ''],
      ['Loading <span class="wh">meg-os 6.11.0-teknofest</span> ...', ''],
      ['[    0.081230] teknofest: 3rd place in Türkiye detected (AI in Aviation 2026)', 'dm'],
      ['[    0.233917] nvidia: RTX 5070 Ti (Blackwell) online · DPVO patch applied', 'dm'],
      [OK + 'Started <span class="wh">VectorX</span> object detection (YOLO11x + P2).', ''],
      [OK + 'Started DPVO visual odometry (8× on Blackwell).', ''],
      [OK + 'Started <span class="wh">MT-29</span> secure messaging (281/281 checks).', ''],
      [OK + 'Started <span class="wh">Jarvis</span> edge-to-cloud orchestrator.', ''],
      [OK + 'Started <span class="wh">AI Control</span> memory server (MCP · 9 tools).', '']
    ];
    for (var bi = 0; bi < bootL.length && !stop(); bi++) { line(bootL[bi][0], bootL[bi][1]); sfx('hdd'); await sleep(bi < 5 ? 60 : 110); }
    await wait(380);
    line('<span class="r">[!] unexpected inbound connection on tty1 from 203.0.113.66</span>');
    sfx('error');
    await wait(650);
    await glitch(260, 1.3);
    if (stop()) return result;

    // 2 — the simulated intrusion
    log.innerHTML = '';
    bootEl.classList.add('hack');
    await typeLine(nr ? 'root@kali:~# ./ghostlink -a -s' : 'root@kali:~# ./ghostlink --target=auto --stealth --persist', 'h', 650);
    await wait(160);
    await typeLine(dl('[*] resolving target node', 'OK'), '', 1000);
    await typeLine(dl('[*] reverse tunnel 203.0.113.66:443', 'UP'), 'd', 1000);
    await typeLine(dl('[*] TLS1.3 handshake · AES-256-GCM', 'OK'), 'd', 1000);
    await typeLine('[+] session opened (pid 4721)', '', 1000);
    await typeLine('[*] fingerprinting target node...', '', 1000);
    if (stop()) return result;
    $('#fp-hash').textContent = '#' + fp.hash;
    var rowsEl = $('#fp-rows');
    rowsEl.innerHTML = '';
    var items = [['BROWSER', fp.br], ['OS', fp.os], ['DEVICE', fp.dev], ['GPU', fp.gpu], ['DISPLAY', fp.scr], ['CPU', fp.cores + ' threads'], ['LOCALE', fp.lang + ' · ' + fp.city], ['LOCAL TIME', fp.time]];
    if (fp.bat) items.push(['BATTERY', fp.bat]);
    items.forEach(function (it) {
      var d = document.createElement('div');
      d.className = 'fp-row';
      d.innerHTML = '<span>' + it[0] + '</span><b>········</b><i>SCAN</i>';
      rowsEl.appendChild(d);
    });
    var panel = $('#fp-panel');
    show(panel);
    sfx('ping');
    panel.animate([{ clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-10px)' }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' });
    if (nr) log.style.opacity = '.3';
    var rc = $('#fp-radar');
    rc.width = rc.height = Math.round((rc.clientWidth || 84) * Math.min(2, window.devicePixelRatio || 1));
    stops.push(radar(rc));
    var rows = Array.prototype.slice.call(rowsEl.children);
    for (var ri = 0; ri < items.length && !stop(); ri++) {
      rows[ri].classList.add('on');
      await scrambleTo(rows[ri].querySelector('b'), String(items[ri][1]), 230);
      rows[ri].querySelector('i').textContent = 'MATCH';
      sfx('tick');
    }
    var riskEl = $('#fp-risk'), rk0 = performance.now();
    (function rk(t) { var p = Math.min(1, (t - rk0) / 1100); riskEl.textContent = Math.round(97 * (1 - Math.pow(1 - p, 2))); if (p < 1 && !stop()) raf(rk); })(rk0);
    await typeLine('[+] fingerprint locked · #' + fp.hash, 'h', 1000);
    await wait(420);
    if (nr) { panel.classList.remove('on'); log.style.opacity = '1'; }
    await typeLine(dl('[*] escalating privileges', 'OK'), '', 1000);
    await typeLine(dl('[*] dumping browser keychain', ((180 + Math.random() * 90) | 0) + ' entries'), '', 1000);
    await typeLine(fp.mobile ? '[*] mounting /storage/emulated/0 (rw)' : '[*] mounting ~/ (rw)', '', 1000);
    var files = fp.mobile
      ? ['/DCIM/Camera/IMG_20261103_184211.jpg', '/WhatsApp/Media/Images/IMG-20261102-WA0014.jpg', '/Download/invoice_oct.pdf', '/DCIM/Screenshots/Screenshot_20261101.png', '/Documents/notes.txt', '/DCIM/Camera/VID_20261019_212032.mp4', '/Contacts/contacts.vcf', '/Recordings/voice_14.m4a']
      : ['~/Desktop/cv_final_v3.pdf', '~/Pictures/IMG_2026_0614.HEIC', '~/Downloads/invoice_oct.pdf', '~/Documents/notes/passwords_OLD.txt', '~/Desktop/project_FINAL(2).docx', '~/.ssh/known_hosts', '~/Pictures/Screenshot 2026-10-11.png', '~/Movies/VID_20260819.mp4'];
    var bar = line('', 'h'), total = fp.mobile ? 4.7 : 2.2, feedShown = false;
    for (var fi = 0; fi < files.length && !stop(); fi++) {
      line((nr ? '  ↳ ' : '    ↳ exfil  ') + files[fi], 'f');
      sfx('hdd');
      var p = (fi + 1) / files.length, w = nr ? 14 : 26, fl = Math.round(p * w);
      bar.textContent = '[' + '█'.repeat(fl) + '░'.repeat(w - fl) + '] ' + Math.round(p * 100) + '% · ' + (p * total).toFixed(1) + '/' + total + ' GB';
      log.appendChild(bar);
      if (!feedShown && p > 0.45) {
        feedShown = true;
        line('[!] Accessing Local Video Feed...', 'r');
        $('#feed-src').textContent = fp.mobile ? 'front_camera' : '/dev/video0';
        var feed = $('#feed');
        show(feed);
        sfx('statik', 1.2);
        feed.animate([{ transform: 'scale(.9)', opacity: 0 }, { transform: 'scale(1.03)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, easing: 'ease-out' });
        stops.push(feedLoop($('#feed-cv'), $('#feed-tc')));
        if (nr) log.style.opacity = '.35';
      }
      await wait(80 + Math.random() * 90);
    }
    var ft = $('#feed-txt');
    ft.textContent = 'HANDSHAKE…'; await glitch(260, 1.2); await wait(500);
    ft.textContent = 'FEED ACQUIRED ●'; await glitch(320, 1.6); await wait(650);
    if (stop()) return result;

    // 3 — CRITICAL_SYSTEM_BREACH → 3·2·1 → kernel panic → crack
    line('[!] integrity check FAILED — kernel tampering detected', 'r');
    $('#node-name').textContent = fp.dev.toUpperCase();
    $('#node-hash').textContent = '#' + fp.hash.slice(0, 8);
    stops.shift()();
    $('#b-crit').textContent = x('PORTFOLYOMA HOŞ GELDİNİZ', 'WELCOME TO MY PORTFOLIO');
    bootEl.classList.add('alarm');
    sfx('alarm');
    var alI = setInterval(function () { sfx('alarm'); }, 900);
    stops.push(function () { clearInterval(alI); });
    var crit = $('#b-alarm .crit');
    crit.animate([{ transform: 'scale(1.35)', opacity: 0 }, { transform: 'scale(.94)', opacity: 1, offset: 0.55 }, { transform: 'scale(1.03)', offset: 0.8 }, { transform: 'scale(1)', opacity: 1 }], { duration: 700, easing: 'ease-out' });
    await wait(800);
    if (stop()) return result;
    // The call to action: one press opts into the full cinematic and unlocks audio.
    var cta = $('#b-cta');
    $('#b-cta-t').textContent = x('SİNEMATİK MODU BAŞLAT', 'START CINEMATIC MODE');
    $('#b-cta-s').textContent = x('sesli · yaklaşık 40 saniye', 'with sound · about 40 seconds');
    $('#b-cta-h').textContent = x('halka dolunca sessiz devam eder', 'continues silently when the ring fills');
    bootEl.classList.add('cta');
    cta.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 650, easing: 'ease-out' });
    try { cta.focus({ preventScroll: true }); } catch (e) {}
    cinematic = await new Promise(function (res) {
      var settled = false;
      var fin = function (v) { if (settled) return; settled = true; clearTimeout(tt); clearInterval(cc); ctaPress = null; res(v); };
      var tt = setTimeout(function () { fin(false); }, 9000);
      var cc = setInterval(function () { if (stop()) fin(false); }, 100);
      ctaPress = function () { fin(true); };
      cta.onclick = function (e) { e.stopPropagation(); fin(true); };
    });
    bootEl.classList.remove('cta');
    if (stop()) return result;
    if (cinematic && window.SFX) { window.SFX.unlock(); window.SFX.setMute(false); sfx('power'); sfx('alarm'); }
    if (cinematic) bootEl.classList.add('count');
    var cnt = $('#b-cnt');
    for (var cn = 3; cn >= 1 && cinematic && !stop(); cn--) {
      cnt.textContent = cn;
      sfx('count', cn);
      cnt.animate([{ transform: 'scale(1.9)' }, { transform: 'scale(.95)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-out' });
      if (cn === 2) glitch(220, 1.4);
      await wait(760);
    }
    if (!stop()) { cnt.textContent = '0'; sfx('count', 0); await glitch(260, 2); }
    clearInterval(alI);
    bootEl.classList.remove('count');
    if (stop()) return result;
    var panic = $('#b-panic');
    show(panic);
    sfx('panic');
    var PANIC = ['[   13.371337] Kernel panic - not syncing: Attempted to kill init! exitcode=0x0000000b',
      '[   13.371402] CPU: 3 PID: 1 Comm: systemd Tainted: G      D     6.11.0-meg #1',
      '[   13.371455] Hardware name: TARGET_NODE/BREACHED, BIOS 20.26 11/06/2026',
      '[   13.371460] Call Trace:', '[   13.371462]  <TASK>', '[   13.371471]  dump_stack_lvl+0x48/0x70', '[   13.371489]  panic+0x34c/0x370',
      '[   13.371502]  do_exit+0x9a1/0xac0', '[   13.371520]  do_group_exit+0x31/0x80', '[   13.371533]  get_signal+0x99c/0x9d0', '[   13.371560]  </TASK>',
      '[   13.371602] Kernel Offset: 0x1a000000 from 0xffffffff81000000', '[   13.371644] ---[ end Kernel panic - not syncing: Attempted to kill init! ]---'];
    for (var pi = 0; pi < PANIC.length && !stop(); pi++) {
      var pd = document.createElement('div');
      if (/Kernel panic|end Kernel/.test(PANIC[pi])) pd.className = 'k';
      pd.textContent = PANIC[pi];
      panic.appendChild(pd);
      await sleep(36);
    }
    stops.forEach(function (f) { f(); });
    stops = [];
    bootEl.classList.add('freeze');
    await wait(1000);
    await crack();
    await wait(650);
    if (stop()) return result;

    // 4 — the joke
    fxc.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
    bootEl.classList.add('joke');
    show(hello);
    await wait(380);
    await typeTo($('#bh-j1'), x('Sakin olun. Dosyalarınız güvende.', 'Relax. Your files are safe.'), 34);
    await wait(650);
    var j2 = $('#bh-j2'), j2t = x('Ama iyi bir yapay zekâ mühendisinin dikkatinizi çekmesi 3 saniye sürer.', 'But a good AI engineer only needs 3 seconds to get your attention.');
    await typeTo(j2, j2t, 30);
    j2.innerHTML = j2t.replace(x('3 saniye', '3 seconds'), '<em>' + x('3 saniye', '3 seconds') + '</em>');
    sfx('ping');
    await wait(2200);
    if (stop()) return result;
    hello.classList.add('s2');
    await wait(450);
    var name = $('#bh-name');
    name.style.opacity = '0';
    await settle([writeHand($('#bh-hand'), 1100)]);
    if (stop()) return result;
    name.style.opacity = '';
    scrambleTo(name, 'Muhammet Emin Genç', 700);
    sfx('success');
    await wait(760);
    hello.classList.add('role');
    await wait(1400);
    exit();
    return result;
  }

  // 5 — doors: slam shut over the intro, then slide open onto the site.
  function openDoors() {
    var cleanup = function () { root.classList.remove('boot-on'); bootEl.className = ''; };
    if (!doors || !canAnimate) { cleanup(); bootRes(); return; }
    var l = $('.door.l', doors), r = $('.door.r', doors);
    doors.classList.add('on');
    var shut = { duration: 260, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' };
    l.animate([{ transform: 'translateX(-101%)' }, { transform: 'translateX(0)' }], shut);
    r.animate([{ transform: 'translateX(101%)' }, { transform: 'translateX(0)' }], shut).finished.then(function () {
      sfx('thud', 1.2);
      cleanup();
      bootRes(); // agents start building behind the doors
      var open = { duration: 1150, delay: 220, easing: 'cubic-bezier(.86,0,.07,1)', fill: 'forwards' };
      l.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-101%)' }], open);
      r.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], open).finished.then(function () {
        doors.classList.remove('on');
        l.getAnimations().forEach(function (a) { a.cancel(); });
        r.getAnimations().forEach(function (a) { a.cancel(); });
      });
    });
  }

  /* ----- 6: the site stutters, freezes, shatters and recovers ----- */
  function heroPlaced() {
    return new Promise(function (res) {
      var t0 = performance.now();
      (function chk() {
        var pend = $$('.nav [data-b], #hero [data-b]').filter(function (el) { return !el.classList.contains('is-built'); });
        if (!pend.length || !root.classList.contains('build-on') || performance.now() - t0 > 9000) return res();
        setTimeout(chk, 250);
      })();
    });
  }
  function splitTitle(h1) {
    var out = [];
    var walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (tn) {
      var frag = document.createDocumentFragment();
      Array.prototype.forEach.call(tn.nodeValue, function (ch) {
        var s = document.createElement('span');
        s.className = 'chx';
        s.textContent = ch;
        if (ch === ' ') s.style.width = '.26em';
        frag.appendChild(s);
        if (ch !== ' ') out.push(s);
      });
      tn.parentNode.replaceChild(frag, tn);
    });
    return out;
  }
  async function crashSeq() {
    var CR = { on: true };
    var cwait = function (ms) { return new Promise(function (r) { setTimeout(r, CR.on ? ms : 0); }); };
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    var skipBtn = $('#cr-skip'), dlg = $('#cr-dlg'), scr = $('#cr-screen'), cboot = $('#cr-boot'), rec = $('#cr-recover'), gl = $('#cr-gl'), glx = gl.getContext('2d');
    var title = $('#hero .hero-title'), titleHTML = title.innerHTML, wEl = $('#weight'), wOld = wEl ? wEl.textContent : '';
    var visible = function (el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
    var els = $$('.brand, .nav-links a, .nav-actions > *, #hero .eyebrow, #hero .hello, #hero .hero-role, #hero .hero-lead, #hero .hero-cta > *, #hero .stat, #hero .hero-side, #hero .sysbar').filter(visible);
    var bodies = [], physOn = false;
    var on = function (el) { el.classList.add('on'); }, off = function (el) { el.classList.remove('on'); };

    function end(natural) {
      if (!CR.on) return;
      CR.on = false;
      physOn = false;
      glx.clearRect(0, 0, gl.width, gl.height);
      [dlg, scr, cboot, skipBtn].forEach(off);
      els.concat(bodies.map(function (b) { return b.el; })).forEach(function (e) { e.getAnimations().forEach(function (a) { a.cancel(); }); e.style.transform = ''; });
      dlg.style.transform = '';
      title.innerHTML = titleHTML;
      if (wEl) wEl.textContent = wOld;
      root.classList.remove('crashing', 'frozen');
      rec.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).finished.then(function () { off(rec); rec.getAnimations().forEach(function (a) { a.cancel(); }); });
      setTimeout(function () { if (window.JARVIS) window.JARVIS.launch({ greet: 'recovered' }); }, 500);
    }
    skipBtn.textContent = x('atla ›', 'skip ›');
    skipBtn.onclick = function () { end(false); };

    root.classList.add('crashing');
    var sb = root.style.scrollBehavior; root.style.scrollBehavior = 'auto'; scrollTo(0, 0); root.style.scrollBehavior = sb;
    await cwait(2200); if (!CR.on) return;
    on(skipBtn);
    // 1 — frame drops
    var fpsL = [54, 41, 29, 17, 9, 3];
    for (var i = 0; i < fpsL.length; i++) {
      if (!CR.on) return;
      var fps = fpsL[i];
      sfx('hdd'); if (fps < 20) sfx('glitch', 0.3);
      if (wEl) wEl.textContent = fps + ' FPS';
      els.forEach(function (e) { e.style.transform = 'translate(' + (rnd(-2, 2) * (60 / fps) * 0.15).toFixed(1) + 'px,' + (rnd(-1, 1) * (60 / fps) * 0.1).toFixed(1) + 'px)'; });
      await cwait(110 + (60 - fps) * 4);
    }
    // 2 — hang + "not responding"
    root.classList.add('frozen');
    sfx('buzz', 1);
    if (wEl) wEl.textContent = '0 FPS';
    await cwait(1000); if (!CR.on) return;
    var dp = $('#cr-dlgp'), secs = 4.0;
    $('#cr-dlgh').textContent = x('portfolio.exe yanıt vermiyor', 'portfolio.exe is not responding');
    $('#cr-wait').textContent = x('Bekle', 'Wait');
    $('#cr-kill').textContent = x('Sonlandır', 'End process');
    var dtxt = function () { dp.textContent = x('Uygulama ' + fmt1(secs) + ' saniyedir yanıt vermiyor. Bekleyebilir ya da süreci sonlandırabilirsin.', 'The app has not responded for ' + fmt1(secs) + ' seconds. You can wait or end the process.'); };
    dtxt();
    on(dlg);
    sfx('error');
    var tk = setInterval(function () { secs += 0.1; dtxt(); }, 100);
    await new Promise(function (r) {
      var fin = false, go = function () { if (!fin) { fin = true; r(); } };
      $('#cr-kill').onclick = go;
      $('#cr-wait').onclick = function () { dp.textContent = x('Bekleniyor… sistem kararsız.', 'Waiting… system unstable.'); setTimeout(go, 900); };
      setTimeout(go, 2800);
      var c = setInterval(function () { if (!CR.on) { clearInterval(c); go(); } }, 100);
    });
    clearInterval(tk);
    if (!CR.on) return;
    root.classList.remove('frozen');
    // 3 — shatter under real gravity (bounce + friction + spin)
    var letters = splitTitle(title);
    var H = innerHeight, all = [dlg].concat(letters, els);
    bodies = all.map(function (el) {
      var r = el.getBoundingClientRect(), isL = el.classList.contains('chx');
      return { el: el, x: 0, y: 0, r: 0, vx: rnd(-3.5, 3.5), vy: rnd(-7, -1.5), size: Math.sqrt(r.width * r.height) / 140, vr: rnd(-7, 7) * (isL ? 1.6 : 1),
        floor: H - r.bottom - rnd(0, 12), minX: Math.min(0, 6 - r.left), maxX: Math.max(0, innerWidth - 6 - r.right), rest: false, hit: false,
        t0: performance.now() + (el === dlg ? 0 : 180 + (isL ? rnd(0, 650) : rnd(100, 900))) };
    });
    sfx('rumble', 0.9); sfx('glitch', 1.5);
    gl.width = innerWidth / 2 | 0; gl.height = innerHeight / 2 | 0;
    (function bars(t0) {
      (function f(t) {
        glx.clearRect(0, 0, gl.width, gl.height);
        if (t - t0 > 1500 || !CR.on) return;
        var n = (6 + Math.random() * 14) | 0;
        for (var k = 0; k < n; k++) { var y = Math.random() * gl.height, h = 1 + Math.random() * gl.height * 0.05, q = Math.random(); glx.fillStyle = q < 0.5 ? 'rgba(255,42,74,' + Math.random() * 0.35 + ')' : q < 0.75 ? 'rgba(61,255,143,' + Math.random() * 0.3 + ')' : 'rgba(0,0,0,' + (0.4 + Math.random() * 0.5) + ')'; glx.fillRect(0, y, gl.width, h); }
        raf(f);
      })(t0);
    })(performance.now());
    await Promise.race([new Promise(function (res) {
      physOn = true;
      var G0 = 0.95, last = performance.now();
      (function f(t) {
        if (!physOn || !CR.on) return res();
        var dt = Math.min(2.2, (t - last) / 16.67), moving = 0;
        last = t;
        bodies.forEach(function (b) {
          if (t < b.t0) { moving++; return; }
          if (b.rest) return;
          moving++;
          b.vy += G0 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
          if (b.x < b.minX) { b.x = b.minX; b.vx = Math.abs(b.vx) * 0.5; } else if (b.x > b.maxX) { b.x = b.maxX; b.vx = -Math.abs(b.vx) * 0.5; }
          if (b.y >= b.floor) {
            if (!b.hit || Math.abs(b.vy) > 6) { b.hit = true; sfx('thud', b.size); }
            b.y = b.floor;
            if (Math.abs(b.vy) < 2.2) { b.vy = 0; b.vx *= 0.6; b.vr *= 0.5; if (Math.abs(b.vx) < 0.2) b.rest = true; }
            else { b.vy *= -0.34; b.vx *= 0.78; b.vr *= 0.55; }
          }
          b.el.style.transform = 'translate(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px) rotate(' + b.r.toFixed(1) + 'deg)';
        });
        if (moving) raf(f); else { physOn = false; res(); }
      })(last);
    }), cwait(2600)]);
    physOn = false;
    if (!CR.on) return;
    await cwait(350); if (!CR.on) return;
    // 4 — crash screen + core dump
    var dump = $('#cr-dump'), cbar = $('#cr-bar'), cf = $('#cr-f');
    dump.innerHTML = '';
    $('#cr-sub').textContent = x('(core dumped) · süreç 4721 beklenmedik şekilde sonlandı', '(core dumped) · process 4721 terminated unexpectedly');
    on(scr);
    sfx('buzz', 0.45); sfx('error');
    var DL = ['<b>Thread 1 "render" received signal SIGSEGV</b>', '#0  0x00007ffd3a2c4e10 in render_hero (ctx=0x0) at hero.ts:42', '#1  0x00007ffd3a2c1f8b in layout_grid () at layout.ts:118',
      '#2  0x00007ffd3a2bf002 in hydrate_portfolio () at main.ts:7', '#3  0x00007ffd3a2b9a41 in __libc_start_main ()', 'heap: 412 MB · stack: overflow · ' + letters.length + ' glyph'];
    for (var di = 0; di < DL.length; di++) { if (!CR.on) return; dump.innerHTML += (dump.innerHTML ? '\n' : '') + DL[di]; sfx('tick'); await cwait(130); }
    var b0 = performance.now();
    (function fb(t) { var p = Math.min(1, (t - b0) / 1100); cbar.style.transform = 'scaleX(' + p + ')'; cf.textContent = x('bellek dökümü alınıyor… %', 'dumping memory… ') + Math.round(p * 100) + (lang() === 'en' ? '%' : ''); if (p < 1 && CR.on) raf(fb); })(b0);
    await cwait(1200); if (!CR.on) return;
    cf.textContent = x('otomatik kurtarma başlatılıyor…', 'starting automatic recovery…');
    await cwait(650); if (!CR.on) return;
    // 5 — recovery boot
    var blog = $('#cr-log'), OKs = '<span class="d">[</span><span class="ok">  OK  </span><span class="d">]</span> ';
    blog.innerHTML = '';
    on(cboot); off(scr);
    sfx('post');
    var BL = ['<span class="h">MEG-OS 26.11 LTS</span> <span class="d">· recovery boot · MEG-1453</span>', '', OKs + 'Restored filesystem from snapshot <span class="h">@last-good</span>.',
      OKs + 'Started <span class="h">vectorx.service</span> — YOLO11x-P2 inference.', OKs + 'Started <span class="h">dpvo-odometry.service</span>.',
      OKs + 'Started <span class="h">mt29-secure-core.service</span> (281/281 checks).', OKs + 'Started <span class="h">jarvis.service</span> — ROS 2 companion.', OKs + 'Reached target <span class="h">Portfolio</span>.', ''];
    for (var bl = 0; bl < BL.length; bl++) { if (!CR.on) return; blog.innerHTML += BL[bl] + '\n'; sfx('hdd'); await cwait(BL[bl] ? 110 : 60); }
    var base = blog.innerHTML;
    for (var k2 = 0; k2 <= 20; k2++) {
      if (!CR.on) return;
      var ww = narrow() ? 14 : 24, ff = Math.round(k2 / 20 * ww);
      blog.innerHTML = base + x('yeniden kuruluyor ', 'rebuilding ') + '[' + '█'.repeat(ff) + '░'.repeat(ww - ff) + '] ' + (k2 * 5) + '%';
      await cwait(35);
    }
    await cwait(200); if (!CR.on) return;
    // 6 — rebuild: the wreckage lifts off the floor and flies home
    sfx('whoosh', true, 1.6, 0.13);
    cboot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.then(function () { off(cboot); cboot.getAnimations().forEach(function (a) { a.cancel(); }); });
    off(dlg); dlg.style.transform = '';
    var back = bodies.filter(function (b) { return b.el !== dlg; });
    back.sort(function (a, b) { return (b.el.classList.contains('chx') ? 1 : 0) - (a.el.classList.contains('chx') ? 1 : 0); });
    var homes = back.map(function (b, k) {
      var isL = b.el.classList.contains('chx');
      var cur = b.el.style.transform || 'none';
      var lift = 'translate(' + b.x.toFixed(1) + 'px,' + (b.y - rnd(14, 40)).toFixed(1) + 'px) rotate(' + (b.r * 0.5).toFixed(1) + 'deg)';
      var an = b.el.animate([{ transform: cur }, { transform: lift, offset: 0.2 }, { transform: 'translate(0,0) rotate(0deg) scale(1.08)', offset: 0.85 }, { transform: 'none' }],
        { duration: isL ? 1000 : 1200, delay: 350 + (isL ? k * 25 : 450 + Math.random() * 350), easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
      return an.finished.then(function () { sfx('lock'); b.el.style.transform = ''; }, function () {});
    });
    await Promise.race([Promise.all(homes), cwait(4500)]);
    if (!CR.on) return;
    back.forEach(function (b) { b.el.getAnimations().forEach(function (a) { a.cancel(); }); b.el.style.transform = ''; });
    title.innerHTML = titleHTML;
    els.forEach(function (e) { e.style.transform = ''; });
    if (wEl) wEl.textContent = wOld;
    // 7 — the line (team spirit, not ego)
    off(skipBtn);
    var secsT = (performance.now() - t0Crash) / 1000;
    $('#cr-rk').textContent = x('✓ KURTARMA TAMAMLANDI · kesinti ' + fmt1(secsT) + ' sn · veri kaybı 0 bayt', '✓ RECOVERY COMPLETE · downtime ' + fmt1(secsT) + ' s · data lost: 0 bytes');
    $('#cr-r1').textContent = x('En iyi sistemler bile çökebilir.', 'Even the best systems can crash.');
    $('#cr-r2').textContent = x('Önemli olan, onu yeniden ayağa kaldırabilmek.', 'What matters is getting them back on their feet.');
    $('#cr-r3').innerHTML = x('Ve biz kurtarırız.<em>ölç · düzelt · yeniden başlat — MEG-1453</em>', 'And we recover.<em>measure · fix · restart — MEG-1453</em>');
    on(rec);
    rec.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
    sfx('chime');
    $$('#cr-recover .rk, #cr-recover .r1, #cr-recover .r2, #cr-recover .r3').forEach(function (p, ix) {
      p.animate([{ transform: 'translateY(34px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1000, delay: ix * 380, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
    });
    await new Promise(function (r) { var fin = function () { rec.removeEventListener('click', fin); r(); }; rec.addEventListener('click', fin); setTimeout(fin, 6200); });
    end(true);
  }
  var t0Crash = 0;

  async function startIntro() {
    if (!(bootEl && root.classList.contains('boot-on') && canAnimate)) {
      root.classList.remove('boot-on');
      bootRes();
      return;
    }
    try { sessionStorage.setItem('meg:booted', '1'); } catch (e) {}
    var r = await runIntro();
    if (r.skipped || !r.cinematic || reduced) { setTimeout(function () { if (window.JARVIS) window.JARVIS.launch({ greet: 'hello' }); }, 2500); return; }
    await heroPlaced();
    t0Crash = performance.now();
    crashSeq().catch(function () { root.classList.remove('crashing', 'frozen'); });
  }
  startIntro().catch(function () { root.classList.remove('boot-on'); bootRes(); });

  /* =====================================================================
     page effects: notes, typing, decrypt, audit, camera
     ===================================================================== */
  if (root.classList.contains('fx') && canAnimate) {
    if (auCount) { auCount.innerHTML = countText(0); auBar.style.transform = 'scaleX(0)'; }
    cameraHud();
    targetLock();
    MEG.bootDone.then(function () {
      $$('[data-anno]').forEach(function (a) { playAnno(a).catch(function () { a.classList.add('anno-done'); }); });
      // letter-by-letter typing spots: editor code, prompts, skill headers, hero intro
      var SPEED = { code: 13, text: 11, cmd: 26 };
      $$('[data-type]').forEach(function (el) {
        if (auBody && auBody.contains(el)) return;
        var type = el.getAttribute('data-type');
        whenVisible(el.closest('.editor, .panel, p, div') || el, type === 'cmd' ? 0.6 : 0.35)
          .then(function () { return whenPlaced(el); })
          .then(function () { return sleep(type === 'code' ? 300 : 120); })
          .then(function () { return typeNode(el, SPEED[type] || 26); });
      });
      if (auBody) runAudit().catch(function () { auBody.classList.add('au-done'); auCount.innerHTML = countText(281); auBar.style.transform = 'none'; });
      $$('.sec-idx').forEach(function (s) {
        var span = $('[data-i18n]', s);
        if (!span) return;
        whenVisible(s, 0.6).then(function () { return whenPlaced(s); }).then(function () { decrypt(span); });
      });
    });
  } else {
    root.classList.remove('fx');
  }

  /* ----- pause infinite loops that are off screen ----- */
  if ('IntersectionObserver' in window) {
    var pio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('paused', !e.isIntersecting); });
    }, { rootMargin: '150px 0px' });
    $$('[data-live]').forEach(function (n) { pio.observe(n); });
    var heroEl = $('#hero');
    if (heroEl) new IntersectionObserver(function (es) { root.classList.toggle('hero-in', es[0].isIntersecting); }, { threshold: 0.15 }).observe(heroEl);
  }
  document.addEventListener('visibilitychange', function () { root.classList.toggle('paused', document.hidden); });
})();
