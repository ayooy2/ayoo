import { navbar, mobileMenu, cmdOverlay } from './lib/navbar.js';
import { esc } from './lib/sanitize.js';
// 首页 Edge SSR — Personal Operating System
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const [sRes, siteRes, articleRes, statsRes, tagsRes] = await Promise.all([
      env.DB.prepare('SELECT key, value FROM settings').all(),
      env.DB.prepare('SELECT id, title, url, icon, description FROM sites ORDER BY sort_order ASC, id ASC LIMIT 200').all(),
      env.DB.prepare("SELECT id, title, slug, summary, created_at, views FROM articles WHERE is_published = 1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY created_at DESC LIMIT 4").all(),
      env.DB.prepare('SELECT COUNT(*) as count, COALESCE(SUM(views), 0) as total_views FROM articles WHERE is_published = 1').first(),
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
  var bgRaw = s.bg_image || '';
  // 防止 CSS 注入：只允许 http/https 或相对路径
  if (bgRaw && !/^https?:\/\/|^\/[^\/]/i.test(bgRaw)) bgRaw = '';
  var bg = bgRaw ? esc(bgRaw) : '';

  var bgStyle = bg ? ' style="background-image:url(\'' + bg + '\');background-size:cover;background-position:center;background-attachment:fixed;"' : '';

  // Navigation cards — static pages first, then dynamic sites
  var navCards = '';
  navCards += `<div class="nav-card" data-url="/now" title="Now" style="animation-delay:0ms"><div class="nav-card-icon"><span class="nav-card-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span></div><div class="nav-card-text"><div class="nav-card-title">Now</div><div class="nav-card-desc">近况</div></div></div>`;
  navCards += `<div class="nav-card" data-url="/guestbook" title="留言簿" style="animation-delay:60ms"><div class="nav-card-icon"><span class="nav-card-emoji"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></span></div><div class="nav-card-text"><div class="nav-card-title">留言簿</div><div class="nav-card-desc">来留个言吧</div></div></div>`;
  for (var i = 0; i < sites.length; i++) {
    navCards += navCard(sites[i], i + 2);
  }

  // Recent articles
  var articleCards = '';
  for (var i = 0; i < articles.length; i++) {
    articleCards += articleCard(articles[i], i);
  }
  if (!articleCards) articleCards = '<p class="empty-state"><span class="empty-state-text">暂无文章</span></p>';

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
<link rel="stylesheet" href="/style.css?v=4">
</head>
<body${bgStyle}>
${navbar(t, '/', '')}
<div class="page-wrapper">
  <div class="content">

    <!-- Hero: Time + Greeting -->
    <section class="home-hero animate-in">
      <div class="home-time" id="time">--:--</div>
      <div class="home-date" id="date">----年--月--日</div>
      <div class="home-greeting" id="greeting"></div>
    </section>

    <!-- Personal Card -->
    <div class="home-profile animate-in" style="animation-delay:100ms">
      <div class="home-profile-info">
        <div class="home-profile-name">${t}</div>
        <div class="home-profile-bio">${subRaw ? sub : 'Personal Operating System'}</div>
        <div class="home-profile-stats">
          <span class="home-profile-stat"><strong>${stats.count}</strong> 文章</span>
          <span class="home-profile-stat"><strong>${stats.tag_count}</strong> 标签</span>
          <span class="home-profile-stat"><strong>${stats.total_views}</strong> 阅读</span>
          <span class="home-profile-stat"><strong>${sites.length}</strong> 导航</span>
        </div>
      </div>
    </div>

    <!-- Main Grid: Articles + Nav Cards -->
    <div class="home-grid">

      <!-- Left: Recent Articles -->
      <section>
        <div class="section-header">
          <span class="section-title">最近文章</span>
          <a href="/blog" class="section-link">查看全部 →</a>
        </div>
        <div class="home-articles stagger">
          ${articleCards}
        </div>
      </section>

      <!-- Right: Navigation Cards -->
      <section>
        <div class="section-header">
          <span class="section-title">导航</span>
        </div>
        <div class="home-nav stagger">
          ${navCards}
        </div>
      </section>

    </div>

    <!-- Status Bar -->
    <div class="home-status animate-in" style="animation-delay:500ms">
      <div class="status-item">
        <span class="status-dot"></span>
        <span>在线</span>
      </div>
      <div class="status-item">${stats.count} 篇文章</div>
      <div class="status-item">${stats.total_views} 次阅读</div>
      <div class="status-item" id="last-updated"></div>
    </div>

  </div>

  <footer class="page-footer">
    <span class="footer-text">${foot}</span>
  </footer>
</div>

${mobileMenu()}
<script src="/app.js"></script>
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

  /* Scroll reveal animation */
  if('IntersectionObserver' in window){
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}})
    },{threshold:0.1});
    document.querySelectorAll('.scroll-reveal').forEach(function(el){observer.observe(el)});
  }
})()
</script>
${cmdOverlay()}
</body>
</html>`;
}

function articleCard(article, index) {
  var date = formatDate(article.created_at);
  return `<a href="/blog/${esc(article.slug)}" class="article-card" style="animation-delay:${index * 80}ms">
    <h3 class="article-card-title">${esc(article.title)}</h3>
    <p class="article-card-summary">${esc(article.summary || '')}</p>
    <div class="article-card-meta">
      <span>${date}</span>
      <span>${article.views || 0} 阅读</span>
    </div>
  </a>`;
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


