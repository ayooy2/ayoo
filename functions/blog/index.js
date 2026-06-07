// 博客列表 Edge SSR — Card Grid Layout
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

  // Blog cards
  var cards = '';
  for (var i = 0; i < articles.length; i++) {
    cards += blogCard(articles[i], i);
  }
  if (!cards) cards = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p class="empty-state-text">还没有文章</p></div>';

  var seo = '<meta name="description" content="所有已发布的文章笔记">'
    + '\n<meta property="og:type" content="website">'
    + '\n<meta property="og:title" content="Blog">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev/blog">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev/blog">'
    + '\n<link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml">';

  return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Blog</title>${seo}
<link rel="stylesheet" href="/style.css">
</head>
<body>
${blogNavbar()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">Blog</h1>
    <p class="page-subtitle">${articles.length} 篇文章</p>
  </div>
  <div class="content">
    <div class="blog-grid stagger">
      ${cards}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/">← 返回首页</a></span>
  </footer>
</div>
<script>
(function(){
  /* Clock */
  function updateClock(){var n=new Date(),h=String(n.getHours()).padStart(2,'0'),m=String(n.getMinutes()).padStart(2,'0'),s=String(n.getSeconds()).padStart(2,'0');var el=document.getElementById('clock');if(el) el.textContent=h+':'+m+':'+s}
  updateClock();setInterval(updateClock,1e3);
  var b=document.getElementById('theme-toggle'),st=localStorage.getItem('theme')||'light';
  if(st==='dark') document.documentElement.setAttribute('data-theme','dark');
  b.textContent=st==='dark'?'☀':'☽';
  b.addEventListener('click',function(){
    var d=document.documentElement.getAttribute('data-theme')==='dark';
    if(d){document.documentElement.removeAttribute('data-theme');localStorage.setItem('theme','light');b.textContent='☽'}
    else{document.documentElement.setAttribute('data-theme','dark');localStorage.setItem('theme','dark');b.textContent='☀'}
  });
  var hamburger=document.getElementById('nav-hamburger');
  var menu=document.getElementById('mobile-menu');
  var closeBtn=document.getElementById('mobile-menu-close');
  if(hamburger&&menu) hamburger.addEventListener('click',function(){menu.classList.add('active')});
  if(closeBtn&&menu) closeBtn.addEventListener('click',function(){menu.classList.remove('active')});
})()
</script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

function blogNavbar() {
  return `<nav class="navbar"><div class="nav-inner"><a href="/blog" class="nav-brand">Blog</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a></div></div>`;
}

function blogCard(a, index) {
  var date = (a.created_at || '').slice(0, 10);
  var tags = '';
  var tagArr = (a.tags || '').split(',').filter(Boolean);
  for (var t = 0; t < tagArr.length; t++) {
    tags += '<span class="tag">#' + esc(tagArr[t].trim()) + '</span>';
  }

  var cover = '';
  if (a.cover_image) {
    cover = '<img class="blog-card-cover" src="' + esc(a.cover_image) + '" alt="" loading="lazy">';
  } else {
    cover = '<div class="blog-card-cover-placeholder"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
  }

  return `<a href="/blog/${esc(a.slug)}" class="blog-card" style="animation-delay:${index * 60}ms">
    ${cover}
    <h3 class="blog-card-title">${esc(a.title)}</h3>
    ${a.summary ? '<p class="blog-card-summary">' + esc(a.summary) + '</p>' : ''}
    <div class="blog-card-meta">
      <span>${esc(date)}</span>
      <span>${a.views || 0} 阅读</span>
      <span>${a.likes} 喜欢</span>
    </div>
    ${tags ? '<div class="blog-card-tags">' + tags + '</div>' : ''}
  </a>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
