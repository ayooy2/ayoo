// 功能 页面 Edge SSR — Site Features
export async function onRequestGet(context) {
  try {
    const { env } = context;
    // Get article count, tag count, total views for stats
    const [statsRes, tagsRes] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count, COALESCE(SUM(views), 0) as total_views FROM articles WHERE is_published=1').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM tags').first()
    ]);

    var html = render(statsRes || { count: 0, total_views: 0 }, tagsRes || { count: 0 });
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { return new Response('Error: ' + e.message, { status: 500 }); }
}

function render(stats, tags) {
  var features = [
    { icon: '📝', title: 'Markdown 博客', desc: '支持 Markdown 写作，代码高亮，目录导航，阅读时间估算' },
    { icon: '💬', title: '评论系统', desc: '支持嵌套回复，Gravatar 头像，管理员删除，防垃圾蜜罐' },
    { icon: '❤️', title: '点赞互动', desc: '基于浏览器指纹的点赞切换，防止重复点赞' },
    { icon: '🔍', title: '全文搜索', desc: '文章标题、摘要、内容、标签全文检索，关键词高亮' },
    { icon: '📋', title: '留言簿', desc: '访客留言板，支持昵称和网址，QQ 复古头像' },
    { icon: '📰', title: 'RSS 订阅', desc: 'RSS 2.0 订阅源，支持阅读器订阅最新文章' },
    { icon: '🗺️', title: '站点地图', desc: '自动生成 XML Sitemap，覆盖所有公开页面' },
    { icon: '⌨️', title: '命令面板', desc: 'Ctrl+K 快速导航，模糊搜索页面和文章' },
    { icon: '🌙', title: '暗色模式', desc: '一键切换明暗主题，偏好自动保存' },
    { icon: '📱', title: '移动适配', desc: '完全响应式设计，移动端友好' },
    { icon: '🖼️', title: '图片管理', desc: '后台图片上传，支持裁剪压缩，base64 存储' },
    { icon: '⏰', title: '定时发布', desc: '文章支持定时发布，到时间自动上线' },
    { icon: '🏷️', title: '标签分类', desc: '文章标签管理，按标签筛选文章' },
    { icon: '📊', title: '访问统计', desc: '每篇文章独立阅读计数，总览统计' },
    { icon: '🚀', title: 'CDN 加速', desc: 'Cloudflare Pages 全球 CDN，毫秒级响应' },
    { icon: '🔒', title: '安全防护', desc: 'XSS 转义，安全响应头，蜜罐防垃圾' }
  ];

  var cardsHtml = '';
  for (var i = 0; i < features.length; i++) {
    var f = features[i];
    cardsHtml += '<div class="feature-card animate-in" style="animation-delay:' + (i * 60) + 'ms">'
      + '<div class="feature-icon">' + f.icon + '</div>'
      + '<h3 class="feature-title">' + esc(f.title) + '</h3>'
      + '<p class="feature-desc">' + esc(f.desc) + '</p>'
      + '</div>';
  }

  var statsHtml = '<div class="feature-stats animate-in" style="animation-delay:0ms">'
    + '<div class="feature-stat"><span class="feature-stat-num">' + stats.count + '</span><span class="feature-stat-label">篇文章</span></div>'
    + '<div class="feature-stat"><span class="feature-stat-num">' + stats.total_views + '</span><span class="feature-stat-label">次阅读</span></div>'
    + '<div class="feature-stat"><span class="feature-stat-num">' + tags.count + '</span><span class="feature-stat-label">个标签</span></div>'
    + '</div>';

  var seo = '<meta name="description" content="网站功能一览 — 博客、评论、搜索、RSS、暗色模式等">'
    + '\n<meta property="og:type" content="website">'
    + '\n<meta property="og:title" content="功能">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev/features">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev/features">';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>功能</title>${seo}
<link rel="stylesheet" href="/style.css?v=3">
</head>
<body>
${featuresNavbar()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">功能</h1>
    <p class="page-subtitle">这个网站能做什么</p>
  </div>
  <div class="content">
    ${statsHtml}
    <div class="feature-grid stagger">
      ${cardsHtml}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js"></script>
<div class="cmd-overlay" id="cmd-overlay"><div class="cmd-box"><div class="cmd-input-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input class="cmd-input" id="cmd-input" placeholder="搜索页面、笔记、链接..." autocomplete="off"></div><div class="cmd-list" id="cmd-list"></div><div class="cmd-hint"><span><kbd>↑↓</kbd> 导航</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div></div></div>
</body>
</html>`;
}

function featuresNavbar() {
  return `<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">功能</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/blog" class="nav-link"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔记</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a><a href="/features" class="mobile-menu-link">功能</a></div></div>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
