/**
 * toolbar.js — 前端浮动工具栏（FAB 风格）
 * 功能：主题切换、字体切换、背景色切换、语言切换、返回顶部
 * 无框架依赖，纯原生 JS
 */
(function() {
  'use strict';

  /* ===== 配置数据 ===== */
  var FONTS = [
    { id: 'inter',  label: 'Inter',  en: 'Inter' },
    { id: 'noto',   label: '思源',   en: 'Noto' },
    { id: 'system', label: '系统',   en: 'System' },
    { id: 'serif',  label: '宋体',   en: 'Serif' },
    { id: 'mono',   label: '等宽',   en: 'Mono' }
  ];

  var BG_COLORS = [
    { id: 'default',  color: '#fafafa', label: '默认',  dark: false },
    { id: 'warm',     color: '#fdf6f0', label: '暖色',  dark: false },
    { id: 'cool',     color: '#eef1f5', label: '冷色',  dark: false },
    { id: 'mint',     color: '#eef7f2', label: '薄荷',  dark: false },
    { id: 'lavender', color: '#f3eef7', label: '薰衣草', dark: false },
    { id: 'dark',     color: '#12121e', label: '深色',  dark: true }
  ];

  var BG_SCHEMES = {
    default: null,
    warm: {
      '--bg-primary': '#fdf6f0', '--bg-secondary': '#f5ece2', '--bg-elevated': '#fffbf7',
      '--bg-hover': '#f8f0e8', '--border': '#e4d8cc', '--border-subtle': '#efe5d9',
      '--text-primary': '#292524', '--text-secondary': '#6b6560', '--text-tertiary': '#a09890',
      '--accent': '#4a7ab5', '--accent-hover': '#3d6a9e', '--accent-subtle': '#eef4fa',
      '--accent-text': '#4a7ab5'
    },
    cool: {
      '--bg-primary': '#eef1f5', '--bg-secondary': '#e4e8ee', '--bg-elevated': '#f7f8fa',
      '--bg-hover': '#e0e5ec', '--border': '#cdd3dc', '--border-subtle': '#dce1e8',
      '--text-primary': '#1a2332', '--text-secondary': '#546178', '--text-tertiary': '#8a96a8',
      '--accent': '#4a6a8a', '--accent-hover': '#3d5a78', '--accent-subtle': '#e8eff6',
      '--accent-text': '#4a6a8a'
    },
    mint: {
      '--bg-primary': '#eef7f2', '--bg-secondary': '#ddeee4', '--bg-elevated': '#f5faf7',
      '--bg-hover': '#d8eae0', '--border': '#c4ddce', '--border-subtle': '#d4e8dc',
      '--text-primary': '#1a2e22', '--text-secondary': '#4a6b55', '--text-tertiary': '#7a9e88',
      '--accent': '#3d7a5c', '--accent-hover': '#2d6a4c', '--accent-subtle': '#e5f2eb',
      '--accent-text': '#3d7a5c'
    },
    lavender: {
      '--bg-primary': '#f3eef7', '--bg-secondary': '#e8e0f0', '--bg-elevated': '#faf7fc',
      '--bg-hover': '#e3d9ee', '--border': '#d4c8e2', '--border-subtle': '#e0d6ec',
      '--text-primary': '#261a32', '--text-secondary': '#615478', '--text-tertiary': '#9488a8',
      '--accent': '#7a5a9a', '--accent-hover': '#6a4a88', '--accent-subtle': '#f0eaf6',
      '--accent-text': '#7a5a9a'
    },
    dark: {
      '--bg-primary': '#12121e', '--bg-secondary': '#1a1a2e', '--bg-elevated': '#1e1e32',
      '--bg-hover': '#252540', '--border': '#2a2a44', '--border-subtle': '#222238',
      '--text-primary': '#e0e0ec', '--text-secondary': '#9898b0', '--text-tertiary': '#6868a0',
      '--text-placeholder': '#4a4a70',
      '--accent': '#6888c0', '--accent-hover': '#7898d0', '--accent-subtle': '#1a2440',
      '--accent-text': '#7898d0',
      '--danger': '#e06060', '--danger-bg': '#301515',
      '--success': '#50c878', '--success-bg': '#152818',
      '--shadow-xs': '0 1px 2px rgba(0,0,0,0.3)',
      '--shadow-sm': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
      '--shadow-md': '0 4px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.25)',
      '--shadow-lg': '0 10px 15px rgba(0,0,0,0.35), 0 4px 6px rgba(0,0,0,0.25)',
      '--shadow-card': '0 1px 3px rgba(0,0,0,0.3)',
      '--shadow-card-hover': '0 8px 24px rgba(0,0,0,0.4)'
    }
  };

  var LABELS = {
    zh: { theme: '主题', font: '字体', bg: '背景', lang: '语言', settings: '设置', top: '顶部' },
    en: { theme: 'Theme', font: 'Font', bg: 'Background', lang: 'Language', settings: 'Settings', top: 'Top' }
  };

  /* ===== 状态 ===== */
  var settings = {
    theme: localStorage.getItem('ayoo_theme') || localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'),
    font: localStorage.getItem('ayoo_font') || 'inter',
    bg: localStorage.getItem('ayoo_bg') || 'default',
    lang: localStorage.getItem('ayoo_lang') || 'zh'
  };
  var popupOpen = false;

  /* ===== 公共方法（暴露给 window 供 onclick 调用） ===== */
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    settings.theme = theme;
    localStorage.setItem('ayoo_theme', theme);
    localStorage.setItem('theme', theme);
    applyBgImage();
    refreshUI();
  }

  function toggleTheme() {
    setTheme(settings.theme === 'dark' ? 'light' : 'dark');
  }

  function setFont(fontId) {
    document.documentElement.setAttribute('data-font', fontId);
    settings.font = fontId;
    localStorage.setItem('ayoo_font', fontId);
    refreshUI();
  }

  function setBg(bgId) {
    var scheme = BG_SCHEMES[bgId];
    var root = document.documentElement;
    if (!scheme) {
      Object.keys(BG_SCHEMES).forEach(function(key) {
        if (BG_SCHEMES[key]) {
          Object.keys(BG_SCHEMES[key]).forEach(function(v) { root.style.removeProperty(v); });
        }
      });
      root.removeAttribute('data-bg');
    } else {
      root.setAttribute('data-bg', bgId);
      Object.keys(scheme).forEach(function(v) { root.style.setProperty(v, scheme[v]); });
    }
    settings.bg = bgId;
    localStorage.setItem('ayoo_bg', bgId);
    applyBgImage();
    refreshUI();
  }

  function setLang(lang) {
    settings.lang = lang;
    localStorage.setItem('ayoo_lang', lang);
    // 切换页面文本
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    var els = document.querySelectorAll('[data-zh]');
    for (var i = 0; i < els.length; i++) {
      var text = els[i].getAttribute('data-' + lang);
      if (text !== null) els[i].textContent = text;
    }
    // 重建弹窗以更新按钮文字
    var wasOpen = popupOpen;
    buildPopup();
    if (wasOpen) {
      var popup = document.getElementById('fab-popup');
      if (popup) popup.classList.add('active');
      var overlay = document.getElementById('fab-overlay');
      if (overlay) overlay.classList.add('active');
    }
    refreshUI();
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  /* ===== 背景图片管理 ===== */
  var bgFetching = false;
  function applyBgImage() {
    if (window.__bgSettings) {
      doApplyBgImage(window.__bgSettings);
    } else if (!bgFetching) {
      bgFetching = true;
      fetch('/api/settings').then(function(r) { return r.json(); }).then(function(data) {
        window.__bgSettings = {
          bg: data.bg_image || '',
          bgDark: data.bg_image_dark || '',
          solidBg: data.solid_bg === '1' || data.solid_bg === true
        };
        doApplyBgImage(window.__bgSettings);
      }).catch(function() { bgFetching = false; });
    }
  }

  function doApplyBgImage(bg) {
    if (!bg) return;
    if (bg.solidBg) {
      document.body.style.backgroundImage = '';
      return;
    }
    var imgUrl = settings.theme === 'dark' ? (bg.bgDark || '') : (bg.bg || '');
    if (imgUrl) {
      document.body.style.backgroundImage = 'url(' + imgUrl + ')';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = '';
    }
  }

  /* ===== UI 刷新（更新 FAB 按钮 + 弹窗状态） ===== */
  function refreshUI() {
    var L = LABELS[settings.lang] || LABELS.zh;
    var isDark = settings.theme === 'dark';
    // 更新暗色模式按钮图标
    var darkBtn = document.getElementById('fab-dark');
    if (darkBtn) {
      darkBtn.textContent = isDark ? '☀️' : '🌙';
      darkBtn.title = L.theme;
    }
    // 更新主按钮标题
    var mainBtn = document.getElementById('fab-main');
    if (mainBtn) mainBtn.title = L.settings;
    // 更新返回顶部按钮标题
    var topBtn = document.getElementById('fab-top');
    if (topBtn) topBtn.title = L.top;
    // 更新弹窗 active 状态
    updatePopupState();
  }

  function updatePopupState() {
    var popup = document.getElementById('fab-popup');
    if (!popup) return;
    var L = LABELS[settings.lang] || LABELS.zh;
    var labels = popup.querySelectorAll('.fab-group-label');
    if (labels[0]) labels[0].textContent = L.theme;
    if (labels[1]) labels[1].textContent = L.font;
    if (labels[2]) labels[2].textContent = L.bg;
    if (labels[3]) labels[3].textContent = L.lang;
    // 更新主题按钮 active
    popup.querySelectorAll('[data-theme]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.theme === settings.theme);
    });
    // 更新字体按钮 active
    popup.querySelectorAll('[data-font]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.font === settings.font);
    });
    // 更新背景按钮 active
    popup.querySelectorAll('[data-bg]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.bg === settings.bg);
    });
    // 更新语言按钮 active
    popup.querySelectorAll('[data-lang]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.lang === settings.lang);
    });
  }

  /* ===== 弹窗开关 ===== */
  function togglePopup() {
    if (popupOpen) { closePopup(); }
    else { openPopup(); }
  }

  function openPopup() {
    popupOpen = true;
    var popup = document.getElementById('fab-popup');
    var overlay = document.getElementById('fab-overlay');
    if (popup) popup.classList.add('active');
    if (overlay) overlay.classList.add('active');
  }

  function closePopup() {
    popupOpen = false;
    var popup = document.getElementById('fab-popup');
    var overlay = document.getElementById('fab-overlay');
    if (popup) popup.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  /* ===== 返回顶部 ===== */
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ===== 构建 FAB 按钮 ===== */
  function buildFAB() {
    var old = document.getElementById('ayoo-toolbar');
    if (old) old.remove();

    var L = LABELS[settings.lang] || LABELS.zh;
    var isDark = settings.theme === 'dark';

    // FAB 容器
    var container = document.createElement('div');
    container.id = 'ayoo-toolbar';
    container.className = 'fab-container';

    // 返回顶部按钮 — 使用内联 onclick
    var topBtn = document.createElement('button');
    topBtn.id = 'fab-top';
    topBtn.className = 'fab-btn fab-btn-top';
    topBtn.title = L.top;
    topBtn.textContent = '↑';
    topBtn.setAttribute('onclick', 'AyooToolbar._scrollToTop()');

    // 暗色模式切换 — 使用内联 onclick
    var darkBtn = document.createElement('button');
    darkBtn.id = 'fab-dark';
    darkBtn.className = 'fab-btn';
    darkBtn.title = L.theme;
    darkBtn.textContent = isDark ? '☀️' : '🌙';
    darkBtn.setAttribute('onclick', 'AyooToolbar._toggleTheme()');

    // 主设置按钮 — 使用内联 onclick
    var mainBtn = document.createElement('button');
    mainBtn.id = 'fab-main';
    mainBtn.className = 'fab-btn fab-btn-main';
    mainBtn.title = L.settings;
    mainBtn.textContent = '⚙';
    mainBtn.setAttribute('onclick', 'AyooToolbar._togglePopup()');

    container.appendChild(topBtn);
    container.appendChild(darkBtn);
    container.appendChild(mainBtn);
    document.body.appendChild(container);

    // 设置弹窗
    buildPopup();

    // 遮罩层
    var overlay = document.createElement('div');
    overlay.id = 'fab-overlay';
    overlay.className = 'fab-overlay';
    overlay.setAttribute('onclick', 'AyooToolbar._closePopup()');
    document.body.appendChild(overlay);
  }

  /* ===== 构建设置弹窗（所有按钮使用内联 onclick） ===== */
  function buildPopup() {
    var old = document.getElementById('fab-popup');
    if (old) old.remove();

    var L = LABELS[settings.lang] || LABELS.zh;
    var popup = document.createElement('div');
    popup.id = 'fab-popup';
    popup.className = 'fab-popup';

    var html = '';

    // 主题 — 每个按钮内联 onclick 调用 setTheme
    html += '<div class="fab-group">'
      + '<div class="fab-group-label">' + L.theme + '</div>'
      + '<div class="fab-row">'
      + '<button class="fab-opt' + (settings.theme === 'light' ? ' active' : '') + '" data-theme="light" onclick="AyooToolbar._setTheme(\'light\')">☀️ ' + (settings.lang === 'zh' ? '日间' : 'Light') + '</button>'
      + '<button class="fab-opt' + (settings.theme === 'dark' ? ' active' : '') + '" data-theme="dark" onclick="AyooToolbar._setTheme(\'dark\')">🌙 ' + (settings.lang === 'zh' ? '夜间' : 'Dark') + '</button>'
      + '</div></div>';

    // 字体 — 每个按钮内联 onclick 调用 setFont
    html += '<div class="fab-group">'
      + '<div class="fab-group-label">' + L.font + '</div>'
      + '<div class="fab-row">';
    FONTS.forEach(function(f) {
      html += '<button class="fab-opt' + (settings.font === f.id ? ' active' : '') + '" data-font="' + f.id + '" onclick="AyooToolbar._setFont(\'' + f.id + '\')">'
        + (settings.lang === 'zh' ? f.label : f.en) + '</button>';
    });
    html += '</div></div>';

    // 背景色 — 每个按钮内联 onclick 调用 setBg
    html += '<div class="fab-group">'
      + '<div class="fab-group-label">' + L.bg + '</div>'
      + '<div class="fab-row">';
    BG_COLORS.forEach(function(b) {
      html += '<button class="fab-bg-btn' + (settings.bg === b.id ? ' active' : '') + (b.dark ? ' dark-swatch' : '') + '"'
        + ' data-bg="' + b.id + '" style="background:' + b.color + '" title="' + b.label + '" onclick="AyooToolbar._setBg(\'' + b.id + '\')"></button>';
    });
    html += '</div></div>';

    // 语言 — 每个按钮内联 onclick 调用 setLang
    html += '<div class="fab-group">'
      + '<div class="fab-group-label">' + L.lang + '</div>'
      + '<div class="fab-row">'
      + '<button class="fab-opt' + (settings.lang === 'zh' ? ' active' : '') + '" data-lang="zh" onclick="AyooToolbar._setLang(\'zh\')">中文</button>'
      + '<button class="fab-opt' + (settings.lang === 'en' ? ' active' : '') + '" data-lang="en" onclick="AyooToolbar._setLang(\'en\')">English</button>'
      + '</div></div>';

    popup.innerHTML = html;
    document.body.appendChild(popup);
  }

  /* ===== 滚动监听 ===== */
  function bindScroll() {
    var topBtn = document.getElementById('fab-top');
    if (!topBtn) return;
    var ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(function() {
          topBtn.classList.toggle('visible', window.scrollY > 300);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ===== 初始化 ===== */
  function init() {
    setTheme(settings.theme);
    setFont(settings.font);
    setBg(settings.bg);
    applyBgImage();
    // 初始语言设置
    document.documentElement.lang = settings.lang === 'en' ? 'en' : 'zh-CN';
    var els = document.querySelectorAll('[data-zh]');
    for (var i = 0; i < els.length; i++) {
      var text = els[i].getAttribute('data-' + settings.lang);
      if (text !== null) els[i].textContent = text;
    }
    buildFAB();
    bindScroll();
    // 监听系统主题变化
    matchMedia('(prefers-color-scheme:dark)').addEventListener('change', function(e) {
      if (!localStorage.getItem('ayoo_theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /* ===== 启动 ===== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露公共接口（供 onclick 和调试使用）
  window.AyooToolbar = {
    settings: settings,
    _setTheme: setTheme,
    _toggleTheme: toggleTheme,
    _setFont: setFont,
    _setBg: setBg,
    _setLang: setLang,
    _togglePopup: togglePopup,
    _closePopup: closePopup,
    _scrollToTop: scrollToTop
  };
})();
