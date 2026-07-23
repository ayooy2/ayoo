/**
 * toolbar.js — 悬浮设置工具栏
 * 功能：主题切换（亮/暗）、字体选择（5种）、语言切换（中/英）
 * 依赖：toolbar.css
 * 存储：localStorage（ayoo_theme、ayoo_font、ayoo_lang）
 */
(function(){
  /* ── 配置 ── */
  var FONTS = [
    { id: 'inter',  label: 'Inter',      preview: 'Aa' },
    { id: 'noto',   label: 'Noto Sans',  preview: '你好' },
    { id: 'system', label: 'System',     preview: 'Sys' },
    { id: 'serif',  label: 'Serif',      preview: 'Ser' },
    { id: 'mono',   label: 'Mono',       preview: '</>' }
  ];

  /* ── 读取持久化设置 ── */
  var settings = {
    theme: localStorage.getItem('ayoo_theme') || localStorage.getItem('theme') || 'light',
    font:  localStorage.getItem('ayoo_font') || 'inter',
    lang:  localStorage.getItem('ayoo_lang') || 'zh'
  };

  /* ── 应用设置 ── */
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    // 同步旧的 theme-toggle 按钮
    var oldBtn = document.getElementById('theme-toggle');
    if (oldBtn) oldBtn.textContent = theme === 'dark' ? '☀' : '☽';
    // 同步 highlight.js 主题
    var hljsLink = document.getElementById('hljs-theme');
    if (hljsLink) {
      hljsLink.href = theme === 'dark'
        ? 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css'
        : 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css';
    }
    localStorage.setItem('ayoo_theme', theme);
    localStorage.setItem('theme', theme); // 兼容旧代码
    settings.theme = theme;
    updatePanel();
  }

  function applyFont(font) {
    document.documentElement.setAttribute('data-font', font);
    localStorage.setItem('ayoo_font', font);
    settings.font = font;
    updatePanel();
  }

  function applyLang(lang) {
    document.documentElement.setAttribute('data-lang', lang);
    localStorage.setItem('ayoo_lang', lang);
    settings.lang = lang;
    // 切换所有带 data-zh/data-en 的元素
    document.querySelectorAll('[data-zh][data-en]').forEach(function(el) {
      el.textContent = lang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-zh');
    });
    // 切换 placeholder
    document.querySelectorAll('[data-zh-placeholder][data-en-placeholder]').forEach(function(el) {
      el.placeholder = lang === 'en' ? el.getAttribute('data-en-placeholder') : el.getAttribute('data-zh-placeholder');
    });
    updatePanel();
  }

  /* ── 初始化应用 ── */
  applyTheme(settings.theme);
  if (settings.font !== 'inter') applyFont(settings.font);
  if (settings.lang !== 'zh') applyLang(settings.lang);

  /* ── 创建 DOM ── */
  var overlay = document.createElement('div');
  overlay.className = 'toolbar-overlay';

  var fab = document.createElement('button');
  fab.className = 'toolbar-fab';
  fab.setAttribute('aria-label', 'Settings');
  fab.title = '设置';
  fab.textContent = '⚙';

  var panel = document.createElement('div');
  panel.className = 'toolbar-panel';
  panel.innerHTML =
    '<div class="toolbar-panel-title">⚙ 设置</div>' +
    /* 主题 */
    '<div class="toolbar-group">' +
      '<div class="toolbar-group-label">主题</div>' +
      '<div class="toolbar-row" id="tb-theme-row">' +
        '<button class="toolbar-btn" data-theme="light">☀ 亮色</button>' +
        '<button class="toolbar-btn" data-theme="dark">🌙 暗色</button>' +
      '</div>' +
    '</div>' +
    '<div class="toolbar-divider"></div>' +
    /* 字体 */
    '<div class="toolbar-group">' +
      '<div class="toolbar-group-label">字体</div>' +
      '<div class="toolbar-row" id="tb-font-row"></div>' +
    '</div>' +
    '<div class="toolbar-divider"></div>' +
    /* 语言 */
    '<div class="toolbar-group">' +
      '<div class="toolbar-group-label">语言 / Language</div>' +
      '<div class="toolbar-row" id="tb-lang-row">' +
        '<button class="toolbar-btn" data-lang="zh">中文</button>' +
        '<button class="toolbar-btn" data-lang="en">English</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  document.body.appendChild(fab);

  /* ── 填充字体按钮 ── */
  var fontRow = document.getElementById('tb-font-row');
  FONTS.forEach(function(f) {
    var btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.setAttribute('data-font', f.id);
    btn.textContent = f.preview;
    btn.title = f.label;
    fontRow.appendChild(btn);
  });

  /* ── 更新面板状态 ── */
  function updatePanel() {
    // 主题
    panel.querySelectorAll('[data-theme]').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-theme') === settings.theme);
    });
    // 字体
    panel.querySelectorAll('[data-font]').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-font') === settings.font);
    });
    // 语言
    panel.querySelectorAll('[data-lang]').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === settings.lang);
    });
  }
  updatePanel();

  /* ── 事件绑定 ── */
  var isOpen = false;
  function toggle() {
    isOpen = !isOpen;
    panel.classList.toggle('active', isOpen);
    overlay.classList.toggle('active', isOpen);
    fab.textContent = isOpen ? '✕' : '⚙';
  }
  function close() {
    isOpen = false;
    panel.classList.remove('active');
    overlay.classList.remove('active');
    fab.textContent = '⚙';
  }

  fab.addEventListener('click', toggle);
  overlay.addEventListener('click', close);

  // 点击面板外关闭
  document.addEventListener('click', function(e) {
    if (isOpen && !panel.contains(e.target) && e.target !== fab) close();
  });

  // ESC 关闭
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) close();
  });

  // 主题按钮
  panel.addEventListener('click', function(e) {
    var btn = e.target.closest('.toolbar-btn');
    if (!btn) return;
    if (btn.hasAttribute('data-theme')) {
      applyTheme(btn.getAttribute('data-theme'));
    } else if (btn.hasAttribute('data-font')) {
      applyFont(btn.getAttribute('data-font'));
    } else if (btn.hasAttribute('data-lang')) {
      applyLang(btn.getAttribute('data-lang'));
    }
  });
})();
