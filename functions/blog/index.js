export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    "SELECT id, title, slug, summary, cover_image, author, tags, created_at, views FROM articles WHERE is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY created_at DESC LIMIT 50"
  ).all();
  const articles = results || [];
  for (const a of articles) {
    const l = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id=?').bind(a.id).first();
    const cm = await env.DB.prepare('SELECT COUNT(*) as c FROM comments WHERE article_id=?').bind(a.id).first();
    a.likes = l.c; a.comments = cm.c;
  }

  var items = '';
  for (var i = 0; i < articles.length; i++) {
    var a = articles[i], time = (a.created_at || '').slice(0, 10);
    var tags = '';
    var tagArr = (a.tags || '').split(',').filter(Boolean);
    for (var t = 0; t < tagArr.length; t++) {
      tags += '<span class="blog-tag">#' + esc(tagArr[t].trim()) + '</span>';
    }
    items += '<a class="blog-item" href="/blog/' + a.slug + '"><div class="blog-item-title">' + esc(a.title) + '</div>'
      + (a.summary ? '<div class="blog-item-summary">' + esc(a.summary) + '</div>' : '')
      + '<div class="blog-item-meta"><span>' + esc(a.author) + '</span><span>' + time + '</span>'
      + '<span>' + (a.views || 0) + ' 阅读</span><span>' + a.likes + ' 喜欢</span><span>' + a.comments + ' 评论</span>' + tags + '</div></a>';
  }
  if (!items) items = '<p class="empty">还没有文章</p>';

  var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>笔记</title>'
    + '<meta name="description" content="所有已发布的文章笔记">'
    + '<meta property="og:type" content="website">'
    + '<meta property="og:title" content="笔记">'
    + '<meta property="og:url" content="https://ayoow.pages.dev/blog">'
    + '<link rel="canonical" href="https://ayoow.pages.dev/blog">'
    + '<link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml">'
    + '<link rel="stylesheet" href="/style.css"></head><body>'
    + '<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">笔记</a><div class="nav-spacer"></div><a href="/search" class="nav-link">搜索</a><a href="/archive" class="nav-link">归档</a><a href="/" class="nav-link">首页</a></div></nav>'
    + '<div class="article-wrapper"><h2 style="font-weight:400;margin-bottom:1.5rem;font-size:1.3rem;letter-spacing:0.04em;color:var(--color-text);">笔记</h2>'
    + '<div class="blog-list">' + items + '</div></div></body></html>';
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
