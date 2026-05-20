export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    'SELECT id, title, slug, summary, cover_image, author, tags, created_at FROM articles WHERE is_published=1 ORDER BY created_at DESC LIMIT 50'
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
      + '<span>' + a.likes + ' 喜欢</span><span>' + a.comments + ' 评论</span>' + tags + '</div></a>';
  }
  if (!items) items = '<p class="empty">还没有文章</p>';

  var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>笔记</title><link rel="stylesheet" href="/style.css"></head><body>'
    + '<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">笔记</a><div class="nav-spacer"></div><a href="/" class="nav-link">← 首页</a></div></nav>'
    + '<div class="article-wrapper"><h2 style="font-weight:400;margin-bottom:1.5rem;font-size:1.3rem;letter-spacing:0.04em;color:var(--color-text);">笔记</h2>'
    + '<div class="blog-list">' + items + '</div></div></body></html>';
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
