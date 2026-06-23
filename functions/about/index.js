// 关于我 页面 Edge SSR
export async function onRequestGet(context) {
  try {
    const { env } = context;
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM settings WHERE key IN ('about_title','about_content','about_avatar','title','subtitle')"
    ).all();
    var settings = {};
    for (var i = 0; i < (results || []).length; i++) {
      settings[results[i].key] = results[i].value;
    }

    var html = render(settings);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { return new Response('Error: ' + e.message, { status: 500 }); }
}

function render(s) {
  var title = esc(s.about_title || '关于我');
  var content = s.about_content || '';
  var avatar = esc(s.about_avatar || '');
  var siteTitle = esc(s.title || 'Ayoo');

  // Simple markdown to HTML (client-side marked.js will enhance)
  var contentHtml = content
    .replace(/\\n/g, '\n')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  contentHtml = '<p>' + contentHtml + '</p>';

  var avatarHtml = avatar
    ? '<div class="about-avatar"><img src="' + avatar + '" alt="avatar"></div>'
    : '';

  var seo = '<meta name="description" content="关于 ' + siteTitle + ' — 个人简介">'
    + '\n<meta property="og:type" content="profile">'
    + '\n<meta property="og:title" content="' + title + '">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev/about">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev/about">';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>${seo}
<link rel="stylesheet" href="/style.css?v=3">
</head>
<body>
${aboutNavbar()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">${title}</h1>
  </div>
  <div class="content">
    <div class="about-container animate-in" style="animation-delay:100ms">
      ${avatarHtml}
      <div class="article-body about-body" id="about-content">
        ${contentHtml}
      </div>
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js"></script>
<script>
(function(){
  var raw = ${JSON.stringify(content)};
  if(raw && window.marked){
    var el = document.getElementById('about-content');
    if(el) el.innerHTML = marked.parse(raw.replace(/\\\\n/g, '\\n'));
  }
  if(!window.marked){
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    s.onload = function(){
      var raw2 = ${JSON.stringify(content)};
      if(raw2){
        var el2 = document.getElementById('about-content');
        if(el2) el2.innerHTML = marked.parse(raw2.replace(/\\\\n/g, '\\n'));
      }
    };
    document.head.appendChild(s);
  }
})();
</script>
<div class="cmd-overlay" id="cmd-overlay"><div class="cmd-box"><div class="cmd-input-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input class="cmd-input" id="cmd-input" placeholder="搜索页面、笔记、链接..." autocomplete="off"></div><div class="cmd-list" id="cmd-list"></div><div class="cmd-hint"><span><kbd>↑↓</kbd> 导航</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div></div></div>
</body>
</html>`;
}

function aboutNavbar() {
  return `<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">关于</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/blog" class="nav-link"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔记</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a><a href="/about" class="mobile-menu-link">关于</a></div></div>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
