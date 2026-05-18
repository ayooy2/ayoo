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

  const html = renderList(articles);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

function renderList(articles) {
  var items = '';
  for (var i = 0; i < articles.length; i++) {
    var a = articles[i];
    var time = (a.created_at || '').slice(0, 10);
    var tags = (a.tags || '').split(',').filter(Boolean).map(function(t) {
      return '<span style="display:inline-block;background:var(--color-primary-light);color:var(--color-primary);padding:0.15rem 0.5rem;border-radius:10px;font-size:0.75rem;margin-right:0.3rem;">' + t.trim() + '</span>';
    }).join('');
    items += '<article style="background:var(--color-glass-bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:var(--radius-xl);padding:1.5rem;border:1px solid var(--color-glass-border);margin-bottom:1rem;transition:all 0.3s ease;cursor:pointer;" onclick="location.href=\'/blog/' + a.slug + '\'" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'var(--shadow-lg)\'" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\'">'
      + (a.cover_image ? '<img src="' + esc(a.cover_image) + '" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-bottom:0.8rem;" alt="">' : '')
      + '<h2 style="font-size:1.2rem;margin-bottom:0.3rem;color:var(--color-text);">' + esc(a.title) + '</h2>'
      + '<p style="color:var(--color-text-muted);font-size:0.9rem;margin-bottom:0.6rem;">' + esc(a.summary || '') + '</p>'
      + '<div style="display:flex;align-items:center;gap:0.8rem;font-size:0.8rem;color:var(--color-text-placeholder);flex-wrap:wrap;">'
      + '<span>' + esc(a.author) + '</span><span>' + time + '</span>'
      + '<span>❤ ' + a.likes + '</span><span>💬 ' + a.comments + '</span>'
      + tags + '</div></article>';
  }
  if (!items) items = '<p style="text-align:center;color:var(--color-text-placeholder);padding:3rem;">还没有文章</p>';

  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>博客</title><link rel="stylesheet" href="/style.css"><style>.blog-wrapper{max-width:800px;margin:0 auto;padding:5rem 1.5rem 2rem;}</style></head><body>'
    + '<nav class="navbar"><div class="nav-inner"><a href="/" style="text-decoration:none;"><span class="nav-brand">博客</span></a><div class="nav-spacer"></div><a href="/" style="color:var(--color-text-muted);text-decoration:none;font-size:0.9rem;">← 返回首页</a></div></nav>'
    + '<div class="blog-wrapper">' + items + '</div></body></html>';
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
