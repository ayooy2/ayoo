import { navbar, mobileMenu, cmdOverlay } from '../lib/navbar.js';
// 博客列表 Edge SSR — Card Grid Layout with Tag Filtering
export async function onRequestGet(context) {
  const { env } = context;
  try {
  const url = new URL(context.request.url);
  const tagFilter = (url.searchParams.get('tag') || '').trim();

  // Build query with optional tag filter
  var sql = `SELECT a.id, a.title, a.slug, a.summary, a.cover_image, a.author, a.tags, a.created_at, a.views,
      (SELECT COUNT(*) FROM likes WHERE article_id=a.id) as likes,
      (SELECT COUNT(*) FROM comments WHERE article_id=a.id) as comments
    FROM articles a WHERE a.is_published=1 AND (a.scheduled_at IS NULL OR a.scheduled_at <= datetime('now'))`;
  var params = [];
  if (tagFilter) {
    sql += " AND (',' || a.tags || ',') LIKE ?";
    params.push('%,' + tagFilter + ',%');
  }
  sql += ' ORDER BY a.created_at DESC LIMIT 50';

  var stmt = env.DB.prepare(sql);
  if (params.length) stmt = stmt.bind(...params);
  const { results } = await stmt.all();
  const articles = results || [];

  // Fetch all tags for filter bar
  const { results: allTags } = await env.DB.prepare('SELECT * FROM tags ORDER BY name ASC').all();
  const tags = allTags || [];

  // Blog cards
  var cards = '';
  for (var i = 0; i < articles.length; i++) {
    cards += blogCard(articles[i], i);
  }
  if (!cards) cards = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p class="empty-state-text">还没有文章</p></div>';

  var seo = '<meta name="description" content="所有已发布的文章笔记">'
    + '\n<meta property="og:type" content="website">'
    + '\n<meta property="og:title" content="Blog">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev/blog">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev/blog">'
    + '\n<link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml">';

  return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Blog</title>${seo}
<link rel="stylesheet" href="/style.css?v=3">
</head>
<body>
${blogNavbar()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">Blog</h1>
    <p class="page-subtitle">${tagFilter ? '标签: ' + esc(tagFilter) + ' · ' : ''}${articles.length} 篇文章</p>
  </div>
  <div class="content">
    ${tagFilterBar(tags, tagFilter)}
    <div class="blog-grid stagger">
      ${cards}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js"></script>
<div class="cmd-overlay" id="cmd-overlay"><div class="cmd-box"><div class="cmd-input-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input class="cmd-input" id="cmd-input" placeholder="搜索页面、笔记、链接..." autocomplete="off"></div><div class="cmd-list" id="cmd-list"></div><div class="cmd-hint"><span><kbd>↑↓</kbd> 导航</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div></div></div>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    return new Response('服务器错误，请稍后再试', { status: 500 });
  }
}

function blogNavbar() {
  return `<nav class="navbar"><div class="nav-inner"><a href="/blog" class="nav-brand">Blog</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a><a href="/now" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Now</a><a href="/guestbook" class="nav-link"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>留言簿</a><a href="/about" class="nav-link">关于</a><a href="/features" class="nav-link">功能</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a><a href="/now" class="mobile-menu-link">Now</a><a href="/guestbook" class="mobile-menu-link">留言簿</a><a href="/about" class="mobile-menu-link">关于</a><a href="/features" class="mobile-menu-link">功能</a></div></div>`;
}

function blogCard(a, index) {
  var date = (a.created_at || '').slice(0, 10);
  var tags = '';
  var tagArr = (a.tags || '').split(',').filter(Boolean);
  for (var t = 0; t < tagArr.length; t++) {
    tags += '<span class="tag">#' + esc(tagArr[t].trim()) + '</span>';
  }

  var cover = '';
  if (a.cover_image) {
    cover = '<img class="blog-card-cover" src="' + esc(a.cover_image) + '" alt="" loading="lazy">';
  } else {
    cover = '<div class="blog-card-cover-placeholder"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
  }

  return `<a href="/blog/${esc(a.slug)}" class="blog-card" style="animation-delay:${index * 60}ms">
    ${cover}
    <h3 class="blog-card-title">${esc(a.title)}</h3>
    ${a.summary ? '<p class="blog-card-summary">' + esc(a.summary) + '</p>' : ''}
    <div class="blog-card-meta">
      <span>${esc(date)}</span>
      <span>${a.views || 0} 阅读</span>
      <span>${a.likes} 喜欢</span>
      <span>${a.comments} 评论</span>
    </div>
    ${tags ? '<div class="blog-card-tags">' + tags + '</div>' : ''}
  </a>`;
}

function tagFilterBar(allTags, active) {
  if (!allTags.length) return '';
  var html = '<div class="tag-filter-bar">';
  html += '<a class="tag-filter-item' + (!active ? ' active' : '') + '" href="/blog">全部</a>';
  for (var i = 0; i < allTags.length; i++) {
    var t = allTags[i];
    var isActive = active === t.name;
    html += '<a class="tag-filter-item' + (isActive ? ' active' : '') + '" href="/blog?tag=' + encodeURIComponent(t.name) + '">' + esc(t.name) + '</a>';
  }
  html += '</div>';
  return html;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
