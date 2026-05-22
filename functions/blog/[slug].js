export async function onRequestGet(context) {
  try {
    const { env, params } = context;
    const slug = params.slug || new URL(context.request.url).pathname.replace('/blog/', '').replace(/\/$/, '');
    const a = await env.DB.prepare('SELECT * FROM articles WHERE slug=? AND is_published=1').bind(slug).first();
    if (!a) return new Response('Not found', { status: 404 });
    const l = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id=?').bind(a.id).first();
    return new Response(render(a, l.c), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { return new Response('Error', { status: 500 }); }
}

function render(a, likes) {
  var time = (a.created_at || '').replace('T', ' ').slice(0, 16);
  var tags = '', ts = (a.tags || '').split(',').filter(Boolean);
  for (var i = 0; i < ts.length; i++) tags += '<span class="blog-tag">#' + esc(ts[i].trim()) + '</span>';
  var md = JSON.stringify(a.content_md || '');

  return [
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + esc(a.title) + '</title><link rel="stylesheet" href="/style.css">',
    '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>',
    '</head><body>',
    '<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">' + esc(a.title) + '</a><div class="nav-spacer"></div><a href="/blog" class="nav-link">← 笔记</a></div></nav>',
    '<div class="article-wrapper"><article>',
    a.cover_image ? '<img src="' + esc(a.cover_image) + '" class="article-cover" alt="">' : '',
    '<header class="article-header"><h1 class="article-title">' + esc(a.title) + '</h1>',
    '<div class="article-meta"><span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ' + esc(a.author) + '</span><span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ' + time + '</span>' + tags + '<span>' + likes + ' 喜欢</span></div></header>',
    '<div class="article-body" id="content"></div>',
    '<div class="article-actions"><button class="btn-like" id="like-btn" onclick="toggleLike()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 喜欢</button></div>',
    '<section class="comment-section"><h3>评论 (<span id="cc">0</span>)</h3><div id="comments-area"></div>',
    '<textarea class="comment-input" id="comment-input" placeholder="写下想法..."></textarea>',
    '<input class="comment-input" id="comment-name" placeholder="昵称" style="min-height:auto;height:auto;margin-top:0.4rem;width:auto;min-width:160px;">',
    '<button class="btn-submit" onclick="postComment()">发表</button></section></article></div>',
    buildScript(a.id, md),
    '</body></html>'
  ].join('\n');
}

function buildScript(aid, md) {
  var BAR = '<span class="code-block-lang"></span>' +
    '<button class="code-block-btn" title="展开" onclick="var p=this.parentElement.parentElement.querySelector(\'pre\');p.classList.toggle(\'expanded\');var pl=this.querySelector(\'polyline\');if(pl)pl.setAttribute(\'points\',p.classList.contains(\'expanded\')?\'18 15 12 9 6 15\':\'6 9 12 15 18 9\')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>' +
    '<span style="flex:1"></span>' +
    '<button class="code-block-btn" title="复制" onclick="var c=this.parentElement.parentElement.querySelector(\'pre code\');if(c)navigator.clipboard.writeText(c.textContent)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>' +
    '<button class="code-block-btn" title="全屏" onclick="var w=this.parentElement.parentElement;w.classList.toggle(\'fullscreen\');var pre=w.querySelector(\'pre\');if(w.classList.contains(\'fullscreen\')){document.body.style.overflow=\'hidden\';if(!pre.querySelector(\'.line-numbers\')){var lines=pre.textContent.split(\'\\n\');var nums=\'\';var lc=0;for(var li=0;li<lines.length;li++){if(lines[li].trim()||li<lines.length-1)nums+=(++lc)+\'\\n\'}var ln=document.createElement(\'div\');ln.className=\'line-numbers\';ln.textContent=nums;pre.insertBefore(ln,pre.firstChild);pre.style.display=\'flex\';pre.style.alignItems=\'flex-start\'}}else{document.body.style.overflow=\'\'}function escFn(e){if(e.key===\'Escape\'){w.classList.remove(\'fullscreen\');document.body.style.overflow=\'\';document.removeEventListener(\'keydown\',escFn)}}document.addEventListener(\'keydown\',escFn)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>';

  return '<script>var aid=' + aid + ',fp=localStorage.getItem("fp")||(function(){var f="fp"+Date.now()+Math.random();localStorage.setItem("fp",f);return f;})(),replyTo=null;' +
    'function init(){if(typeof marked==="undefined"){setTimeout(init,100);return;}document.getElementById("content").innerHTML=marked.parse(' + md + ');enhanceCB();}init();loadComments();updateLikeState();' +
    'function enhanceCB(){var pres=document.querySelectorAll(".article-body pre");for(var i=0;i<pres.length;i++){var pre=pres[i];var code=pre.querySelector("code");var lang="";if(code){var m=(code.className||"").match(/language-(\\w+)/);if(m)lang=m[1];}var w=document.createElement("div");w.className="code-block-wrapper";var bar=document.createElement("div");bar.className="code-block-bar";bar.innerHTML=' + JSON.stringify(BAR) + ';bar.querySelector(".code-block-lang").textContent=lang||"text";pre.parentNode.insertBefore(w,pre);w.appendChild(bar);w.appendChild(pre)}}' +
    'function postComment(pid){var c=document.getElementById("comment-input").value.trim(),n=document.getElementById("comment-name").value.trim()||"匿名";if(!c)return;fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,parent_id:pid||null,author_name:n,content:c})}).then(function(r){return r.json()}).then(function(){document.getElementById("comment-input").value="";replyTo=null;loadComments()})}' +
    'function loadComments(){fetch("/api/comments?article_id="+aid).then(function(r){return r.json()}).then(function(cs){document.getElementById("cc").textContent=countAll(cs);document.getElementById("comments-area").innerHTML=rc(cs)})}' +
    'function countAll(list){var n=0;for(var i=0;i<list.length;i++){n++;if(list[i].replies)n+=countAll(list[i].replies)}return n}' +
    'function rc(list,d){d=d||0;var h="";for(var i=0;i<list.length;i++){var c=list[i];h+=' + JSON.stringify('<div class="comment-box" style="margin-left:IDXpx"><div style="display:flex;justify-content:space-between;margin-bottom:0.2rem"><strong style="font-size:0.85rem">NAME</strong><span style="font-size:0.72rem;color:var(--color-text-muted)">TIME</span></div><p style="font-size:0.9rem;color:var(--color-text-secondary);margin:0.2rem 0">BODY</p><a class="reply-link" onclick="replyTo=CID;document.getElementById(\'comment-input\').focus()">回复</a></div>') + '.replace("IDX",d*16).replace("NAME",esc(c.author_name)).replace("TIME",(c.created_at||"").slice(0,16).replace("T"," ")).replace("BODY",esc(c.content)).replace("CID",c.id);if(c.replies&&c.replies.length)h+=rc(c.replies,d+1)}return h}' +
    'function toggleLike(){fetch("/api/likes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,fingerprint:fp})}).then(function(r){return r.json()}).then(function(d){updateLikeState()})}' +
    'function updateLikeState(){var b=document.getElementById("like-btn");fetch("/api/likes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,fingerprint:fp})}).then(function(r){return r.json()}).then(function(d){b.innerHTML=d.liked?' + JSON.stringify('<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 已喜欢') + ':' + JSON.stringify('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 喜欢') + ';if(d.liked)b.classList.add("liked");else b.classList.remove("liked")})}' +
    'function esc(s){var d=document.createElement("div");d.textContent=s||"";return d.innerHTML}' +
    '<\/script>';
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
