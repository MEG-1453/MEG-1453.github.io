/*!
 * main.js — i18n, navigation, terminal (JARVIS offline Q&A), counters, video chapters.
 * Zero dependencies. Every loop pauses when the tab is hidden.
 */
(function () {
  'use strict';

  /* ===== config ===== */
  var EMAIL = 'muhammetemingenc679@gmail.com';
  var PHONE = '+905335635229';
  var PHONE_H = '+90 533 563 52 29';
  var GITHUB = 'https://github.com/MEG-1453';
  var LINKEDIN = 'https://www.linkedin.com/in/muhammet-emin-gen%C3%A7-a6797a38b/';
  // "Buy me a coffee" goes straight to WhatsApp (prefilled message) or e-mail — no third-party payment page.
  var CV = { tr: 'assets/cv/Muhammet_Emin_Genc_CV_TR.pdf', en: 'assets/cv/Muhammet_Emin_Genc_CV_EN.pdf' };

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MEG = window.MEG = window.MEG || {};
  MEG.lang = root.getAttribute('data-lang') === 'en' ? 'en' : 'tr';
  MEG.t0 = performance.now();
  var x = function (tr, en) { return MEG.lang === 'en' ? en : tr; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* =====================================================================
     i18n — Turkish lives in the HTML; English is loaded on demand.
     ===================================================================== */
  var TR_META = { title: document.title, desc: ($('meta[name="description"]') || {}).content || '' };
  var enPromise = null;
  function loadEN() {
    if (window.MEG_EN) return Promise.resolve(window.MEG_EN);
    if (!enPromise) enPromise = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'assets/js/lang-en.js?v=20261106';
      s.onload = function () { window.MEG_EN ? res(window.MEG_EN) : rej(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return enPromise;
  }
  function swap(l, d) {
    $$('[data-i18n]').forEach(function (n) {
      if (n.__tr == null) n.__tr = n.innerHTML;
      var v = l === 'en' ? d[n.getAttribute('data-i18n')] : n.__tr;
      if (v != null && n.innerHTML !== v) n.innerHTML = v;
    });
    $$('[data-i18n-ph]').forEach(function (n) {
      if (n.__trph == null) n.__trph = n.placeholder;
      n.placeholder = l === 'en' ? (d[n.getAttribute('data-i18n-ph')] || n.__trph) : n.__trph;
    });
    $$('[data-i18n-label]').forEach(function (n) {
      if (n.__trl == null) n.__trl = n.getAttribute('aria-label') || '';
      n.setAttribute('aria-label', l === 'en' ? (d[n.getAttribute('data-i18n-label')] || n.__trl) : n.__trl);
    });
    MEG.lang = l;
    root.lang = l;
    root.setAttribute('data-lang', l);
    document.title = l === 'en' ? d['meta.title'] : TR_META.title;
    var md = $('meta[name="description"]');
    if (md) md.content = l === 'en' ? d['meta.desc'] : TR_META.desc;
    $$('[data-cv]').forEach(function (a) { a.href = CV[l]; });
    $$('#lang-btn [data-l]').forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-l') === l); });
    $$('[data-n]').forEach(fmtNum);
    roles();
    document.dispatchEvent(new CustomEvent('meg:lang', { detail: l }));
  }
  function setLang(l, save) {
    if (save) { try { localStorage.setItem('meg:lang', l); } catch (e) {} }
    if (l === 'en') return loadEN().then(function (d) { swap('en', d); }, function () { swap('tr', {}); });
    swap('tr', {});
    return Promise.resolve();
  }
  MEG.setLang = setLang;

  /* ===== numbers (tr: 26.002 / 0,87 — en: 26,002 / 0.87) ===== */
  function fmt(v, dec) {
    try { return new Intl.NumberFormat(MEG.lang === 'en' ? 'en-US' : 'tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v); }
    catch (e) { return v.toFixed(dec); }
  }
  function fmtNum(n) { if (!n.__counting) n.textContent = fmt(+n.getAttribute('data-n'), +(n.getAttribute('data-dec') || 0)); }
  function countUp(n) {
    if (reduced || n.__counting) return;
    var to = +n.getAttribute('data-n'), dec = +(n.getAttribute('data-dec') || 0), d = 950, t0 = performance.now();
    n.__counting = true;
    (function tick(now) {
      var p = Math.max(0, Math.min(1, (now - t0) / d)), e = 1 - Math.pow(1 - p, 3);
      n.textContent = fmt(to * e, dec);
      if (p < 1) requestAnimationFrame(tick); else { n.__counting = false; fmtNum(n); }
    })(t0);
  }
  document.addEventListener('meg:built', function (e) {
    var el = e.target;
    (el.hasAttribute('data-count') ? [el] : $$('[data-count]', el)).forEach(countUp);
    if (!reduced && el.classList.contains('mem-demo')) el.classList.add('play');
  });

  /* ===== hero role rotator ===== */
  var roleEl = $('#role'), roleTimer = 0, heroVisible = true;
  function roles() {
    if (!roleEl) return;
    clearTimeout(roleTimer);
    var list = (roleEl.getAttribute('data-roles-' + MEG.lang) || '').split('|').filter(Boolean);
    var i = 0;
    roleEl.textContent = list[0] || '';
    if (reduced || list.length < 2) return;
    function later(fn, ms) { roleTimer = setTimeout(function () { (document.hidden || !heroVisible) ? later(fn, 1200) : fn(); }, ms); }
    function erase(cb) {
      var s = roleEl.textContent;
      (function f() { s = s.slice(0, -2); roleEl.textContent = s; s.length ? (roleTimer = setTimeout(f, 22)) : cb(); })();
    }
    function typeIn(s, cb) {
      var n = 0;
      (function f() { n++; roleEl.textContent = s.slice(0, n); n < s.length ? (roleTimer = setTimeout(f, 40)) : cb(); })();
    }
    (function cycle() { later(function () { erase(function () { i = (i + 1) % list.length; typeIn(list[i], cycle); }); }, 2800); })();
  }
  var hero = $('#hero');
  if (hero && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { heroVisible = es[0].isIntersecting; }).observe(hero);

  MEG.ready = setLang(MEG.lang, false);

  /* =====================================================================
     nav
     ===================================================================== */
  var nav = $('.nav'), menuBtn = $('.menu-btn');
  function closeMenu() { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', function () { var o = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(o)); });
  $$('.nav-links a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  $('#lang-btn').addEventListener('click', function () { setLang(MEG.lang === 'tr' ? 'en' : 'tr', true); });

  if ('IntersectionObserver' in window) {
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (es) { nav.classList.toggle('scrolled', !es[0].isIntersecting); }).observe(sentinel);

    var links = {};
    $$('.nav-links a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var secObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('active', k === e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { secObs.observe(s); });
  }

  /* =====================================================================
     sysbar: Istanbul clock, uptime, page weight
     ===================================================================== */
  var clockEl = $('#clock'), upEl = $('#uptime');
  var tf = null;
  try { tf = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); } catch (e) {}
  function uptime() {
    var s = Math.floor((performance.now() - MEG.t0) / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function tick() {
    if (document.hidden) return;
    if (tf) clockEl.textContent = tf.format(new Date());
    upEl.textContent = uptime();
    var cc = document.getElementById('ct-clock');
    if (cc && tf) cc.textContent = tf.format(new Date()).slice(0, 5);
  }
  tick();
  setInterval(tick, 1000);

  function weight() {
    var b = 0;
    try {
      var navE = performance.getEntriesByType('navigation')[0];
      if (navE) b += navE.transferSize || navE.encodedBodySize || 0;
      performance.getEntriesByType('resource').forEach(function (r) {
        if (!/\.(mp4|webm)(\?|$)/.test(r.name)) b += r.transferSize || r.encodedBodySize || 0;
      });
    } catch (e) {}
    MEG.weight = b ? Math.round(b / 1024) + ' KB' : '—';
    $('#weight').textContent = MEG.weight;
  }
  window.addEventListener('load', function () { setTimeout(weight, 400); });

  document.addEventListener('DOMContentLoaded', function () {
    var B = window.MEGBuild;
    if (B) $('#agents-n').textContent = B.tier.agents + ' · ' + B.tier.name;
  });

  /* =====================================================================
     video: lazy poster + chapters
     ===================================================================== */
  var video = $('#vx-video');
  if (video) {
    var setPoster = function () { if (!video.poster) video.poster = video.getAttribute('data-poster'); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { setPoster(); o.disconnect(); } }, { rootMargin: '700px 0px' }).observe(video);
    } else setPoster();
    // Autoplay (muted) while at least half of the video is on screen; never fights a manual pause.
    var saveData = navigator.connection && navigator.connection.saveData;
    if (!saveData && 'IntersectionObserver' in window) {
      var autoPause = false, userPaused = false;
      video.muted = true;
      video.loop = true;
      video.addEventListener('pause', function () { if (!autoPause) userPaused = true; autoPause = false; });
      video.addEventListener('play', function () { userPaused = false; });
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) {
          setPoster();
          if (video.paused && !userPaused) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
        } else if (!video.paused) { autoPause = true; video.pause(); }
      }, { threshold: 0.5 }).observe(video);
    }
    var chaps = $$('.chap');
    chaps.forEach(function (b) {
      b.addEventListener('click', function () {
        var at = +b.getAttribute('data-t');
        var go = function () { try { video.currentTime = at; } catch (e) {} var p = video.play(); if (p && p.catch) p.catch(function () {}); };
        setPoster();
        if (video.readyState >= 1) go();
        else { video.preload = 'metadata'; video.addEventListener('loadedmetadata', go, { once: true }); video.load(); }
      });
    });
    var last = -2;
    video.addEventListener('timeupdate', function () {
      var ct = video.currentTime, idx = -1;
      chaps.forEach(function (b, i) { if (ct >= +b.getAttribute('data-t') - 0.5) idx = i; });
      if (idx !== last) { last = idx; chaps.forEach(function (b, i) { b.classList.toggle('on', i === idx); }); }
    });
  }

  /* =====================================================================
     copy, toast, share, support
     ===================================================================== */
  var toastEl = $('#toast'), toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-copy');
      copy(v).then(function (ok) { toast(ok ? x('Kopyalandı: ', 'Copied: ') + v : v); });
    });
  });

  // prefilled WhatsApp / e-mail text follows the page language
  function supportLinks() {
    var wa = $('#wa-btn'), ml = $('#coffee-btn');
    var msg = x('Merhaba Muhammet, portfolyonu gördüm ve sana bir kahve ısmarlamak istiyorum ☕', 'Hi Muhammet, I saw your portfolio and would like to buy you a coffee ☕');
    if (wa) wa.href = 'https://wa.me/' + PHONE.replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
    if (ml) ml.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(x('☕ Kahve ısmarlamak istiyorum', '☕ I would like to buy you a coffee'));
  }
  supportLinks();
  document.addEventListener('meg:lang', supportLinks);

  var shareBtn = $('#share-btn');
  if (shareBtn) shareBtn.addEventListener('click', function () {
    var data = { title: document.title, text: x('Muhammet Emin Genç — portfolyo', 'Muhammet Emin Genç — portfolio'), url: location.href.split('#')[0] };
    if (navigator.share) navigator.share(data).catch(function () {});
    else copy(data.url).then(function () { toast(x('Bağlantı kopyalandı', 'Link copied')); });
  });

  /* =====================================================================
     TERMINAL
     ===================================================================== */
  var term = { body: $('#term-body'), out: $('#term-out'), form: $('#term-form'), input: $('#term-in'), hist: [], hi: -1 };
  var chain = Promise.resolve();
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduced ? 0 : ms); }); };
  function scrollTerm() { term.body.scrollTop = term.body.scrollHeight; }
  function print(html, cls) {
    var d = document.createElement('div');
    d.className = 'tl' + (cls ? ' ' + cls : '');
    d.innerHTML = html;
    term.out.appendChild(d);
    while (term.out.childElementCount > 240) term.out.firstChild.remove();
    scrollTerm();
    return d;
  }
  function printLines(lines, gap) {
    return lines.reduce(function (p, l) { return p.then(function () { print(l[0], l[1]); return wait(gap == null ? 45 : gap); }); }, Promise.resolve());
  }
  function typeInto(node, text) {
    return new Promise(function (res) {
      if (reduced) { node.textContent = text; scrollTerm(); return res(); }
      var i = 0;
      (function f() {
        i = Math.min(text.length, i + 3);
        node.textContent = text.slice(0, i);
        scrollTerm();
        i < text.length ? requestAnimationFrame(f) : res();
      })();
    });
  }
  var link = function (label, cmd) { return '<button type="button" class="t-link" data-run="' + esc(cmd) + '">' + esc(label) + '</button>'; };
  var pad = function (s, n) { s = String(s); return s + ' '.repeat(Math.max(1, n - s.length)); };

  var TARGETS = { 'ai-control': 'ai-control', aicontrol: 'ai-control', aic: 'ai-control', hafiza: 'ai-control', memory: 'ai-control', about: 'about', hakkimda: 'about', vectorx: 'vectorx', vx: 'vectorx', teknofest: 'vectorx', security: 'security', guvenlik: 'security', mt29: 'security', projects: 'projects', projeler: 'projects', jarvis: 'projects', esenlink: 'projects', regulator: 'projects', github: 'projects', skills: 'skills', yetkinlikler: 'skills', experience: 'experience', deneyim: 'experience', contact: 'contact', iletisim: 'contact', support: 'support', destek: 'support', kahve: 'support', coffee: 'support' };
  function go(id) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }
  function norm(s) {
    return String(s).toLocaleLowerCase('tr').replace(/[ıİ]/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[âà]/g, 'a').replace(/î/g, 'i').replace(/[^a-z0-9.+ ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ----- JARVIS offline knowledge base ----- */
  var KB = [
    { k: ['kimsin', 'sen kim', 'who are you', 'jarvis nedir', 'jarvis ne', 'what is jarvis', 'jarvis'], go: 'projects',
      tr: "Ben JARVIS'in portföy modu. Asıl Jarvis, Muhammet'in ROS 2 tabanlı otonom cihazları bulutta çalışan bir Spring Boot backend'i üzerinden izleyip yöneten edge-to-cloud sistemi (v1.0 → v3.0, K3s, PostgreSQL). Ben burada çevrimdışı bir bilgi tabanıyla onun hakkındaki soruları yanıtlıyorum.",
      en: "I'm JARVIS in portfolio mode. The real Jarvis is Muhammet's edge-to-cloud system that monitors and manages ROS 2 autonomous devices through a Spring Boot backend in the cloud (v1.0 → v3.0, K3s, PostgreSQL). Here I answer questions about him from an offline knowledge base." },
    { k: ['teknofest', 'derece', 'yarisma', 'odul', 'ucuncu', 'award', 'competition', 'rank', 'third'], go: 'vectorx',
      tr: "TEKNOFEST 2026 Havacılıkta Yapay Zekâ Yarışması'nda VectorX takımı Türkiye 3.'sü oldu. Muhammet takım kaptanıydı; model mimarisi kararlarını, eğitim-değerlendirme döngüsünü, teknik raporlamayı ve 5 kişilik ekibin koordinasyonunu yürüttü.",
      en: "At the TEKNOFEST 2026 Artificial Intelligence in Aviation competition, team VectorX placed 3rd in Türkiye. Muhammet was team captain and led model architecture decisions, the training/evaluation loop, technical reporting and a 5-person team." },
    { k: ['vectorx', 'iha', 'drone', 'uav', 'yolo', 'tespit', 'detection', 'odometri', 'odometry', 'map'], go: 'vectorx',
      tr: "VectorX üç görevi tek oturumda, internetsiz çözüyor: YOLO11x + P2 ile nesne tespiti (mAP@0,5: 0,30 → 0,87), DPVO görsel odometri ile konum kestirimi (ort. hata 7,71 m → 6,03 m) ve OWLv2 + DINOv3 + LightGlue ile referans nesne eşleştirme (VS1: 0,23 → 0,86).",
      en: "VectorX solves three tasks in one offline session: object detection with YOLO11x + P2 (mAP@0.5: 0.30 → 0.87), position estimation with DPVO visual odometry (mean error 7.71 m → 6.03 m) and reference-object matching with OWLv2 + DINOv3 + LightGlue (VS1: 0.23 → 0.86)." },
    { k: ['gpu', 'rtx', 'dpvo', 'hizlan', 'blackwell', 'cuda', 'speed', 'fast'], go: 'vectorx',
      tr: "Araştırma kodu olan DPVO, o tarihte desteklenmeyen RTX 5070 Ti (Blackwell) mimarisine 42 satırlık hedefli bir değişiklikle taşındı: 8 kat hızlandı, sadakat testlerinde davranış farkı yalnızca %1,2.",
      en: "DPVO, a research codebase, was ported to the then-unsupported RTX 5070 Ti (Blackwell) with a targeted 42-line change: 8× faster, with only a 1.2% behavioural difference in fidelity tests." },
    { k: ['veri', 'etiket', 'dataset', 'label', 'annotation'], go: 'vectorx',
      tr: "Ekip 5.577 karede 26.002 kutuyu elle etiketledi; çelişkili etiketli 1.778 kare ayrı bir havuzda düzeltildi. UAP/UAİ sınıflarında 0,95+ AP'nin ana nedeni bu karar.",
      en: "The team hand-labelled 26,002 boxes across 5,577 frames; 1,778 frames with conflicting labels were fixed in a separate pool. That decision is the main reason for 0.95+ AP on the landing-area classes." },
    { k: ['mt29', 'mt-29', 'mesaj', 'chat', 'android', 'kotlin', 'messaging'], go: 'security',
      tr: "MT-29 Chat; mesajlaşma, sesli/görüntülü arama ve acil durum özelliklerini birleştiren güvenlik odaklı aile iletişim uygulaması. Android (Kotlin · Compose) + Spring Boot, EMQX, PostgreSQL, Redis ve Coturn; kendi sunucusunda Docker Compose ile. Tek geliştirici, uçtan uca.",
      en: "MT-29 Chat is a security-first family communication app combining messaging, voice/video calls and emergency features. Android (Kotlin · Compose) + Spring Boot, EMQX, PostgreSQL, Redis and Coturn, self-hosted with Docker Compose. Solo developer, end to end." },
    { k: ['guvenlik', 'security', 'acik', 'zafiyet', 'vulnerab', 'sifre', 'encrypt', 'aes', 'e2e', 'audit', 'pentest'], go: 'security',
      tr: "MT-29'da veriler AES-256-GCM ile şifreli saklanıyor, bildirimler HPKE / X25519 ile uçtan uca şifreli. Muhammet kendi denetiminde 3 kritik ve 1 yüksek seviyeli açığı bulup kapattı; canlının kopyasında 281 otomatik güvenlik kontrolü koşuyor ve 55 kütüphane açığı yamandı.",
      en: "In MT-29, data is stored encrypted with AES-256-GCM and notifications are end-to-end encrypted with HPKE / X25519. In his own audit Muhammet found and fixed 3 critical and 1 high-severity issue; 281 automated security checks run against a copy of production and 55 dependency vulnerabilities were patched." },
    { k: ['siber', 'cyber', 'ctf', 'hack', 'kali', 'hackviser', 'recon', 'nmap'], go: 'projects',
      tr: "Siber Vatan Programı / Hackviser CTF'e katıldı (Eki–Ara 2025) ve Ekim 2026'da yeniden başladı; Kali Linux kullanıyor. GitHub'da asenkron Python ile yazdığı MEG-1453 Recon ağ keşif aracı var; güvenliği kendi ürünlerinde saldırgan gözüyle denetleyerek uyguluyor.",
      en: "He took part in the Siber Vatan Programme / Hackviser CTF (Oct–Dec 2025) and rejoined it in October 2026; he works on Kali Linux. His GitHub has MEG-1453 Recon, an async-Python network reconnaissance tool; he applies security by auditing his own products with an attacker's mindset." },
    { k: ['ai control', 'ai-control', 'aicontrol', 'aic', 'hafiza', 'memory', 'claude', 'mcp', 'uzaktan', 'remote', 'kalici'], go: 'ai-control',
      tr: "AI Control, Muhammet'in şu an geliştirdiği proje: Claude Code için uzaktan kontrol ve kalıcı hafıza. Oturumlar telefondan (PWA, Tailscale özel ağı), PC'den ve VS Code'dan aynı canlı terminalle yönetiliyor. Hafıza 9 araçlı bir MCP sunucusunda; yalnızca onaylanan bilgi Markdown kasaya ve yerel git geçmişine yazılıyor, zaman makinesiyle geri alınabiliyor. Node.js 22, node-pty, WebSocket, Preact; 73 otomatik test.",
      en: "AI Control is what Muhammet is building right now: remote control and persistent memory for Claude Code. Sessions are driven from the phone (PWA over a private Tailscale network), the PC and VS Code through the same live terminal. Memory lives in a 9-tool MCP server; only approved facts are written to a Markdown vault with local git history and can be rolled back with a time machine. Node.js 22, node-pty, WebSocket, Preact; 73 automated tests." },
    { k: ['esenlink', 'esenler', 'fintech', 'akilli sehir', 'smart city', 'nestjs', 'escrow'], go: 'projects',
      tr: "EsenLink, gençleri, esnafı ve belediyeyi buluşturan akıllı şehir FinTech ekosistemi: Next.js 14 + NestJS + Prisma, PostgreSQL 16, Redis 7 ve MinIO. e-Devlet girişi (mock), güvenli havuz (escrow), adil ücret hesaplama ve yapay zekâ destekli dolandırıcılık tespiti içeriyor.",
      en: "EsenLink is a smart-city FinTech ecosystem connecting young people, local businesses and the municipality: Next.js 14 + NestJS + Prisma, PostgreSQL 16, Redis 7 and MinIO, with e-Government login (mock), escrow, fair-wage calculation and AI-assisted fraud detection." },
    { k: ['regulator', 'finans', 'finance', 'para', 'money', 'llm', 'ollama', 'openai', 'gemini'], go: 'projects',
      tr: "Regulator, yapay zekâ destekli kişisel finans yönetimi. 'Dün Migros'tan kartla 450 TL alışveriş yaptım' gibi cümleleri ayrıştırıp kaydediyor; LLM motoru yerel (Ollama) ya da bulut (OpenAI, Gemini) olarak seçilebiliyor. Java 21 + Spring Boot ve Next.js 14.",
      en: "Regulator is AI-assisted personal finance. It parses sentences like 'Yesterday I spent 450 TL at Migros by card' and records them; the LLM engine can be local (Ollama) or cloud (OpenAI, Gemini). Java 21 + Spring Boot and Next.js 14." },
    { k: ['social', 'sosyal', 'spring security', 'ilk backend', 'first backend', 'jwt'], go: 'projects',
      tr: "Social Backend, Muhammet'in Java ile yazdığı ilk backend: kullanıcı, gönderi, yorum ve beğeni akışlarına sahip bir sosyal medya REST API'si. JWT tabanlı Spring Security, DTO katmanı, global hata yönetimi ve Controller → Service → Repository mimarisi; arayüzü React.",
      en: "Social Backend is Muhammet's first Java backend: a social-media REST API with users, posts, comments and likes. JWT-based Spring Security, a DTO layer, global error handling and a Controller → Service → Repository architecture, with a React front end." },
    { k: ['yetenek', 'yetkinlik', 'skill', 'teknoloji', 'stack', 'python', 'java', 'bildigi', 'know'], go: 'skills',
      tr: "Ana yığın: Python · PyTorch · YOLO · OpenCV | Java · Spring Boot · PostgreSQL · Docker / K3s | Kotlin · Jetpack Compose | TypeScript · NestJS · Next.js | ROS 2 · ESP32.",
      en: "Core stack: Python · PyTorch · YOLO · OpenCV | Java · Spring Boot · PostgreSQL · Docker / K3s | Kotlin · Jetpack Compose | TypeScript · NestJS · Next.js | ROS 2 · ESP32." },
    { k: ['okul', 'universite', 'egitim', 'ogrenci', 'school', 'university', 'education', 'student', 'sinif'], go: 'experience',
      tr: "Nişantaşı Üniversitesi, Yazılım Mühendisliği (İngilizce), 3. sınıf · 2023–2028 (beklenen).",
      en: "Nişantaşı University, Software Engineering (taught in English), 3rd year · 2023–2028 (expected)." },
    { k: ['deneyim', 'experience', 'liderlik', 'leadership', 't3', 'koordinator', 'kulup', 'club'], go: 'experience',
      tr: "T3 Vakfı / TEKNOFEST İstanbul İl Koordinatörlüğü'nde üniversite ilişkileri temsilcisi (Ağu 2026–) ve Nişantaşı Üniversitesi TEKNOFEST Kulübü'nde yönetim kurulu üyesi (projeler ve yarışmalar, Eki 2025–).",
      en: "University relations representative at the T3 Foundation / TEKNOFEST Istanbul Provincial Coordination (Aug 2026–) and board member (projects & competitions, Oct 2025–) of the Nişantaşı University TEKNOFEST Club." },
    { k: ['iletisim', 'contact', 'mail', 'ulas', 'reach', 'linkedin', 'telefon', 'phone', 'numara'], go: 'contact',
      tr: 'E-posta: ' + EMAIL + ' · Telefon: ' + PHONE_H + " · GitHub: MEG-1453 · LinkedIn: muhammet-emin-genç. 'email' yazarsan adresi panoya kopyalarım.",
      en: 'E-mail: ' + EMAIL + ' · Phone: ' + PHONE_H + " · GitHub: MEG-1453 · LinkedIn: muhammet-emin-genç. Type 'email' and I'll copy the address." },
    { k: ['staj', 'is firsat', 'is teklif', 'ise al', 'hire', 'firsat', 'birlikte calis', 'teklif', ' job', 'intern', 'work with'], go: 'contact',
      tr: 'Proje, staj ve iş görüşmeleri için en hızlı yol doğrudan e-posta: ' + EMAIL + " — 'cv' yazarsan özgeçmiş de iner.",
      en: 'For projects, internships or job conversations the fastest route is e-mail: ' + EMAIL + " — type 'cv en' to download the résumé." },
    { k: ['cv', 'ozgecmis', 'resume'], go: 'contact',
      tr: "'cv' yaz, Türkçe PDF iner; 'cv en' İngilizce sürümü indirir.",
      en: "Type 'cv en' for the English PDF, or 'cv' for the Turkish one." },
    { k: ['ingilizce', 'arapca', 'english', 'arabic', 'dil', 'language'], go: 'experience',
      tr: 'İngilizce B2 (eğitim dili İngilizce), Arapça A2, ana dili Türkçe.',
      en: 'English B2 (his degree is taught in English), Arabic A2, native Turkish.' },
    { k: ['nerede', 'konum', 'sehir', 'where', 'location', 'istanbul', 'yasiyor'], go: 'contact',
      tr: 'İstanbul, Türkiye.', en: 'İstanbul, Türkiye.' },
    { k: ['kahve', 'coffee', 'destek', 'support', 'bagis', 'donate'], go: 'support',
      tr: "Çalışmalarını beğendiysen sayfanın sonundaki 'Kahve ısmarla' bölümünden ona WhatsApp'tan ya da e-postayla doğrudan yazabilirsin — ya da GitHub'da bir ⭐ bırak.",
      en: "If you like his work, the 'Buy me a coffee' section at the end of the page lets you message him directly on WhatsApp or by e-mail — or leave a ⭐ on GitHub." },
    { k: ['site', 'portfolyo', 'portfolio', 'nasil yapildi', 'how was', 'agent', 'build', 'performans', 'performance'], go: null,
      tr: "Bu site sıfır bağımlılıkla yazıldı: saf HTML, CSS ve JS. Gördüğün agentlar yalnızca transform/opacity animasyonu kullanıyor; düşük donanımlı cihazlarda sayıları otomatik azalıyor, 'azaltılmış hareket' tercihinde hiç çalışmıyorlar. 'build' yazarsan sayfayı yeniden inşa ederler.",
      en: "This site has zero dependencies: plain HTML, CSS and JS. The agents only animate transform/opacity; on low-end devices their number drops automatically and with 'reduced motion' they don't run at all. Type 'build' and they'll rebuild the page." },
    { k: ['merhaba', 'selam', 'hello', ' hi ', ' hey ', 'naber'], go: null,
      tr: "Merhaba! Bana Muhammet'in projelerini, TEKNOFEST derecesini, güvenlik çalışmalarını ya da iletişim bilgilerini sorabilirsin.",
      en: 'Hi! Ask me about Muhammet\'s projects, his TEKNOFEST placement, his security work or how to contact him.' },
    { k: ['tesekkur', 'sagol', 'thanks', 'thank you'], go: null,
      tr: 'Rica ederim. İyi incelemeler!', en: 'You\'re welcome. Enjoy the tour!' }
  ];
  var MISS = {
    tr: "Bunu bilgi tabanımda bulamadım. Şunları deneyebilirsin: teknofest · vectorx · güvenlik · mt29 · esenlink · iletişim — ya da doğrudan yaz: " + EMAIL,
    en: "I couldn't find that in my knowledge base. Try: teknofest · vectorx · security · mt29 · esenlink · contact — or write directly: " + EMAIL
  };

  function ask(q) {
    var n = ' ' + norm(q) + ' ';
    if (!n.trim()) {
      var d0 = print('<span class="who">jarvis ›</span> <span></span>', 'jv');
      return typeInto(d0.lastChild, KB[0][MEG.lang]).then(function () {
        print(x('Örnekler: ', 'Try: ') + ['teknofest', 'vectorx', x('güvenlik', 'security'), 'esenlink', x('iletişim', 'contact')].map(function (s) { return link(s, 'jarvis ' + s); }).join(' · '), 't-dim');
      });
    }
    var thinking = print('<span class="t-c">jarvis</span> <span class="t-dim">' + x('düşünüyor…', 'thinking…') + '</span>');
    return wait(280).then(function () {
      var best = null, score = 0;
      KB.forEach(function (e, i) {
        var s = 0;
        e.k.forEach(function (k) { if (n.indexOf(k) !== -1) s += k.length > 4 ? 2 : 1; });
        if (i === 0 && s && n.trim().split(' ').length > 2) s -= 1; // prefer topic answers over the intro
        if (s > score) { score = s; best = e; }
      });
      thinking.remove();
      var d = print('<span class="who">jarvis ›</span> <span></span>', 'jv');
      return typeInto(d.lastChild, best ? best[MEG.lang] : MISS[MEG.lang]).then(function () {
        if (best && best.go) print(link('→ ' + x('bölüme git', 'go to section') + ': ' + best.go, 'open ' + best.go), 't-dim');
      });
    });
  }

  function downloadCV(l) {
    var a = document.createElement('a');
    a.href = CV[l];
    a.download = CV[l].split('/').pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
    print('<span class="t-ok">↓</span> ' + x('indiriliyor: ', 'downloading: ') + esc(a.download));
  }

  var CMDS = {
    help: { d: function () { return x('komut listesi', 'list commands'); }, run: function () {
      print(x('Kullanılabilir komutlar:', 'Available commands:'), 't-dim');
      Object.keys(CMDS).forEach(function (k) {
        if (CMDS[k].hidden) return;
        print('  ' + link(k, k) + ' '.repeat(Math.max(1, 11 - k.length)) + '<span class="t-dim">' + esc(CMDS[k].d()) + '</span>');
      });
      print(x("İpucu: Tab tamamlar, ↑ ↓ geçmişte gezer. Doğrudan soru da sorabilirsin: <span class='t-c'>teknofest derecesi ne?</span>",
        "Tip: Tab completes, ↑ ↓ walks history. You can also just ask: <span class='t-c'>what did he win at teknofest?</span>"), 't-dim');
    } },
    whoami: { d: function () { return x('kısaca ben', 'who I am'); }, run: function () {
      return printLines([
        ['<span class="t-b">Muhammet Emin Genç</span> — ' + x('yazılım mühendisliği öğrencisi (Nişantaşı Üni., 3. sınıf)', 'software engineering student (Nişantaşı Univ., 3rd year)')],
        [x('AI / bilgisayarlı görü · güvenli backend · Android · ROS 2', 'AI / computer vision · secure backend · Android · ROS 2'), 't-dim'],
        [x("VectorX takım kaptanı — TEKNOFEST 2026 Havacılıkta Yapay Zekâ, <span class='t-ok'>Türkiye 3.'sü</span>", "VectorX team captain — TEKNOFEST 2026 AI in Aviation, <span class='t-ok'>3rd in Türkiye</span>")],
        ['İstanbul, Türkiye', 't-dim']
      ], 60);
    } },
    neofetch: { d: function () { return x('sistem bilgisi', 'system info'); }, run: function () {
      var B = window.MEGBuild || { tier: { agents: 0, name: '-' } };
      var art = [' __  __ ___ ___ ', '|  \\/  | __/ __|', '| |\\/| | _| (_ |', '|_|  |_|___\\___|', '', '', '', '', '', '', '', ''];
      var k = function (a, b) { return '<span class="t-ok">' + a + '</span>: ' + b; };
      var info = [
        '<span class="t-ok">meg-1453</span>@<span class="t-ok">portfolio</span>', '-----------------',
        k('OS', 'MEG-OS 2026.11 (vanilla web)'), k('Host', 'Muhammet Emin Genç'), k('Kernel', 'HTML5 · CSS3 · ES2017'),
        k('Uptime', uptime()), k('Packages', x('0 (npm) · 0 framework', '0 (npm) · 0 frameworks')), k('Shell', 'jsh 1.0'),
        k(x('Ekran', 'Display'), screen.width + 'x' + screen.height + ' @' + (Math.round((window.devicePixelRatio || 1) * 100) / 100) + 'x'),
        k('CPU', (navigator.hardwareConcurrency || '?') + ' ' + x('çekirdek', 'cores') + (navigator.deviceMemory ? ' · ≥' + navigator.deviceMemory + ' GB' : '')),
        k('Agents', B.tier.agents + ' (' + B.tier.name + ')'), k(x('Sayfa', 'Page'), MEG.weight || '—')
      ];
      var narrow = term.body.clientWidth < 520;
      if (narrow) return printLines(art.slice(0, 4).map(function (a) { return ['<span class="t-ok">' + esc(a) + '</span>']; }).concat(info.map(function (i) { return [i]; })), 25);
      return printLines(info.map(function (i, n) { return ['<span class="t-ok">' + esc(pad(art[n] || '', 19)) + '</span>' + i]; }), 25);
    } },
    ls: { d: function () { return x('dosyalar', 'files'); }, run: function () {
      print(['about.txt', 'awards.log', 'skills.json', 'contact.txt'].map(function (f) { return link(f, 'cat ' + f); }).join('   ') + '   <span class="t-c">projects/</span>   cv_tr.pdf   cv_en.pdf');
    } },
    cat: { d: function () { return x('dosya oku (ls)', 'read a file (ls)'); }, run: function (a) {
      var f = (a[0] || '').toLowerCase();
      if (f === 'about.txt') return CMDS.whoami.run();
      if (f === 'awards.log') return printLines([
        ["<span class='t-dim'>[2026]</span>    TEKNOFEST " + x("Havacılıkta Yapay Zekâ — <span class='t-ok'>Türkiye 3.'sü</span> (VectorX, takım kaptanı)", "AI in Aviation — <span class='t-ok'>3rd in Türkiye</span> (VectorX, captain)")],
        ["<span class='t-dim'>[2026-03]</span> " + x('Milli Teknoloji Zirvesi — Yerli Savunma Ekosisteminin Geleceği', 'National Technology Summit — Future of the Domestic Defence Ecosystem')],
        ["<span class='t-dim'>[2026-10]</span> Siber Vatan / Hackviser CTF " + x('— yeniden başladım', '— rejoined')],
        ["<span class='t-dim'>[2025]</span>    Siber Vatan / Hackviser CTF · Talentcoders CodeSprint"]
      ], 60);
      if (f === 'skills.json') return printLines([
        ['{'],
        ['  <span class="t-c">"ai"</span>: ["PyTorch", "YOLO11", "OpenCV", "DPVO", "DINOv3", "Ollama"],'],
        ['  <span class="t-c">"backend"</span>: ["Spring Boot", "NestJS", "PostgreSQL", "Redis", "MQTT", "Docker", "K3s"],'],
        ['  <span class="t-c">"mobile_web"</span>: ["Kotlin", "Jetpack Compose", "WebRTC", "React", "Next.js"],'],
        ['  <span class="t-c">"robotics"</span>: ["ROS 2", "ESP32", "STM32", "PID", "SLAM"],'],
        ['  <span class="t-c">"security"</span>: ["Kali Linux", "AES-256-GCM", "HPKE/X25519", "JWT", "OWASP"]'],
        ['}']
      ], 30);
      if (f === 'contact.txt') return CMDS.contact.run();
      if (f.indexOf('projects') === 0) { print(x("cat: projects/: bir dizin — 'projects' yaz", "cat: projects/: is a directory — try 'projects'"), 't-err'); return; }
      if (/\.pdf$/.test(f)) { print(x("cat: ikili dosya — 'cv' komutunu kullan", "cat: binary file — use 'cv'"), 't-err'); return; }
      print(x('cat: ' + esc(f || '?') + ': böyle bir dosya yok', 'cat: ' + esc(f || '?') + ': no such file'), 't-err');
    } },
    projects: { d: function () { return x('projeler', 'projects'); }, run: function () {
      var rows = [
        ['vectorx', 'vectorx', x("İHA otonomi hattı · TEKNOFEST 2026 Türkiye 3.'sü", 'UAV autonomy pipeline · TEKNOFEST 2026, 3rd in Türkiye')],
        ['ai-control', 'ai-control', x('Claude Code için uzaktan kontrol + kalıcı hafıza · MCP', 'remote control + persistent memory for Claude Code · MCP')],
        ['mt29', 'security', x('güvenlik odaklı iletişim · Android + Spring Boot', 'security-first messaging · Android + Spring Boot')],
        ['jarvis', 'projects', x('ROS 2 edge-to-cloud orkestrasyon · v1 → v3', 'ROS 2 edge-to-cloud orchestration · v1 → v3')],
        ['esenlink', 'projects', x('akıllı şehir FinTech · NestJS + Next.js', 'smart-city FinTech · NestJS + Next.js')],
        ['regulator', 'projects', x('yapay zekâ destekli finans · Spring Boot + LLM', 'AI-assisted finance · Spring Boot + LLM')],
        ['social', 'projects', x("ilk Java backend'im · Spring Security + JWT", 'first Java backend · Spring Security + JWT')],
        ['recon', 'projects', x('ağ keşif aracı · async Python', 'network recon tool · async Python')]
      ];
      return printLines(rows.map(function (r, i) {
        return ['<span class="t-dim">[' + (i + 1) + ']</span> ' + link(r[0], 'open ' + r[1]) + ' '.repeat(Math.max(1, 11 - r[0].length)) + '<span class="t-dim">' + esc(r[2]) + '</span>'];
      }).concat([[x("'open &lt;bölüm&gt;' ile git · GitHub: ", "'open &lt;section&gt;' to jump · GitHub: ") + '<a href="' + GITHUB + '" target="_blank" rel="noopener">MEG-1453</a>', 't-dim']]), 50);
    } },
    open: { d: function () { return x('bölüme git', 'jump to a section'); }, run: function (a) {
      var id = TARGETS[norm(a[0] || '')];
      if (!id) { print(x('open: hedefler → ', 'open: targets → ') + ['about', 'vectorx', 'security', 'projects', 'skills', 'experience', 'contact', 'support'].map(function (s) { return link(s, 'open ' + s); }).join(' '), 't-dim'); return; }
      print('<span class="t-ok">→</span> #' + id);
      go(id);
    } },
    scan: { d: function () { return x('portföyü tara (nmap-lite)', 'scan this portfolio (nmap-lite)'); }, run: function () {
      var rows = [
        ['22/tcp', 'open', 'about', x('hakkımda', 'about me'), 'about'],
        ['443/tcp', 'open', 'vectorx', x("TEKNOFEST 2026 · Türkiye 3.'sü", 'TEKNOFEST 2026 · 3rd in Türkiye'), 'vectorx'],
        ['8883/tcp', 'open', 'mt29-chat', 'MQTT/TLS · E2E push · AES-256-GCM', 'security'],
        ['stdio', 'open', 'ai-control', x('MCP hafıza · 9 araç · onaylı kayıt', 'MCP memory · 9 tools · approved writes'), 'ai-control'],
        ['7400/udp', 'open', 'jarvis', 'ROS 2 DDS · edge → cloud', 'projects'],
        ['3001/tcp', 'open', 'esenlink', 'NestJS API · Swagger', 'projects'],
        ['11434/tcp', 'open', 'ollama', x('regulator · yerel LLM', 'regulator · local LLM'), 'projects'],
        ['5432/tcp', 'filtered', 'postgresql', x('dışarıya kapalı — tasarım gereği', 'closed to the outside — by design'), null]
      ];
      return printLines([
        [x('nmap-lite 1.0 başlatılıyor → meg.portfolio', 'Starting nmap-lite 1.0 → meg.portfolio'), 't-dim'],
        [x('Host ayakta · 0 bağımlılık · 0 izleyici (tracker)', 'Host is up · 0 dependencies · 0 trackers'), 't-dim'],
        ['<span class="t-dim">' + pad('PORT', 11) + pad('STATE', 10) + pad('SERVICE', 12) + 'DETAIL</span>']
      ], 140).then(function () {
        return printLines(rows.map(function (r) {
          var svc = r[4] ? link(r[2], 'open ' + r[4]) + ' '.repeat(Math.max(1, 12 - r[2].length)) : pad(r[2], 12);
          return [pad(r[0], 11) + '<span class="' + (r[1] === 'open' ? 't-ok' : 't-warn') + '">' + pad(r[1], 10) + '</span>' + svc + '<span class="t-dim">' + esc(r[3]) + '</span>'];
        }), 110);
      }).then(function () {
        print(x('Tarama bitti: 1 host, ' + rows.length + ' servis. Servis adına tıkla → bölüme git.', 'Done: 1 host, ' + rows.length + ' services. Click a service → jump to its section.'), 't-dim');
      });
    } },
    jarvis: { d: function () { return x("Jarvis'e soru sor (çevrimdışı)", 'ask Jarvis (offline)'); }, run: function (a) { return ask(a.join(' ')); } },
    ask: { hidden: true, run: function (a) { return ask(a.join(' ')); } },
    contact: { d: function () { return x('iletişim bilgileri', 'contact details'); }, run: function () {
      return printLines([
        [pad('email', 10) + '<a href="mailto:' + EMAIL + '">' + EMAIL + '</a>'],
        [pad(x('telefon', 'phone'), 10) + '<a href="tel:' + PHONE + '">' + PHONE_H + '</a>'],
        [pad('linkedin', 10) + '<a href="' + LINKEDIN + '" target="_blank" rel="noopener">in/muhammet-emin-genç</a>'],
        [pad('github', 10) + '<a href="' + GITHUB + '" target="_blank" rel="noopener">github.com/MEG-1453</a>'],
        [pad(x('konum', 'location'), 10) + 'İstanbul, Türkiye']
      ], 50);
    } },
    email: { d: function () { return x('e-postayı kopyala', 'copy e-mail'); }, run: function () {
      return copy(EMAIL).then(function (ok) { print(ok ? '<span class="t-ok">✓</span> ' + x('panoya kopyalandı: ', 'copied to clipboard: ') + EMAIL : EMAIL); });
    } },
    cv: { d: function () { return x('CV indir [tr|en]', 'download CV [tr|en]'); }, run: function (a) { downloadCV((a[0] || MEG.lang) === 'en' ? 'en' : 'tr'); } },
    lang: { d: function () { return x('dil değiştir [tr|en]', 'switch language [tr|en]'); }, run: function (a) {
      var l = (a[0] || (MEG.lang === 'tr' ? 'en' : 'tr')).toLowerCase() === 'en' ? 'en' : 'tr';
      return setLang(l, true).then(function () { print('<span class="t-ok">✓</span> ' + x('dil: Türkçe', 'language: English')); });
    } },
    build: { d: function () { return x('sayfayı agentlara yeniden inşa ettir', 'let the agents rebuild the page'); }, run: function () {
      if (window.MEGBuild && window.MEGBuild.replay()) print('<span class="t-warn">[ .. ]</span> ' + x('agentlar sayfayı yeniden inşa ediyor… (Esc = atla)', 'agents are rebuilding the page… (Esc = skip)'));
      else print(x('Bu tarayıcı animasyonları desteklemiyor.', 'This browser does not support the animations.'), 't-err');
    } },
    coffee: { d: function () { return x('kahve ısmarla', 'buy me a coffee'); }, run: function () {
      print(x('Teşekkürler! Destek bölümüne gidiyorum…', 'Thank you! Heading to the support section…'));
      go('support');
    } },
    history: { d: function () { return x('komut geçmişi', 'command history'); }, run: function () {
      if (!term.hist.length) return print(x('(boş)', '(empty)'), 't-dim');
      term.hist.forEach(function (h, i) { print('<span class="t-dim">' + String(i + 1).padStart(3, ' ') + '</span>  ' + esc(h)); });
    } },
    clear: { d: function () { return x('ekranı temizle', 'clear the screen'); }, run: function () { term.out.textContent = ''; } },
    date: { hidden: true, run: function () { print(new Date().toLocaleString(MEG.lang === 'en' ? 'en-GB' : 'tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'full', timeStyle: 'medium' }) + ' (İstanbul)'); } },
    echo: { hidden: true, run: function (a) { print(esc(a.join(' '))); } },
    pwd: { hidden: true, run: function () { print('/home/meg/portfolio'); } },
    cd: { hidden: true, run: function () { print(x('cd: burası zaten ev', "cd: you're already home"), 't-dim'); } },
    sudo: { hidden: true, run: function () {
      print('[sudo] password for meg: ********', 't-dim');
      return wait(700).then(function () { print(x('meg sudoers dosyasında değil. Bu olay raporlanacak.', 'meg is not in the sudoers file. This incident will be reported.'), 't-err'); });
    } },
    rm: { hidden: true, run: function () { print(x('rm: izin reddedildi — bu portföy salt okunur ve yedekli.', 'rm: permission denied — this portfolio is read-only and backed up.'), 't-err'); } },
    hack: { hidden: true, run: function () { print(x("Etik kural #1: izinsiz erişim yok. Bunun yerine 'scan' ile bu portföyü tara.", "Ethics rule #1: no unauthorised access. Try 'scan' on this portfolio instead."), 't-warn'); } },
    exit: { hidden: true, run: function () { print(x("Çıkış yok. Ama 'contact' ile bana ulaşabilirsin.", "There's no way out. But 'contact' gets you to me."), 't-dim'); } }
  };

  function exec(line) {
    print('<span class="p">meg-1453@portfolio:~$</span> ' + esc(line));
    if (!line) return Promise.resolve();
    term.hist.push(line);
    if (term.hist.length > 50) term.hist.shift();
    term.hi = -1;
    var parts = line.split(/\s+/), name = parts[0].toLowerCase(), args = parts.slice(1);
    var cmd = CMDS[name];
    try {
      if (cmd) return Promise.resolve(cmd.run(args, line));
      if (/\s|\?/.test(line) || line.length > 12) return ask(line);
      print(x('komut bulunamadı: ', 'command not found: ') + esc(name) + " — " + link('help', 'help'), 't-err');
    } catch (e) { print('error: ' + esc(e.message || e), 't-err'); }
    return Promise.resolve();
  }
  function runCmd(line) { chain = chain.then(function () { return exec(String(line).trim()); }).catch(function () {}); return chain; }
  MEG.run = runCmd;

  term.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = term.input.value;
    term.input.value = '';
    runCmd(v);
  });
  term.input.addEventListener('keydown', function (e) {
    if (window.SFX && e.key.length === 1) window.SFX.key();
    if (e.key === 'Tab') {
      e.preventDefault();
      var v = term.input.value, parts = v.split(' ');
      var pool = parts.length === 1 ? Object.keys(CMDS).filter(function (k) { return !CMDS[k].hidden; })
        : parts[0] === 'open' ? ['about', 'vectorx', 'security', 'ai-control', 'projects', 'skills', 'experience', 'contact', 'support']
        : parts[0] === 'cat' ? ['about.txt', 'awards.log', 'skills.json', 'contact.txt']
        : parts[0] === 'cv' || parts[0] === 'lang' ? ['tr', 'en'] : [];
      var cur = parts[parts.length - 1];
      var m = pool.filter(function (k) { return k.indexOf(cur) === 0; });
      if (m.length === 1) { parts[parts.length - 1] = m[0]; term.input.value = parts.join(' ') + (parts.length === 1 ? ' ' : ''); }
      else if (m.length > 1) print(m.join('  '), 't-dim');
    } else if (e.key === 'ArrowUp') {
      if (!term.hist.length) return;
      e.preventDefault();
      term.hi = term.hi < 0 ? term.hist.length - 1 : Math.max(0, term.hi - 1);
      term.input.value = term.hist[term.hi];
    } else if (e.key === 'ArrowDown') {
      if (term.hi < 0) return;
      e.preventDefault();
      term.hi++;
      if (term.hi >= term.hist.length) { term.hi = -1; term.input.value = ''; } else term.input.value = term.hist[term.hi];
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      term.out.textContent = '';
    }
  });
  term.body.addEventListener('click', function (e) {
    if (e.target.closest('a,button')) return;
    var sel = window.getSelection && String(window.getSelection());
    if (!sel) term.input.focus({ preventScroll: true });
  });

  function focusTerm(prefill) {
    var side = $('.hero-side');
    if (side) side.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    setTimeout(function () {
      if (typeof prefill === 'string') term.input.value = prefill;
      term.input.focus({ preventScroll: true });
    }, reduced ? 0 : 350);
  }
  MEG.focusTerm = focusTerm;

  /* ----- sound toggle in the nav ----- */
  var sndBtn = $('#snd-btn');
  function sndState() {
    var on = !!(window.SFX && !window.SFX.muted);
    if (!sndBtn) return;
    sndBtn.classList.toggle('on', on);
    sndBtn.setAttribute('aria-pressed', String(on));
    sndBtn.title = on ? x('Ses: açık', 'Sound: on') : x('Ses: kapalı', 'Sound: off');
  }
  if (sndBtn) sndBtn.addEventListener('click', function () {
    if (!window.SFX) return;
    window.SFX.unlock();
    window.SFX.setMute(!window.SFX.muted);
    if (!window.SFX.muted) window.SFX.tick();
  });
  document.addEventListener('meg:sound', sndState);
  document.addEventListener('meg:lang', sndState);
  sndState();
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-run]');
    if (r) { runCmd(r.getAttribute('data-run')); return; }
    var c = e.target.closest('[data-cmd]');
    if (c) {
      var cmd = c.getAttribute('data-cmd');
      if (!c.closest('#hero') && cmd !== 'build') focusTerm();
      runCmd(cmd);
      return;
    }
    if (e.target.closest('[data-term-focus]')) focusTerm();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    focusTerm();
  });

  /* ----- boot sequence: starts when the agents place the terminal ----- */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    var B = window.MEGBuild;
    var building = !!(B && B.running());
    printLines([
      ['MEG-OS 2026.11 · jsh 1.0 · ' + x('0 bağımlılık', '0 dependencies'), 't-dim'],
      ['<span class="t-ok">[ OK ]</span> jarvis-core v3      ' + x('yüklendi · çevrimdışı mod', 'loaded · offline mode')],
      ['<span class="t-ok">[ OK ]</span> vectorx.pipeline    mAP@0.5 = 0.87 · TEKNOFEST → 3.'],
      ['<span class="t-ok">[ OK ]</span> mt29.audit          281/281 ' + x('kontrol geçti', 'checks passed')],
      ['<span class="t-ok">[ OK ]</span> ai-control.hafiza   ' + x('9 MCP aracı · onaylı kalıcı hafıza', '9 MCP tools · approved persistent memory')],
      [building
        ? '<span class="t-warn">[ .. ]</span> agent swarm         ' + B.tier.agents + ' agent ' + x('sayfayı inşa ediyor', 'building the page')
        : '<span class="t-ok">[ OK ]</span> agent swarm         ' + x('sayfa hazır', 'page ready')],
      [''],
      [x('Merhaba. Komutlar için ' + link('help', 'help') + ' yaz ya da bir soru sor: ' + link('jarvis teknofest', 'jarvis teknofest'),
        'Hi. Type ' + link('help', 'help') + ' for commands or ask a question: ' + link('jarvis teknofest', 'jarvis teknofest'))]
    ], 150);
  }
  document.addEventListener('meg:build-done', function (e) {
    if (!booted) return;
    var d = e.detail || {};
    print('<span class="t-ok">[ OK ]</span> agent swarm         ' + (d.skipped ? x('atlandı', 'skipped') : x('inşa tamamlandı · ', 'build complete · ') + d.secs + 's'));
  });
  var side = $('.hero-side');
  if (root.classList.contains('build-on') && side) {
    side.addEventListener('meg:built', function (e) { if (e.target === side) setTimeout(boot, 250); });
    setTimeout(boot, 6000);
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
