// GET /archive — 归档页，按年月分组
export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    "SELECT id, title, slug, created_at, views FROM articles WHERE is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY created_at DESC"
  ).all();

  // 按年月分组
  var groups = {};
  for (var i = 0; i < (results || []).length; i++) {
    var a = results[i];
    var ym = (a.created_at || '').slice(0, 7); // "2026-05"
    if (!ym) ym = '未知';
    if (!groups[ym]) groups[ym] = [];
    groups[ym].push(a);
  }

  var html = '';
  var ymKeys = Object.keys(groups).sort().reverse();
  for (var g = 0; g < ymKeys.length; g++) {
    var ym = ymKeys[g];
    var parts = ym.split('-');
    var label = parts[0] + '年' + (parts[1] ? parseInt(parts[1]) + '月' : '');
    html += '<div class="archive-group"><h3 class="archive-month">' + esc(label) + ' <span class="count">' + groups[ym].length + '</span></h3><ul class="archive-list">';
    for (var j = 0; j < groups[ym].length; j++) {
      var a = groups[ym][j];
      var day = (a.created_at || '').slice(8, 10);
      html += '<li><span class="archive-day">' + esc(day) + '</span><a href="/blog/' + a.slug + '">' + esc(a.title) + '</a><span class="archive-views">' + (a.views || 0) + ' 阅读</span></li>';
    }
    html += '</ul></div>';
  }
  if (!html) html = '<p class="empty">暂无文章</p>';

  var page = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>归档</title>'
    + '<meta name="description" content="所有文章归档">'
    + '<link rel="stylesheet" href="/style.css"></head><body>'
    + '<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">归档</a><div class="nav-spacer"></div><a href="/blog" class="nav-link">笔记</a><a href="/" class="nav-link">首页</a></div></nav>'
    + '<div class="article-wrapper"><h2 style="font-weight:400;margin-bottom:1.5rem;font-size:1.3rem;color:var(--color-text);">归档 · ' + (results || []).length + ' 篇文章</h2>'
    + html + '</div></body></html>';

  return new Response(page, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
  });
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
