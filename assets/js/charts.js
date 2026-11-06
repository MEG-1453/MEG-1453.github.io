/*!
 * charts.js — three small HTML charts, no library:
 *   #chart-vx     first version → final (two series, one axis 0–1)
 *   #chart-areas  projects per area (one series)
 *   #chart-time   career as an animated git graph (main = university, branches = parallel roles)
 * Palette validated for the dark surface #0a100b (lightness band, chroma, CVD ΔE ≥ 20):
 *   final / single series #22ad62 · first version #5b8fe0
 * Every mark is focusable with a tooltip; every chart has a table view.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var lang = function () { return root.getAttribute('data-lang') === 'en' ? 'en' : 'tr'; };
  var x = function (tr, en) { return lang() === 'en' ? en : tr; };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C1 = '#22ad62', C2 = '#5b8fe0';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function fmt(v, d) {
    try { return new Intl.NumberFormat(lang() === 'en' ? 'en-US' : 'tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
    catch (e) { return v.toFixed(d); }
  }

  /* ---------- tooltip (hover + keyboard focus) ---------- */
  var tip = document.createElement('div');
  tip.className = 'ctip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  function showTip(el) {
    tip.innerHTML = el.getAttribute('data-tip');
    tip.classList.add('on');
    var r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = Math.min(innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2));
    var top = r.top - th - 10;
    if (top < 8) top = r.bottom + 10;
    tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
  }
  function hideTip() { tip.classList.remove('on'); }
  var near = function (e) { return e.target && e.target.closest ? e.target.closest('[data-tip]') : null; };
  document.addEventListener('pointerover', function (e) { var t = near(e); if (t) showTip(t); });
  document.addEventListener('pointerout', function (e) { var t = near(e); if (t && !t.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('focusin', function (e) { var t = near(e); if (t) showTip(t); });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });

  function table(head, rows) {
    return '<details class="c-table"><summary>' + x('Tablo görünümü', 'Table view') + '</summary><table><thead><tr>' +
      head.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return i ? '<td>' + esc(c) + '</td>' : '<th scope="row">' + esc(c) + '</th>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></details>';
  }
  function grid(ticks, max, label) {
    return '<div class="c-grid" aria-hidden="true">' + ticks.map(function (v) {
      return '<span style="left:' + (v / max * 100) + '%"><em>' + label(v) + '</em></span>';
    }).join('') + '</div>';
  }

  /* ---------- 1: first version → final ---------- */
  function vx(el) {
    var rows = [
      { k: x('Nesneleri bulma', 'Finding objects'), s: x('Görev 1', 'Task 1'), a: 0.2951, b: 0.8699 },
      { k: x('Fotoğraftaki hedefi bulma', 'Finding the photographed target'), s: x('Görev 3 · senaryo 1', 'Task 3 · scenario 1'), a: 0.23, b: 0.86 },
      { k: x('Fotoğraftaki hedefi bulma', 'Finding the photographed target'), s: x('Görev 3 · senaryo 4', 'Task 3 · scenario 4'), a: 0.16, b: 0.71 }
    ];
    var A = x('İlk sürüm (16 Temmuz)', 'First version (16 July)'), B = x('Final sürüm', 'Final version');
    var tick = function (v) { return v === 0 ? '0' : v === 1 ? '1' : fmt(v, v === 0.5 ? 1 : 2); };
    var bar = function (r, v, c, name, lab) {
      var t = '<b>' + esc(r.k) + '</b> · ' + esc(r.s) + '<br>' + esc(name) + ': <b>' + fmt(v, 2) + '</b>';
      return '<div class="c-bar" tabindex="0" style="--w:' + v + ';--c:' + c + '" data-tip="' + esc(t) + '" aria-label="' + esc(r.k + ', ' + r.s + ', ' + name + ': ' + fmt(v, 2)) + '"><i></i>' +
        (lab ? '<span class="c-val">' + fmt(v, 2) + '</span>' : '') + '</div>';
    };
    el.innerHTML = '<div class="c-legend"><span><i style="background:' + C2 + '"></i>' + esc(A) + '</span><span><i style="background:' + C1 + '"></i>' + esc(B) + '</span></div>' +
      '<div class="c-body" role="group" aria-label="' + esc(x('İlk sürüm ve final isabet skorları', 'First and final accuracy scores')) + '">' +
      grid([0, 0.25, 0.5, 0.75, 1], 1, tick) +
      rows.map(function (r) {
        return '<div class="c-row"><div class="c-lab"><b>' + esc(r.k) + '</b><small>' + esc(r.s) + '</small></div><div class="c-plot c-pair">' +
          bar(r, r.a, C2, A, false) + bar(r, r.b, C1, B, true) + '</div></div>';
      }).join('') + '</div>' +
      table([x('Ölçüm', 'Measure'), A, B], rows.map(function (r) { return [r.k + ' · ' + r.s, fmt(r.a, 2), fmt(r.b, 2)]; }));
  }

  /* ---------- 2: projects per area ---------- */
  function areas(el) {
    var rows = [
      { k: x('Mobil & web', 'Mobile & web'), p: ['MT-29 Chat', 'EsenLink', 'Regulator', 'Social Backend', 'Travel Guide Pro', 'AI Control', 'Hobbies Lab'] },
      { k: x('Backend & altyapı', 'Backend & infrastructure'), p: ['MT-29 Chat', 'Jarvis', 'EsenLink', 'Regulator', 'Social Backend', 'AI Control'] },
      { k: x('Yapay zekâ & görü', 'AI & vision'), p: ['VectorX', 'Jarvis', 'EsenLink', 'Regulator', 'AI Control'] },
      { k: x('Robotik & otonom', 'Robotics & autonomy'), p: ['VectorX', 'Jarvis', 'ESP32 Air Mouse', x('Gömülü Sistemler', 'Embedded Systems'), 'Hobbies Lab'] },
      { k: x('Güvenlik', 'Security'), p: ['MT-29 Chat', 'MEG-1453 Recon', 'AI Control'] }
    ];
    var max = 8;
    el.innerHTML = '<div class="c-body c-areas" role="group" aria-label="' + esc(x('Alanlara göre proje sayısı', 'Projects per area')) + '">' +
      grid([0, 2, 4, 6, 8], max, function (v) { return String(v); }) +
      rows.map(function (r) {
        var n = r.p.length, t = '<b>' + esc(r.k) + '</b> · ' + n + ' ' + x('proje', 'projects') + '<br>' + esc(r.p.join(', '));
        return '<div class="c-row"><div class="c-lab"><b>' + esc(r.k) + '</b></div><div class="c-plot">' +
          '<div class="c-bar c-thick" tabindex="0" style="--w:' + (n / max) + ';--c:' + C1 + '" data-tip="' + esc(t) + '" aria-label="' + esc(r.k + ': ' + n + ' ' + x('proje', 'projects')) + '"><i></i><span class="c-val">' + n + '</span></div>' +
          '<small class="c-names">' + esc(r.p.join(' · ')) + '</small></div></div>';
      }).join('') + '</div>' +
      table([x('Alan', 'Area'), x('Proje sayısı', 'Projects'), x('Projeler', 'Which')], rows.map(function (r) { return [r.k, String(r.p.length), r.p.join(', ')]; }));
  }

  /* ---------- 3: career as a git graph — main = university, branches = roles held at the same time ----------
   * Window Aug 2025 → Feb 2027 (where everything happens); main runs past both edges (Sep 2023 → Jun 2028).
   * A playhead sweeps from the left edge to "today", lanes draw in behind it, commits pop as it passes.
   * Lane palette validated on #0a100b (L band, chroma, CVD ΔE ≥ 14.8): #22ad62 #1598c4 #c0861c #8b7cf0 */
  var LANE = { main: '#22ad62', club: '#1598c4', ctf: '#c0861c', t3: '#8b7cf0' };
  function timeline(el) {
    var en = lang() === 'en';
    var M = en ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    var BASE = 2025 * 12 + 7, SPAN = 18; // Aug 2025 … Feb 2027
    var mi = function (y, m) { return y * 12 + (m - 1) - BASE; };
    var md = function (v) { var a = BASE + Math.floor(v); return M[a % 12] + ' ' + Math.floor(a / 12); };
    var d = new Date(), now = Math.max(0.5, Math.min(SPAN - 0.5, mi(d.getFullYear(), d.getMonth() + 1) + (d.getDate() - 1) / 31));
    var ongoing = x('devam', 'ongoing');
    // geometry in real px (re-rendered on resize)
    var Wt = Math.max(300, Math.round(el.clientWidth || 600)), mob = Wt < 600;
    var LAB = mob ? 0 : Math.min(250, Math.round(Wt * 0.24));
    var X0 = LAB + (mob ? 4 : 26), X1 = Wt - (mob ? 8 : 18), px = (X1 - X0) / SPAN;
    var X = function (v) { return X0 + v * px; };
    var TOP = mob ? 40 : 50, GAP = mob ? 40 : 50;
    var Y = { main: TOP + 18, club: TOP + 18 + GAP, ctf: TOP + 18 + GAP * 2, t3: TOP + 18 + GAP * 3 };
    var AX = Y.t3 + (mob ? 26 : 32), HH = AX + (mob ? 34 : 38);
    var CV = Math.max(14, Math.min(42, px * 0.95));
    var XN = X(now), D = 2.4;
    var at = function (xp) { return (Math.max(0, xp - X0) / Math.max(1, XN - X0) * D).toFixed(2) + 's'; };
    var dur = function (a, b) { return (Math.max(0.08, (b - a) / Math.max(1, XN - X0) * D)).toFixed(2) + 's'; };
    var f1 = function (n) { return Math.round(n * 10) / 10; };
    var fork = function (x0, y0, y1) { return 'M' + f1(x0) + ' ' + y0 + 'C' + f1(x0 + CV * 0.55) + ' ' + y0 + ' ' + f1(x0 + CV * 0.45) + ' ' + y1 + ' ' + f1(x0 + CV) + ' ' + y1; };
    var o = [];
    // grid: months + years
    o.push('<g class="gg-grid" aria-hidden="true">');
    for (var v = 0; v <= SPAN; v++) {
      var abs = BASE + v, yr = abs % 12 === 0;
      o.push('<line' + (yr ? ' class="yr"' : '') + ' x1="' + f1(X(v)) + '" x2="' + f1(X(v)) + '" y1="' + (TOP + 4) + '" y2="' + AX + '"/>');
      if (v < SPAN && (!mob || (abs % 3 === 0))) o.push('<text class="gg-mo" x="' + f1(X(v + 0.5)) + '" y="' + (AX + 14) + '" text-anchor="middle">' + M[abs % 12] + '</text>');
      if (yr) o.push('<text class="gg-yr" x="' + f1(X(v) + 3) + '" y="' + (AX + 29) + '">' + Math.floor(abs / 12) + '</text>');
    }
    o.push('</g>');
    // lane labels (desktop: left column; phone: a list above the graph)
    var lanes = [
      { k: 'main', br: 'main', t: x('Yazılım Mühendisliği', 'Software Engineering'), s: x('Nişantaşı Üni. · Eyl 2023 → Haz 2028', 'Nişantaşı Univ. · Sep 2023 → Jun 2028'),
        tip: x('<b>Yazılım Mühendisliği (İngilizce)</b><br>Nişantaşı Üniversitesi<br>Eyl 2023 – Haz 2028 (beklenen)', '<b>Software Engineering (English)</b><br>Nişantaşı University<br>Sep 2023 – Jun 2028 (expected)') },
      { k: 'club', br: x('teknofest-kulubu', 'teknofest-club'), t: x('TEKNOFEST Kulübü', 'TEKNOFEST Club'), s: x('Yönetim Kurulu · Eki 2025 → devam', 'Board · Oct 2025 → ongoing'),
        tip: x('<b>TEKNOFEST Kulübü · Yönetim Kurulu</b><br>Projeler ve yarışmalar<br>Eki 2025 – devam', '<b>TEKNOFEST Club · Board</b><br>Projects & competitions<br>Oct 2025 – ongoing') },
      { k: 'ctf', br: 'siber-vatan-ctf', t: 'Siber Vatan / Hackviser CTF', s: x('Eki–Ara 2025 · Eki 2026 → devam', 'Oct–Dec 2025 · Oct 2026 → ongoing'),
        tip: x('<b>Siber Vatan / Hackviser CTF</b><br>Siber güvenlik programı<br>Eki – Ara 2025, Eki 2026\'da yeniden başladı', '<b>Siber Vatan / Hackviser CTF</b><br>Cybersecurity programme<br>Oct – Dec 2025, rejoined Oct 2026') },
      { k: 't3', br: 't3-vakfi', t: x('T3 Vakfı · Üniversite İlişkileri', 'T3 Foundation · University Relations'), s: x('TEKNOFEST İstanbul · Ağu 2026 → devam', 'TEKNOFEST Istanbul · Aug 2026 → ongoing'),
        tip: x('<b>T3 Vakfı · Üniversite İlişkileri</b><br>TEKNOFEST İstanbul İl Koordinatörlüğü<br>Ağu 2026 – devam', '<b>T3 Foundation · University Relations</b><br>TEKNOFEST Istanbul coordination<br>Aug 2026 – ongoing') }
    ];
    if (!mob) lanes.forEach(function (l) {
      o.push('<g class="gg-lab" style="--dl:0s"><line x1="0" x2="14" y1="' + Y[l.k] + '" y2="' + Y[l.k] + '" stroke="' + LANE[l.k] + '" stroke-width="3" stroke-linecap="round"/>' +
        '<text class="gg-t1" x="22" y="' + (Y[l.k] - 3) + '">' + esc(l.t) + '</text><text class="gg-t2" x="22" y="' + (Y[l.k] + 13) + '">' + esc(l.s) + '</text></g>');
    });
    // lanes: [lane, path d, x start, x end, tooltip]
    var seg = function (k, dd, xa, xb, tip) {
      o.push('<g class="gg-seg" tabindex="0" data-tip="' + esc(tip) + '"><path class="gg-hit" d="' + dd + '"/>' +
        '<path class="gg-lane" pathLength="1" d="' + dd + '" stroke="' + LANE[k] + '" style="color:' + LANE[k] + ';--dl:' + at(xa) + ';--du:' + dur(xa, xb) + '"/></g>');
    };
    var fut = function (k, y, xa, xb) {
      if (xb - xa < 4) return;
      o.push('<path class="gg-fut" d="M' + f1(xa) + ' ' + y + 'H' + f1(xb) + '" stroke="' + LANE[k] + '" style="--dl:' + D + 's"/>');
    };
    var L = {}; lanes.forEach(function (l) { L[l.k] = l; });
    var xs = X(0) - (mob ? 4 : 14);
    seg('main', 'M' + f1(xs) + ' ' + Y.main + 'H' + f1(XN), xs, XN, L.main.tip);
    fut('main', Y.main, XN + 8, X1 + (mob ? 4 : 10));
    var xc = X(mi(2025, 10));
    seg('club', fork(xc, Y.main, Y.club) + 'H' + f1(XN), xc, XN, L.club.tip);
    fut('club', Y.club, XN + 8, Math.min(X1, XN + 46));
    var xm = X(mi(2026, 1));
    seg('ctf', fork(xc, Y.main, Y.ctf) + 'H' + f1(xm - CV) + 'C' + f1(xm - CV * 0.45) + ' ' + Y.ctf + ' ' + f1(xm - CV * 0.55) + ' ' + Y.main + ' ' + f1(xm) + ' ' + Y.main, xc, xm, L.ctf.tip);
    var xr = X(mi(2026, 10));
    seg('ctf', fork(xr, Y.main, Y.ctf) + 'H' + f1(XN), xr, XN, L.ctf.tip);
    fut('ctf', Y.ctf, XN + 8, Math.min(X1, XN + 46));
    var xt = X(mi(2026, 8));
    seg('t3', fork(xt, Y.main, Y.t3) + 'H' + f1(XN), xt, XN, L.t3.tip);
    fut('t3', Y.t3, XN + 8, Math.min(X1, XN + 46));
    // branch names (git style), just after each fork
    // [lane, x, above/below] — placed where no fork/merge curve or the today line crosses them
    if (!mob) [['club', xm + 10, -8], ['ctf', xc + CV + 8, 16], ['ctf', xr + CV + 8, 16], ['t3', xt + CV + 8, -8]].forEach(function (b) {
      var w = L[b[0]].br.length * 6.1;
      if (b[1] + w > XN - 6) return;
      o.push('<text class="gg-br gg-lab" x="' + f1(b[1]) + '" y="' + (Y[b[0]] + b[2]) + '" style="--dl:' + at(b[1]) + '">' + esc(L[b[0]].br) + '</text>');
    });
    // commits
    var node = function (k, xp, y, r, tip, cls) {
      return '<g class="gg-ev' + (cls ? ' ' + cls : '') + '" tabindex="0" data-tip="' + esc(tip) + '" aria-label="' + esc(tip.replace(/<[^>]+>/g, ' ')) + '">' +
        '<circle class="gg-hitc" cx="' + f1(xp) + '" cy="' + y + '" r="' + (r + 9) + '"/>' +
        '<g class="gg-c" style="--dl:' + at(xp) + '"><circle class="gg-node" cx="' + f1(xp) + '" cy="' + y + '" r="' + r + '" stroke="' + LANE[k] + '"/>' +
        '<circle cx="' + f1(xp) + '" cy="' + y + '" r="' + (r * 0.45).toFixed(1) + '" fill="' + LANE[k] + '"/></g></g>';
    };
    // branch start / merge commits
    o.push(node('club', xc + CV, Y.club, 4.5, L.club.tip));
    o.push(node('ctf', xc + CV, Y.ctf, 4.5, L.ctf.tip));
    o.push(node('ctf', xm - CV, Y.ctf, 4.5, L.ctf.tip));
    o.push(node('ctf', xr + CV, Y.ctf, 4.5, L.ctf.tip));
    o.push(node('t3', xt + CV, Y.t3, 4.5, L.t3.tip));
    // events on main, labelled above
    var evs = [
      { m: mi(2025, 10), n: 'Talentcoders CodeSprint', sn: 'CodeSprint', tip: x('<b>Talentcoders CodeSprint</b><br>Katılımcı<br>Eki 2025', '<b>Talentcoders CodeSprint</b><br>Participant<br>Oct 2025') },
      { m: mi(2026, 3), n: x('Milli Teknoloji Zirvesi', 'National Tech Summit'), sn: x('Tek. Zirvesi', 'Tech Summit'), tip: x('<b>Milli Teknoloji Zirvesi</b><br>Yerli Savunma Ekosisteminin Geleceği<br>Mar 2026', '<b>National Technology Summit</b><br>Future of the domestic defence ecosystem<br>Mar 2026') },
      { m: mi(2026, 7), star: true, n: x("VectorX · TÜRKİYE 3.'SÜ", 'VECTORX · 3RD IN TÜRKİYE'), sn: x("VectorX · 3.'SÜ", 'VectorX · 3RD'),
        tip: x("<b>VectorX · TEKNOFEST Havacılıkta Yapay Zekâ</b><br>Takım kaptanı · Türkiye 3.'sü<br>Tem 2026 (16 Temmuz: ilk yarışma sürümü)", '<b>VectorX · TEKNOFEST AI in Aviation</b><br>Team captain · 3rd in Türkiye<br>Jul 2026 (16 July: first competition version)') }
    ];
    evs.forEach(function (e, i) {
      var xp = X(e.m), dl = at(xp), name = mob ? e.sn : e.n;
      var tier = mob ? (i % 2) * 15 : 0;
      var ty = mob ? 12 + tier : 32;
      o.push('<g class="gg-lab" style="--dl:' + dl + '">');
      if (!mob) o.push('<text class="gg-ed" x="' + f1(xp) + '" y="14" text-anchor="middle">' + md(e.m) + '</text>');
      if (e.star) {
        var pw = Math.round(name.length * (mob ? 6.2 : 6.9) + 18), py = ty - 13;
        o.push('<g class="gg-pill"><rect x="' + f1(xp - pw / 2) + '" y="' + py + '" width="' + pw + '" height="18" rx="9"/><text x="' + f1(xp) + '" y="' + (py + 12.5) + '" text-anchor="middle">' + esc(name) + '</text></g>');
      } else {
        o.push('<text class="gg-en" x="' + f1(xp) + '" y="' + ty + '" text-anchor="middle">' + esc(name) + '</text>');
      }
      o.push('<line class="gg-conn" x1="' + f1(xp) + '" x2="' + f1(xp) + '" y1="' + (ty + 6) + '" y2="' + (Y.main - (e.star ? 11 : 9)) + '"/></g>');
      o.push(node('main', xp, Y.main, e.star ? 8 : 6, e.tip, e.star ? 'star' : ''));
    });
    // HEAD: live rings where work is ongoing
    ['main', 'club', 'ctf', 't3'].forEach(function (k) {
      o.push('<circle class="gg-headr" cx="' + f1(XN) + '" cy="' + Y[k] + '" r="6" stroke="' + LANE[k] + '" style="--D:' + D + 's"/>' +
        '<circle class="gg-head" cx="' + f1(XN) + '" cy="' + Y[k] + '" r="4.5" fill="' + LANE[k] + '" style="--dl:' + D + 's"/>');
    });
    // playhead that becomes the "today" marker
    var tl = x('BUGÜN', 'TODAY') + (mob ? '' : ' · ' + md(now)), tw = Math.round(tl.length * 6.4 + 14);
    o.push('<g class="gg-now" style="--x0:' + f1(X0) + 'px;--xn:' + f1(XN) + 'px;--D:' + D + 's" aria-hidden="true">' +
      '<line x1="0" x2="0" y1="' + (TOP - 2) + '" y2="' + AX + '"/>' +
      '<rect x="' + (-tw / 2) + '" y="' + (TOP - 20) + '" width="' + tw + '" height="17" rx="8.5"/>' +
      '<text x="0" y="' + (TOP - 8) + '" text-anchor="middle">' + esc(tl) + '</text></g>');

    var legend = '<div class="c-legend gg-legend">' +
      '<span><i class="lg-ev"></i>' + x('Etkinlik (commit)', 'Event (commit)') + '</span>' +
      '<span><i class="lg-star"></i>' + x('Derece', 'Award') + '</span>' +
      '<span><i class="lg-head"></i>' + x('Devam ediyor', 'Ongoing') + '</span>' +
      '<span><i class="lg-fut"></i>' + x('Sürüyor / planlanan', 'Continuing / planned') + '</span>' +
      '<span><i class="lg-now"></i>' + x('Bugün', 'Today') + ' · ' + md(now) + '</span></div>';
    var list = mob ? '<ul class="gg-list">' + lanes.map(function (l) {
      return '<li><i style="background:' + LANE[l.k] + '"></i><b>' + esc(l.t) + '</b><small>' + esc(l.s) + '</small></li>';
    }).join('') + '</ul>' : '';
    el.innerHTML = legend + list + '<div class="gg" role="group" aria-label="' + esc(x('Kariyer grafiği: ana hat üniversite, dallar aynı anda yürütülen görevler', 'Career graph: main line is university, branches are roles held at the same time')) + '">' +
      '<svg width="' + Wt + '" height="' + HH + '" viewBox="0 0 ' + Wt + ' ' + HH + '">' + o.join('') + '</svg></div>' +
      table([x('Görev', 'Role'), x('Kurum', 'Organisation'), x('Tarih', 'When')], [
        [x('Yazılım Mühendisliği', 'Software Engineering'), x('Nişantaşı Üniversitesi', 'Nişantaşı University'), x('Eyl 2023 – Haz 2028 (beklenen)', 'Sep 2023 – Jun 2028 (expected)')],
        [x('TEKNOFEST Kulübü · Yönetim Kurulu', 'TEKNOFEST Club · Board'), x('Nişantaşı Üniversitesi', 'Nişantaşı University'), x('Eki 2025 – ', 'Oct 2025 – ') + ongoing],
        ['Siber Vatan / Hackviser CTF', x('Siber güvenlik programı', 'Cybersecurity programme'), x('Eki – Ara 2025 · Eki 2026 – ', 'Oct – Dec 2025 · Oct 2026 – ') + ongoing],
        ['Talentcoders CodeSprint', x('Katılımcı', 'Participant'), md(mi(2025, 10))],
        [x('Milli Teknoloji Zirvesi', 'National Technology Summit'), x('Yerli savunma ekosistemi', 'Domestic defence ecosystem'), md(mi(2026, 3))],
        ['VectorX · TEKNOFEST', x("Takım kaptanı · Türkiye 3.'sü", 'Team captain · 3rd in Türkiye'), md(mi(2026, 7))],
        [x('T3 Vakfı · Üniversite İlişkileri', 'T3 Foundation · University Relations'), x('TEKNOFEST İstanbul İl Koordinatörlüğü', 'TEKNOFEST Istanbul coordination'), x('Ağu 2026 – ', 'Aug 2026 – ') + ongoing]
      ]);
  }

  /* ---------- mount: render, then animate once the agents placed the box ---------- */
  var CHARTS = [['#chart-vx', vx], ['#chart-areas', areas], ['#chart-time', timeline]];
  function renderAll() {
    CHARTS.forEach(function (c) { var el = $(c[0]); if (el) c[1](el); });
  }
  function reveal(el) {
    var box = el.closest('[data-b]') || el;
    var go = function () { requestAnimationFrame(function () { el.classList.add('in'); }); };
    if (reduced) return el.classList.add('in');
    var ready = function () {
      if (!root.classList.contains('build-on') || box.classList.contains('is-built')) return go();
      box.addEventListener('meg:built', function on(e) { if (e.target === box) { box.removeEventListener('meg:built', on); setTimeout(go, 200); } });
    };
    if (!('IntersectionObserver' in window)) return ready();
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); ready(); } }, { threshold: 0.3 });
    io.observe(el);
  }
  renderAll();
  CHARTS.forEach(function (c) { var el = $(c[0]); if (el) reveal(el); });
  document.addEventListener('meg:lang', renderAll);
  // the timeline places its date labels by track width → redo it when the width really changes
  var lastW = innerWidth, rzT = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () { if (innerWidth === lastW) return; lastW = innerWidth; var el = $('#chart-time'); if (el) timeline(el); }, 250);
  });
})();
