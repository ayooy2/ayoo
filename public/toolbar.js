/**
 * toolbar.js — 前端浮动工具栏（FAB 风格）
 * 功能：主题切换、字体切换、背景滤镜切换、返回顶部
 * 无框架依赖，纯原生 JS
 */
(function() {
  'use strict';

  /* ===== 配置数据 ===== */
  // 两种字体
  var FONTS = [
    { id: 'inter', label: 'Inter' },
    { id: 'serif', label: '宋体' }
  ];

  // 两种背景滤镜（低饱和度，护眼）
  var BG_FILTERS = [
    { id: 'warm',  color: 'rgba(253, 240, 225, 0.15)', label: '暖色' },
    { id: 'cool',  color: 'rgba(225, 235, 250, 0.12)', label: '冷色' }
  ];

  /* ===== 状态 ===== */
  var settings = {
    theme: localStorage.getItem('ayoo_theme') || localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'),
    font: localStorage.getItem('ayoo_font') || 'inter',
    bgFilter: localStorage.getItem('ayoo_bgfilter') || 'warm'
  };
  var popupOpen = false;

  /* ===== 主题切换 ===== */
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

  /* ===== 字体切换 ===== */
  function setFont(fontId) {
    document.documentElement.setAttribute('data-font', fontId);
    settings.font = fontId;
    localStorage.setItem('ayoo_font', fontId);
    refreshUI();
  }

  /* ===== 背景滤镜切换 ===== */
  function setBgFilter(filterId) {
    var filter = BG_FILTERS.find(function(f) { return f.id === filterId; });
    if (!filter) return;
    settings.bgFilter = filterId;
    localStorage.setItem('ayoo_bgfilter', filterId);
    applyBgFilter();
    refreshUI();
  }

  /* 创建/更新滤镜覆盖层（真实 DOM div，不用伪元素） */
  function applyBgFilter() {
    var overlay = document.getElementById('ayoo-bg-filter');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ayoo-bg-filter';
      overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;transition:background 0.6s;';
      document.body.appendChild(overlay);
    }
    var filter = BG_FILTERS.find(function(f) { return f.id === settings.bgFilter; });
    overlay.style.background = filter ? filter.color : 'transparent';
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

  /* ===== UI 刷新 ===== */
  function refreshUI() {
    var isDark = settings.theme === 'dark';
    // 暗色模式按钮图标
    var darkBtn = document.getElementById('fab-dark');
    if (darkBtn) {
      darkBtn.textContent = isDark ? '☀️' : '🌙';
      darkBtn.title = '主题';
    }
    // 主按钮标题
    var mainBtn = document.getElementById('fab-main');
    if (mainBtn) mainBtn.title = '设置';
    // 返回顶部按钮标题
    var topBtn = document.getElementById('fab-top');
    if (topBtn) topBtn.title = '顶部';
    // 更新弹窗 active 状态
    updatePopupState();
  }

  function updatePopupState() {
    var popup = document.getElementById('fab-popup');
    if (!popup) return;
    // 更新字体按钮
    popup.querySelectorAll('[data-font]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.font === settings.font);
    });
    // 更新背景滤镜按钮
    popup.querySelectorAll('[data-bgfilter]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.bgfilter === settings.bgFilter);
    });
  }

  /* ===== 弹窗开关 ===== */
  function togglePopup() {
    popupOpen ? closePopup() : openPopup();
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

    var isDark = settings.theme === 'dark';

    var container = document.createElement('div');
    container.id = 'ayoo-toolbar';
    container.className = 'fab-container';

    // 返回顶部
    var topBtn = document.createElement('button');
    topBtn.id = 'fab-top';
    topBtn.className = 'fab-btn fab-btn-top';
    topBtn.title = '顶部';
    topBtn.textContent = '↑';
    topBtn.setAttribute('onclick', 'AyooToolbar._scrollToTop()');

    // 暗色模式切换
    var darkBtn = document.createElement('button');
    darkBtn.id = 'fab-dark';
    darkBtn.className = 'fab-btn';
    darkBtn.title = '主题';
    darkBtn.textContent = isDark ? '☀️' : '🌙';
    darkBtn.setAttribute('onclick', 'AyooToolbar._toggleTheme()');

    // 主设置按钮
    var mainBtn = document.createElement('button');
    mainBtn.id = 'fab-main';
    mainBtn.className = 'fab-btn fab-btn-main';
    mainBtn.title = '设置';
    mainBtn.textContent = '⚙';
    mainBtn.setAttribute('onclick', 'AyooToolbar._togglePopup()');

    container.appendChild(topBtn);
    container.appendChild(darkBtn);
    container.appendChild(mainBtn);
    document.body.appendChild(container);

    buildPopup();

    // 遮罩层
    var overlay = document.createElement('div');
    overlay.id = 'fab-overlay';
    overlay.className = 'fab-overlay';
    overlay.setAttribute('onclick', 'AyooToolbar._closePopup()');
    document.body.appendChild(overlay);
  }

  /* ===== 构建设置弹窗 ===== */
  function buildPopup() {
    var old = document.getElementById('fab-popup');
    if (old) old.remove();

    var popup = document.createElement('div');
    popup.id = 'fab-popup';
    popup.className = 'fab-popup';

    var html = '';

    // 字体
    html += '<div class="fab-group">'
      + '<div class="fab-group-label">字体</div>'
      + '<div class="fab-row">';
    FONTS.forEach(function(f) {
      html += '<button class="fab-opt' + (settings.font === f.id ? ' active' : '') + '" data-font="' + f.id + '" onclick="AyooToolbar._setFont(\'' + f.id + '\')">' + f.label + '</button>';
    });
    html += '</div></div>';

    // 背景滤镜
    html += '<div class="fab-group">'
      + '<div class="fab-group-label">背景</div>'
      + '<div class="fab-row">';
    BG_FILTERS.forEach(function(f) {
      html += '<button class="fab-bg-btn' + (settings.bgFilter === f.id ? ' active' : '') + '"'
        + ' data-bgfilter="' + f.id + '" style="background:' + f.color.replace(/[\d.]+\)$/, '0.45)') + '" title="' + f.label + '" onclick="AyooToolbar._setBgFilter(\'' + f.id + '\')"></button>';
    });
    html += '</div></div>';

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
    setBgFilter(settings.bgFilter);
    applyBgImage();
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

  // 暴露公共接口
  window.AyooToolbar = {
    settings: settings,
    _setTheme: setTheme,
    _toggleTheme: toggleTheme,
    _setFont: setFont,
    _setBgFilter: setBgFilter,
    _togglePopup: togglePopup,
    _closePopup: closePopup,
    _scrollToTop: scrollToTop
  };
})();
