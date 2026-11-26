/* ===== رادیوهاب — راهنمای PTMP شاتل ===== */
(function () {
  'use strict';
  const D = window.PTP_DATA;
  const byId = {};
  D.nodes.forEach(n => byId[n.id] = n);
  const ROOT = D.root;

  // DFS order
  const order = [];
  (function dfs(id) { order.push(id); (byId[id].children || []).forEach(dfs); })(ROOT);
  const secOrder = {};
  D.sections.forEach(s => secOrder[s.id] = order.filter(id => byId[id].section === s.id));
  const secById = {};
  D.sections.forEach(s => secById[s.id] = s);
  const SEC_COLOR = { troubleshoot: '#0ea5e9', config: '#8b5cf6', tools: '#f59e0b', install: '#10b981', overview: '#64748b' };

  // ---- helpers ----
  const fa = n => Number(n || 0).toLocaleString('fa-IR');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function norm(s) {
    return String(s)
      .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه')
      .replace(/[أإآ]/g, 'ا').replace(/ؤ/g, 'و')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function plain(html) {
    const t = document.createElement('textarea');
    t.innerHTML = html.replace(/<[^>]+>/g, ' ');
    return t.value.replace(/\s+/g, ' ').trim();
  }
  function chain(id) {
    const out = [];
    let cur = id;
    while (cur) { out.unshift(cur); cur = byId[cur].parent; }
    return out;
  }
  const ICONS = {
    troubleshoot: '<svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    config: '<svg viewBox="0 0 24 24"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
    tools: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    install: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    overview: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    steps: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>'
  };

  // ---- search index ----
  const index = D.nodes.map(n => ({ id: n.id, name: norm(n.name), text: norm(plain(n.html)) }));
  function doSearch(q) {
    const words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    const res = [];
    for (const it of index) {
      let score = 0, ok = true, pos = -1;
      for (const w of words) {
        const ni = it.name.indexOf(w), ti = it.text.indexOf(w);
        if (ni < 0 && ti < 0) { ok = false; break; }
        score += (ni >= 0 ? 20 : 0) + (ti >= 0 ? 1 : 0);
        if (pos < 0) pos = ti >= 0 ? ti : 0;
      }
      if (ok) res.push({ id: it.id, score, pos, text: it.text });
    }
    res.sort((a, b) => b.score - a.score || byId[b.id].views - byId[a.id].views);
    return res.slice(0, 60);
  }
  function snippet(text, q, pos) {
    const words = norm(q).split(' ').filter(Boolean);
    const start = Math.max(0, pos - 70);
    let s = (start > 0 ? '…' : '') + text.slice(start, start + 220) + (start + 220 < text.length ? '…' : '');
    s = esc(s);
    words.forEach(w => {
      s = s.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
    });
    return s;
  }

  // ---- network canvas ----
  let netRaf = null;
  function stopNet() { if (netRaf) { cancelAnimationFrame(netRaf); netRaf = null; } }
  function initNet() {
    stopNet();
    const cv = document.getElementById('net');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W, H, nodes = [];
    const N = 34, DIST = 130;
    function size() {
      const r = cv.parentElement.getBoundingClientRect();
      W = cv.width = Math.round(r.width);
      H = cv.height = Math.round(r.height);
    }
    function init() {
      size();
      nodes = Array.from({ length: N }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
        r: Math.random() * 1.8 + 1.2
      }));
    }
    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < DIST) {
            ctx.strokeStyle = 'rgba(125,211,252,' + (0.35 * (1 - d / DIST)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = 'rgba(186,230,253,.8)';
      for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill(); }
      netRaf = requestAnimationFrame(tick);
    }
    init(); tick();
    window.addEventListener('resize', () => { if (document.getElementById('net')) { stopNet(); init(); tick(); } });
    document.addEventListener('visibilitychange', () => {
      if (!document.getElementById('net')) return;
      if (document.hidden) stopNet();
      else tick();
    });
  }

  // ---- renderers ----
  const main = document.getElementById('main');
  function crumbs(id) {
    const c = chain(id);
    return '<div class="crumbs">' + c.map((x, i) =>
      (i ? '<span class="sep">‹</span>' : '') +
      (i === c.length - 1 ? '<span>' + esc(byId[x].name) + '</span>' : '<a href="#/a/' + x + '">' + esc(byId[x].name) + '</a>')
    ).join('') + '</div>';
  }
  function metaHtml(n) {
    let m = '<div class="meta">';
    if (n.date) m += '<span>به‌روزرسانی: ' + esc(n.date) + '</span>';
    m += '<span class="views">بازدید: <b>' + fa(n.views) + '</b></span>';
    if (n.rate) m += '<span>امتیاز: ' + esc(n.rate) + ' از ۵</span>';
    (n.tags || []).forEach(t => m += '<span class="tag">' + esc(t) + '</span>');
    return m + '</div>';
  }
  function rowHtml(n, sub) {
    return '<a class="row" href="#/a/' + n.id + '"><div><span>' + esc(n.name) + '</span>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div><span class="vw">' + fa(n.views) + ' بازدید</span></a>';
  }

  function renderHome() {
    const totalViews = D.nodes.reduce((s, n) => s + n.views, 0);
    const top = [...D.nodes].sort((a, b) => b.views - a.views).slice(0, 8);
    const cards = D.sections.map(s => {
      const cnt = secOrder[s.id].length;
      const href = s.id === 'troubleshoot' ? '#/a/641' : '#/s/' + s.id;
      return '<a class="card" style="--c:' + SEC_COLOR[s.id] + '" href="' + href + '"><div class="ic">' + ICONS[s.id] + '</div><b>' + esc(s.title) + '</b><p>' + esc(s.desc) + '</p><span class="n">' + fa(cnt) + ' مقاله</span></a>';
    }).join('');
    const chips = D.sections.map(s => '<a href="' + (s.id === 'troubleshoot' ? '#/a/641' : '#/s/' + s.id) + '">' + esc(s.title) + '</a>').join('') + '<a href="#/tree">درخت کامل</a>';
    main.innerHTML = '<div class="fadein">' +
      '<div class="hero"><canvas id="net" aria-hidden="true"></canvas><div class="hero-inner">' +
      '<span class="hero-badge">راهنمای داخلی شاتل</span>' +
      '<h1>راهنمای جامع سرویس <span class="grad">PTMP</span><br>از عیب‌یابی تا کانفیگ رادیو.</h1>' +
      '<p>عیب‌یابی تعاملی گام‌به‌گام، کانفیگ رادیوهای Mikrotik و UBNT، ابزارها و نصب — همراه با جستجوی آنی در ۱۵۱ مقاله.</p>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + fa(D.nodes.length) + '</b><span>مقاله</span></div>' +
      '<div class="stat"><b>' + fa(secOrder.troubleshoot.length) + '</b><span>گام عیب‌یابی</span></div>' +
      '<div class="stat"><b>' + fa(totalViews) + '</b><span>بازدید ثبت‌شده</span></div>' +
      '<div class="stat"><b>' + fa(152) + '</b><span>تصویر آموزشی</span></div>' +
      '</div>' +
      '<a class="cta" href="#/a/641">' + ICONS.troubleshoot + ' شروع عیب‌یابی گام‌به‌گام</a>' +
      '<nav class="chips">' + chips + '</nav>' +
      '</div></div>' +
      '<h2 class="sec-title">بخش‌ها</h2><div class="cards">' + cards + '</div>' +
      '<h2 class="sec-title">پربازدیدترین مقالات</h2><div class="toplist">' +
      top.map((n, i) => '<a href="#/a/' + n.id + '"><span class="rank">' + fa(i + 1) + '</span><span>' + esc(n.name) + '</span><span class="vw">' + fa(n.views) + ' بازدید</span></a>').join('') +
      '</div></div>';
    initNet();
  }

  function renderSection(sid) {
    const s = secById[sid];
    if (!s) return render404();
    const ids = secOrder[sid];
    let body;
    if (sid === 'troubleshoot') {
      const root = byId['641'];
      body = '<div class="article-head"><h1>' + esc(s.title) + '</h1><p style="color:var(--muted);font-size:14px">' + esc(s.desc) + '</p>' +
        '<a class="cta" href="#/a/641">' + ICONS.troubleshoot + ' ورود به راهنمای تعاملی</a></div>' +
        '<h2 class="sec-title">شاخه‌های اصلی عیب‌یابی</h2><div class="steps">' +
        root.children.map((c, i) => stepHtml(byId[c], i + 1)).join('') + '</div>' +
        '<h2 class="sec-title">همه گام‌ها (' + fa(ids.length) + ')</h2><div class="list">' +
        ids.map(id => rowHtml(byId[id])).join('') + '</div>';
    } else {
      body = '<div class="article-head"><h1>' + esc(s.title) + '</h1><p style="color:var(--muted);font-size:14px">' + esc(s.desc) + '</p></div>' +
        '<div class="list">' + ids.map(id => rowHtml(byId[id], esc(byId[id].date || ''))).join('') + '</div>';
    }
    main.innerHTML = '<div class="fadein">' + body + '</div>';
  }

  function stepHtml(n, num) {
    return '<a class="step" href="#/a/' + n.id + '"><span class="num">' + fa(num) + '</span><span class="nm">' + esc(n.name) + '</span>' + ICONS.chev.replace('<svg', '<svg class="arr"') + '</a>';
  }

  function renderArticle(id) {
    const n = byId[id];
    if (!n) return render404();
    const kids = n.children || [];
    const isWizard = n.section === 'troubleshoot' && kids.length;
    let steps = '';
    if (kids.length) {
      steps = '<div class="steps-title">' + ICONS.steps + (isWizard ? 'گام بعدی را انتخاب کنید' : 'زیرمجموعه‌ها') + '</div><div class="steps">' +
        kids.map((c, i) => stepHtml(byId[c], i + 1)).join('') + '</div>';
    }
    const back = n.parent ? '<a class="backstep" href="#/a/' + n.parent + '">' + ICONS.back + ' بازگشت به: ' + esc(byId[n.parent].name) + '</a>' : '';
    const so = secOrder[n.section];
    const pi = so.indexOf(id);
    let pager = '<div class="pager">';
    pager += pi > 0 ? '<a href="#/a/' + so[pi - 1] + '"><small>قبلی</small>' + esc(byId[so[pi - 1]].name) + '</a>' : '<span style="flex:1"></span>';
    pager += pi < so.length - 1 ? '<a class="next" href="#/a/' + so[pi + 1] + '"><small>بعدی</small>' + esc(byId[so[pi + 1]].name) + '</a>' : '<span style="flex:1"></span>';
    pager += '</div>';
    main.innerHTML = '<div class="fadein">' + crumbs(id) +
      '<div class="article-head"><h1>' + esc(n.name) + '</h1>' + metaHtml(n) + '</div>' +
      '<div class="article-body">' + n.html + '</div>' + steps + back + pager + '</div>';
    main.querySelectorAll('.article-body img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.src));
    });
  }

  function renderSearch(q) {
    const res = doSearch(q);
    let body;
    if (!res.length) {
      body = '<div class="empty">نتیجه‌ای برای «' + esc(q) + '» یافت نشد.</div>';
    } else {
      body = '<div class="list">' + res.map(r => {
        const n = byId[r.id];
        return '<a class="row" href="#/a/' + n.id + '"><div style="min-width:0"><span>' + esc(n.name) + '</span>' +
          '<div class="snippet">' + snippet(r.text, q, r.pos) + '</div></div>' +
          '<span class="vw">' + fa(n.views) + '</span></a>';
      }).join('') + '</div>';
    }
    main.innerHTML = '<div class="fadein"><div class="article-head"><h1>جستجو: ' + esc(q) + '</h1>' +
      '<p style="color:var(--muted);font-size:13px">' + fa(res.length) + ' نتیجه</p></div>' + body + '</div>';
  }

  function renderTree() {
    function node(id) {
      const n = byId[id];
      const kids = n.children || [];
      const tg = kids.length ? '<button class="tg" data-t="' + id + '">+</button>' : '<span class="leaf-dot"></span>';
      return '<li><div class="trow">' + tg + '<a href="#/a/' + id + '">' + esc(n.name) + '</a><span class="vw">' + fa(n.views) + '</span></div>' +
        (kids.length ? '<ul hidden>' + kids.map(node).join('') + '</ul>' : '') + '</li>';
    }
    main.innerHTML = '<div class="fadein"><div class="article-head"><h1>درخت کامل محتوا</h1>' +
      '<p style="color:var(--muted);font-size:13px">همه ' + fa(D.nodes.length) + ' گره بخش PTMP با ساختار اصلی</p>' +
      '<div style="margin-top:12px;display:flex;gap:8px"><button class="hbtn" style="width:auto;padding:0 16px;font-family:inherit;font-size:13px" id="expAll">باز کردن همه</button>' +
      '<button class="hbtn" style="width:auto;padding:0 16px;font-family:inherit;font-size:13px" id="colAll">بستن همه</button></div></div>' +
      '<div class="tree" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px"><ul>' + node(ROOT) + '</ul></div></div>';
    main.querySelector('.tree').addEventListener('click', e => {
      const b = e.target.closest('.tg');
      if (!b) return;
      const ul = b.closest('li').querySelector(':scope > ul');
      const open = !ul.hidden;
      ul.hidden = open;
      b.textContent = open ? '+' : '−';
    });
    document.getElementById('expAll').onclick = () => { main.querySelectorAll('.tree ul').forEach(u => u.hidden = false); main.querySelectorAll('.tg').forEach(b => b.textContent = '−'); };
    document.getElementById('colAll').onclick = () => { main.querySelectorAll('.tree ul').forEach(u => u.hidden = true); main.querySelectorAll('.tg').forEach(b => b.textContent = '+'); };
  }

  function render404() {
    main.innerHTML = '<div class="empty">صفحه موردنظر یافت نشد.<br><a href="#/">بازگشت به خانه</a></div>';
  }

  // ---- sidebar ----
  function buildSidebar() {
    const aside = document.getElementById('sidebar');
    aside.innerHTML = '<div class="nav-title">ناوبری</div>' +
      '<a class="nav-item" href="#/" data-nav="home">' + ICONS.overview.replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"') + ' خانه</a>' +
      D.sections.map(s => '<a class="nav-item" href="' + (s.id === 'troubleshoot' ? '#/a/641' : '#/s/' + s.id) + '" data-nav="' + s.id + '"><span class="dot" style="background:' + SEC_COLOR[s.id] + '"></span>' + esc(s.title) + '<span class="cnt">' + fa(secOrder[s.id].length) + '</span></a>').join('') +
      '<div class="nav-title">فهرست</div>' +
      '<a class="nav-item" href="#/tree" data-nav="tree">' + ICONS.steps.replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"') + ' درخت کامل محتوا</a>';
  }
  function setActive(key) {
    document.querySelectorAll('aside .nav-item').forEach(a => a.classList.toggle('active', a.dataset.nav === key));
  }

  // ---- router ----
  function route() {
    stopNet();
    const h = location.hash || '#/';
    const parts = h.replace(/^#\//, '').split('/');
    window.scrollTo({ top: 0 });
    document.getElementById('sidebar').classList.remove('open');
    if (parts[0] === '') { renderHome(); setActive('home'); document.title = 'رادیوهاب | راهنمای PTMP شاتل'; }
    else if (parts[0] === 's') { renderSection(parts[1]); setActive(parts[1]); document.title = (secById[parts[1]] || {}).title + ' | رادیوهاب'; }
    else if (parts[0] === 'a') {
      renderArticle(parts[1]);
      const n = byId[parts[1]];
      setActive(n ? n.section : '');
      document.title = (n ? n.name : 'یافت نشد') + ' | رادیوهاب';
    }
    else if (parts[0] === 'search') { const q = decodeURIComponent(parts.slice(1).join('/') || ''); renderSearch(q); setActive(''); document.title = 'جستجو: ' + q + ' | رادیوهاب'; document.getElementById('q').value = q; }
    else if (parts[0] === 'tree') { renderTree(); setActive('tree'); document.title = 'درخت محتوا | رادیوهاب'; }
    else render404();
    document.getElementById('progress').style.width = '0';
  }

  // ---- events ----
  function openLightbox(src) {
    const lb = document.getElementById('lightbox');
    lb.querySelector('img').src = src;
    lb.classList.add('open');
  }
  document.getElementById('lightbox').addEventListener('click', function () { this.classList.remove('open'); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('lightbox').classList.remove('open');
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); document.getElementById('q').focus(); }
  });
  document.getElementById('q').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) location.hash = '#/search/' + encodeURIComponent(e.target.value.trim());
  });
  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = cur;
    localStorage.setItem('radio-theme', cur);
  });
  document.getElementById('menuBtn').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  main.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#') && !href.startsWith('#/')) {
      e.preventDefault();
      const name = href.slice(1);
      const t = main.querySelector('[id="' + name + '"], [name="' + name + '"]');
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  window.addEventListener('scroll', () => {
    const el = document.querySelector('.article-body');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const done = Math.min(Math.max(-r.top, 0), Math.max(total, 1));
    document.getElementById('progress').style.width = (total > 0 ? done / total * 100 : 0) + '%';
  });
  window.addEventListener('hashchange', route);

  // ---- init ----
  document.documentElement.dataset.theme = localStorage.getItem('radio-theme') || 'light';
  buildSidebar();
  route();
})();