/*!
 * jarvis.js — JARVIS, a small quadcopter companion (a nod to VectorX).
 * Drawn in a 3/4 front view: all four props on top, the rear pair further back,
 * a gimbal camera under the nose that follows the mouse cursor.
 * Flight: a continuous spring-mass loop that drifts on layered sines and roams
 * only inside the empty side margins (never over text), with scroll inertia.
 * It never talks on its own: when it has something to say about the current
 * section a pulsing "!" appears above it; click to hear it (it flies over, locks
 * on and explains, then returns to its margin). No "!" → menu.
 * Transform-only; static on reduced motion; no roaming on small/low-end devices.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lite = root.classList.contains('lite');
  var lang = function () { return root.getAttribute('data-lang') === 'en' ? 'en' : 'tr'; };
  var x = function (tr, en) { return lang() === 'en' ? en : tr; };
  var sfx = function (n, a) { var S = window.SFX; if (S && S[n]) { try { S[n](a); } catch (e) {} } };
  var raf = function (f) { return requestAnimationFrame(f); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var small = function () { return innerWidth < 760; };
  var vw = function () { return document.documentElement.clientWidth || innerWidth; }; // excludes the scrollbar
  var seen = {};
  try { seen = JSON.parse(sessionStorage.getItem('meg:jv-seen') || '{}'); } catch (e) {}
  var remember = function (k) { seen[k] = 1; try { sessionStorage.setItem('meg:jv-seen', JSON.stringify(seen)); } catch (e) {} };

  /* ---------------- DOM ---------------- */
  var el = document.createElement('div');
  el.id = 'jarvis';
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.innerHTML =
    '<div class="jv-body">' +
      '<svg class="jv-svg" viewBox="-6 12 152 60" aria-hidden="true">' +
        // 3/4 front view. Rear pair sits higher, narrower and dimmer (further away); arms tuck behind the shell.
        '<g class="jv-rear"><path class="jv-arm" d="M57 37 36 24"/><path class="jv-arm" d="M83 37 104 24"/>' +
          '<rect class="jv-mot" x="31.5" y="22" width="9" height="6" rx="2.5"/><rect class="jv-mot" x="99.5" y="22" width="9" height="6" rx="2.5"/>' +
          '<ellipse class="jv-cap" cx="36" cy="22.6" rx="3.6" ry="1.1"/><ellipse class="jv-cap" cx="104" cy="22.6" rx="3.6" ry="1.1"/></g>' +
        '<path class="jv-shell" d="M47 38C51 30 89 30 93 38L96 47C87 55 53 55 44 47Z"/>' +
        '<path class="jv-deck" d="M49.5 38C54 32.5 86 32.5 90.5 38C83 42.5 57 42.5 49.5 38Z"/>' +
        '<path class="jv-visor" d="M55 37C63 33.5 77 33.5 85 37"/>' +
        '<path class="jv-trim" d="M50 46C60 50 80 50 90 46"/>' +
        '<circle class="jv-led" cx="70" cy="33" r="1.6"/>' +
        // front pair: wider, lower, in front of the shell
        '<g class="jv-front"><path class="jv-arm" d="M49 45 17 43"/><path class="jv-arm" d="M91 45 123 43"/>' +
          '<rect class="jv-mot" x="11" y="40" width="12" height="9" rx="3"/><rect class="jv-mot" x="117" y="40" width="12" height="9" rx="3"/>' +
          '<ellipse class="jv-cap" cx="17" cy="40.9" rx="4.8" ry="1.4"/><ellipse class="jv-cap" cx="123" cy="40.9" rx="4.8" ry="1.4"/>' +
          '<circle class="jv-nav" cx="17" cy="51.5" r="1.4"/><circle class="jv-nav" cx="123" cy="51.5" r="1.4"/></g>' +
        // gimbal camera under the nose — this is the eye that follows the cursor
        '<path class="jv-yoke" d="M60 51v5a10 10 0 0 0 20 0v-5"/>' +
        '<circle class="jv-cam" cx="70" cy="60" r="8"/>' +
        '<circle class="jv-lens" cx="70" cy="60" r="5.4"/>' +
        '<circle class="jv-iris" cx="70" cy="60" r="3.4"/>' +
        '<circle class="jv-pupil" cx="70" cy="60" r="1.7"/>' +
      '</svg>' +
      '<i class="jv-rot b l"></i><i class="jv-rot b r"></i><i class="jv-rot f l"></i><i class="jv-rot f r"></i>' +
      '<span class="jv-alert" aria-hidden="true">!</span>' +
      '<span class="jv-tag">JARVIS · MEG-1453</span>' +
    '</div>' +
    '<div class="jv-say" hidden><p class="jv-txt" role="status" aria-live="polite"></p><div class="jv-act"></div></div>';
  var beam = document.createElement('div'); beam.id = 'jv-beam'; beam.setAttribute('aria-hidden', 'true');
  var box = document.createElement('div'); box.id = 'jv-box'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = '<i></i><i></i><i></i><i></i><span></span>';
  var say$ = el.querySelector('.jv-say'), txt$ = el.querySelector('.jv-txt'), act$ = el.querySelector('.jv-act');
  var pupil = el.querySelector('.jv-pupil'), iris = el.querySelector('.jv-iris');

  /* ---------------- flight model ----------------
   * Idle JARVIS lives only in the empty side margins next to the content column
   * ("gutters"), so it never covers text. It roams up/down and left/right inside a
   * gutter and now and then slips out of the screen edge and comes back in on the
   * other side (never crossing the page). Only when it explains something may it
   * fly over the content; afterwards it returns to a margin. If the margins are too
   * narrow (tablet/phone/small window) it parks small in the bottom-right corner. */
  var W = 104, H = 83, launched = false, sayOpen = false, touring = false, scanEl = null, scanLabel = '';
  var S = { x: 0, y: 0, vx: 0, vy: 0, mode: 'idle', target: null, arrived: null, roamT: 0, lastSY: 0, last: 0, mx: -999, my: -999, mIn: false,
    side: 'r', fx: 0.5, fy: 0.46, warp: false, free: false, near: false, ex: 0, ey: 0, rot: 0 };
  var GUT = { l: 0, r: 0 }, fit = 'gut'; // 'gut' (margins wide enough) | 'dock' (corner)
  var NAV = 62;
  function measure() {
    var w = $('main .wrap') || $('.wrap'), cw = vw();
    if (w) {
      var r = w.getBoundingClientRect(), cs = getComputedStyle(w);
      GUT.l = Math.max(0, r.left + (parseFloat(cs.paddingLeft) || 0));
      GUT.r = Math.max(0, cw - (r.right - (parseFloat(cs.paddingRight) || 0)));
    } else { GUT.l = GUT.r = 0; }
    var g = Math.min(GUT.l, GUT.r);
    if (!small() && g - 16 >= 64) { fit = 'gut'; W = Math.round(Math.min(118, g - 16)); }
    else { fit = 'dock'; W = small() ? 64 : 72; }
    H = Math.round(W * 60 / 152); // svg viewBox aspect
    el.style.setProperty('--jw', W + 'px');
    el.classList.toggle('jv-compact', W < 96);
    var nav = $('.nav'); NAV = nav ? nav.getBoundingClientRect().height || 62 : 62;
  }
  // the x/y range a drone centre may use inside one gutter
  function lane(side) {
    var g = side === 'l' ? GUT.l : GUT.r, cw = vw();
    var lo = side === 'l' ? 8 + W / 2 : cw - g + 8 + W / 2;
    var hi = side === 'l' ? g - 8 - W / 2 : cw - 8 - W / 2;
    if (hi < lo) hi = lo = (lo + hi) / 2;
    return { lo: lo, hi: hi, top: NAV + 34 + H / 2, bot: innerHeight - H / 2 - 44 };
  }
  function anchor(t) {
    if (fit === 'dock') {
      var lift = root.classList.contains('build-on') ? 70 : 0;
      return { x: vw() - W / 2 - 10, y: innerHeight - H / 2 - 12 - lift + (reduced ? 0 : Math.sin(t * 0.0011) * 2) };
    }
    var L = lane(S.side), a = reduced ? 0 : 1;
    if (S.warp) return { x: S.side === 'r' ? vw() + W : -W, y: S.y };
    var bx = L.lo + (L.hi - L.lo) * S.fx, by = L.top + Math.max(0, L.bot - L.top) * S.fy;
    var x0 = bx + (Math.sin(t * 0.00037) * 9 + Math.sin(t * 0.00071) * 4) * a;
    var y0 = by + (Math.sin(t * 0.00053) * 14 + Math.cos(t * 0.00029) * 8) * a;
    return { x: clamp(x0, L.lo, L.hi), y: y0 };
  }
  // Unity-style SmoothDamp: a critically damped spring toward a moving target, in px and px/s
  function smoothDamp(cur, target, vel, smoothTime, dt, maxSpeed) {
    var omega = 2 / Math.max(0.0001, smoothTime), k = omega * dt;
    var ex = 1 / (1 + k + 0.48 * k * k + 0.235 * k * k * k);
    var change = clamp(cur - target, -maxSpeed * smoothTime, maxSpeed * smoothTime);
    var t2 = cur - change, temp = (vel + omega * change) * dt;
    var nv = (vel - omega * temp) * ex, out = t2 + (change + temp) * ex;
    if ((target - cur > 0) === (out > target)) { out = target; nv = 0; } // never overshoot
    return [out, nv];
  }
  function pickSide() { // nearest margin to where it is now
    S.side = S.x < vw() / 2 ? 'l' : 'r';
  }
  function beside(r) {
    if (!small() && r.right + W + 30 < vw()) return { x: r.right + W / 2 + 18, y: clamp(r.top + 46, 90, innerHeight - H - 30) };
    if (!small() && r.left - W - 30 > 0) return { x: r.left - W / 2 - 18, y: clamp(r.top + 46, 90, innerHeight - H - 30) };
    return { x: clamp(r.right - W / 2, W / 2 + 6, vw() - W / 2 - 6), y: clamp(r.top - H / 2 - 12, 90, innerHeight - H - 30) };
  }
  function targetPt(t) {
    if (S.mode === 'goto' && S.target) return beside(S.target.getBoundingClientRect());
    return anchor(t);
  }
  function apply(rot) {
    el.style.transform = 'translate3d(' + (S.x - W / 2).toFixed(1) + 'px,' + (S.y - H / 2).toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg)';
  }
  function tick(now) {
    if (!launched) return;
    raf(tick);
    if (document.hidden || root.classList.contains('crashing')) { S.last = now; return; }
    var dt = Math.min(0.05, (now - (S.last || now)) / 1000) || 1 / 60, f = dt * 60;
    S.last = now;
    var idle = S.mode === 'idle';
    // scrolling no longer kicks the drone: it is position:fixed and simply holds its place while the page moves
    // roam inside the margin: up/down + a little left/right; sometimes switch margins through the screen edge
    if (idle && fit === 'gut' && !S.free && !S.warp && !sayOpen && !lite && !reduced && now > S.roamT) {
      if (Math.random() < 0.28 && GUT.l - 16 >= W && GUT.r - 16 >= W) S.warp = true;
      else { S.fy = 0.08 + Math.random() * 0.84; S.fx = Math.random(); }
      S.roamT = now + 5200 + Math.random() * 4800;
    }
    var T = targetPt(now);
    // critically damped follow (no overshoot, no bounce): ease out of rest, glide, settle
    var st = S.mode === 'goto' ? 0.42 : S.warp ? 0.65 : 1.05, vmax = S.mode === 'goto' ? 1700 : 620;
    var rx = smoothDamp(S.x, T.x, S.vx, st, dt, vmax), ry = smoothDamp(S.y, T.y, S.vy, st, dt, vmax);
    var nx = rx[0], ny = ry[0], cw = vw();
    S.vx = rx[1]; S.vy = ry[1];
    if (idle && fit === 'gut' && !S.free) {
      // hard wall on the content side of the margin; the outer screen edge is open for the side switch
      var L = lane(S.side);
      if (S.side === 'r') { if (nx < L.lo) { nx = L.lo; S.vx = Math.max(0, S.vx); } nx = Math.min(nx, cw + W * 1.5); }
      else { if (nx > L.hi) { nx = L.hi; S.vx = Math.min(0, S.vx); } nx = Math.max(nx, -W * 1.5); }
      if (S.warp && (S.side === 'r' ? nx > cw + W * 0.55 : nx < -W * 0.55)) { // out → re-enter on the other side
        S.side = S.side === 'r' ? 'l' : 'r';
        nx = S.side === 'r' ? cw + W * 0.6 : -W * 0.6;
        S.vx = 0; S.warp = false; S.fx = Math.random() * 0.6; S.fy = 0.15 + Math.random() * 0.7;
        if (S.side === 'r') S.fx = 1 - S.fx;
      }
    } else {
      nx = clamp(nx, W / 2 + 10, cw - W / 2 - 10);
    }
    S.x = nx;
    S.y = clamp(ny, H / 2 + NAV + 4, innerHeight - H / 2 - 8);
    var sp = Math.hypot(S.vx, S.vy);
    if (S.free && idle) { var Lf = lane(S.side); if (S.x >= Lf.lo - 2 && S.x <= Lf.hi + 2) S.free = false; } // back in its margin
    if (S.arrived && Math.hypot(T.x - S.x, T.y - S.y) < 26 && sp < 140) { var r = S.arrived; S.arrived = null; r(); }
    // gentle bank into the direction of travel, smoothed so it never snaps
    S.rot += (clamp(S.vx * 0.011, -8, 8) - S.rot) * Math.min(1, dt * 7);
    apply(S.rot);
    // camera: locks on the scan target, otherwise follows the mouse cursor, otherwise looks where it flies
    var ex, ey, near = false;
    if (scanEl) { var sr = scanEl.getBoundingClientRect(), a1 = Math.atan2(sr.top + Math.min(sr.height, innerHeight) / 2 - S.y, sr.left + sr.width / 2 - S.x); ex = Math.cos(a1) * 2.1; ey = Math.sin(a1) * 2.1; }
    else if (S.mIn) {
      var mdx = S.mx - S.x, mdy = S.my - S.y, md = Math.hypot(mdx, mdy) || 1, m = Math.min(1, md / 120);
      ex = mdx / md * 2.1 * m; ey = mdy / md * 2.1 * m;
      near = md < 170;
    } else { ex = clamp(S.vx * 0.005, -1.8, 1.8); ey = clamp(S.vy * 0.004, -1.6, 1.6); }
    var e = Math.min(1, 0.22 * f);
    S.ex += (ex - S.ex) * e; S.ey += (ey - S.ey) * e;
    pupil.setAttribute('transform', 'translate(' + S.ex.toFixed(2) + ' ' + S.ey.toFixed(2) + ')');
    iris.setAttribute('transform', 'translate(' + (S.ex * 0.5).toFixed(2) + ' ' + (S.ey * 0.5).toFixed(2) + ')');
    if (near !== S.near) { S.near = near; el.classList.toggle('jv-near', near); }
    if (scanEl) placeScan();
  }
  document.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; S.mx = e.clientX; S.my = e.clientY; S.mIn = true; }, { passive: true });
  document.documentElement.addEventListener('mouseleave', function () { S.mIn = false; });
  window.addEventListener('blur', function () { S.mIn = false; });
  var rzT = 0;
  window.addEventListener('resize', function () { clearTimeout(rzT); rzT = setTimeout(measure, 120); });

  function flyTo(t$) {
    S.mode = 'goto';
    S.target = t$;
    S.warp = false;
    return new Promise(function (res) {
      var done = false, fin = function () { if (!done) { done = true; res(); } };
      S.arrived = fin;
      setTimeout(fin, 3400);
    });
  }
  function rest() {
    var was = S.mode;
    S.mode = 'idle'; S.target = null; S.arrived = null;
    if (was !== 'idle' && fit === 'gut') { pickSide(); S.fy = clamp((S.y - NAV - 34) / Math.max(1, innerHeight - NAV - 78), 0.08, 0.92); S.fx = S.side === 'r' ? 0.3 : 0.7; S.free = true; S.roamT = performance.now() + 5000; }
  }

  /* ---------------- scan: laser + lock-on box (tracks while scrolling) ---------------- */
  var scanT = 0;
  function placeScan() {
    var r = scanEl.getBoundingClientRect(), p = 8;
    var h = Math.min(r.height, innerHeight * 0.8);
    box.style.transform = 'translate(' + Math.round(r.left - p) + 'px,' + Math.round(r.top - p) + 'px)';
    box.style.width = Math.round(r.width + p * 2) + 'px';
    box.style.height = Math.round(h + p * 2) + 'px';
    var lx = S.x, ly = S.y;
    var tx = clamp(lx, r.left + 10, r.right - 10), ty = clamp(ly, r.top + 10, r.top + h - 10);
    var len = Math.hypot(tx - lx, ty - ly), ang = Math.atan2(ty - ly, tx - lx);
    beam.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px) rotate(' + ang.toFixed(4) + 'rad) scaleX(' + len.toFixed(1) + ')';
  }
  function scan(t$, label, ms) {
    if (!t$) return;
    scanEl = t$;
    scanLabel = label;
    box.lastChild.textContent = label + ' ' + (0.93 + Math.random() * 0.06).toFixed(2) + ' · JARVIS';
    placeScan();
    box.classList.add('on');
    beam.classList.add('on');
    sfx('zap');
    clearTimeout(scanT);
    scanT = setTimeout(unscan, ms || 2600);
  }
  function unscan() { clearTimeout(scanT); scanEl = null; box.classList.remove('on'); beam.classList.remove('on'); }

  /* ---------------- speech bubble (only ever on request) ---------------- */
  var sayT = 0, typeTok = 0;
  function say(text, actions, ms) {
    clearTimeout(sayT);
    var tok = ++typeTok;
    sayOpen = true;
    say$.hidden = false;
    say$.classList.toggle('flip', S.x < vw() / 2);
    requestAnimationFrame(function () { say$.classList.add('on'); });
    act$.innerHTML = '';
    txt$.textContent = '';
    var i = 0;
    var done = function () {
      txt$.textContent = text;
      (actions || []).forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'jv-btn' + (a.primary ? ' pri' : '');
        b.textContent = a.label;
        b.addEventListener('click', function (e) { e.stopPropagation(); sfx('tick'); a.fn(); });
        act$.appendChild(b);
      });
      if (!actions || !actions.length) sayT = setTimeout(hush, ms || 7000);
    };
    if (reduced) return done();
    (function f() {
      if (tok !== typeTok) return;
      i = Math.min(text.length, i + 2);
      txt$.textContent = text.slice(0, i);
      sfx('blip');
      i < text.length ? setTimeout(f, 18) : done();
    })();
  }
  function hush() {
    clearTimeout(sayT);
    typeTok++;
    sayOpen = false;
    say$.classList.remove('on');
    setTimeout(function () { if (!sayOpen) say$.hidden = true; }, 250);
    if (!touring) { unscan(); rest(); setTimeout(refreshAlert, 300); }
  }

  /* ---------------- what JARVIS knows about each section ---------------- */
  function spots() {
    return [
      { id: 'hero', sec: 'hero', el: '#hero .hero-title', label: x('insan', 'person'),
        t: x("Merhaba! Ben JARVIS, Muhammet'in asistanıyım. İstersen sana onu 60 saniyede anlatayım.", "Hi! I'm JARVIS, Muhammet's assistant. Want me to show you around in 60 seconds?") },
      { id: 'about', sec: 'about', el: '#portrait', label: x('insan', 'person'),
        t: x('Bu Muhammet. Kendi yazdığı model onu da tespit etti; güven skoru 0.99.', 'This is Muhammet. The model he built detected him too — confidence 0.99.') },
      { id: 'vectorx', sec: 'vectorx', el: '#vectorx .award', label: 'VectorX',
        t: x("En gurur duyduğu proje: drone'lar için yapay zekâ. 5 kişilik takımın kaptanıydı ve Türkiye 3.'sü oldular.", 'His proudest project: AI for drones. He captained a 5-person team that placed 3rd in Türkiye.') },
      { id: 'vxsteps', sec: null, el: '#vectorx .steps', label: x('görev', 'task'),
        t: x("Sistem üç iş yapıyor: görüntüdeki nesneleri buluyor, GPS'siz konum hesaplıyor ve fotoğraftaki hedefi arıyor.", 'The system does three jobs: finds objects in the image, works out its position without GPS and hunts for the target in a photo.') },
      { id: 'security', sec: 'security', el: '#security .audit', label: 'MT-29',
        t: x('Burada kendi uygulamasına saldırgan gibi saldırıp 4 ciddi açığı kapattı. Her sürümde 281 otomatik güvenlik testi çalışıyor.', 'Here he attacked his own app like an adversary and closed 4 serious holes. 281 automated security tests run on every release.') },
      { id: 'projects', sec: 'projects', el: '#ai-control', label: 'AI Control',
        t: x('Şu an geliştirdiği proje: benim gibi yapay zekâ asistanlarına kalıcı hafıza veren ve telefondan yönetilen bir araç.', 'What he is building right now: a tool that gives AI assistants like me a persistent memory and remote control from the phone.') },
      { id: 'skills', sec: 'skills', el: '#chart-areas', label: x('grafik', 'chart'),
        t: x('En çok mobil/web ve backend projesi var; yapay zekâ hemen arkasından geliyor.', 'Most of his projects are mobile/web and backend, with AI right behind.') },
      { id: 'experience', sec: 'experience', el: '#chart-time', label: x('zaman', 'timeline'),
        t: x('Okulu, TEKNOFEST kulübünü ve T3 Vakfı görevini aynı anda yürütüyor.', 'He runs university, the TEKNOFEST club and his T3 Foundation role at the same time.') },
      { id: 'contact', sec: 'contact', el: '#contact .contact-card', label: x('iletişim', 'contact'),
        t: x('Beğendiysen buradan ulaşabilirsin. E-postası tek tıkla kopyalanıyor.', 'Liked it? Reach him here — his e-mail copies with one click.') }
    ];
  }
  function spotBy(key, val) { var s = spots(); for (var i = 0; i < s.length; i++) if (s[i][key] === val) return s[i]; return null; }

  /* ---------------- the "!" — something to say about where you are ---------------- */
  var pending = null; // 'greet' | spot id
  function setAlert(p) {
    pending = p;
    el.classList.toggle('has-alert', !!p);
    el.setAttribute('aria-label', p ? x('JARVIS: yeni bir notu var, dinlemek için tıkla', 'JARVIS has a note for you — click to hear it') : x('JARVIS asistanı: menüyü aç', 'JARVIS assistant: open menu'));
  }
  var currentSec = 'hero';
  function refreshAlert() { // "!" for the section on screen, if JARVIS hasn't explained it yet
    if (!launched || pending === 'greet' || touring) return;
    var s = spotBy('sec', currentSec);
    setAlert(s && s.id !== 'hero' && !seen['s:' + s.id] ? s.id : null);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        currentSec = e.target.id;
        refreshAlert();
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 }); // a section counts once it crosses the middle band — works for sections taller than the screen too
    ['hero', 'about', 'vectorx', 'security', 'projects', 'skills', 'experience', 'contact'].forEach(function (id) { var n = document.getElementById(id); if (n) io.observe(n); });
  }
  async function comment(s) {
    remember('s:' + s.id);
    setAlert(null);
    var t$ = $(s.el);
    if (!t$) return;
    var r = t$.getBoundingClientRect();
    if (r.top < 70 || r.top > innerHeight * 0.7) {
      t$.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      await new Promise(function (res) { setTimeout(res, reduced ? 0 : 650); });
    }
    await flyTo(t$);
    scan(t$, s.label, 7000);
    say(s.t, [{ label: x('Tamam', 'OK'), primary: true, fn: hush }, { label: x('Tura çık ›', 'Take the tour ›'), fn: function () { hush(); tour(0); } }]);
  }
  function greet() {
    remember('greet');
    setAlert(null);
    say(greetText, [
      { label: x('▶ Turu başlat', '▶ Start the tour'), primary: true, fn: function () { hush(); tour(0); } },
      { label: x('Sonra', 'Later'), fn: hush }
    ]);
  }

  /* ---------------- guided tour ---------------- */
  var TOUR = ['hero', 'vectorx', 'vxsteps', 'security', 'projects', 'skills', 'experience', 'contact'];
  var tourI = 0, tourT = 0;
  async function tour(i) {
    touring = true;
    setAlert(null);
    tourI = i || 0;
    clearTimeout(tourT);
    var s = spotBy('id', TOUR[tourI]), t$ = s && $(s.el);
    if (!t$) return endTour();
    sayOpen = false; say$.classList.remove('on');
    t$.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    await new Promise(function (res) { setTimeout(res, reduced ? 0 : 750); });
    if (!touring) return;
    await flyTo(t$);
    if (!touring) return;
    scan(t$, s.label, 11000);
    var last = tourI >= TOUR.length - 1;
    say((tourI + 1) + '/' + TOUR.length + ' · ' + s.t, [
      { label: last ? x('Bitir', 'Finish') : x('İleri ›', 'Next ›'), primary: true, fn: function () { last ? endTour() : tour(tourI + 1); } },
      { label: x('Turu kapat', 'Close tour'), fn: endTour }
    ]);
    TOUR.slice(0, tourI + 1).forEach(function (id) { remember('s:' + id); });
    tourT = setTimeout(function () { if (touring) (last ? endTour() : tour(tourI + 1)); }, 12000);
  }
  function endTour() {
    touring = false;
    clearTimeout(tourT);
    unscan();
    rest();
    say(x('Tur bitti! Soru sormak istersen bana tıkla ya da terminale yaz.', "That's the tour! Click me or use the terminal if you have a question."), null, 5000);
  }

  /* ---------------- menu ---------------- */
  function menu() {
    if (touring) return;
    sfx('tick');
    var soundOn = window.SFX && !window.SFX.muted;
    say(x('Ne yapalım?', 'What shall we do?'), [
      { label: x('▶ 60 saniyelik tur', '▶ 60-second tour'), primary: true, fn: function () { hush(); tour(0); } },
      { label: x('Bu bölümü anlat', 'Explain this section'), fn: function () { hush(); var s = spotBy('sec', currentSec); if (s) comment(s); } },
      { label: x('Soru sor', 'Ask a question'), fn: function () { hush(); if (window.MEG && window.MEG.focusTerm) window.MEG.focusTerm('jarvis '); } },
      { label: soundOn ? x('Sesi kapat', 'Mute') : x('Sesi aç', 'Sound on'), fn: function () { if (window.SFX) { window.SFX.unlock(); window.SFX.setMute(soundOn); } hush(); } },
      { label: '×', fn: hush }
    ]);
  }
  function activate() {
    if (sayOpen && !touring) { hush(); return; }
    if (pending === 'greet') return greet();
    if (pending) { var s = spotBy('id', pending); if (s) return comment(s); }
    menu();
  }
  el.addEventListener('click', function (e) { if (e.target.closest('.jv-say')) return; activate(); });
  el.addEventListener('keydown', function (e) { if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate(); } });

  /* ---------------- launch ---------------- */
  var greetText = '';
  function launch(opts) {
    opts = opts || {};
    measure();
    if (!launched) {
      launched = true;
      document.body.appendChild(beam);
      document.body.appendChild(box);
      document.body.appendChild(el);
      S.x = innerWidth + W; S.y = innerHeight * 0.42; S.lastSY = scrollY;
      apply(0);
      requestAnimationFrame(function () { el.classList.add('on'); });
      sfx('power');
      if (reduced) { var a = anchor(0); S.x = a.x; S.y = a.y; apply(0); }
      raf(tick);
      if (reduced) setInterval(function () { var p = targetPt(0); S.x = p.x; S.y = p.y; apply(0); if (scanEl) placeScan(); }, 500);
    }
    // never speaks first: a greeting only shows up as a "!" to click
    if (opts.greet && !seen.greet) {
      greetText = opts.greet === 'recovered'
        ? x("Sistem kurtarıldı. Ben JARVIS, Muhammet'in asistanıyım. İstersen seni 60 saniyede projelerinde gezdireyim.", "System recovered. I'm JARVIS, Muhammet's assistant. Want a 60-second tour of his projects?")
        : x("Merhaba, ben JARVIS. Muhammet'in projelerini 60 saniyede gezdirebilirim.", "Hi, I'm JARVIS. I can show you Muhammet's projects in 60 seconds.");
      setAlert('greet');
    } else setAlert(pending);
  }
  window.JARVIS = { launch: launch, tour: function () { launch(); tour(0); }, say: function (t) { if (launched) say(t, null, 5000); } };

  // Returning visitors (no intro this session): appear on their own.
  if (!root.classList.contains('boot-on')) setTimeout(function () { launch({ greet: 'hello' }); }, 2600);
  document.addEventListener('meg:lang', function () { if (launched) setAlert(pending); });
})();
