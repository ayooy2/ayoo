import { navbar, mobileMenu, cmdOverlay } from '../lib/navbar.js';
import { esc } from '../lib/sanitize.js';
// Now 页面 Edge SSR — What I'm Doing Now
export async function onRequestGet(context) {
  try {
    const { env } = context;
    const { results } = await env.DB.prepare(
      'SELECT * FROM now_items ORDER BY sort_order'
    ).all();
    const items = results || [];

    // Group items by category
    var groups = {};
    var categoryOrder = [];
    for (var i = 0; i < items.length; i++) {
      var cat = items[i].category || '其他';
      if (!groups[cat]) {
        groups[cat] = [];
        categoryOrder.push(cat);
      }
      groups[cat].push(items[i]);
    }

    // Find most recently updated item
    var lastUpdated = '';
    for (var i = 0; i < items.length; i++) {
      var updatedAt = items[i].updated_at || items[i].created_at || '';
      if (updatedAt > lastUpdated) lastUpdated = updatedAt;
    }
    var lastUpdatedDisplay = lastUpdated ? lastUpdated.replace('T', ' ').slice(0, 10) : '';

    var html = render(groups, categoryOrder, lastUpdatedDisplay);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { console.error('Now page error:', e); return new Response('服务器错误，请稍后再试', { status: 500 }); }
}

function render(groups, categoryOrder, lastUpdated) {
  // Build category sections
  var sections = '';
  for (var i = 0; i < categoryOrder.length; i++) {
    var cat = categoryOrder[i];
    var catItems = groups[cat];
    var listHtml = '';
    for (var j = 0; j < catItems.length; j++) {
      listHtml += '<li class="now-item">' + esc((catItems[j].content || '').replace(/\\n/g, '\n')).replace(/\n/g, '<br>') + '</li>';
    }
    sections += '<div class="now-section animate-in" style="animation-delay:' + (i * 80) + 'ms">'
      + '<h2 class="now-category">' + esc(cat) + '</h2>'
      + '<ul class="now-list">' + listHtml + '</ul>'
      + '</div>';
  }

  if (!sections) {
    sections = '<div class="empty-state"><p class="empty-state-text">暂无内容</p></div>';
  }

  var updatedLine = lastUpdated ? '<p class="now-updated">最后更新：' + esc(lastUpdated) + '</p>' : '';

  var seo = '<meta name="description" content="What I\'m doing now — 当前在做、在读、在学的事情">'
    + '\n<meta property="og:type" content="website">'
    + '\n<meta property="og:title" content="Now">'
    + '\n<meta property="og:description" content="What I\'m doing now">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev/now">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev/now">';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Now</title>${seo}
<link rel="stylesheet" href="/style.css?v=4">
</head>
<body>
${navbar('Now', '/', '/now')}
${mobileMenu()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">What I'm Doing Now</h1>
    ${updatedLine}
  </div>
  <div class="content">
    <div class="article-body now-body">
      ${sections}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js"></script>
${cmdOverlay()}
</body>
</html>`;
}



