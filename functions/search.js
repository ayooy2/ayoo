// GET /search?q=xxx — 搜索结果页 SSR
export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  var results = [];

  if (q && q.length <= 100) {
    const like = '%' + q + '%';
    const { results: rows } = await env.DB.prepare(
      "SELECT id, title, slug, summary, author, tags, created_at, views "
      + "FROM articles WHERE is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) "
      + "AND (title LIKE ? OR summary LIKE ? OR content_md LIKE ? OR tags LIKE ?) "
      + "ORDER BY created_at DESC LIMIT 20"
    ).bind(like, like, like, like).all();
    results = rows || [];
  }

  var items = '';
  for (var i = 0; i < results.length; i++) {
    var a = results[i], time = (a.created_at || '').slice(0, 10);
    items += '<a class="blog-item" href="/blog/' + a.slug + '"><div class="blog-item-title">' + esc(a.title) + '</div>'
      + (a.summary ? '<div class="blog-item-summary">' + esc(a.summary) + '</div>' : '')
      + '<div class="blog-item-meta"><span>' + esc(a.author) + '</span><span>' + time + '</span>'
      + '<span>' + (a.views || 0) + ' 阅读</span></div></a>';
  }
  if (q && !items) items = '<p class="empty">未找到相关文章</p>';
  if (!q) items = '<p class="empty">请输入搜索关键词</p>';

  var title = q ? '搜索: ' + esc(q) : '搜索';
  var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + title + '</title>'
    + '<meta name="robots" content="noindex">'
    + '<link rel="stylesheet" href="/style.css"></head><body>'
    + '<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">搜索</a><div class="nav-spacer"></div><a href="/blog" class="nav-link">笔记</a><a href="/" class="nav-link">首页</a></div></nav>'
    + '<div class="article-wrapper">'
    + '<form action="/search" method="get" style="margin-bottom:1.5rem;display:flex;gap:0.5rem;">'
    + '<input type="text" name="q" value="' + esc(q) + '" placeholder="搜索文章..." style="flex:1;padding:0.6rem 1rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);font-size:1rem;background:var(--color-surface);color:var(--color-text);">'
    + '<button type="submit" class="btn btn-primary">搜索</button>'
    + '</form>'
    + '<div class="blog-list">' + items + '</div></div></body></html>';

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' }
  });
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
