// 首页 Edge SSR — Personal Operating System
export async function onRequestGet(context) {
  const { env } = context;
  const [sRes, siteRes, articleRes, statsRes] = await Promise.all([
    env.DB.prepare('SELECT key, value FROM settings').all(),
    env.DB.prepare('SELECT id, title, url, icon, description FROM sites ORDER BY sort_order ASC, id ASC LIMIT 200').all(),
    env.DB.prepare("SELECT id, title, slug, summary, created_at, views FROM articles WHERE is_published = 1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY created_at DESC LIMIT 4").all(),
    env.DB.prepare('SELECT COUNT(*) as count, COALESCE(SUM(views), 0) as total_views FROM articles WHERE is_published = 1').first()
  ]);
  var settings = {};
  for (var i = 0; i < (sRes.results || []).length; i++) {
    settings[sRes.results[i].key] = sRes.results[i].value;
  }
  var html = render(settings, siteRes.results || [], articleRes.results || [], statsRes || { count: 0, total_views: 0 });
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=86400' }
  });
}

function render(s, sites, articles, stats) {
  var t = esc(s.title || 'Ayoo');
  var sub = esc(s.subtitle || '');
  var foot = esc(s.footer || '');
  var bg = esc(s.bg_image || '');

  var bgStyle = bg ? ' style="background-image:url(\'' + bg + '\');background-size:cover;background-position:center;background-attachment:fixed;"' : '';

  // Navigation cards
  var navCards = '';
  for (var i = 0; i < sites.length; i++) {
    navCards += navCard(sites[i], i);
  }
  if (!navCards) navCards = '<p class="empty-state"><span class="empty-state-text">暂无链接</span></p>';

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
<link rel="stylesheet" href="/style.css">
</head>
<body${bgStyle}>
${navbar(t)}
<div class="page-wrapper">
  <div class="content">

    <!-- Hero: Time + Greeting -->
    <section class="home-hero animate-in">
      <div class="home-time" id="time">--:--</div>
      <div class="home-date" id="date">----年--月--日</div>
      <div class="home-greeting" id="greeting"></div>
    </section>

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
<script>
(function(){
  /* Clock — hero (HH:MM) + navbar (HH:MM:SS) */
  function updateClock(){
    var n=new Date();
    var h=String(n.getHours()).padStart(2,'0');
    var m=String(n.getMinutes()).padStart(2,'0');
    var s=String(n.getSeconds()).padStart(2,'0');
    var hero=document.getElementById('time');
    if(hero) hero.textContent=h+':'+m;
    var nav=document.getElementById('clock');
    if(nav) nav.textContent=h+':'+m+':'+s;
  }
  updateClock();
  setInterval(updateClock,1e3);

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

  /* Theme toggle */
  var b=document.getElementById('theme-toggle'),
      st=localStorage.getItem('theme')||'light';
  if(st==='dark') document.documentElement.setAttribute('data-theme','dark');
  b.textContent=st==='dark'?'☀':'☽';
  b.addEventListener('click',function(){
    var d=document.documentElement.getAttribute('data-theme')==='dark';
    if(d){document.documentElement.removeAttribute('data-theme');localStorage.setItem('theme','light');b.textContent='☽'}
    else{document.documentElement.setAttribute('data-theme','dark');localStorage.setItem('theme','dark');b.textContent='☀'}
  });

  /* Double-click nav cards */
  document.querySelectorAll('.nav-card').forEach(function(x){
    x.addEventListener('dblclick',function(){
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

  /* Mobile menu */
  var hamburger=document.getElementById('nav-hamburger');
  var menu=document.getElementById('mobile-menu');
  var closeBtn=document.getElementById('mobile-menu-close');
  if(hamburger&&menu){
    hamburger.addEventListener('click',function(){menu.classList.add('active')});
  }
  if(closeBtn&&menu){
    closeBtn.addEventListener('click',function(){menu.classList.remove('active')});
  }
})()
/* Command Palette */
(function(){
  var overlay=document.getElementById('cmd-overlay'),input=document.getElementById('cmd-input'),list=document.getElementById('cmd-list');
  var items=[],activeIdx=0,loaded=false;
  function load(){if(loaded)return;loaded=true;fetch('/api/command-index').then(function(r){return r.json()}).then(function(d){items=d.items||[];render('')})}
  function render(q){
    var q2=q.toLowerCase(),filtered=q2?items.filter(function(x){return(x.title+' '+(x.desc||'')+' '+(x.tags||'')).toLowerCase().indexOf(q2)>=0}):items;
    activeIdx=0;
    if(!filtered.length){list.innerHTML='<div class="cmd-empty">没有结果</div>';return}
    var h='';for(var i=0;i<filtered.length;i++){var x=filtered[i];h+='<div class="cmd-item'+(i===0?' active':'')+'" data-idx="'+i+'"><span class="cmd-item-icon">'+(x.icon||'📄')+'</span><div class="cmd-item-text"><div class="cmd-item-title">'+esc(x.title)+'</div>'+(x.desc?'<div class="cmd-item-desc">'+esc(x.desc)+'</div>':'')+'</div><span class="cmd-item-type">'+x.type+'</span></div>'}
    list.innerHTML=h;
    list.querySelectorAll('.cmd-item').forEach(function(el){el.addEventListener('click',function(){go(parseInt(el.dataset.idx))})})
  }
  function go(idx){var q2=input.value.toLowerCase();var filtered=q2?items.filter(function(x){return(x.title+' '+(x.desc||'')+' '+(x.tags||'')).toLowerCase().indexOf(q2)>=0}):items;if(filtered[idx]){close();window.location.href=filtered[idx].url}}
  function open(){load();overlay.classList.add('active');input.value='';input.focus();render('')}
  function close(){overlay.classList.remove('active')}
  function move(d){var els=list.querySelectorAll('.cmd-item');if(!els.length)return;els[activeIdx].classList.remove('active');activeIdx=(activeIdx+d+els.length)%els.length;els[activeIdx].classList.add('active');els[activeIdx].scrollIntoView({block:'nearest'})}
  document.addEventListener('keydown',function(e){if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();overlay.classList.contains('active')?close():open()}if(e.key==='Escape'&&overlay.classList.contains('active'))close()});
  overlay.addEventListener('click',function(e){if(e.target===overlay)close()});
  input.addEventListener('input',function(){render(input.value)});
  input.addEventListener('keydown',function(e){if(e.key==='ArrowDown'){e.preventDefault();move(1)}if(e.key==='ArrowUp'){e.preventDefault();move(-1)}if(e.key==='Enter'){e.preventDefault();go(activeIdx)}});
})();
</script>
<div class="cmd-overlay" id="cmd-overlay"><div class="cmd-box"><div class="cmd-input-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input class="cmd-input" id="cmd-input" placeholder="搜索页面、笔记、链接..." autocomplete="off"></div><div class="cmd-list" id="cmd-list"></div><div class="cmd-hint"><span><kbd>↑↓</kbd> 导航</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div></div></div>
</body>
</html>`;
}

function navbar(title) {
  return `<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">${esc(title)}</a><div class="nav-links"><a href="/blog" class="nav-link"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔记</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>`;
}

function mobileMenu() {
  return `<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a></div></div>`;
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
  return `<div class="nav-card" data-url="${esc(site.url)}" data-icon="${esc(site.icon || '')}" title="${esc(site.title)}" style="animation-delay:${index * 60}ms">
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

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
