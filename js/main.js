/* ==========================================================
   隅光設計 Corner Light — 全站腳本(原生 JS,無框架)
   內容:站點設定 / 共用導覽與頁尾 / 圖片預載 / 視差 / 進場動畫
         會員(localStorage)/ 線上預約 / 表單驗證 / Lightbox
   ========================================================== */
(function () {
  'use strict';

  /* ---------- 0. 站點設定:換品牌名稱、聯絡資訊改這裡就好 ---------- */
  var SITE = {
    name: '隅光設計',
    en: 'CORNER LIGHT',
    enTitle: 'Corner Light',
    tagline: '讓每個角落,都有光。',
    address: '台北市信義區示範路 1 號',
    phone: '02-1234-5678',
    email: 'hello@example.com',
    hours: '週二至週六 10:00–18:00',
    copyright: '© 2026 隅光設計 Corner Light'
  };
  var PAGES = [
    { file: 'index.html', key: 'home', label: '首頁' },
    { file: 'about.html', key: 'about', label: '關於我們' },
    { file: 'services.html', key: 'services', label: '服務項目' },
    { file: 'contact.html', key: 'contact', label: '聯絡我們' }
  ];
  var ALL_FILES = PAGES.map(function (p) { return p.file; }).concat('login.html');
  var SERVICES = { residential: '住宅設計', commercial: '商業空間', lighting: '燈光規劃', consult: '設計諮詢' };
  var SLOTS = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
  var IMG_DIR = 'images/';
  /* 缺圖時的漸層色(依檔名編號輪替) */
  var GRADS = [['#a8967c', '#6d5d49'], ['#b08b75', '#6b4a3b'], ['#9a9a86', '#5e6252'], ['#b39c84', '#7a5f45'], ['#8f9a9a', '#4f5b5b'], ['#b69a8a', '#7c5848']];

  /* ---------- 工具 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) { /* 輸出到頁面前一律 HTML escape */
    return String(v == null ? '' : v).replace(/[&<>"'`]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c];
    });
  }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function currentFile() { return location.pathname.split('/').pop() || 'index.html'; }
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && matchMedia('(hover: none)').matches;
  if (reduced) document.documentElement.classList.add('rm');

  /* ---------- 1. 儲存:localStorage 被封鎖時退回記憶體 ---------- */
  var mem = {};
  var useMem = false;
  try { localStorage.setItem('__cl', '1'); localStorage.removeItem('__cl'); } catch (e) { useMem = true; }
  var store = {
    get: function (k, d) {
      var raw = null;
      try { raw = useMem ? (k in mem ? mem[k] : null) : localStorage.getItem(k); } catch (e) { useMem = true; }
      if (raw == null) return d;
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return d; }
    },
    set: function (k, v) {
      var s = JSON.stringify(v);
      if (!useMem) { try { localStorage.setItem(k, s); return; } catch (e) { useMem = true; } }
      mem[k] = s;
    },
    del: function (k) { try { if (!useMem) localStorage.removeItem(k); } catch (e) { /* 忽略 */ } delete mem[k]; }
  };

  /* ---------- 2. 驗證 ---------- */
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 80; }
  function isPhone(v) {
    if (!/^[0-9+\-\s()]+$/.test(v)) return false;
    var n = v.replace(/\D/g, '').length;
    return n >= 8 && n <= 13;
  }
  /* 為每個欄位連結錯誤訊息(aria-describedby)並提供 setErr */
  function bindErrors(form) {
    $$('[data-err]', form).forEach(function (p) {
      var name = p.getAttribute('data-err');
      p.id = (form.id || 'f') + '-err-' + name;
      var inp = form.elements[name];
      if (inp && !inp.length) inp.setAttribute('aria-describedby', p.id);
    });
  }
  function setErr(form, name, msg) {
    var p = $('[data-err="' + name + '"]', form);
    var inp = form.elements[name];
    if (p) p.textContent = msg || '';
    if (inp && !inp.length) { if (msg) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); }
    return !msg;
  }
  function clearErrs(form) { $$('[data-err]', form).forEach(function (p) { setErr(form, p.getAttribute('data-err'), ''); }); }
  function showMsg(el, text) { if (!el) return; el.textContent = text; el.hidden = !text; }

  /* ---------- 3. 會員(純前端展示:資料只存在瀏覽器) ---------- */
  function hashPw(pw, email) { /* 簡易雜湊(cyrb53),僅供展示,不等於真正的密碼安全 */
    var s = 'cl:' + email + ':' + pw, h1 = 0xdeadbeef, h2 = 0x41c6ce57, i, c;
    for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  var Auth = {
    users: function () { var u = store.get('cl_users', []); return Array.isArray(u) ? u : []; },
    current: function () {
      var e = store.get('cl_session', null);
      if (!e) return null;
      return Auth.users().filter(function (u) { return u.email === e; })[0] || null;
    },
    register: function (name, email, pw) {
      email = email.toLowerCase();
      var users = Auth.users();
      if (users.some(function (u) { return u.email === email; })) return { ok: false, field: 'email', error: '這個 Email 已經註冊過了,請直接登入。' };
      users.push({ name: name, email: email, pw: hashPw(pw, email), at: Date.now() });
      store.set('cl_users', users);
      store.set('cl_session', email);
      return { ok: true };
    },
    login: function (email, pw) {
      email = email.toLowerCase();
      var u = Auth.users().filter(function (x) { return x.email === email; })[0];
      if (!u || u.pw !== hashPw(pw, email)) return { ok: false, field: 'password', error: 'Email 或密碼不正確。' };
      store.set('cl_session', email);
      return { ok: true };
    },
    logout: function () { store.del('cl_session'); }
  };
  /* 登入後只允許導回站內頁面(避免 open redirect) */
  function safeNext() {
    var n = '';
    try { n = new URLSearchParams(location.search).get('next') || ''; } catch (e) { /* 忽略 */ }
    var m = n.match(/^([a-z]+\.html)(#[a-z-]+)?$/);
    return m && ALL_FILES.indexOf(m[1]) > -1 && m[1] !== 'login.html' ? n : 'index.html';
  }
  function loginHref() {
    var f = currentFile();
    return 'login.html' + (f === 'login.html' ? '' : '?next=' + encodeURIComponent(f + location.hash));
  }

  /* ---------- 4. 共用元件:導覽列、手機選單、頁尾(由 JS 注入) ---------- */
  var body = document.body;
  var page = body.getAttribute('data-page') || '';
  var headerEl;

  function navLinksHtml() {
    return PAGES.map(function (p) {
      return '<a href="' + p.file + '"' + (p.key === page ? ' aria-current="page"' : '') + '>' + esc(p.label) + '</a>';
    }).join('');
  }
  function buildHeader() {
    var host = $('#site-header');
    if (!host) return;
    host.innerHTML =
      '<a class="skip" href="#main">跳到主要內容</a>' +
      '<div class="progress" aria-hidden="true"><i></i></div>' +
      '<header class="site-header" id="siteHeader"><div class="wrap nav">' +
      '<a class="logo" href="index.html" aria-label="' + esc(SITE.name) + ' 回首頁"><b>' + esc(SITE.name) + '</b><small>' + esc(SITE.en) + '</small></a>' +
      '<nav class="nav-links" aria-label="主要選單">' + navLinksHtml() + '</nav>' +
      '<div class="nav-auth" data-auth></div>' +
      '<button class="burger" type="button" aria-label="開啟選單" aria-expanded="false" aria-controls="m-menu"><i></i><i></i></button>' +
      '</div></header>' +
      '<div class="m-menu" id="m-menu"><nav aria-label="手機選單">' + navLinksHtml() + '</nav><div class="nav-auth" data-auth></div></div>';
    headerEl = $('#siteHeader');
    /* 鍵盤 Tab 進入導覽列時,確保它不是被隱藏的狀態 */
    headerEl.addEventListener('focusin', function () { headerEl.classList.remove('hide'); });
    var burger = $('.burger', host);
    function setMenu(open) {
      body.classList.toggle('menu-open', open);
      body.classList.toggle('no-scroll', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
    }
    burger.addEventListener('click', function () { setMenu(!body.classList.contains('menu-open')); });
    $$('#m-menu a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && body.classList.contains('menu-open')) { setMenu(false); burger.focus(); } });
    addEventListener('resize', function () { if (innerWidth > 960 && body.classList.contains('menu-open')) setMenu(false); });
  }
  function buildFooter() {
    var host = $('#site-footer');
    if (!host) return;
    host.innerHTML =
      '<footer class="site-footer"><div class="wrap"><div class="foot">' +
      '<div><a class="logo" href="index.html"><b>' + esc(SITE.name) + '</b><small>' + esc(SITE.en) + '</small></a><p>' + esc(SITE.tagline) + '</p></div>' +
      '<div><h4>Sitemap</h4><ul>' + PAGES.map(function (p) { return '<li><a href="' + p.file + '">' + esc(p.label) + '</a></li>'; }).join('') + '<li><a href="login.html">會員登入</a></li></ul></div>' +
      '<div><h4>Contact</h4><address>' + esc(SITE.address) + '<br>' + esc(SITE.phone) + '<br>' + esc(SITE.email) + '<br>' + esc(SITE.hours) + '</address></div>' +
      '</div><div class="foot-bottom"><span>' + esc(SITE.copyright) + '</span><span>本站為虛構品牌之作品集展示,圖片為 AI 生成示意。</span></div></div></footer>';
  }
  /* 依登入狀態更新導覽列右側 */
  function renderAuth() {
    var u = Auth.current();
    $$('[data-auth]').forEach(function (box) {
      if (u) {
        box.innerHTML = '<span class="hi">Hi, ' + esc(u.name) + '</span><button type="button" data-logout>登出</button>';
      } else {
        box.innerHTML = '<a href="' + esc(loginHref()) + '">登入 / 註冊</a>';
      }
    });
  }
  /* 登出按鈕用事件委派,重新渲染導覽列時不會重複綁定 */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-logout]')) return;
    Auth.logout();
    renderAuth();
    document.dispatchEvent(new CustomEvent('cl:auth'));
  });
  /* 把 data-site 欄位填入站點設定 */
  function fillSite() {
    $$('[data-site]').forEach(function (el) { var v = SITE[el.getAttribute('data-site')]; if (v != null) el.textContent = v; });
    $$('[data-site-href]').forEach(function (el) {
      var k = el.getAttribute('data-site-href');
      el.href = k === 'email' ? 'mailto:' + SITE.email : 'tel:' + SITE.phone.replace(/[^\d+]/g, '');
    });
    var t = body.getAttribute('data-title');
    document.title = (t ? t + ' | ' : '') + SITE.name + ' ' + SITE.enTitle;
  }

  /* ---------- 5. 圖片預載:成功設為背景,失敗顯示漸層色塊與檔名 ---------- */
  var imgCache = {};
  function preload(f) {
    return imgCache[f] || (imgCache[f] = new Promise(function (res) {
      var i = new Image();
      i.onload = function () { res(true); };
      i.onerror = function () { res(false); };
      i.src = IMG_DIR + f;
    }));
  }
  function gradFor(f) {
    var n = parseInt(f, 10) || 0;
    return GRADS[n % GRADS.length];
  }
  function initImages() {
    $$('[data-img]').forEach(function (el) {
      var f = el.getAttribute('data-img');
      var alt = el.getAttribute('data-alt');
      if (alt) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', alt); } else { el.setAttribute('aria-hidden', 'true'); }
      preload(f).then(function (ok) {
        if (ok) {
          el.style.backgroundImage = 'url("' + IMG_DIR + f + '")';
          el.classList.add('is-loaded');
        } else {
          var g = gradFor(f);
          el.style.setProperty('--g1', g[0]);
          el.style.setProperty('--g2', g[1]);
          el.setAttribute('data-fname', IMG_DIR + f);
          el.classList.add('img-missing');
        }
      });
    });
  }

  /* ---------- 6. 視差(rAF + translate3d,不使用 background-attachment: fixed) ---------- */
  var items = [];       // 捲動視差項目
  var depthEls = [];    // 滑鼠景深項目
  var mouse = { tx: 0, ty: 0, x: 0, y: 0 };
  var ticking = false;
  var lastY = 0;
  var progressBar;

  function initParallax() {
    progressBar = $('.progress i');
    if (!reduced) {
      /* .par-img 用 data-speed(0–1)= 位移幅度;其他元素的 data-speed = 每捲動 1px 位移幾 px(負值為反向) */
      $$('[data-speed]').forEach(function (el) {
        var isImg = el.classList.contains('par-img');
        var box = isImg ? el.closest('.par') : el.parentElement;
        if (!box) return;
        items.push({ el: el, box: box, img: isImg, s: parseFloat(el.getAttribute('data-speed')) || 0, fade: el.hasAttribute('data-fade'), near: true });
      });
      /* 只處理在視窗附近的元素 */
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) { items.forEach(function (it) { if (it.box === e.target) it.near = e.isIntersecting; }); });
          requestTick();
        }, { rootMargin: '30% 0px 30% 0px' });
        var seen = [];
        items.forEach(function (it) { if (seen.indexOf(it.box) < 0) { seen.push(it.box); io.observe(it.box); } });
      }
      if (!coarse) {
        depthEls = $$('[data-depth]').map(function (el) {
          return { el: el, a: parseFloat(el.getAttribute('data-depth')) || 0, sc: parseFloat(el.getAttribute('data-scale')) || 1 };
        });
        addEventListener('mousemove', function (e) {
          mouse.tx = (e.clientX / innerWidth - .5) * 2;
          mouse.ty = (e.clientY / innerHeight - .5) * 2;
          requestTick();
        }, { passive: true });
      }
    }
    addEventListener('scroll', requestTick, { passive: true });
    addEventListener('resize', requestTick);
    requestTick();
  }
  function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function frame() {
    ticking = false;
    var vh = innerHeight, y = scrollY || pageYOffset;

    /* 導覽列:捲動後變實色,往下隱藏、往上顯示 */
    if (headerEl) {
      var solid = y > 60 || body.hasAttribute('data-solid');
      headerEl.classList.toggle('solid', solid);
      if (!body.classList.contains('menu-open')) {
        if (y > lastY + 4 && y > 240) headerEl.classList.add('hide');
        else if (y < lastY - 4 || y < 120) headerEl.classList.remove('hide');
      }
    }
    lastY = y;

    /* 頂部進度條 */
    if (progressBar) {
      var max = document.documentElement.scrollHeight - vh;
      progressBar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4) + ')';
    }

    /* 視差:先讀取、再寫入,避免重複 layout */
    var near = items.filter(function (it) { return it.near; });
    var rects = near.map(function (it) { return it.box.getBoundingClientRect(); });
    near.forEach(function (it, i) {
      var r = rects[i], off;
      if (r.bottom < -vh * .3 || r.top > vh * 1.3) return;
      if (it.img) {
        var p = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
        off = -p * clamp(it.s, 0, 1) * .18 * r.height;
      } else {
        off = -(r.top + r.height / 2 - vh / 2) * it.s;
      }
      it.el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
      if (it.fade) it.el.style.opacity = clamp(1 - y / (vh * .7), 0, 1).toFixed(3);
    });

    /* 滑鼠景深(線性內插,靠近目標才停止) */
    if (depthEls.length) {
      mouse.x += (mouse.tx - mouse.x) * .08;
      mouse.y += (mouse.ty - mouse.y) * .08;
      depthEls.forEach(function (d) {
        d.el.style.transform = 'translate3d(' + (mouse.x * d.a).toFixed(2) + 'px,' + (mouse.y * d.a).toFixed(2) + 'px,0)' + (d.sc !== 1 ? ' scale(' + d.sc + ')' : '');
      });
      if (Math.abs(mouse.tx - mouse.x) > .002 || Math.abs(mouse.ty - mouse.y) > .002) requestTick();
    }

    /* 精選作品 Reel */
    if (reel && updateReel()) requestTick();
  }

  /* ---------- 6b. 精選作品 Reel:滾動驅動的全螢幕視差 ----------
     每張圖分到一段捲動距離 u(0→1):
       0.00–0.35 從畫面下方滑入(圖片本身落後,產生景深)
       0.35–0.75 以 cubic-out 曲線從圓形放大到全螢幕(clip-path circle 展開 + 圖片反向縮放)
       0.62–0.90 標題、分類、介紹逐行浮現
       0.75–1.00 停留;下一張進來時,這張往後退並變暗 */
  var reel = null;
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function seg(u, a, b) { return clamp((u - a) / (b - a), 0, 1); }
  function initReel() {
    var sec = $('.reel');
    if (!sec || reduced) return;   /* 減少動態:保留靜態堆疊版面 */
    var list = $$('.reel-item', sec).map(function (el) {
      return {
        el: el, img: $('.reel-img', el), shade: $('.reel-shade', el), grad: $('.reel-grad', el), texts: $$('[data-rt]', el),
        w: parseFloat(el.getAttribute('data-w')) || .4, h: parseFloat(el.getAttribute('data-h')) || .55, x: parseFloat(el.getAttribute('data-x')) || 0
      };
    });
    if (!list.length) return;
    sec.style.setProperty('--n', list.length);
    sec.classList.add('is-live');
    reel = {
      sec: sec, stage: $('.reel-stage', sec), items: list, intro: $('.reel-intro', sec),
      count: $('.reel-count', sec), cur: $('[data-reel-cur]', sec), bar: $('.reel-bar i', sec), s: null, lastCur: ''
    };
    measureReel();
    addEventListener('resize', measureReel);
  }
  function measureReel() {
    if (!reel) return;
    reel.W = reel.stage.clientWidth;
    reel.H = reel.stage.clientHeight;
    reel.dist = Math.max(1, reel.sec.offsetHeight - reel.H);
    requestTick();
  }
  /* 回傳 true 代表平滑動畫尚未收斂,需要下一格 */
  function updateReel() {
    var R = reel, N = R.items.length, W = R.W, H = R.H, mobile = W < 760;
    var target = clamp(-R.sec.getBoundingClientRect().top / R.dist, 0, 1) * N;
    if (R.s === null) R.s = target;
    R.s += (target - R.s) * .1;                       /* 慣性平滑,讓滾輪的段落感消失 */
    if (Math.abs(target - R.s) < .0006) R.s = target;
    var s = R.s;

    /* 開場標題:往上反向視差並淡出 */
    var e0 = easeOut(seg(s, 0, .35));
    R.intro.style.transform = 'translate3d(0,' + (-e0 * H * .3).toFixed(1) + 'px,0)';
    R.intro.style.opacity = clamp(1 - e0 * 1.4, 0, 1).toFixed(3);

    R.items.forEach(function (it, i) {
      var u = clamp(s - i, 0, 1);
      var nxt = i < N - 1 ? clamp(s - i - 1, 0, 1) : 0;
      var enter = easeOut(seg(u, 0, .35));
      var grow = easeOut(seg(u, .35, .75));           /* cubic-out 放大 */
      var txt = seg(u, .62, .9);
      var hold = seg(u, .75, 1);
      var push = easeOut(seg(nxt, 0, .75));            /* 下一張進場時的後退量 */
      var textOut = 1 - seg(nxt, 0, .18);

      /* 圓形(縮小狀態)的大小與圓心;放大時半徑以 cubic-out 長到能蓋住整個螢幕 */
      var d = mobile ? Math.min(W * .74, H * .46) : Math.min(it.h * H * .92, W * .46);
      var r0 = d / 2, cx = W / 2 + (mobile ? 0 : it.x * W), cy = H / 2;
      var rFull = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 2;
      var rad = r0 + (rFull - r0) * grow;
      var ty = (1 - enter) * (H - (cy - r0) + 60);    /* 從畫面外往上滑入 */
      var sc = 1 - push * .1;
      it.el.style.transform = 'translate3d(0,' + ty.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
      it.el.style.clipPath = 'circle(' + rad.toFixed(1) + 'px at ' + cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px)';

      /* 圖片:滑入時落後(重度視差)、放大時反向縮小、停留時緩慢漂移 */
      var iy = -ty * .28 - hold * H * .035 + push * H * .06;
      var is = 1.38 - .33 * grow - .05 * hold;
      it.img.style.transform = 'translate3d(0,' + iy.toFixed(1) + 'px,0) scale(' + is.toFixed(4) + ')';
      it.shade.style.opacity = (push * .6).toFixed(3);
      it.grad.style.opacity = (Math.max(grow * .35, txt) * textOut).toFixed(3);

      /* 文字逐行浮現 */
      it.texts.forEach(function (t, j) {
        var p = easeOut(clamp(txt * 1.7 - j * .22, 0, 1)) * textOut;
        t.style.opacity = p.toFixed(3);
        t.style.transform = 'translate3d(0,' + ((1 - p) * 42).toFixed(1) + 'px,0)';
      });
    });

    /* 第一張放大到全螢幕後,舞台底色轉為墨黑,後退的圖片四周不會露出米色 */
    R.stage.classList.toggle('is-dark', s > .75);

    /* 右側計數器與進度 */
    var cur = pad(clamp(Math.floor(s - .35) + 1, 1, N));
    if (cur !== R.lastCur) { R.cur.textContent = cur; R.lastCur = cur; }
    R.count.style.opacity = easeOut(seg(s, .45, .75)).toFixed(3);
    R.bar.style.transform = 'scaleY(' + (s / N).toFixed(4) + ')';
    return s !== target;
  }

  /* ---------- 7. 進場動畫:標題逐行、區塊淡入、數字計數 ---------- */
  function initReveal() {
    var list = $$('.reveal');
    if (reduced || !('IntersectionObserver' in window)) { list.forEach(function (e) { e.classList.add('in'); }); }
    else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
      list.forEach(function (e) { io.observe(e); });
    }
    /* 數字計數 */
    var counters = $$('[data-count]');
    function run(el) {
      var to = parseFloat(el.getAttribute('data-count')) || 0, t0 = null, dur = 1600;
      var span = el.querySelector('span') || el;
      if (reduced) { span.textContent = to; return; }
      (function step(t) {
        if (t0 == null) t0 = t;
        var k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
        span.textContent = Math.round(to * e);
        if (k < 1) requestAnimationFrame(step);
      })(performance.now());
    }
    if (!counters.length) return;
    if (reduced || !('IntersectionObserver' in window)) { counters.forEach(function (c) { var s = c.querySelector('span') || c; s.textContent = c.getAttribute('data-count'); }); return; }
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } });
    }, { threshold: .6 });
    counters.forEach(function (c) { cio.observe(c); });
  }
  function readyClass() {
    var go = function () { requestAnimationFrame(function () { body.classList.add('ready'); }); };
    var wait = new Promise(function (r) { setTimeout(r, 900); });
    if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, wait]).then(go); else go();
  }

  /* ---------- 8. Lightbox(Esc 或點背景關閉) ---------- */
  function initLightbox() {
    var cards = $$('.work');
    if (!cards.length) return;
    var lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', '作品大圖');
    lb.innerHTML = '<button class="lb-close" type="button" aria-label="關閉">✕</button><figure><div class="lb-media"></div><figcaption></figcaption></figure>';
    body.appendChild(lb);
    var media = $('.lb-media', lb), cap = $('figcaption', lb), closeBtn = $('.lb-close', lb), opener = null;

    function open(card) {
      opener = card;
      var f = card.getAttribute('data-file'), t = card.getAttribute('data-title') || '', m = card.getAttribute('data-meta') || '';
      media.innerHTML = '';
      preload(f).then(function (ok) {
        if (ok) {
          var img = new Image();
          img.src = IMG_DIR + f;
          img.alt = t;
          media.appendChild(img);
        } else {
          var g = gradFor(f), ph = document.createElement('div');
          ph.className = 'lb-ph';
          ph.style.setProperty('--g1', g[0]);
          ph.style.setProperty('--g2', g[1]);
          ph.textContent = IMG_DIR + f;
          media.appendChild(ph);
        }
      });
      cap.innerHTML = esc(t) + '<small>' + esc(m) + '</small>';
      lb.classList.add('open');
      body.classList.add('no-scroll');
      closeBtn.focus();
    }
    function close() {
      lb.classList.remove('open');
      if (!body.classList.contains('menu-open')) body.classList.remove('no-scroll');
      if (opener) opener.focus();
    }
    cards.forEach(function (c) { c.addEventListener('click', function () { open(c); }); });
    closeBtn.addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'FIGURE') close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); } /* 焦點鎖在對話框內 */
    });
  }

  /* ---------- 9. 登入 / 註冊頁 ---------- */
  function initAuthPage() {
    var root = $('#auth-root');
    if (!root) return;
    var loginForm = $('#login-form'), regForm = $('#register-form'), welcome = $('#welcome');
    var tabs = $$('.tab', root), panels = { login: $('#panel-login'), register: $('#panel-register') };
    [loginForm, regForm].forEach(bindErrors);

    function showTab(name, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-tab') === name;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panels.login.hidden = name !== 'login';
      panels.register.hidden = name !== 'register';
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
      t.addEventListener('keydown', function (e) { /* 方向鍵切換分頁 */
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          showTab(tabs[(i + 1) % tabs.length].getAttribute('data-tab'), true);
        }
      });
    });
    if (location.hash === '#register') showTab('register');

    function renderState() {
      var u = Auth.current();
      var next = safeNext();
      $('#tabs-wrap').hidden = !!u;
      welcome.hidden = !u;
      if (u) {
        $('[data-who]', welcome).textContent = u.name;
        $('[data-go]', welcome).href = next;
        panels.login.hidden = panels.register.hidden = true;
      } else {
        showTab(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0].getAttribute('data-tab'));
      }
    }
    function done(msgEl, text) {
      showMsg(msgEl, text);
      renderAuth();
      setTimeout(function () { location.href = safeNext(); }, reduced ? 0 : 700);
    }
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrs(loginForm);
      var email = loginForm.email.value.trim(), pw = loginForm.password.value, ok = true;
      if (!isEmail(email)) ok = setErr(loginForm, 'email', '請輸入正確的 Email 格式。') && ok;
      if (!pw) ok = setErr(loginForm, 'password', '請輸入密碼。') && ok;
      if (!ok) return;
      var r = Auth.login(email, pw);
      if (!r.ok) { setErr(loginForm, r.field, r.error); return; }
      done($('.form-msg', loginForm), '登入成功,正在帶您回到原本的頁面…');
    });
    regForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrs(regForm);
      var name = regForm.name.value.trim(), email = regForm.email.value.trim(), pw = regForm.password.value, pw2 = regForm.confirm.value, ok = true;
      if (name.length < 1 || name.length > 20) ok = setErr(regForm, 'name', '請輸入姓名(1–20 字)。') && ok;
      if (!isEmail(email)) ok = setErr(regForm, 'email', '請輸入正確的 Email 格式。') && ok;
      if (pw.length < 6) ok = setErr(regForm, 'password', '密碼至少需要 6 碼。') && ok;
      else if (pw.length > 64) ok = setErr(regForm, 'password', '密碼最多 64 碼。') && ok;
      if (pw2 !== pw) ok = setErr(regForm, 'confirm', '兩次輸入的密碼不一致。') && ok;
      if (!ok) return;
      var r = Auth.register(name, email, pw);
      if (!r.ok) { setErr(regForm, r.field, r.error); return; }
      done($('.form-msg', regForm), '註冊成功,已為您登入,正在返回…');
    });
    document.addEventListener('cl:auth', renderState);
    renderState();
  }

  /* ---------- 10. 線上預約(無金流,資料存 localStorage) ---------- */
  function initBooking() {
    var form = $('#booking-form');
    if (!form) return;
    bindErrors(form);
    var gate = $('#booking-gate'), listEl = $('#my-bookings'), slotsEl = $('#slots'), dateEl = form.date, msg = $('.form-msg', form);
    var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    var far = new Date(tomorrow); far.setDate(far.getDate() + 180);
    dateEl.min = ymd(tomorrow);   /* 最早明天 */
    dateEl.max = ymd(far);

    function all() { var b = store.get('cl_bookings', []); return Array.isArray(b) ? b : []; }
    function parseDate(v) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
      if (!m) return null;
      var d = new Date(+m[1], +m[2] - 1, +m[3]);
      return d.getMonth() === +m[2] - 1 ? d : null;
    }
    function dateProblem(v) {
      var d = parseDate(v);
      if (!d) return '請選擇預約日期。';
      if (d < tomorrow) return '最早可預約明天的時段。';
      if (d > far) return '目前僅開放 180 天內的預約。';
      if (d.getDay() === 0 || d.getDay() === 1) return '週日、週一為公休,請改選週二至週六。';
      return '';
    }
    function taken(date, slot) { return all().some(function (b) { return b.date === date && b.slot === slot; }); }

    /* 時段按鈕:已被預約的變灰不能選 */
    function renderSlots() {
      var v = dateEl.value, prob = v ? dateProblem(v) : '請先選擇日期,再挑選時段。';
      var keep = (form.slot && form.slot.value) || '';
      slotsEl.innerHTML = SLOTS.map(function (s) {
        var off = !!prob || taken(v, s);
        return '<label class="slot"><input type="radio" name="slot" value="' + esc(s) + '"' + (off ? ' disabled' : '') + (!off && keep === s ? ' checked' : '') + '><span>' + esc(s) + (off && !prob ? ' <span class="vh">(已額滿)</span>' : '') + '</span></label>';
      }).join('');
      var hint = $('#slots-hint');
      hint.textContent = prob || '灰色且有刪除線的時段已被預約。';
    }

    /* 我的預約(輸出前一律 escape) */
    function renderList() {
      var u = Auth.current();
      var mine = u ? all().filter(function (b) { return b.email === u.email; }).sort(function (a, b) { return (a.date + a.slot).localeCompare(b.date + b.slot); }) : [];
      if (!mine.length) { listEl.innerHTML = '<li class="empty">目前沒有預約紀錄。</li>'; return; }
      listEl.innerHTML = mine.map(function (b) {
        return '<li><div><strong>' + esc(SERVICES[b.service] || b.service) + '</strong><span>' + esc(b.date) + ' ' + esc(b.slot) + '</span>' +
          '<small>' + esc(b.name) + ' · ' + esc(b.phone) + (b.note ? ' · ' + esc(b.note) : '') + '</small></div>' +
          '<button class="btn btn--sm" type="button" data-cancel="' + esc(b.id) + '">取消預約</button></li>';
      }).join('');
    }
    /* 取消:需按兩次確認(避免使用瀏覽器對話框) */
    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cancel]');
      if (!btn) return;
      if (!btn.hasAttribute('data-armed')) {
        btn.setAttribute('data-armed', '1');
        btn.textContent = '再按一次確認';
        setTimeout(function () { if (btn.isConnected) { btn.removeAttribute('data-armed'); btn.textContent = '取消預約'; } }, 3500);
        return;
      }
      var u = Auth.current(), id = btn.getAttribute('data-cancel');
      store.set('cl_bookings', all().filter(function (b) { return !(b.id === id && u && b.email === u.email); }));
      showMsg(msg, '已取消該筆預約,時段已釋出。');
      renderList(); renderSlots();
    });

    /* 登入狀態:未登入時表單被遮罩並引導到登入頁 */
    function applyAuth() {
      var u = Auth.current();
      gate.hidden = !!u;
      if (u) { form.removeAttribute('inert'); if (!form.name.value) form.name.value = u.name; } else { form.setAttribute('inert', ''); }
      var link = $('a', gate);
      if (link) link.href = 'login.html?next=' + encodeURIComponent('services.html#booking');
      renderList();
    }
    document.addEventListener('cl:auth', applyAuth);

    dateEl.addEventListener('change', function () { setErr(form, 'date', ''); renderSlots(); });
    form.addEventListener('change', function (e) { if (e.target.name === 'slot') setErr(form, 'slot', ''); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var u = Auth.current();
      if (!u) { applyAuth(); return; }
      clearErrs(form); showMsg(msg, '');
      var service = form.service.value, date = dateEl.value, slot = (form.slot && form.slot.value) || '';
      var name = form.name.value.trim(), phone = form.phone.value.trim(), note = form.note.value.trim(), ok = true;
      if (!SERVICES[service]) ok = setErr(form, 'service', '請選擇服務項目。') && ok;
      var dp = dateProblem(date); if (dp) ok = setErr(form, 'date', dp) && ok;
      if (!dp && !slot) ok = setErr(form, 'slot', '請選擇一個時段。') && ok;
      if (SLOTS.indexOf(slot) < 0 && slot) ok = setErr(form, 'slot', '時段不正確,請重新選擇。') && ok;
      if (name.length < 1 || name.length > 20) ok = setErr(form, 'name', '請輸入姓名(1–20 字)。') && ok;
      if (!isPhone(phone)) ok = setErr(form, 'phone', '請輸入正確的電話,例如 0912-345-678 或 02-1234-5678。') && ok;
      if (note.length > 200) ok = setErr(form, 'note', '備註請控制在 200 字以內。') && ok;
      if (!ok) return;
      if (taken(date, slot)) { setErr(form, 'slot', '這個時段剛被預約了,請改選其他時段。'); renderSlots(); return; }
      var list = all();
      list.push({ id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), email: u.email, service: service, date: date, slot: slot, name: name, phone: phone, note: note, at: Date.now() });
      store.set('cl_bookings', list);
      showMsg(msg, '預約已送出:' + date + ' ' + slot + '・' + SERVICES[service] + '。(展示用途,不會真的通知設計師)');
      dateEl.value = ''; form.note.value = '';
      renderSlots(); renderList();
    });

    /* 服務區塊的「預約此服務」按鈕:帶入服務項目 */
    $$('[data-book]').forEach(function (a) {
      a.addEventListener('click', function () { form.service.value = a.getAttribute('data-book'); setErr(form, 'service', ''); });
    });
    renderSlots();
    applyAuth();
  }

  /* ---------- 11. 聯絡表單 ---------- */
  function initContact() {
    var form = $('#contact-form');
    if (!form) return;
    bindErrors(form);
    var msg = $('.form-msg', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrs(form);
      var name = form.name.value.trim(), email = form.email.value.trim(), phone = form.phone.value.trim(), text = form.message.value.trim(), ok = true;
      if (name.length < 1 || name.length > 20) ok = setErr(form, 'name', '請輸入姓名(1–20 字)。') && ok;
      if (!isEmail(email)) ok = setErr(form, 'email', '請輸入正確的 Email 格式。') && ok;
      if (phone && !isPhone(phone)) ok = setErr(form, 'phone', '電話格式不正確(可留空)。') && ok;
      if (text.length < 5) ok = setErr(form, 'message', '請至少輸入 5 個字。') && ok;
      else if (text.length > 500) ok = setErr(form, 'message', '訊息請控制在 500 字以內。') && ok;
      if (!ok) return;
      var box = store.get('cl_messages', []);
      if (!Array.isArray(box)) box = [];
      box.push({ name: name, email: email, phone: phone, message: text, at: Date.now() });
      store.set('cl_messages', box.slice(-20));
      form.reset();
      showMsg(msg, '謝謝您的來信!(展示用途:訊息只存在這個瀏覽器,不會寄出)');
    });
  }

  /* ---------- 啟動 ---------- */
  function start() {
    buildHeader();
    buildFooter();
    fillSite();
    renderAuth();
    initImages();
    initReel();
    initParallax();
    initReveal();
    initLightbox();
    initAuthPage();
    initBooking();
    initContact();
    readyClass();
    var sn = $('#storage-note'); if (useMem && sn) sn.hidden = false;
    /* 從別頁帶著 #booking 進來時,資料渲染後再定位 */
    if (location.hash === '#booking') setTimeout(function () { var t = $('#booking'); if (t) t.scrollIntoView(); }, 60);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
