/**
 * 首页 SSR
 * 功能：渲染主页（导航卡片、统计、状态栏）
 * 依赖：navbar.js、sanitize.js、response.js
 * 核心入口：onRequestGet()
 */
import { navbar, mobileMenu, cmdOverlay } from './lib/navbar.js';
import { esc } from './lib/sanitize.js';
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const [sRes, siteRes, articleRes, statsRes, tagsRes] = await Promise.all([
      env.DB.prepare('SELECT key, value FROM settings').all(),
      env.DB.prepare('SELECT id, title, url, icon, description FROM sites ORDER BY sort_order ASC, id ASC LIMIT 200').all(),
      env.DB.prepare("SELECT id, title, slug, summary, cover_image, is_encrypted, created_at, views FROM articles WHERE is_published = 1 AND (article_type = 'blog' OR article_type IS NULL) AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY created_at DESC LIMIT 4").all(),
      env.DB.prepare('SELECT COUNT(*) as count, COALESCE(SUM(views), 0) as total_views FROM articles WHERE is_published = 1 AND (article_type = \'blog\' OR article_type IS NULL)').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM tags').first()
    ]);
    var settings = {};
    for (var i = 0; i < (sRes.results || []).length; i++) {
      settings[sRes.results[i].key] = sRes.results[i].value;
    }
    var stats = statsRes || { count: 0, total_views: 0 };
    stats.tag_count = (tagsRes && tagsRes.count) || 0;
    var html = render(settings, siteRes.results || [], articleRes.results || [], stats);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=86400' }
    });
  } catch (e) {
    console.error('Homepage error:', e);
    return new Response('服务器错误，请稍后再试', { status: 500 });
  }
}

function render(s, sites, articles, stats) {
  var t = esc(s.title || 'Ayoo');
  var subRaw = s.subtitle || '';
  var sub = esc(subRaw);
  var foot = esc(s.footer || '');
  // Profile: bio and social links
  var profileBio = s.profile_bio || '';
  var profileLinks = [];
  if (s.profile_links) {
    try {
      profileLinks = JSON.parse(s.profile_links.replace(/\\n/g, '\n'));
    } catch(e) { profileLinks = []; }
  }
  var bgRaw = s.bg_image || '';
  var bgDarkRaw = s.bg_image_dark || '';
  var solidBg = s.solid_bg === '1' || s.solid_bg === true;
  // 防止 CSS 注入：只允许 http/https 或相对路径
  if (bgRaw && !/^https?:\/\/|^\/[^\/]/i.test(bgRaw)) bgRaw = '';
  if (bgDarkRaw && !/^https?:\/\/|^\/[^\/]/i.test(bgDarkRaw)) bgDarkRaw = '';
  var bg = bgRaw ? esc(bgRaw) : '';
  var bgDark = bgDarkRaw ? esc(bgDarkRaw) : '';

  // 纯色模式不应用背景图；否则根据当前主题选择
  var bgStyle = '';
  if (!solidBg && bg) {
    bgStyle = ' style="background-image:url(\'' + bg + '\');background-size:cover;background-position:center;background-attachment:fixed;"';
  }
  // 将背景设置传给前端（toolbar.js 根据主题切换时使用）
  var bgSettings = JSON.stringify({ bg: bg, bgDark: bgDark, solidBg: solidBg });

  // Build profile sidebar HTML
  var avatarHtml = '';
  if (s.about_avatar) {
    avatarHtml = '<img class="home-profile-avatar" src="' + esc(s.about_avatar) + '" alt="avatar" />';
  } else {
    avatarHtml = '<div class="home-profile-avatar home-profile-avatar-placeholder">&#x1F60A;</div>';
  }
  var bioHtml = '';
  var bioText = profileBio || subRaw || '';
  if (bioText) {
    bioHtml = '<div class="home-profile-bio">' + esc(bioText) + '</div>';
  }
  var linksHtml = '';
  if (profileLinks.length > 0) {
    linksHtml = '<div class="home-profile-links">';
    for (var li = 0; li < profileLinks.length; li++) {
      var link = profileLinks[li];
      var safeUrl = link.url || '#';
      if (/^(javascript|data|vbscript):/i.test(safeUrl)) safeUrl = '#';
      linksHtml += '<a href="' + esc(safeUrl) + '" class="home-profile-link" title="' + esc(link.label || '') + '" target="_blank" rel="noopener noreferrer">' + profileLinkIcon(link.icon, link.label) + '</a>';
    }
    linksHtml += '</div>';
  }
  var profileHtml = '<div class="home-profile home-profile-enter" style="animation-delay:100ms">'
    + avatarHtml
    + '<div class="home-profile-name">' + t + '</div>'
    + bioHtml
    + '<div class="home-profile-stats">'
    + '<span class="home-profile-stat"><strong>' + stats.count + '</strong> <span data-zh="文章" data-en="Posts">文章</span></span>'
    + '<span class="home-profile-stat"><strong>' + stats.tag_count + '</strong> <span data-zh="标签" data-en="Tags">标签</span></span>'
    + '<span class="home-profile-stat"><strong>' + stats.total_views + '</strong> <span data-zh="阅读" data-en="Views">阅读</span></span>'
    + '<span class="home-profile-stat"><strong>' + sites.length + '</strong> <span data-zh="导航" data-en="Links">导航</span></span>'
    + '</div>'
    + linksHtml
    + '</div>';

  // Navigation cards — static pages first, then dynamic sites
  var navCards = '';
  navCards += `<div class="nav-card" data-url="/now" title="Now" style="animation-delay:0ms"><div class="nav-card-icon"><span class="nav-card-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span></div><div class="nav-card-text"><div class="nav-card-title" data-zh="近况" data-en="Now">近况</div><div class="nav-card-desc" data-zh="当前状态" data-en="Current status">当前状态</div></div></div>`;
  navCards += `<div class="nav-card" data-url="/guestbook" title="留言簿" style="animation-delay:60ms"><div class="nav-card-icon"><span class="nav-card-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></span></div><div class="nav-card-text"><div class="nav-card-title" data-zh="留言簿" data-en="Guestbook">留言簿</div><div class="nav-card-desc" data-zh="来留个言吧" data-en="Leave a message">来留个言吧</div></div></div>`;
  for (var i = 0; i < sites.length; i++) {
    navCards += navCard(sites[i], i + 2);
  }

  // Recent articles
  var articleCards = '';
  for (var i = 0; i < articles.length; i++) {
    articleCards += articleCard(articles[i], i);
  }
  if (!articleCards) articleCards = '<p class="empty-state"><span class="empty-state-text" data-zh="暂无文章" data-en="No articles yet">暂无文章</span></p>';

  var desc = esc(s.subtitle || 'Personal Operating System');
  var seo = '\n<meta name="description" content="' + desc + '">'
    + '\n<meta property="og:type" content="website">'
    + '\n<meta property="og:title" content="' + t + '">'
    + '\n<meta property="og:description" content="' + desc + '">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev">';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${t}</title>${seo}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/style.css?v=6">
<link rel="stylesheet" href="/toolbar.css?v=9">
</head>
<body${bgStyle}>
${navbar(t, '/', '')}
${profileHtml}
<div class="page-wrapper">
  <div class="content">

    <!-- Banner: 站点标题（ihkk.net 风格） -->
    <section class="home-banner animate-in">
      <h1 class="home-banner-title">${t}</h1>
      ${subRaw ? '<p class="home-banner-subtitle">' + sub + '</p>' : ''}
    </section>

    <!-- 最近文章（单栏列表） -->
    <section class="home-articles-section">
      <div class="section-header">
        <span class="section-title">最近文章</span>
        <a href="/blog" class="section-link">查看全部 →</a>
      </div>
      <div class="home-articles stagger">
        ${articleCards}
      </div>
    </section>

    <!-- 导航卡片 -->
    <section class="home-nav-section">
      <div class="section-header">
        <span class="section-title">导航</span>
      </div>
      <div class="home-nav stagger">
        ${navCards}
      </div>
    </section>

    <!-- 状态栏 -->
    <div class="home-status animate-in" style="animation-delay:500ms">
      <div class="status-item">
        <span class="status-dot"></span>
        <span data-zh="在线" data-en="Online">在线</span>
      </div>
      <div class="status-item">${stats.count} <span data-zh="篇文章" data-en="posts">篇文章</span></div>
      <div class="status-item">${stats.total_views} <span data-zh="次阅读" data-en="views">次阅读</span></div>
      <div class="status-item" id="last-updated"></div>
    </div>

  </div>

  <footer class="page-footer">
    <span class="footer-text">${foot}</span>
  </footer>
</div>

${mobileMenu()}
<script src="/app.js" defer></script>
<script>
(function(){
  /* Clock — hero (HH:MM) */
  function updateHeroClock(){var n=new Date(),h=String(n.getHours()).padStart(2,'0'),m=String(n.getMinutes()).padStart(2,'0');var el=document.getElementById('time');if(el) el.textContent=h+':'+m}
  updateHeroClock();setInterval(updateHeroClock,1e3);

  /* Date */
  var n=new Date();
  var days=['日','一','二','三','四','五','六'];
  var dateEl=document.getElementById('date');
  if(dateEl) dateEl.textContent=n.getFullYear()+'年'+(n.getMonth()+1)+'月'+n.getDate()+'日 星期'+days[n.getDay()];

  /* Greeting */
  var h=n.getHours();
  var g='';
  if(h<6) g='夜深了，注意休息';
  else if(h<12) g='早上好，新的一天';
  else if(h<14) g='中午好，记得吃饭';
  else if(h<18) g='下午好，继续加油';
  else if(h<22) g='晚上好，放松一下';
  else g='夜深了，注意休息';
  var gEl=document.getElementById('greeting');
  if(gEl) gEl.textContent=g;

  /* Click nav cards */
  document.querySelectorAll('.nav-card').forEach(function(x){
    x.addEventListener('click',function(e){
      var u=x.dataset.url;
      if(u) window.location.href=u;
    });
    x.addEventListener('dblclick',function(e){
      e.preventDefault();
      var u=x.dataset.url;
      if(u) window.open(u,'_blank','noopener,noreferrer');
    });
  });

  /* Load favicons */
  document.querySelectorAll('.nav-card').forEach(function(x){loadIcon(x)});
  function loadIcon(x){
    var ic=x.querySelector('.nav-card-icon'),
        ci=x.dataset.icon,
        url=x.dataset.url,
        iu=null;
    if(ci) iu=ci;
    else if(url) try{iu='https://'+new URL(url).hostname+'/favicon.ico'}catch(e){}
    if(!iu) return;
    var img=new Image(),done=false,timer=setTimeout(function(){if(!done){done=true;img.src=''}},2e3);
    img.onload=function(){if(done)return;done=true;clearTimeout(timer);ic.innerHTML='';var el=document.createElement('img');el.src=iu;el.alt='';ic.appendChild(el)};
    img.onerror=function(){if(done)return;done=true;clearTimeout(timer)};
    img.src=iu;
  }

})()
</script>
${cmdOverlay()}
<script>window.__bgSettings = ${bgSettings};</script>
<script src="/toolbar.js?v=14" defer></script>
</body>
</html>`;
}

function articleCard(article, index) {
  var date = formatDate(article.created_at);
  var hasCover = !!article.cover_image;
  // 有封面：ihkk.net post-header-with-thumbnail 风格
  var coverHtml = hasCover
    ? '<div class="article-card-header has-cover">'
      + '<img class="article-card-thumb" src="' + esc(article.cover_image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
      + '<div class="article-card-header-text">'
        + '<h3 class="article-card-title">' + esc(article.title) + '</h3>'
        + '<div class="article-card-meta"><span>' + date + '</span><span>' + (article.views || 0) + ' 阅读</span></div>'
      + '</div></div>'
    : '<div class="article-card-header">'
      + '<h3 class="article-card-title">' + esc(article.title) + '</h3>'
      + '<div class="article-card-meta"><span>' + date + '</span><span>' + (article.views || 0) + ' 阅读</span></div>'
      + '</div>';
  // 摘要
  var summaryHtml = article.summary ? '<div class="article-card-summary">' + esc(article.summary) + '</div>' : '';
  return '<a href="/blog/' + esc(article.slug) + '" class="article-card" style="animation-delay:' + (index * 80) + 'ms">'
    + coverHtml + summaryHtml
    + '</a>';
}

function navCard(site, index) {
  var safeUrl = site.url || '#';
  if (/^(javascript|data|vbscript):/i.test(safeUrl)) safeUrl = '#';
  return `<div class="nav-card" data-url="${esc(safeUrl)}" data-icon="${esc(site.icon || '')}" title="${esc(site.title)}" style="animation-delay:${index * 60}ms">
    <div class="nav-card-icon"><span class="nav-card-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg></span></div>
    <div class="nav-card-text">
      <div class="nav-card-title">${esc(site.title)}</div>
      <div class="nav-card-desc">${esc(site.description || '')}</div>
    </div>
  </div>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d)) return esc(dateStr);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

// Profile social link icon mapping
function profileLinkIcon(icon, label) {
  var icons = {
    github: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>',
    twitter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    email: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/></svg>',
    website: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
    rss: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11a9 9 0 019 9"/><path d="M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1"/></svg>',
    weibo: '&#x1F4E2;',
    zhihu: '&#x77E5;&#x4E4E;',
    bilibili: '&#x1F4FA;',
    douyin: '&#x1F3B5;',
    telegram: '&#x2708;&#xFE0F;',
    discord: '&#x1F4AC;',
    youtube: '&#x25B6;&#xFE0F;',
    instagram: '&#x1F4F7;',
    mastodon: '&#x1F418;',
    bluesky: '&#x2601;&#xFE0F;',
    podcast: '&#x1F399;',
    steam: '&#x1F3AE;',
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>'
  };
  var key = (icon || '').toLowerCase();
  if (icons[key]) return icons[key];
  // If icon looks like an emoji or short text, use it directly
  if (icon && icon.length <= 4) return esc(icon);
  // Fallback: link icon
  return icons.link;
}
