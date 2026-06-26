import { navbar, mobileMenu, cmdOverlay } from '../lib/navbar.js';
// 博客列表 Edge SSR — Card Grid Layout with Tag Filtering
export async function onRequestGet(context) {
  const { env } = context;
  try {
  const url = new URL(context.request.url);
  const tagFilter = (url.searchParams.get('tag') || '').trim();

  // Build query with optional tag filter
  var sql = `SELECT a.id, a.title, a.slug, a.summary, a.cover_image, SUBSTR(a.content_md, 1, 2000) as content_md, a.author, a.tags, a.created_at, a.views,
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
<link rel="stylesheet" href="/style.css?v=4">
</head>
<body>
${navbar('Blog', '/blog', '/blog')}
${mobileMenu()}
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
${cmdOverlay()}
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=3600' } });
  } catch (e) {
    return new Response('服务器错误，请稍后再试', { status: 500 });
  }
}


// 从 Markdown 内容中提取第一张图片 URL（支持绝对路径和相对路径）
function extractFirstImage(content_md) {
  if (!content_md) return '';
  var md = content_md.replace(/\\n/g, '\n');
  var m = md.match(/!\[.*?\]\(([^\s)]+)\)/);
  if (!m) return '';
  var url = m[1];
  if (/^javascript:/i.test(url)) return '';
  return url;
}

function blogCard(a, index) {
  var date = (a.created_at || '').slice(0, 10);
  var tags = '';
  var tagArr = (a.tags || '').split(',').filter(Boolean);
  for (var t = 0; t < tagArr.length; t++) {
    tags += '<span class="tag">#' + esc(tagArr[t].trim()) + '</span>';
  }

  // 封面优先级：自定义 cover_image → 文章内第一张图 → 无图
  var imgSrc = a.cover_image || extractFirstImage(a.content_md);
  var hasImage = !!imgSrc;
  var cardClass = hasImage ? 'blog-card blog-card-has-image' : 'blog-card blog-card-no-image';

  var cover = '';
  if (hasImage) {
    cover = '<img class="blog-card-cover" src="' + esc(imgSrc) + '" alt="" loading="lazy" onerror="this.parentElement.classList.remove(\'blog-card-has-image\');this.parentElement.classList.add(\'blog-card-no-image\');this.remove()">';
  }

  return `<a href="/blog/${esc(a.slug)}" class="${cardClass}" style="animation-delay:${index * 60}ms">
    ${cover}
    <div class="blog-card-body">
      <h3 class="blog-card-title">${esc(a.title)}</h3>
      ${a.summary ? '<p class="blog-card-summary">' + esc(a.summary) + '</p>' : ''}
      <div class="blog-card-meta">
        <span>${esc(date)}</span>
        <span>${a.views || 0} 阅读</span>
        <span>${a.likes} 喜欢</span>
        <span>${a.comments} 评论</span>
      </div>
      ${tags ? '<div class="blog-card-tags">' + tags + '</div>' : ''}
    </div>
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
