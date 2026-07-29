/**
 * 分类导航页 SSR
 * 功能：标签切换显示笔记和 Code 文章
 * 路由：/categories
 * 核心入口：onRequestGet()
 * 依赖：navbar.js、sanitize.js
 */
import { navbar, mobileMenu, cmdOverlay } from './lib/navbar.js';
import { esc } from './lib/sanitize.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const url = new URL(context.request.url);
    const activeTab = url.searchParams.get('tab') || 'blog';

    // 笔记：article_type='blog' 或 IS NULL（兼容旧数据）
    const blogSql = `SELECT id, title, slug, summary, is_encrypted, created_at, views
      FROM articles
      WHERE is_published = 1
      AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
      AND (article_type = 'blog' OR article_type IS NULL)
      ORDER BY created_at DESC LIMIT 20`;

    // Code：article_type='code'
    const codeSql = `SELECT id, title, slug, summary, is_encrypted, created_at, views
      FROM articles
      WHERE is_published = 1
      AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
      AND article_type = 'code'
      ORDER BY created_at DESC LIMIT 20`;

    const [blogResult, codeResult] = await Promise.all([
      env.DB.prepare(blogSql).all(),
      env.DB.prepare(codeSql).all()
    ]);

    const blogArticles = blogResult.results || [];
    const codeArticles = codeResult.results || [];

    var html = render(blogArticles, codeArticles, activeTab);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=600, s-maxage=3600'
      }
    });
  } catch (e) {
    console.error('Categories error:', e);
    return new Response('服务器错误，请稍后再试', { status: 500 });
  }
}

function render(blogArticles, codeArticles, activeTab) {
  var isCodeActive = activeTab === 'code';

  // 渲染笔记列表
  var blogList = '';
  for (var i = 0; i < blogArticles.length; i++) {
    blogList += articleItem(blogArticles[i], i);
  }
  if (!blogList) blogList = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p class="empty-state-text" data-zh="暂无笔记" data-en="No notes yet">暂无笔记</p></div>';

  // 渲染 Code 列表
  var codeList = '';
  for (var i = 0; i < codeArticles.length; i++) {
    codeList += articleItem(codeArticles[i], i);
  }
  if (!codeList) codeList = '<div class="empty-state"><svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><p class="empty-state-text" data-zh="暂无代码文章" data-en="No code articles yet">暂无代码文章</p></div>';

  var totalCount = blogArticles.length + codeArticles.length;

  var seo = '<meta name="description" content="分类浏览所有笔记和代码文章">'
    + '\n<meta property="og:type" content="website">'
    + '\n<meta property="og:title" content="分类 - Ayoo">'
    + '\n<meta property="og:description" content="浏览所有笔记和代码文章">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev/categories">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev/categories">';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>分类 - Ayoo</title>${seo}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/style.css?v=6">
<link rel="stylesheet" href="/toolbar.css?v=9">
<style>
/* ── Categories Page ── */
.categories-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-lg);
}
.categories-tab {
  padding: 0.6rem 1.25rem;
  border: none;
  background: none;
  font-size: var(--text-sm);
  cursor: pointer;
  color: var(--text-tertiary);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all var(--duration-fast) var(--ease);
  font-family: var(--font-sans);
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.categories-tab:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}
.categories-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}
.categories-list {
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.categories-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--border-subtle);
  text-decoration: none;
  color: inherit;
  transition: all var(--duration-fast) var(--ease);
  gap: var(--space-md);
}
.categories-item:last-child {
  border-bottom: none;
}
.categories-item:hover {
  padding-left: 0.5rem;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
}
.categories-item-main {
  flex: 1;
  min-width: 0;
}
.categories-item-title {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 0.2rem 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.categories-item:hover .categories-item-title {
  color: var(--accent);
}
.categories-item-summary {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.categories-item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  flex-shrink: 0;
}
.categories-item-date {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
}
.categories-item-views {
  font-size: var(--text-xs);
  color: var(--text-placeholder);
  white-space: nowrap;
}
@media (max-width: 640px) {
  .categories-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  .categories-item-meta {
    flex-direction: row;
    gap: 0.5rem;
  }
}
</style>
</head>
<body>
${navbar('Ayoo', '/', '/categories')}
${mobileMenu()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title" data-zh="分类" data-en="Categories">分类</h1>
    <p class="page-subtitle">${blogArticles.length} <span data-zh="篇笔记" data-en="notes">篇笔记</span> · ${codeArticles.length} <span data-zh="篇代码" data-en="code articles">篇代码</span></p>
  </div>
  <div class="content">
    <div class="categories-tabs">
      <button class="categories-tab${isCodeActive ? '' : ' active'}" id="tab-blog" data-tab="blog">📝 <span data-zh="笔记" data-en="Notes">笔记</span></button>
      <button class="categories-tab${isCodeActive ? ' active' : ''}" id="tab-code" data-tab="code">💻 <span data-zh="Code" data-en="Code">Code</span></button>
    </div>
    <div class="categories-list" id="list-blog" style="display:${isCodeActive ? 'none' : 'block'}">
      ${blogList}
    </div>
    <div class="categories-list" id="list-code" style="display:${isCodeActive ? 'block' : 'none'}">
      ${codeList}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/" data-zh="← 返回首页" data-en="← Back to Home">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js" defer></script>
<script>
(function(){
  var tabBlog = document.getElementById('tab-blog');
  var tabCode = document.getElementById('tab-code');
  var listBlog = document.getElementById('list-blog');
  var listCode = document.getElementById('list-code');
  if (!tabBlog || !tabCode || !listBlog || !listCode) return;

  function switchTab(tab) {
    var isBlog = tab === 'blog';
    tabBlog.classList.toggle('active', isBlog);
    tabCode.classList.toggle('active', !isBlog);
    listBlog.style.display = isBlog ? 'block' : 'none';
    listCode.style.display = isBlog ? 'none' : 'block';
    // 重新触发入场动画
    var activeList = isBlog ? listBlog : listCode;
    activeList.style.animation = 'none';
    activeList.offsetHeight;
    activeList.style.animation = '';
    // 更新 URL 参数
    var url = new URL(window.location);
    url.searchParams.set('tab', tab);
    history.replaceState({}, '', url);
  }

  tabBlog.addEventListener('click', function() { switchTab('blog'); });
  tabCode.addEventListener('click', function() { switchTab('code'); });
})();
</script>
<script src="/toolbar.js?v=11" defer></script>
${cmdOverlay()}
</body>
</html>`;
}

function articleItem(a, index) {
  var date = (a.created_at || '').slice(0, 10);
  return '<a href="/blog/' + esc(a.slug) + '" class="categories-item" style="animation-delay:' + (index * 40) + 'ms">' +
    '<div class="categories-item-main">' +
      '<h3 class="categories-item-title">' + (a.is_encrypted ? '<span title="已加密" style="font-size:0.85rem;">&#x1f512;</span> ' : '') + esc(a.title) + '</h3>' +
      (a.summary ? '<p class="categories-item-summary">' + esc(a.summary) + '</p>' : '') +
    '</div>' +
    '<div class="categories-item-meta">' +
      '<span class="categories-item-date">' + esc(date) + '</span>' +
      '<span class="categories-item-views">' + (a.views || 0) + ' <span data-zh="阅读" data-en="views">阅读</span></span>' +
    '</div>' +
  '</a>';
}
