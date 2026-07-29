/**
 * Code 文章列表 SSR
 * 功能：渲染 Code 文章列表（极简列表布局，无封面图、无标签筛选）
 * 依赖：navbar.js、sanitize.js
 * 核心入口：onRequestGet()
 */
import { navbar, mobileMenu, cmdOverlay } from '../lib/navbar.js';
import { esc } from '../lib/sanitize.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    var sql = `SELECT a.id, a.title, a.slug, a.author, a.tags, a.created_at, a.views
      FROM articles a WHERE a.is_published=1 AND a.article_type='code'
      AND (a.scheduled_at IS NULL OR a.scheduled_at <= datetime('now'))
      ORDER BY a.created_at DESC LIMIT 50`;

    const { results } = await env.DB.prepare(sql).all();
    const articles = results || [];

    // Build simple list
    var listItems = '';
    for (var i = 0; i < articles.length; i++) {
      listItems += codeListItem(articles[i], i);
    }
    if (!listItems) listItems = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p class="empty-state-text" data-zh="还没有 Code 文章" data-en="No code articles yet">还没有 Code 文章</p></div>';

    var seo = '<meta name="description" content="LeetCode 题解和技术代码文章">'
      + '\n<meta property="og:type" content="website">'
      + '\n<meta property="og:title" content="Code">'
      + '\n<meta property="og:url" content="https://ayoow.pages.dev/code">'
      + '\n<link rel="canonical" href="https://ayoow.pages.dev/code">';

    return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Code</title>${seo}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/style.css?v=6">
<link rel="stylesheet" href="/toolbar.css?v=9">
<link rel="stylesheet" href="/code.css?v=1">
</head>
<body>
${navbar('Code', '/code', '/code')}
${mobileMenu()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">Code</h1>
    <p class="page-subtitle">${articles.length} <span data-zh="篇文章" data-en="articles">篇文章</span></p>
  </div>
  <div class="content">
    <div class="code-list stagger">
      ${listItems}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/" data-zh="← 返回首页" data-en="← Back to Home">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js" defer></script>
<script src="/toolbar.js?v=11" defer></script>
${cmdOverlay()}
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' } });
  } catch (e) {
    console.error('Code list error:', e);
    return new Response('服务器错误，请稍后再试', { status: 500 });
  }
}

function codeListItem(a, index) {
  var date = (a.created_at || '').slice(0, 10);
  var tags = '';
  var tagArr = (a.tags || '').split(',').filter(Boolean);
  if (tagArr.length) {
    tags = '<span class="code-list-tags">';
    for (var t = 0; t < tagArr.length; t++) {
      tags += '<span class="code-list-tag">' + esc(tagArr[t].trim()) + '</span>';
    }
    tags += '</span>';
  }

  return `<a href="/code/${esc(a.slug)}" class="code-list-item" style="animation-delay:${index * 40}ms">
    <div class="code-list-item-body">
      <h3 class="code-list-item-title">${esc(a.title)}</h3>
      <div class="code-list-item-meta">
        <span class="code-list-item-date">${esc(date)}</span>
        ${tags}
      </div>
    </div>
    <svg class="code-list-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
  </a>`;
}
