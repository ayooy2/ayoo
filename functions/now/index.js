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
  } catch (e) { return new Response('Error: ' + e.message, { status: 500 }); }
}

function render(groups, categoryOrder, lastUpdated) {
  // Build category sections
  var sections = '';
  for (var i = 0; i < categoryOrder.length; i++) {
    var cat = categoryOrder[i];
    var catItems = groups[cat];
    var listHtml = '';
    for (var j = 0; j < catItems.length; j++) {
      listHtml += '<li class="now-item">' + esc(catItems[j].content || '') + '</li>';
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
<link rel="stylesheet" href="/style.css">
</head>
<body>
${nowNavbar()}
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
</html>`;
}

function nowNavbar() {
  return `<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">Now</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/blog" class="nav-link"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔记</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a><a href="/now" class="mobile-menu-link">Now</a></div></div>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
