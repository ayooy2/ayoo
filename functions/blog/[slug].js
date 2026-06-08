// 文章详情 Edge SSR — Breadcrumb + Sidebar TOC + Modern Layout
export async function onRequestGet(context) {
  try {
    const { env, params } = context;
    const slug = params.slug || new URL(context.request.url).pathname.replace('/blog/', '').replace(/\/$/, '');
    const a = await env.DB.prepare("SELECT * FROM articles WHERE slug=? AND is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))").bind(slug).first();
    if (!a) return new Response('Not found', { status: 404 });
    await env.DB.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').bind(a.id).run();
    a.views = (a.views || 0) + 1;
    const l = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id=?').bind(a.id).first();
    var h = render(a, l.c);
    return new Response(h, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { return new Response('Error: ' + e.message, { status: 500 }); }
}

function render(a, likes) {
  var time = (a.created_at || '').replace('T', ' ').slice(0, 16);
  var tags = '', ts = (a.tags || '').split(',').filter(Boolean);
  for (var i = 0; i < ts.length; i++) tags += '<span class="tag">#' + esc(ts[i].trim()) + '</span>';
  var md = JSON.stringify(a.content_md || '');
  var desc = esc(a.summary || (a.content_md || '').slice(0, 160));
  var kw = ts.map(function(t){ return esc(t.trim()); }).join(',');
  var url = 'https://ayoow.pages.dev/blog/' + esc(a.slug);
  var img = a.cover_image ? esc(a.cover_image) : '';

  // Estimate reading time
  var wordCount = (a.content_md || '').replace(/\\n/g, '\n').replace(/[#*`\[\]()!>-]/g, '').length;
  var readTime = Math.max(1, Math.ceil(wordCount / 500));

  var seo = '<meta name="description" content="' + desc + '">'
    + (kw ? '<meta name="keywords" content="' + kw + '">' : '')
    + '<meta property="og:type" content="article">'
    + '<meta property="og:title" content="' + esc(a.title) + '">'
    + '<meta property="og:description" content="' + desc + '">'
    + '<meta property="og:url" content="' + url + '">'
    + (img ? '<meta property="og:image" content="' + img + '">' : '')
    + '<meta name="twitter:card" content="summary_large_image">'
    + '<meta name="twitter:title" content="' + esc(a.title) + '">'
    + '<meta name="twitter:description" content="' + desc + '">'
    + (img ? '<meta name="twitter:image" content="' + img + '">' : '')
    + '<link rel="canonical" href="' + url + '">'
    + '<link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml">';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(a.title)}</title>${seo}
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="reading-progress" id="reading-progress"></div>
${articleNavbar()}
<div class="page-wrapper">
  <div class="content">

    <!-- Breadcrumb -->
    <div class="article-top-bar animate-in">
      <a href="/blog"><svg viewBox="0 0 24 24"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> Blog</a>
      <span class="article-breadcrumb-sep">/</span>
      <span style="color:var(--text-primary)">${esc(a.title)}</span>
    </div>

    <!-- Mobile TOC (placeholder, built by JS) -->
    <div class="toc-mobile" id="toc-mobile" style="display:none">
      <button class="toc-mobile-toggle" onclick="toggleMobileTOC()">
        <span>目录</span>
        <svg id="toc-mobile-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="toc-mobile-content" id="toc-mobile-content"></div>
    </div>

    <!-- Article Layout: Content + Sidebar TOC -->
    <div class="article-layout">

      <!-- Main Content -->
      <article class="article-wrapper animate-in" style="animation-delay:100ms">
        <header class="article-header">
          ${a.cover_image ? '<img src="' + esc(a.cover_image) + '" class="article-cover" alt="">' : ''}
          <h1 class="article-title">${esc(a.title)}</h1>
          <div class="article-meta">
            <span class="article-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${esc(a.author)}</span>
            <span class="article-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${time}</span>
            <span class="article-meta-item">${a.views || 0} 阅读</span>
            <span class="article-meta-item">${readTime} 分钟</span>
          </div>
          ${tags ? '<div class="article-tags">' + tags + '</div>' : ''}
        </header>

        <div class="article-body" id="content">${simpleMD(a.content_md || '')}</div>

        <div class="article-actions">
          <button class="btn-like" id="like-btn" onclick="toggleLike()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 喜欢
          </button>
        </div>

        <section class="comment-section">
          <h3>评论 (<span id="cc">0</span>)</h3>
          <div id="comments-area"></div>
          <textarea class="comment-input" id="comment-input" placeholder="写下想法..."></textarea>
          <input class="comment-input" id="comment-name" placeholder="昵称" style="min-height:auto;height:auto;margin-top:0.4rem;width:auto;min-width:160px;">
          <button class="btn-submit" onclick="this.disabled=true;postComment(this)">发表</button>
        </section>
      </article>

      <!-- Sidebar TOC (desktop) -->
      <aside class="article-toc" id="article-toc">
        <div class="toc-title">目录</div>
        <ul class="toc-list" id="toc-list"></ul>
      </aside>

    </div>
  </div>

  <footer class="page-footer">
    <span class="footer-text"><a href="/blog">← 返回笔记</a></span>
  </footer>
</div>

<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script>
var aid=${a.id},fp=localStorage.getItem("fp")||(function(){var f="fp"+Date.now()+Math.random();localStorage.setItem("fp",f);return f;})(),replyTo=null;

function init(){
  if(typeof marked=="undefined"){setTimeout(init,100);return;}
  var raw=${md}.replace(/\\\\n/g,"\\n");
  document.getElementById("content").innerHTML=marked.parse(raw);
  wrapCB();
  buildTOC();
}

function buildTOC(){
  var c=document.getElementById("content"),hs=c.querySelectorAll("h2,h3");
  if(hs.length<2) return;

  // Build TOC items
  var items=[];
  for(var i=0;i<hs.length;i++){
    var h=hs[i],id="h-"+i;
    h.id=id;
    items.push({level:h.tagName,id:id,text:h.textContent});
  }

  // Desktop sidebar TOC
  var tocList=document.getElementById("toc-list");
  if(tocList){
    var html='';
    for(var i=0;i<items.length;i++){
      var it=items[i];
      var cls=it.level==="H3"?"toc-item toc-h3":"toc-item";
      html+='<li class="'+cls+'"><a href="#'+it.id+'" data-target="'+it.id+'">'+escTOC(it.text)+'</a></li>';
    }
    tocList.innerHTML=html;
  }

  // Mobile TOC
  var mobile=document.getElementById("toc-mobile");
  var mobileContent=document.getElementById("toc-mobile-content");
  if(mobile&&mobileContent&&items.length>=2){
    mobile.style.display="block";
    var html='<ul class="toc-list" style="border:none">';
    for(var i=0;i<items.length;i++){
      var it=items[i];
      var cls=it.level==="H3"?"toc-item toc-h3":"toc-item";
      html+='<li class="'+cls+'"><a href="#'+it.id+'" data-target="'+it.id+'" onclick="closeMobileTOC()">'+escTOC(it.text)+'</a></li>';
    }
    html+='</ul>';
    mobileContent.innerHTML=html;
  }

  // Scroll spy
  if(items.length>=2) initScrollSpy(items);
}

function escTOC(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}

function initScrollSpy(items){
  var tocLinks=document.querySelectorAll("#toc-list a");
  var headingEls=[];
  for(var i=0;i<items.length;i++){
    var el=document.getElementById(items[i].id);
    if(el) headingEls.push(el);
  }
  if(!headingEls.length) return;

  var activeIdx=-1;
  function updateActive(){
    var scrollY=window.scrollY+100;
    var newIdx=0;
    for(var i=0;i<headingEls.length;i++){
      if(headingEls[i].offsetTop<=scrollY) newIdx=i;
    }
    if(newIdx!==activeIdx){
      activeIdx=newIdx;
      for(var i=0;i<tocLinks.length;i++){
        tocLinks[i].classList.toggle("active",i===activeIdx);
      }
    }
  }

  var ticking=false;
  window.addEventListener("scroll",function(){
    if(!ticking){requestAnimationFrame(function(){updateActive();ticking=false});ticking=true;}
  });
  updateActive();
}

function toggleMobileTOC(){
  var content=document.getElementById("toc-mobile-content");
  var arrow=document.getElementById("toc-mobile-arrow");
  if(content){
    var open=content.classList.toggle("open");
    if(arrow) arrow.style.transform=open?"rotate(180deg)":"";
  }
}
function closeMobileTOC(){
  var content=document.getElementById("toc-mobile-content");
  if(content) content.classList.remove("open");
}

function toggleCB(bar){
  var body=bar.nextElementSibling,wr=bar.parentElement,folded=wr.classList.toggle("folded");
  body.classList.toggle("hidden",folded);
  var arrow=bar.querySelector(".lang-arrow");
  if(arrow) arrow.textContent=folded?"\\u203A":"\\u2335";
  bar.title=folded?"展开":"收起";
}

setTimeout(function(){document.getElementById("content").style.opacity="1"},3000);
init();
loadComments();
updateLikeState();

function barHTML(l){
  return '<span class="code-block-lang">X <span class="lang-arrow">⌵</span></span><span style="flex:1"></span><button class="code-block-btn btn-copy" data-a="copy" title="复制" onclick="event.stopPropagation();onCBBtn(event)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button><button class="code-block-btn btn-fs" data-a="fullscreen" title="全屏" onclick="event.stopPropagation();onCBBtn(event)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>'.replace("X",l);
}

function wrapCB(){
  var pres=document.querySelectorAll("#content pre:not(.code-block-wrapper pre)");
  for(var i=0;i<pres.length;i++){
    var pre=pres[i],code=pre.querySelector("code"),lang="";
    if(code){var m=(code.className||"").match(/language-(\\w+)/);if(m)lang=m[1];}
    var w=document.createElement("div");w.className="code-block-wrapper";
    var bar=document.createElement("div");bar.className="code-block-bar";
    bar.innerHTML=barHTML(lang||"text");
    bar.setAttribute("onclick","toggleCB(this)");bar.title="收起";
    var body=document.createElement("div");body.className="cb-body";
    pre.parentNode.insertBefore(w,pre);w.appendChild(bar);body.appendChild(pre);w.appendChild(body);
  }
}

document.addEventListener("DOMContentLoaded",function(){document.getElementById("content").addEventListener("click",onCBBtn)});

function onCBBtn(e){
  var btn=e.target.closest(".code-block-btn");if(!btn)return;
  var a=btn.dataset.a,w=btn.closest(".code-block-wrapper"),pre=w.querySelector("pre");
  if(a==="copy") navigator.clipboard.writeText(pre.textContent);
  if(a==="fullscreen"){
    w.classList.toggle("fullscreen");
    if(w.classList.contains("fullscreen")){
      document.body.style.overflow="hidden";
      if(!pre.querySelector(".line-numbers")){
        var lines=pre.textContent.split("\\n"),nums="",lc=0;
        for(var li=0;li<lines.length;li++){if(lines[li].trim()||li<lines.length-1)nums+=(++lc)+"\\n"}
        var ln=document.createElement("div");ln.className="line-numbers";ln.textContent=nums;
        pre.insertBefore(ln,pre.firstChild);pre.style.display="flex";
      }
    }else{document.body.style.overflow=""}
  }
}

function postComment(btn){
  var c=document.getElementById("comment-input").value.trim(),
      n=document.getElementById("comment-name").value.trim()||"匿名";
  if(!c){if(btn)btn.disabled=false;return;}
  fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,parent_id:replyTo,author_name:n,content:c})})
  .then(function(r){return r.json()})
  .then(function(){document.getElementById("comment-input").value="";replyTo=null;loadComments()})
  .finally(function(){if(btn)btn.disabled=false});
}

function loadComments(){
  fetch("/api/comments?article_id="+aid).then(function(r){return r.json()}).then(function(cs){
    document.getElementById("cc").textContent=countAll(cs);
    document.getElementById("comments-area").innerHTML=rc(cs);
  });
}

function countAll(list){var n=0;for(var i=0;i<list.length;i++){n++;if(list[i].replies)n+=countAll(list[i].replies)}return n}

function rc(list,d){
  d=d||0;var h="";
  for(var i=0;i<list.length;i++){
    var c=list[i];
    h+='<div class="comment-box" style="padding-left:'+(d*16)+'px">';
    h+='<div class="comment-author">'+escR(c.author_name)+'</div>';
    h+='<div class="comment-time">'+((c.created_at||"").slice(0,16).replace("T"," "))+'</div>';
    h+='<div class="comment-text">'+escR(c.content)+'</div>';
    h+='<a class="reply-link" onclick="replyTo='+c.id+';document.getElementById(\\'comment-input\\').focus()">回复</a>';
    h+='</div>';
    if(c.replies&&c.replies.length) h+=rc(c.replies,d+1);
  }
  return h;
}

function toggleLike(){
  fetch("/api/likes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,fingerprint:fp})})
  .then(function(r){return r.json()}).then(function(){updateLikeState()});
}

function updateLikeState(){
  var b=document.getElementById("like-btn");
  fetch("/api/likes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,fingerprint:fp})})
  .then(function(r){return r.json()})
  .then(function(d){
    b.innerHTML=d.liked
      ?'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 已喜欢'
      :'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 喜欢';
    if(d.liked) b.classList.add("liked"); else b.classList.remove("liked");
  });
}

function escR(s){var d=document.createElement("div");d.textContent=s||"";return d.innerHTML}

/* Clock */
(function(){function u(){var n=new Date(),h=String(n.getHours()).padStart(2,'0'),m=String(n.getMinutes()).padStart(2,'0'),s=String(n.getSeconds()).padStart(2,'0');var el=document.getElementById('clock');if(el) el.textContent=h+':'+m+':'+s}u();setInterval(u,1e3)})();

/* Reading progress bar */
(function(){
  var bar=document.getElementById('reading-progress');
  if(!bar)return;
  var ticking=false;
  window.addEventListener('scroll',function(){
    if(!ticking){requestAnimationFrame(function(){var h=document.documentElement.scrollHeight-window.innerHeight;if(h>0)bar.style.width=Math.min(100,Math.round(window.scrollY/h*100))+'%';ticking=false});ticking=true}
  });
})();

/* Theme toggle */
var b=document.getElementById("theme-toggle"),st=localStorage.getItem("theme")||"light";
if(st==="dark") document.documentElement.setAttribute("data-theme","dark");
b.textContent=st==="dark"?"☀":"☽";
b.addEventListener("click",function(){
  var d=document.documentElement.getAttribute("data-theme")==="dark";
  if(d){document.documentElement.removeAttribute("data-theme");localStorage.setItem("theme","light");b.textContent="☽"}
  else{document.documentElement.setAttribute("data-theme","dark");localStorage.setItem("theme","dark");b.textContent="☀"}
});

/* Mobile menu */
var hamburger=document.getElementById("nav-hamburger");
var menu=document.getElementById("mobile-menu");
var closeBtn=document.getElementById("mobile-menu-close");
if(hamburger&&menu) hamburger.addEventListener("click",function(){menu.classList.add("active")});
if(closeBtn&&menu) closeBtn.addEventListener("click",function(){menu.classList.remove("active")});

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

function articleNavbar() {
  return `<nav class="navbar"><div class="nav-inner"><a href="/blog" class="nav-brand">Blog</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/blog" class="nav-link"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔记</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a></div></div>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function simpleMD(md) {
  var t = String(md || '');
  t = t.replace(/\\n/g, '\n');
  var cbs = [], i, j;
  while ((i = t.indexOf('```')) >= 0) {
    var start = i + 3;
    var nl = t.indexOf('\n', start);
    if (nl < 0) break;
    var lang = t.slice(start, nl).trim();
    var end = t.indexOf('\n```', nl);
    if (end < 0) { end = t.indexOf('```', nl + 1); if (end < 0) break; }
    var code = t.slice(nl + 1, end);
    cbs.push({l: lang, c: code});
    t = t.slice(0, i) + '__CB' + (cbs.length - 1) + '__' + t.slice(end + 4);
  }
  t = esc(t);
  for (var n = 0; n < cbs.length; n++) {
    var cb = cbs[n], l = esc(cb.l || 'text'), c = esc(cb.c);
    var html = '<div class="code-block-wrapper"><div class="code-block-bar" title="收起" onclick="toggleCB(this)">' +
      '<span class="code-block-lang">' + l + ' <span class="lang-arrow">⌵</span></span>' +
      '<span style="flex:1"></span>' +
      '<button class="code-block-btn btn-copy" data-a="copy" title="复制" onclick="event.stopPropagation();onCBBtn(event)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>' +
      '<button class="code-block-btn btn-fs" data-a="fullscreen" title="全屏" onclick="event.stopPropagation();onCBBtn(event)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>' +
      '</div><div class="cb-body"><pre><code>' + c + '</code></pre></div></div>';
    t = t.replace('__CB' + n + '__', html);
  }
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(?!\*)(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\n### (.+)/g, '\n<h3>$1</h3>');
  t = t.replace(/\n## (.+)/g, '\n<h2>$1</h2>');
  t = t.replace(/\n# (.+)/g, '\n<h1>$1</h1>');
  t = t.replace(/\n&gt; (.+)/g, '\n<blockquote>$1</blockquote>');
  t = t.replace(/\n---/g, '\n<hr>');
  var parts = t.split('\n\n'), out = '';
  for (var k = 0; k < parts.length; k++) {
    var p = parts[k].trim(); if (!p) continue;
    if (/^<(h[123]|div|blockquote|hr|li|img)/.test(p)) out += p;
    else out += '<p>' + p.replace(/\n/g, '<br>') + '</p>';
  }
  return out;
}
