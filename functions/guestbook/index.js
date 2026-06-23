// 留言簿 Edge SSR
export async function onRequestGet(context) {
  const { env } = context;
  try {
  const { results } = await env.DB.prepare(
    'SELECT * FROM guestbook ORDER BY created_at DESC LIMIT 50'
  ).all();
  const entries = results || [];

  var cards = '';
  for (var i = 0; i < entries.length; i++) {
    cards += guestbookCard(entries[i], i);
  }
  if (!cards) cards = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p class="empty-state-text">还没有留言，来抢沙发吧</p></div>';

  var seo = '<meta name="description" content="留言簿 — 欢迎留下你的足迹">'
    + '\n<meta property="og:type" content="website">'
    + '\n<meta property="og:title" content="留言簿">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev/guestbook">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev/guestbook">';

  return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>留言簿</title>${seo}
<link rel="stylesheet" href="/style.css?v=3">
</head>
<body>
${guestbookNavbar()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">留言簿</h1>
    <p class="page-subtitle">欢迎留下你的足迹</p>
  </div>
  <div class="content">
    <div class="guestbook-form-wrap" style="margin-bottom:2rem;">
      <form id="guestbook-form" class="comment-form" style="display:flex;flex-direction:column;gap:.75rem;">
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;">
          <input type="text" name="name" class="comment-input" placeholder="你的名字 *" required maxlength="50" style="flex:1;min-width:140px;">
          <input type="url" name="url" class="comment-input" placeholder="网站 (选填)" maxlength="200" style="flex:1;min-width:140px;">
        </div>
        <textarea name="message" class="comment-input" placeholder="说点什么吧..." required maxlength="1000" rows="3"></textarea>
        <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
        <div><button type="submit" class="btn-submit" id="gb-submit">提交留言</button></div>
      </form>
    </div>
    <div class="guestbook-list stagger">
      ${cards}
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
  /* Guestbook form */
  var form=document.getElementById('guestbook-form');
  var btn=document.getElementById('gb-submit');
  if(form) form.addEventListener('submit',function(e){
    e.preventDefault();
    var hp=form.elements['website'];
    if(hp&&hp.value) return;
    var name=(form.elements['name'].value||'').trim();
    var url=(form.elements['url'].value||'').trim();
    var message=(form.elements['message'].value||'').trim();
    if(!name||!message) return;
    btn.disabled=true;btn.textContent='提交中...';
    fetch('/api/guestbook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,url:url,message:message})})
    .then(function(r){if(!r.ok)throw new Error('fail');return r.json()})
    .then(function(){window.location.reload()})
    .catch(function(){alert('提交失败，请稍后再试');btn.disabled=false;btn.textContent='提交留言'});
  });
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
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    return new Response('服务器错误，请稍后再试', { status: 500 });
  }
}

function guestbookNavbar() {
  return `<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">留言簿</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/blog" class="nav-link"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔记</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a><a href="/guestbook" class="mobile-menu-link">留言簿</a></div></div>`;
}

function guestbookCard(entry, index) {
  var date = (entry.created_at || '').slice(0, 16).replace('T', ' ');
  var nameHtml = entry.url
    ? '<a href="' + esc(entry.url) + '" target="_blank" rel="noopener" class="comment-author">' + esc(entry.name) + '</a>'
    : '<span class="comment-author">' + esc(entry.name) + '</span>';
  return '<div class="comment-box" style="animation-delay:' + (index * 60) + 'ms">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">'
    + nameHtml
    + '<span class="comment-time">' + esc(date) + '</span>'
    + '</div>'
    + '<div class="comment-text">' + esc(entry.message).replace(/\n/g, '<br>') + '</div>'
    + '</div>';
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
