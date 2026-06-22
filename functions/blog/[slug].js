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
    const prev = await env.DB.prepare("SELECT title, slug FROM articles WHERE is_published=1 AND id < ? AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY id DESC LIMIT 1").bind(a.id).first();
    const next = await env.DB.prepare("SELECT title, slug FROM articles WHERE is_published=1 AND id > ? AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY id ASC LIMIT 1").bind(a.id).first();
    var h = render(a, l.c, prev, next);
    return new Response(h, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { return new Response('Error: ' + e.message, { status: 500 }); }
}

function render(a, likes, prev, next) {
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
<link rel="stylesheet" href="/style.css?v=3">
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
          <div id="reply-hint" class="comment-reply-hint" style="display:none">
            <span id="reply-hint-text"></span>
            <button onclick="cancelReply()" class="reply-cancel-btn">取消回复</button>
          </div>
          <form id="comment-form" class="comment-form">
            <div class="comment-form-row">
              <input type="text" id="comment-name" class="comment-input" placeholder="昵称 *" required maxlength="20" style="flex:1;min-height:auto;height:auto;">
              <input type="email" id="comment-email" class="comment-input" placeholder="邮箱 *" required maxlength="100" style="flex:1;min-height:auto;height:auto;">
            </div>
            <input type="url" id="comment-url" class="comment-input" placeholder="个人网址 (选填)" maxlength="200" style="min-height:auto;height:auto;">
            <textarea id="comment-input" class="comment-input" placeholder="写下想法... (5-500字)" required maxlength="500" rows="3"></textarea>
            <input type="text" name="website" class="honeypot" tabindex="-1" autocomplete="off">
            <div id="comment-error" class="comment-form-error" style="display:none"></div>
            <button type="submit" class="btn-submit" id="comment-submit-btn">发表评论</button>
          </form>
          <div id="comments-area"></div>
        </section>
      </article>

      <!-- Sidebar TOC (desktop) -->
      <aside class="article-toc" id="article-toc">
        <div class="toc-topbar">
          <svg class="toc-topbar-icon" onclick="var t=document.getElementById('toc-list');t.classList.toggle('collapsed');this.classList.toggle('collapsed')" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
          <span class="toc-topbar-info" id="toc-info"></span>
          ${prev ? '<a class="toc-topbar-btn" href="/blog/' + esc(prev.slug) + '" title="' + esc(prev.title) + '" data-label="Previous post"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></a>' : '<span class="toc-topbar-btn disabled" data-label="Previous post"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span>'}
          ${next ? '<a class="toc-topbar-btn" href="/blog/' + esc(next.slug) + '" title="' + esc(next.title) + '" data-label="Next post"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></a>' : '<span class="toc-topbar-btn disabled" data-label="Next post"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></span>'}
          <button class="toc-topbar-btn" data-label="Back to top" onclick="window.scrollTo({top:0,behavior:'smooth'})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
        </div>
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
  var wr=bar.parentElement;if(wr.classList.contains("fullscreen"))return;
  var body=bar.nextElementSibling,folded=wr.classList.toggle("folded");
  body.classList.toggle("hidden",folded);
  var arrow=bar.querySelector(".lang-arrow");
  if(arrow) arrow.textContent=folded?"\\u203A":"\\u2335";
  bar.title=folded?"展开":"收起";
}

setTimeout(function(){document.getElementById("content").style.opacity="1"},3000);
init();
/* Remove animate-in after animation to prevent transform from breaking fixed positioning */
document.querySelectorAll('.animate-in').forEach(function(el){el.addEventListener('animationend',function(){el.classList.remove('animate-in');el.style.opacity='1'},{once:true})});
loadComments();
updateLikeState();

/* Comment form submission */
var _cForm=document.getElementById("comment-form");
if(_cForm){
  _cForm.addEventListener("submit",function(e){e.preventDefault();submitComment()});
  if(_cName)document.getElementById("comment-name").value=_cName;
  if(_cEmail)document.getElementById("comment-email").value=_cEmail;
}

/* TOC topbar hover info */
var tocInfo=document.getElementById("toc-info");
var tocBtns=document.querySelectorAll(".toc-topbar-btn");
for(var bi=0;bi<tocBtns.length;bi++){
  (function(btn){
    btn.addEventListener("mouseenter",function(){if(tocInfo)tocInfo.textContent=btn.dataset.label||""});
    btn.addEventListener("mouseleave",function(){if(tocInfo)tocInfo.textContent=""});
  })(tocBtns[bi]);
}

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
  var a=btn.dataset.a,w=btn.closest(".code-block-wrapper"),pre=w.querySelector("pre"),body=w.querySelector(".cb-body");
  if(a==="copy") navigator.clipboard.writeText(pre.textContent);
  if(a==="fullscreen"){
    var bar=w.querySelector(".code-block-bar"),arrow=bar?bar.querySelector(".lang-arrow"):null;
    if(!w.classList.contains("fullscreen")){
      /* entering fullscreen */
      w._wasFolded=w.classList.contains("folded");
      w.classList.remove("folded");
      body.classList.remove("hidden");
      if(arrow) arrow.textContent="⌵";
      if(bar) bar.title="收起";
      w.classList.add("fullscreen");
      document.body.style.overflow="hidden";
      if(!pre.querySelector(".line-numbers")){
        var lines=pre.textContent.split("\\n"),nums="",lc=0;
        for(var li=0;li<lines.length;li++){if(lines[li].trim()||li<lines.length-1)nums+=(++lc)+"\\n"}
        var ln=document.createElement("div");ln.className="line-numbers";ln.textContent=nums;
        pre.insertBefore(ln,pre.firstChild);
      }
    }else{
      /* exiting fullscreen */
      w.classList.remove("fullscreen");
      document.body.style.overflow="";
      pre.style.display="";
      if(w._wasFolded){
        w.classList.add("folded");
        body.classList.add("hidden");
        if(arrow) arrow.textContent="›";
        if(bar) bar.title="展开";
      }
      delete w._wasFolded;
    }
  }
}

function submitComment(){
  var form=document.getElementById("comment-form");
  var hp=form.elements['website'];
  if(hp&&hp.value) return false;
  var n=(document.getElementById("comment-name").value||"").trim();
  var em=(document.getElementById("comment-email").value||"").trim().toLowerCase();
  var u=(document.getElementById("comment-url").value||"").trim();
  var c=(document.getElementById("comment-input").value||"").trim();
  var errEl=document.getElementById("comment-error");
  var btn=document.getElementById("comment-submit-btn");
  errEl.style.display="none";
  if(!n||!em||!c){showCommentError("请填写昵称、邮箱和评论内容");return false;}
  btn.disabled=true;btn.textContent="发布中...";
  fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,parent_id:replyTo,author_name:n,email:em,url:u,content:c})})
  .then(function(r){if(!r.ok)return r.json().then(function(d){throw new Error(d.error||"提交失败")});return r.json()})
  .then(function(){document.getElementById("comment-input").value="";cancelReply();try{localStorage.setItem("comment_email",em);localStorage.setItem("comment_name",n)}catch(e){}_cEmail=em;_cName=n;loadComments();showCommentSuccess()})
  .catch(function(err){showCommentError(err.message||"提交失败，请稍后再试")})
  .finally(function(){btn.disabled=false;btn.textContent="发表评论"});
  return false;
}

function showCommentError(msg){
  var el=document.getElementById("comment-error");el.textContent=msg;el.style.display="block";el.style.color="var(--danger)";
}
function showCommentSuccess(){
  var el=document.getElementById("comment-error");el.textContent="评论发布成功！";el.style.display="block";el.style.color="var(--success)";
  setTimeout(function(){el.style.display="none"},3000);
}
function cancelReply(){replyTo=null;var h=document.getElementById("reply-hint");if(h)h.style.display="none";}
function startReply(id,name){replyTo=id;var h=document.getElementById("reply-hint"),t=document.getElementById("reply-hint-text");if(h&&t){t.textContent="回复 "+name+":";h.style.display="flex";}document.getElementById("comment-input").focus();}

function loadComments(page){
  page=page||1;
  fetch("/api/comments?article_id="+aid+"&page="+page+"&limit=20").then(function(r){return r.json()}).then(function(d){
    document.getElementById("cc").textContent=d.total||0;
    var area=document.getElementById("comments-area");
    if(page===1) area.innerHTML="";
    if(!d.total&&page===1){area.innerHTML='<div class="comment-empty">还没有评论，来抢沙发吧</div>';return;}
    var html=rc(d.comments||[]);
    if(d.hasMore) html+='<div class="comment-load-more"><button class="btn-submit" onclick="loadComments('+(page+1)+')">加载更多评论</button></div>';
    area.insertAdjacentHTML('beforeend',html);
    checkAdmin();
  }).catch(function(){});
}

function rc(list,d){
  d=d||0;var h="";
  for(var i=0;i<list.length;i++){
    var c=list[i];
    var avatar=c.avatar_url||"https://www.gravatar.com/avatar?d=mp&s=48";
    if(avatar.indexOf("gravatar.com/avatar?")>0&&_cEmail&&c.author_name===_cName){avatar=gravatar(_cEmail);}
    var nameHtml=c.url
      ?'<a href="'+escR(c.url)+'" target="_blank" rel="noopener noreferrer" class="comment-author">'+escR(c.author_name)+'</a>'
      :'<span class="comment-author">'+escR(c.author_name)+'</span>';
    var time=((c.created_at||"").slice(0,16).replace("T"," "));
    h+='<div class="comment-box'+(d?' comment-children':'')+'">';
    h+='<div class="comment-header">';
    h+='<img class="comment-avatar" src="'+avatar+'" alt="" loading="lazy" onerror="this.src=&quot;https://www.gravatar.com/avatar?d=mp&amp;s=48&quot;">';
    h+='<div class="comment-header-info">';
    h+=nameHtml;
    h+='<span class="comment-time">'+time+'</span>';
    h+='</div>';
    h+='<button class="comment-delete-btn" data-id="'+c.id+'" onclick="deleteComment('+c.id+')" title="删除" style="display:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
    h+='</div>';
    h+='<div class="comment-text">'+escR(c.content).replace(/\\n/g,"<br>")+'</div>';
    h+='<a class="reply-link" onclick="startReply('+c.id+',&apos;'+escR(c.author_name).replace(/'/g,"&apos;")+'&apos;)">回复</a>';
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

function md5c(s){function L(k,d){return(k<<d)|(k>>>(32-d))}function K(G,k){var I,d,F,H,x;F=(G&2147483648);H=(k&2147483648);I=(G&1073741824);d=(k&1073741824);x=(G&1073741823)+(k&1073741823);if(I&d)return(x^2147483648^F^H);if(I|d){if(x&1073741824)return(x^3221225472^F^H);else return(x^1073741824^F^H)}else return(x^F^H)}function r(d,F,k){return(d&F)|((~d)&k)}function q(d,F,k){return(d&k)|(F&(~k))}function p(d,F,k){return(d^F^k)}function n(d,F,k){return(F^(d|(~k)))}function u(G,F,aa,Z,k,H,I){G=K(G,K(K(r(F,aa,Z),k),I));return K(L(G,H),F)}function f(G,F,aa,Z,k,H,I){G=K(G,K(K(q(F,aa,Z),k),I));return K(L(G,H),F)}function D(G,F,aa,Z,k,H,I){G=K(G,K(K(p(F,aa,Z),k),I));return K(L(G,H),F)}function t(G,F,aa,Z,k,H,I){G=K(G,K(K(n(F,aa,Z),k),I));return K(L(G,H),F)}function e(G){var Z;var F=G.length;var x=F+8;var k=(x-(x%64))/64;var I=(k+1)*16;var aa=Array(I-1);var d=0;var H=0;while(H<F){Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=(aa[Z]|(G.charCodeAt(H)<<d));H++}Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=aa[Z]|(128<<d);aa[I-2]=F<<3;aa[I-1]=F>>>29;return aa}function B(x){var k="",F="",G,d;for(d=0;d<=3;d++){G=(x>>>(d*8))&255;F="0"+G.toString(16);k=k+F.substr(F.length-2,2)}return k}var C=[],P,h,E,v,g,Y,X,W,V,S=7,Q=12,N=17,M=22,A=5,z=9,y=14,w=20,i=4,o=11,m=16,j=23,U=6,T=10,R=15,O=21;s=e(s);Y=1732584193;X=4023233417;W=2562383102;V=271733878;for(P=0;P<s.length;P+=16){h=Y;E=X;v=W;g=V;Y=u(Y,X,W,V,s[P],S,3614090360);V=u(V,Y,X,W,s[P+1],Q,3905402710);W=u(W,V,Y,X,s[P+2],N,606105819);X=u(X,W,V,Y,s[P+3],M,3250441966);Y=u(Y,X,W,V,s[P+4],S,4118548399);V=u(V,Y,X,W,s[P+5],Q,1200080426);W=u(W,V,Y,X,s[P+6],N,2821735955);X=u(X,W,V,Y,s[P+7],M,4249261313);Y=u(Y,X,W,V,s[P+8],S,1770035416);V=u(V,Y,X,W,s[P+9],Q,2336552879);W=u(W,V,Y,X,s[P+10],N,4294925233);X=u(X,W,V,Y,s[P+11],M,2304563134);Y=u(Y,X,W,V,s[P+12],S,1804603682);V=u(V,Y,X,W,s[P+13],Q,4254626195);W=u(W,V,Y,X,s[P+14],N,2792965006);X=u(X,W,V,Y,s[P+15],M,1236535329);Y=f(Y,X,W,V,s[P+1],A,4129170786);V=f(V,Y,X,W,s[P+6],z,3225465664);W=f(W,V,Y,X,s[P+11],y,643717713);X=f(X,W,V,Y,s[P],w,3921069994);Y=f(Y,X,W,V,s[P+5],A,3593408605);V=f(V,Y,X,W,s[P+10],z,38016083);W=f(W,V,Y,X,s[P+15],y,3634488961);X=f(X,W,V,Y,s[P+4],w,3889429448);Y=f(Y,X,W,V,s[P+9],A,568446438);V=f(V,Y,X,W,s[P+14],z,3275163606);W=f(W,V,Y,X,s[P+3],y,4107603335);X=f(X,W,V,Y,s[P+8],w,1163531501);Y=f(Y,X,W,V,s[P+13],A,2850285829);V=f(V,Y,X,W,s[P+2],z,4243563512);W=f(W,V,Y,X,s[P+7],y,1735328473);X=f(X,W,V,Y,s[P+12],w,2368359562);Y=D(Y,X,W,V,s[P+5],i,4294588738);V=D(V,Y,X,W,s[P+8],o,2272392833);W=D(W,V,Y,X,s[P+11],m,1839030562);X=D(X,W,V,Y,s[P+14],j,4259657740);Y=D(Y,X,W,V,s[P+1],i,2763975236);V=D(V,Y,X,W,s[P+4],o,1272893353);W=D(W,V,Y,X,s[P+7],m,4139469664);X=D(X,W,V,Y,s[P+10],j,3200236656);Y=D(Y,X,W,V,s[P+13],i,681279174);V=D(V,Y,X,W,s[P],o,3936430074);W=D(W,V,Y,X,s[P+3],m,3572445317);X=D(X,W,V,Y,s[P+6],j,76029189);Y=D(Y,X,W,V,s[P+9],i,3654602809);V=D(V,Y,X,W,s[P+12],o,3873151461);W=D(W,V,Y,X,s[P+15],m,530742520);X=D(X,W,V,Y,s[P+2],j,3299628645);Y=t(Y,X,W,V,s[P],U,4096336452);V=t(V,Y,X,W,s[P+7],T,1126891415);W=t(W,V,Y,X,s[P+14],R,2878612391);X=t(X,W,V,Y,s[P+5],O,4237533241);Y=t(Y,X,W,V,s[P+12],U,1700485571);V=t(V,Y,X,W,s[P+3],T,2399980690);W=t(W,V,Y,X,s[P+10],R,4293915773);X=t(X,W,V,Y,s[P+1],O,2240044497);Y=t(Y,X,W,V,s[P+8],U,1873313359);V=t(V,Y,X,W,s[P+15],T,4264355552);W=t(W,V,Y,X,s[P+6],R,2734768916);X=t(X,W,V,Y,s[P+13],O,1309151649);Y=t(Y,X,W,V,s[P+4],U,4149444226);V=t(V,Y,X,W,s[P+11],T,3174756917);W=t(W,V,Y,X,s[P+2],R,718787259);X=t(X,W,V,Y,s[P+9],O,3951481745);Y=K(Y,h);X=K(X,E);W=K(W,v);V=K(V,g)}return(B(Y)+B(X)+B(W)+B(V)).toLowerCase()}
function gravatar(email){if(!email)return"https://www.gravatar.com/avatar?d=mp&s=48";return"https://www.gravatar.com/avatar/"+md5c(email.trim().toLowerCase())+"?d=mp&s=48";}
var _cEmail=(function(){try{return localStorage.getItem("comment_email")||""}catch(e){return""}})();
var _cName=(function(){try{return localStorage.getItem("comment_name")||""}catch(e){return""}})();
var _isAdmin=null;
function checkAdmin(){
  if(_isAdmin===false) return;
  var token=localStorage.getItem("admin_token");
  if(!token){_isAdmin=false;return;}
  if(_isAdmin===true){
    document.querySelectorAll(".comment-delete-btn").forEach(function(b){b.style.display="inline-flex"});
    return;
  }
  fetch("/api/auth",{headers:{"Authorization":"Bearer "+token}}).then(function(r){return r.json()}).then(function(d){
    if(d.ok){_isAdmin=true;document.querySelectorAll(".comment-delete-btn").forEach(function(b){b.style.display="inline-flex"})}
    else{_isAdmin=false;}
  }).catch(function(){});
}

function deleteComment(id){
  if(!confirm("确定删除这条评论及其所有回复？")) return;
  var token=localStorage.getItem("admin_token");
  fetch("/api/comments/"+id,{method:"DELETE",headers:{"Authorization":"Bearer "+token}})
  .then(function(r){if(!r.ok)throw new Error("fail");return r.json()})
  .then(function(){commentPage=1;loadComments(1)})
  .catch(function(){alert("删除失败")});
}

/* Clock */
(function(){function u(){var n=new Date(),h=String(n.getHours()).padStart(2,'0'),m=String(n.getMinutes()).padStart(2,'0'),s=String(n.getSeconds()).padStart(2,'0');var el=document.getElementById('clock');if(el) el.textContent=h+':'+m+':'+s}u();setInterval(u,1e3)})();
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

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
  return `<nav class="navbar"><div class="nav-inner"><a href="/blog" class="nav-brand">Blog</a><div class="nav-links"><a href="/" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>首页</a><a href="/blog" class="nav-link"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔记</a><a href="/search" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>搜索</a><a href="/archive" class="nav-link"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>归档</a><a href="/now" class="nav-link"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Now</a><a href="/guestbook" class="nav-link"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>留言簿</a></div><div class="nav-spacer"></div><span class="nav-clock" id="clock">--:--:--</span><button class="theme-toggle" id="theme-toggle" aria-label="切换主题">☽</button><button class="nav-hamburger" id="nav-hamburger" aria-label="菜单"><svg viewBox="0 0 24 24"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg></button></div></nav>
<div class="mobile-menu" id="mobile-menu"><button class="mobile-menu-close" id="mobile-menu-close"><svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button><div class="mobile-menu-links"><a href="/" class="mobile-menu-link">首页</a><a href="/blog" class="mobile-menu-link">笔记</a><a href="/search" class="mobile-menu-link">搜索</a><a href="/archive" class="mobile-menu-link">归档</a><a href="/now" class="mobile-menu-link">Now</a><a href="/guestbook" class="mobile-menu-link">留言簿</a></div></div>`;
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
