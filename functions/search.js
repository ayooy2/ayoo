// GET /search?q=xxx — 搜索结果页 SSR
export async function onRequestGet(context) {
  const { env } = context;
  try {
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
    items += `<a class="search-result animate-in" href="/blog/${esc(a.slug)}" style="animation-delay:${i * 60}ms">
      <div class="search-result-title">${esc(a.title)}</div>
      ${a.summary ? '<div class="search-result-summary">' + esc(a.summary) + '</div>' : ''}
      <div class="search-result-meta">${esc(a.author)} · ${time} · ${a.views || 0} 阅读</div>
    </a>`;
  }

  var emptyHtml = '';
  if (q && !items) emptyHtml = '<div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><p class="empty-state-text">未找到相关文章</p></div>';
  if (!q) emptyHtml = '<div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><p class="empty-state-text">输入关键词搜索</p></div>';

  // Highlight keywords in results
  var highlightQ = esc(q);
  if (q) {
    items = items.replace(/(>)([^<]*?)(<)/g, function(match, pre, text, post) {
      var highlighted = text.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
      return pre + highlighted + post;
    });
  }

  var title = q ? '搜索: ' + esc(q) : '搜索';

  // Recent searches
  var recentHtml = '';
  if (!q) {
    recentHtml = `<div class="search-recent" id="search-recent" style="display:none">
      <div class="search-recent-title">最近搜索</div>
      <div class="search-recent-list" id="search-recent-list"></div>
    </div>`;
  }

  return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/style.css?v=3">
</head>
<body>
${searchNavbar()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">搜索</h1>
    ${q ? '<p class="page-subtitle">关键词: ' + esc(q) + '</p>' : ''}
  </div>
  <div class="content">
    <div class="search-container">
      <form action="/search" method="get" class="search-form animate-in">
        <div class="search-input-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input type="text" name="q" value="${esc(q)}" placeholder="搜索文章..." class="search-input" autofocus></div>
        <button type="submit" class="search-btn">搜索</button>
      </form>
      <div class="search-results">
        ${items || emptyHtml}
      </div>
      ${recentHtml}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js"></script>
<script>
(function(){
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

  /* / shortcut to focus search */
  document.addEventListener('keydown',function(e){
    if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){
      e.preventDefault();var si=document.querySelector('.search-input');if(si)si.focus();
    }
  });

  /* Recent searches */
  var q='${esc(q)}';
  if(q){saveRecent(q)}
  function saveRecent(t){
    try{var r=JSON.parse(localStorage.getItem('recent_searches')||'[]');r=r.filter(function(x){return x!==t});r.unshift(t);if(r.length>8)r=r.slice(0,8);localStorage.setItem('recent_searches',JSON.stringify(r))}catch(e){}
  }
  var recentDiv=document.getElementById('search-recent');
  var recentList=document.getElementById('search-recent-list');
  if(recentDiv&&recentList){
    try{var r=JSON.parse(localStorage.getItem('recent_searches')||'[]');if(r.length){recentDiv.style.display='block';var h='';for(var i=0;i<r.length;i++){h+='<a class="search-recent-item" href="/search?q='+encodeURIComponent(r[i])+'">'+esc(r[i])+'</a>'}recentList.innerHTML=h}}catch(e){}
  }
})();
</script>
<div class="cmd-overlay" id="cmd-overlay"><div class="cmd-box"><div class="cmd-input-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input class="cmd-input" id="cmd-input" placeholder="搜索页面、笔记、链接..." autocomplete="off"></div><div class="cmd-list" id="cmd-list"></div><div class="cmd-hint"><span><kbd>↑↓</kbd> 导航</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div></div></div>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
  } catch (e) {
    return new Response('服务器错误，请稍后再试', { status: 500 });
  }
}

function searchNavbar() {
  return `<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">搜索</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/blog" class="nav-link"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔记</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a><a href="/now" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Now</a><a href="/guestbook" class="nav-link"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>留言簿</a><a href="/about" class="nav-link">关于</a><a href="/features" class="nav-link">功能</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a><a href="/now" class="mobile-menu-link">Now</a><a href="/guestbook" class="mobile-menu-link">留言簿</a><a href="/about" class="mobile-menu-link">关于</a><a href="/features" class="mobile-menu-link">功能</a></div></div>`;
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
