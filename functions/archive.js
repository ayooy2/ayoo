import { navbar, mobileMenu, cmdOverlay } from './lib/navbar.js';
import { esc } from './lib/sanitize.js';
// GET /archive — 归档页，时间线布局
export async function onRequestGet(context) {
  const { env } = context;
  try {
  const { results } = await env.DB.prepare(
    "SELECT id, title, slug, created_at, views FROM articles WHERE is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY created_at DESC"
  ).all();

  // Group by year, then by month
  var years = {};
  for (var i = 0; i < (results || []).length; i++) {
    var a = results[i];
    var ym = (a.created_at || '').slice(0, 7);
    if (!ym) ym = '0000-00';
    var year = ym.slice(0, 4);
    var month = ym.slice(5, 7);
    if (!years[year]) years[year] = {};
    if (!years[year][month]) years[year][month] = [];
    years[year][month].push(a);
  }

  var timeline = '';
  var yearKeys = Object.keys(years).sort().reverse();
  for (var y = 0; y < yearKeys.length; y++) {
    var year = yearKeys[y];
    timeline += '<div class="archive-year animate-in" style="animation-delay:' + (y * 100) + 'ms">' + year + '</div>';

    var monthKeys = Object.keys(years[year]).sort().reverse();
    for (var m = 0; m < monthKeys.length; m++) {
      var month = monthKeys[m];
      var articles = years[year][month];
      var monthLabel = parseInt(month, 10) + '月';
      timeline += '<div class="archive-month">' + monthLabel + ' <span class="archive-month-count">' + articles.length + '</span></div>';
      timeline += '<ul class="archive-list">';
      for (var j = 0; j < articles.length; j++) {
        var a = articles[j];
        var day = (a.created_at || '').slice(8, 10);
        timeline += '<li class="archive-item"><span class="archive-item-day">' + esc(day) + '</span><a href="/blog/' + esc(a.slug) + '">' + esc(a.title) + '</a><span class="archive-item-views">' + (a.views || 0) + '</span></li>';
      }
      timeline += '</ul>';
    }
  }
  if (!timeline) timeline = '<div class="empty-state"><p class="empty-state-text">暂无文章</p></div>';

  return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>归档</title>
<meta name="description" content="所有文章归档">
<link rel="stylesheet" href="/style.css?v=4">
</head>
<body>
${navbar('归档', '/', '/archive')}
${mobileMenu()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">归档</h1>
    <p class="page-subtitle">${(results || []).length} 篇文章</p>
  </div>
  <div class="content">
    <div class="archive-timeline">
      ${timeline}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js"></script>
${cmdOverlay()}
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' } });
  } catch (e) {
    return new Response('服务器错误，请稍后再试', { status: 500 });
  }
}


