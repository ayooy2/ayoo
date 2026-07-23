import { navbar, mobileMenu, cmdOverlay } from '../lib/navbar.js';
import { esc, safeUrl } from '../lib/sanitize.js';
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
  if (!cards) cards = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p class="empty-state-text" data-zh="还没有留言，来抢沙发吧" data-en="No messages yet, be the first!">还没有留言，来抢沙发吧</p></div>';

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
<link rel="stylesheet" href="/style.css?v=6">
<link rel="stylesheet" href="/toolbar.css?v=6">
</head>
<body>
${navbar('留言簿', '/', '/guestbook')}
${mobileMenu()}
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
        <div><button type="submit" class="btn-submit" id="gb-submit" data-zh="提交留言" data-en="Submit">提交留言</button></div>
      </form>
    </div>
    <div class="guestbook-list stagger">
      ${cards}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/" data-zh="← 返回首页" data-en="← Back to Home">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js" defer></script>
<script>
(function(){
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function safeUrl(u){if(!u)return'';var t=u.replace(/^[\s\x00]+/,'');if(/^javascript:|^data:|^vbscript:/i.test(t))return'#';return u}
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
    .then(function(d){
      form.reset();
      btn.disabled=false;btn.textContent='提交留言';
      /* Insert new entry at top of list */
      var list=document.querySelector('.comment-list')||document.querySelector('.content');
      if(list){
        var empty=list.querySelector('.empty-state');if(empty)empty.remove();
        var div=document.createElement('div');div.className='comment-box';div.style.animationDelay='0ms';
        var avatar='https://q1.qlogo.cn/g?b=qq&nk=0&s=100&fid='+Math.abs(name.split('').reduce(function(h,c){return((h<<5)-h)+c.charCodeAt(0)|0},0))%14+1;
        var safeL=url?safeUrl(url):'';
        var nameHtml=safeL?'<a href="'+esc(safeL)+'" target="_blank" rel="noopener" class="comment-author">'+esc(name)+'</a>':'<span class="comment-author">'+esc(name)+'</span>';
        div.innerHTML='<div class="comment-header"><img class="comment-avatar" src="'+avatar+'" alt="" loading="lazy"><div class="comment-meta">'+nameHtml+'</div></div><div class="comment-body"><p>'+esc(message)+'</p></div>';
        list.insertBefore(div,list.firstChild);
      }
    })
    .catch(function(){alert('提交失败，请稍后再试');btn.disabled=false;btn.textContent='提交留言'});
  });
})()
</script>
<script src="/toolbar.js" defer></script>
${cmdOverlay()}
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
  } catch (e) {
    return new Response('服务器错误，请稍后再试', { status: 500 });
  }
}


function retroAv(seed){var h=0,s=String(seed);for(var i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return'https://q1.qlogo.cn/g?b=qq&nk=0&s=100&fid='+(Math.abs(h)%14+1);}

function guestbookCard(entry, index) {
  var date = (entry.created_at || '').slice(0, 16).replace('T', ' ');
  var avatar = retroAv(entry.name || 'default');
  var safeLink = entry.url ? safeUrl(entry.url) : '';
  var nameHtml = safeLink
    ? '<a href="' + esc(safeLink) + '" target="_blank" rel="noopener" class="comment-author">' + esc(entry.name) + '</a>'
    : '<span class="comment-author">' + esc(entry.name) + '</span>';
  return '<div class="comment-box" style="animation-delay:' + (index * 60) + 'ms">'
    + '<div class="comment-header">'
    + '<img class="comment-avatar" src="' + avatar + '" alt="" loading="lazy">'
    + '<div class="comment-header-info">'
    + nameHtml
    + '<span class="comment-time">' + esc(date) + '</span>'
    + '</div></div>'
    + '<div class="comment-text">' + esc((entry.message || '').replace(/\\n/g, '\n')).replace(/\n/g, '<br>') + '</div>'
    + '</div>';
}


