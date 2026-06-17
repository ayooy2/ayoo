// GET /archive — 归档页，时间线布局
export async function onRequestGet(context) {
  const { env } = context;
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
      var monthLabel = parseInt(month) + '月';
      timeline += '<div class="archive-month">' + monthLabel + ' <span class="archive-month-count">' + articles.length + '</span></div>';
      timeline += '<ul class="archive-list">';
      for (var j = 0; j < articles.length; j++) {
        var a = articles[j];
        var day = (a.created_at || '').slice(8, 10);
        timeline += '<li class="archive-item"><span class="archive-item-day">' + esc(day) + '</span><a href="/blog/' + a.slug + '">' + esc(a.title) + '</a><span class="archive-item-views">' + (a.views || 0) + '</span></li>';
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
<link rel="stylesheet" href="/style.css">
</head>
<body>
${archiveNavbar()}
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
<script>
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
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
/* Remove animate-in after animation to prevent transform from breaking fixed positioning */
document.querySelectorAll('.animate-in').forEach(function(el){el.addEventListener('animationend',function(){el.classList.remove('animate-in');el.style.opacity='1'},{once:true})});
</script>
<div class="cmd-overlay" id="cmd-overlay"><div class="cmd-box"><div class="cmd-input-wrap"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input class="cmd-input" id="cmd-input" placeholder="搜索页面、笔记、链接..." autocomplete="off"></div><div class="cmd-list" id="cmd-list"></div><div class="cmd-hint"><span><kbd>↑↓</kbd> 导航</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div></div></div>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' } });
}

function archiveNavbar() {
  return `<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">归档</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/blog" class="nav-link"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔记</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/now" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Now</a><a href="/guestbook" class="nav-link"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>留言簿</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a><a href="/now" class="mobile-menu-link">Now</a><a href="/guestbook" class="mobile-menu-link">留言簿</a></div></div>`;
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
