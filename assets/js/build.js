/*!
 * build.js — Agent Build
 * Cursor agents assemble the page as you scroll: they drag a selection box,
 * type headings, copy a card (Ctrl+C) and paste its clones next to it (Ctrl+V).
 * Written from scratch for this portfolio. Zero dependencies.
 *
 * Performance rules
 *  - only transform / opacity / clip-path are animated (Web Animations API)
 *  - a DOM overlay with a few dozen nodes at most; no canvas, no page snapshot
 *  - agent count follows the device: 3 (low-end) / 4 (mobile, mid) / 6 (desktop)
 *  - a backlog speeds agents up; stale work is revealed instantly
 *  - prefers-reduced-motion, Save-Data or a repeat visit in the same session => no build
 *  Markup:  data-b="draw" | "type" | "scan" | "group" (children are copy-pasted)
 *  URL:     ?build=1 force · ?build=0 disable
 */
(function () {
  'use strict';

  var root = document.documentElement;
  window.__megBuild = true;

  var NAMES = ['jarvis', 'vectorx', 'yolo11', 'dpvo', 'owlv2', 'dinov3', 'bytetrack', 'mt29', 'emqx', 'ros2', 'k3s', 'sentinel', 'recon', 'cipher'];
  var COLORS = ['#3dff8f', '#4de8ff', '#c6ff4d', '#ffc24d', '#5effd8', '#a6ffc4', '#7dffb0', '#9be7ff', '#e2ff7a', '#ffd98a', '#2fe0b0', '#b8ffd9', '#66f2ff', '#d0ff5c'];
  var EASE = 'cubic-bezier(.55,.05,.25,1)';
  var EASE_DRAW = 'cubic-bezier(.3,.6,.35,1)';
  var MAC = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
  var TXT = {
    tr: { build: 'inşa', agents: 'agent', scroll: 'kaydır ↓ inşa sürsün', skip: 'atla', done: 'inşa tamam', skipped: 'atlandı' },
    en: { build: 'build', agents: 'agents', scroll: 'scroll ↓ to keep building', skip: 'skip', done: 'build complete', skipped: 'skipped' }
  };

  var supported = typeof Animation !== 'undefined' && 'finished' in Animation.prototype &&
    typeof Element.prototype.animate === 'function' && 'IntersectionObserver' in window;

  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var noop = function () {};
  var t = function (k) { return TXT[root.getAttribute('data-lang') === 'en' ? 'en' : 'tr'][k]; };

  function detectTier() {
    var n = navigator, cores = n.hardwareConcurrency || 4, mem = n.deviceMemory || 8;
    var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (cores <= 2 || mem <= 2) return { name: 'lite', agents: 4, k: 0.7 };
    if (cores <= 4 || mem <= 4 || coarse || innerWidth < 760) return { name: 'mid', agents: 8, k: 0.85 };
    return { name: 'full', agents: 14, k: 1 };
  }
  var tier = detectTier();

  var layer = document.getElementById('build-layer');
  var hud = document.getElementById('build-hud');
  var hudLabel = document.getElementById('hud-label');
  var hudN = document.getElementById('hud-n');
  var hudT = document.getElementById('hud-t');
  var hudBar = document.getElementById('hud-bar');
  var hudHint = document.getElementById('hud-hint');
  var hudSkip = document.getElementById('hud-skip');
  var hudSkipT = document.getElementById('hud-skip-t');

  var S = null; // current run state

  /* ---------------- helpers ---------------- */
  function steps() { return $$('[data-b]').filter(function (el) { return !el.parentElement.closest('[data-b]'); }); }
  function built(el) { return el.classList.contains('is-built'); }
  function fire(el) { el.dispatchEvent(new CustomEvent('meg:built', { bubbles: true })); }
  function mark(el) { if (built(el)) return; el.classList.add('is-built'); fire(el); }
  function reveal(el) {
    if (built(el)) return;
    if (el.getAttribute('data-b') === 'group') Array.prototype.forEach.call(el.children, mark);
    $$('[data-b]', el).forEach(reveal);
    mark(el);
  }
  function revealAll() { steps().forEach(reveal); }
  function hasBox(el) { return el.getClientRects().length > 0; }
  function toPage(r) { return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; }
  function pr(el) { return toPage(el.getBoundingClientRect()); }
  function inView(r) {
    var y0 = scrollY, vh = innerHeight;
    return r.w > 0 && r.h > 0 && r.y < y0 + vh * 1.04 && r.y + r.h > y0 - vh * 0.04;
  }
  function textBox(el) {
    try {
      var rg = document.createRange();
      rg.selectNodeContents(el);
      var b = rg.getBoundingClientRect(), lines = rg.getClientRects();
      if (b.width) return { box: toPage(b), first: toPage(lines[0] || b) };
    } catch (e) {}
    var p = pr(el);
    return { box: p, first: p };
  }
  function mk(cls, r, c) {
    var n = document.createElement('div');
    n.className = cls;
    n.style.cssText = 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px;--c:' + c;
    layer.appendChild(n);
    return n;
  }
  function drop(n, delay) {
    setTimeout(function () {
      if (!n.isConnected) return;
      var an = n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      an.finished.then(function () { n.remove(); }, function () { n.remove(); });
    }, delay || 0);
  }

  /* ---------------- agent ---------------- */
  function Agent(i, x, y) {
    var el = document.createElement('div');
    this.c = COLORS[i % COLORS.length];
    el.className = 'agent';
    el.style.setProperty('--c', this.c);
    el.innerHTML = '<svg viewBox="0 0 14 18" width="14" height="18" aria-hidden="true"><path d="M1 1v14.6l3.9-3.7 2.6 5.6 2.5-1.1-2.6-5.5H13z"/></svg>' +
      '<span class="ag-tag">' + NAMES[i % NAMES.length] + '</span><span class="ag-key"></span>';
    layer.appendChild(el);
    this.el = el;
    this.key = el.lastChild;
    this.anim = null;
    this.kt = 0;
    this.pt = 0;
    this.place(x, y);
  }
  Agent.prototype.place = function (x, y) {
    if (this.anim) this.anim.cancel();
    this.x = x; this.y = y;
    this.el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
  };
  Agent.prototype.move = function (x, y, d, ease) {
    var from = 'translate3d(' + this.x + 'px,' + this.y + 'px,0)';
    var to = 'translate3d(' + x + 'px,' + y + 'px,0)';
    this.x = x; this.y = y;
    this.el.style.transform = to;
    this.anim = this.el.animate([{ transform: from }, { transform: to }], { duration: Math.max(16, d), easing: ease || EASE });
    return this.anim.finished.then(noop, noop);
  };
  Agent.prototype.travel = function (x, y, k) { return clamp(Math.hypot(x - this.x, y - this.y) * 0.45, 220, 760) * k; };
  Agent.prototype.chip = function (txt, ms) {
    var key = this.key;
    key.textContent = txt;
    key.classList.add('on');
    clearTimeout(this.kt);
    this.kt = setTimeout(function () { key.classList.remove('on'); }, ms || 600);
  };
  // A cursor never sits still: with nothing to do it flies off the nearest edge and fades.
  Agent.prototype.leave = function (k) {
    if (this.gone) return Promise.resolve();
    this.gone = true;
    var el = this.el, left = this.x - scrollX < innerWidth / 2;
    var tx = left ? scrollX - 90 : scrollX + innerWidth + 90;
    var ty = clamp(this.y + (Math.random() - 0.5) * 160, scrollY + 40, scrollY + innerHeight - 40);
    return this.move(tx, ty, (520 + Math.random() * 260) * (k || 1), 'cubic-bezier(.5,0,.9,.6)').then(function () { el.classList.add('parked'); });
  };
  // ...and comes back in from the side it left.
  Agent.prototype.unpark = function () {
    if (!this.gone) return;
    this.gone = false;
    var left = this.x - scrollX < innerWidth / 2;
    this.place(left ? scrollX - 70 : scrollX + innerWidth + 70, scrollY + innerHeight * (0.2 + Math.random() * 0.6));
    this.el.classList.remove('parked');
  };
  // Tiny drift instead of a dead stop while the agent "thinks".
  Agent.prototype.drift = function (ms) {
    return this.move(this.x + (Math.random() - 0.5) * 26, this.y + (Math.random() - 0.5) * 18, Math.max(60, ms), 'ease-in-out');
  };

  /* ---------------- actions ---------------- */
  // Drag a selection box over the element, then let it appear.
  async function draw(a, el, k, s, mode, done) {
    var r = pr(el);
    if (!inView(r)) return done(el);
    await a.move(r.x - 2, r.y - 2, a.travel(r.x, r.y, k));
    if (s.stopped) return;
    r = pr(el);
    var b = mk('sel', r, a.c);
    b.innerHTML = '<i></i><i></i><i></i><i></i><span class="sz">' + Math.round(r.w) + ' × ' + Math.round(r.h) + '</span>';
    var d = clamp(Math.sqrt(r.w * r.h) * 1.5, 300, 780) * k;
    b.animate([{ transform: 'scale(0.001)' }, { transform: 'scale(1)' }], { duration: d, easing: EASE_DRAW });
    await a.move(r.x + r.w, r.y + r.h, d, EASE_DRAW);
    if (s.stopped) return;
    b.classList.add('done');
    if (mode === 'scan') {
      var sd = Math.round(900 * k);
      el.style.setProperty('--sd', sd + 'ms');
      var sl = mk('scanl', { x: r.x, y: r.y, w: r.w, h: 2 }, a.c);
      sl.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(' + r.h + 'px)' }], { duration: sd, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      drop(sl, sd);
      done(el);
      await a.drift(260 * k);
      drop(b, sd * 0.7);
      return;
    }
    done(el);
    await a.drift(150 * k);
    drop(b, 200 * k);
  }

  // Click into a heading and "type" it: steps() clip reveal that the I-beam follows.
  async function type(a, el, k, s) {
    var er = pr(el);
    if (!inView(er)) return reveal(el);
    var tb = textBox(el), box = tb.box, first = tb.first;
    var ly = first.y + first.h / 2;
    await a.move(box.x - 4, ly, a.travel(box.x, ly, k));
    if (s.stopped) return reveal(el);
    var n = clamp((el.textContent || '').trim().length, 6, 40);
    var d = n * 34 * k;
    var r0 = Math.max(0, er.x + er.w - box.x), r1 = Math.max(0, er.x + er.w - (box.x + box.w));
    var an = el.animate([{ clipPath: 'inset(-8px ' + r0 + 'px -8px -8px)' }, { clipPath: 'inset(-8px ' + r1 + 'px -8px -8px)' }],
      { duration: d, easing: 'steps(' + n + ', end)', fill: 'forwards' });
    s.anims.add(an);
    a.el.classList.add('ibeam');
    try {
      await a.move(box.x + box.w + 3, ly, d, 'steps(' + n + ', end)');
    } finally {
      reveal(el);
      an.cancel();
      s.anims.delete(an);
      a.el.classList.remove('ibeam');
    }
    await a.drift(120 * k);
  }

  // Draw the first child, Ctrl+C, then drag ghosts and Ctrl+V each sibling into place.
  async function group(a, g, k, s) {
    var now = [], later = [];
    Array.prototype.forEach.call(g.children, function (c) {
      if (built(c)) return;
      if (!hasBox(c)) return mark(c);
      var r = pr(c);
      if (inView(r)) now.push(c);
      else if (r.y + r.h < scrollY) mark(c); // already scrolled past: no show, just place it
      else later.push(c);
    });
    if (now.length) {
      await draw(a, now[0], k, s, 'draw', mark);
      if (s.stopped) return;
      if (now.length > 1) {
        var prev = pr(now[0]);
        await a.move(prev.x + prev.w / 2, prev.y + prev.h / 2, 170 * k);
        a.chip(MAC ? '⌘C' : 'Ctrl+C', 650);
        await a.drift(220 * k);
        var cap = tier.name === 'lite' ? 2 : 6;
        for (var i = 1; i < now.length; i++) {
          if (s.stopped) return;
          var c = now[i];
          if (built(c)) continue;
          if (i > cap) {
            var rest = now.slice(i);
            rest.forEach(function (x, j) { setTimeout(function () { mark(x); }, 40 + j * 55); });
            a.chip('×' + rest.length, 800);
            await a.drift(rest.length * 55 + 120);
            break;
          }
          var r = pr(c);
          var gh = mk('ghost', prev, a.c);
          var dx = r.x - prev.x, dy = r.y - prev.y;
          var d = clamp(Math.hypot(dx, dy) * 0.5, 200, 600) * k;
          gh.animate([{ transform: 'translate(0,0) scale(1,1)' },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (r.w / (prev.w || 1)) + ',' + (r.h / (prev.h || 1)) + ')' }],
            { duration: d, easing: EASE, fill: 'forwards' });
          await a.move(r.x + r.w / 2, r.y + r.h / 2, d, EASE);
          a.chip(MAC ? '⌘V' : 'Ctrl+V', 380);
          if (window.SFX) window.SFX.lock();
          mark(c);
          drop(gh, 60);
          prev = r;
        }
      }
    }
    if (later.length && !s.stopped) {
      // Rest of the group is below the fold: continue when it scrolls in.
      later[0].__grp = g;
      s.enq.delete(g);
      s.io.observe(later[0]);
      return 'partial';
    }
  }

  function run(a, el, k, s) {
    var kind = el.getAttribute('data-b');
    if (kind === 'group') return group(a, el, k, s);
    if (kind === 'type') return type(a, el, k, s);
    return draw(a, el, k, s, kind === 'scan' ? 'scan' : 'draw', reveal);
  }

  /* ---------------- scheduler ---------------- */
  function enqueue(s, el) {
    if (s.enq.has(el) || built(el)) return;
    s.enq.add(el);
    s.q.push({ el: el, t: performance.now() });
    s.wait.splice(0).forEach(function (r) { r(); });
  }

  function onIntersect(entries) {
    var s = S;
    if (!s || s.stopped) return;
    entries.filter(function (e) { return e.isIntersecting; })
      .sort(function (p, q) { return (p.boundingClientRect.top - q.boundingClientRect.top) || (p.boundingClientRect.left - q.boundingClientRect.left); })
      .forEach(function (e) {
        s.io.unobserve(e.target);
        var el = e.target.__grp || e.target;
        e.target.__grp = null;
        enqueue(s, el);
      });
    // The build frontier only moves down: anything the visitor has already passed
    // (reload mid-page, fast jump) is placed instantly instead of waiting forever.
    s.steps.forEach(function (el) {
      if (built(el) || s.enq.has(el)) return;
      var r = el.getBoundingClientRect();
      if (r.height && r.bottom < -40) { s.io.unobserve(el); reveal(el); }
    });
    progress(s);
  }

  async function worker(a, s) {
    while (!s.stopped) {
      var item = s.q.shift();
      if (!item) {
        // idle agents swarm around the screen a little before they park
        a.idle = (a.idle || 0) + 1;
        if (a.idle <= 3 && !a.gone) {
          await a.move(scrollX + innerWidth * (0.08 + Math.random() * 0.84), scrollY + innerHeight * (0.12 + Math.random() * 0.72), (650 + Math.random() * 550) * tier.k, EASE);
          continue;
        }
        await a.leave(tier.k);
        progress(s);
        await new Promise(function (r) { s.wait.push(r); });
        continue;
      }
      var el = item.el;
      if (built(el)) continue;
      a.idle = 0;
      a.unpark();
      a.busy = (el.className || el.tagName).toString().slice(0, 24) + ':' + el.getAttribute('data-b');
      var age = performance.now() - item.t;
      var k = tier.k * (s.q.length >= tier.agents * 2 ? 0.55 : 1);
      var res;
      try {
        if (age > 6000) reveal(el);
        else res = await run(a, el, k, s);
      } catch (e) { res = null; }
      if (res !== 'partial') reveal(el);
      progress(s);
    }
  }

  function progress(s) {
    if (!s || s.finished) return;
    var n = 0;
    for (var i = 0; i < s.steps.length; i++) if (built(s.steps[i])) n++;
    hudN.textContent = n;
    hudBar.style.transform = 'scaleX(' + (n / s.steps.length) + ')';
    hudHint.textContent = s.q.length ? '' : t('scroll');
    if (n >= s.steps.length) finish(false);
  }

  function start() {
    if (!supported) { revealAll(); root.classList.remove('build-on'); return; }
    var all = steps();
    var s = S = { steps: all, q: [], wait: [], enq: new Set(), anims: new Set(), agents: [], stopped: false, finished: false, t0: performance.now(), io: null };
    all.forEach(function (el) { if (!hasBox(el)) reveal(el); });
    hud.hidden = false;
    hud.classList.remove('done');
    hudLabel.textContent = t('build') + ' · ' + tier.agents + ' ' + t('agents');
    hudSkipT.textContent = t('skip');
    hudT.textContent = all.length;
    var x0 = scrollX + innerWidth / 2, y0 = scrollY + innerHeight - 40;
    for (var i = 0; i < tier.agents; i++) s.agents.push(new Agent(i, x0 + (i - (tier.agents - 1) / 2) * 18, y0));
    s.io = new IntersectionObserver(onIntersect, { rootMargin: '0px 0px -4% 0px', threshold: 0 });
    all.forEach(function (el) { if (!built(el)) s.io.observe(el); });
    s.agents.forEach(function (a) { worker(a, s); });
    progress(s);
  }

  function finish(skipped) {
    var s = S;
    if (!s || s.finished) return;
    s.finished = s.stopped = true;
    s.wait.splice(0).forEach(function (r) { r(); });
    if (s.io) s.io.disconnect();
    try { sessionStorage.setItem('meg:built', '1'); } catch (e) {}
    var secs = ((performance.now() - s.t0) / 1000).toFixed(1);
    if (!skipped && window.SFX) window.SFX.success();
    hud.classList.add('done');
    hudLabel.textContent = skipped ? t('skipped') : t('done') + ' · ' + secs + 's';
    hudHint.textContent = '';
    hudN.textContent = s.steps.length;
    hudBar.style.transform = 'scaleX(1)';
    s.agents.forEach(function (a) { if (skipped) a.el.classList.add('parked'); else a.leave(0.8); });
    setTimeout(function () { if (S === s) { layer.textContent = ''; root.classList.remove('build-on'); } }, skipped ? 300 : 1000);
    setTimeout(function () { if (S === s) hud.hidden = true; }, skipped ? 900 : 2600);
    document.dispatchEvent(new CustomEvent('meg:build-done', { detail: { skipped: skipped, secs: secs } }));
  }

  function skip() {
    var s = S;
    if (!s || s.finished) return;
    root.classList.add('instant');
    s.stopped = true;
    s.anims.forEach(function (an) { an.cancel(); });
    s.agents.forEach(function (a) { if (a.anim) a.anim.cancel(); });
    $$('.sel,.ghost,.scanl', layer).forEach(function (n) { n.remove(); });
    revealAll();
    finish(true);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('instant'); }); });
  }

  function replay() {
    if (!supported) return false;
    if (S && !S.finished) skip();
    var sb = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = sb;
    root.classList.add('instant');
    $$('.is-built').forEach(function (n) { n.classList.remove('is-built'); });
    layer.textContent = '';
    root.classList.add('build-on');
    void root.offsetWidth;
    root.classList.remove('instant');
    try { sessionStorage.removeItem('meg:built'); } catch (e) {}
    S = null;
    requestAnimationFrame(function () { try { start(); } catch (e) { revealAll(); root.classList.remove('build-on'); } });
    return true;
  }

  /* ---------------- wiring ---------------- */
  hudSkip.addEventListener('click', skip);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S && !S.finished) skip(); });
  // Keyboard users must never land on invisible content.
  document.addEventListener('focusin', function (e) {
    var s = S;
    if (!s || s.finished) return;
    for (var i = 0; i < s.steps.length; i++) if (s.steps[i].contains(e.target)) { reveal(s.steps[i]); break; }
    progress(s);
  }, true);

  window.MEGBuild = {
    tier: tier,
    supported: supported,
    replay: replay,
    skip: skip,
    running: function () { return !!S && !S.finished; },
    debug: function () {
      return S && { q: S.q.map(function (i) { return (i.el.className || i.el.tagName).toString().slice(0, 24); }), wait: S.wait.length,
        agents: S.agents.map(function (a) { return [Math.round(a.x), Math.round(a.y), a.el.classList.contains('parked') ? 'P' : '', a.busy || '']; }) };
    }
  };

  async function boot() {
    if (!root.classList.contains('build-on')) return;
    if (!supported) { revealAll(); root.classList.remove('build-on'); return; }
    // Let the boot screen finish first; the agents start as it powers off.
    try { if (window.MEG && window.MEG.bootDone) await Promise.race([window.MEG.bootDone, sleep(180000)]); } catch (e) {}
    try {
      await Promise.race([
        Promise.all([document.fonts ? document.fonts.ready : null, window.MEG && window.MEG.ready]),
        sleep(1500)
      ]);
    } catch (e) {}
    try { start(); } catch (e) { revealAll(); root.classList.remove('build-on'); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
