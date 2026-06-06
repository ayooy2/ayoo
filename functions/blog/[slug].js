export async function onRequestGet(context) {
  try {
    const { env, params } = context;
    const slug = params.slug || new URL(context.request.url).pathname.replace('/blog/', '').replace(/\/$/, '');
    const a = await env.DB.prepare("SELECT * FROM articles WHERE slug=? AND is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))").bind(slug).first();
    if (!a) return new Response('Not found', { status: 404 });
    const l = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id=?').bind(a.id).first();
    var h = render(a, l.c);
    return new Response(h, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { return new Response('Error', { status: 500 }); }
}

function render(a, likes) {
  var time = (a.created_at || '').replace('T', ' ').slice(0, 16);
  var tags = '', ts = (a.tags || '').split(',').filter(Boolean);
  for (var i = 0; i < ts.length; i++) tags += '<span class="blog-tag">#' + esc(ts[i].trim()) + '</span>';
  var md = JSON.stringify(a.content_md || '');

  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + esc(a.title) + '</title><link rel="stylesheet" href="/style.css"><\/head><body>' +
    '<nav class="navbar"><div class="nav-inner"><a href="/" class="nav-brand">' + esc(a.title) + '</a><div class="nav-spacer"></div><a href="/blog" class="nav-link">笔记</a></div></nav>' +
    '<div class="article-wrapper"><article>' +
    (a.cover_image ? '<img src="' + esc(a.cover_image) + '" class="article-cover" alt="">' : '') +
    '<header class="article-header"><h1 class="article-title">' + esc(a.title) + '</h1>' +
    '<div class="article-meta"><span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ' + esc(a.author) + '</span><span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:2px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ' + time + '</span>' + tags + '<span>' + likes + ' 喜欢</span></div></header>' +
    '<div class="article-body" id="content">' + simpleMD(a.content_md || '') + '</div>' +
    '<div class="article-actions"><button class="btn-like" id="like-btn" onclick="toggleLike()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 喜欢</button></div>' +
    '<section class="comment-section"><h3>评论 (<span id="cc">0</span>)</h3><div id="comments-area"></div>' +
    '<textarea class="comment-input" id="comment-input" placeholder="写下想法..."></textarea>' +
    '<input class="comment-input" id="comment-name" placeholder="昵称" style="min-height:auto;height:auto;margin-top:0.4rem;width:auto;min-width:160px;">' +
    '<button class="btn-submit" onclick="postComment()">发表</button></section></article></div>' +
    '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>' +
    '<script>var aid=' + a.id + ',fp=localStorage.getItem("fp")||(function(){var f="fp"+Date.now()+Math.random();localStorage.setItem("fp",f);return f;})(),replyTo=null;' +
    'function init(){if(typeof marked=="undefined"){setTimeout(init,100);return;}var raw=' + md + '.replace(/\\\\n/g,"\\n");document.getElementById("content").innerHTML=marked.parse(raw);wrapCB();}' +
    'function toggleCB(bar){var body=bar.nextElementSibling,wr=bar.parentElement,folded=wr.classList.toggle(\'folded\');body.classList.toggle(\'hidden\',folded);var arrow=bar.querySelector(\'.lang-arrow\');if(arrow)arrow.textContent=folded?\'\\u203A\':\'\\u2335\';bar.title=folded?\'展开\':\'收起\'}' +
    'setTimeout(function(){document.getElementById("content").style.opacity="1"},3000);init();loadComments();updateLikeState();' +
    'function barHTML(l){return' + JSON.stringify('<span class="code-block-lang">X ⌵</span><span style="flex:1"></span><button class="code-block-btn btn-copy" data-a="copy" title="复制" onclick="event.stopPropagation()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button><button class="code-block-btn btn-fs" data-a="fullscreen" title="全屏" onclick="event.stopPropagation()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>') + '.replace("X",l)}' +
    'function wrapCB(){var pres=document.querySelectorAll("#content pre:not(.code-block-wrapper pre)");for(var i=0;i<pres.length;i++){var pre=pres[i],code=pre.querySelector("code"),lang="";if(code){var m=(code.className||"").match(/language-(\\w+)/);if(m)lang=m[1];}var w=document.createElement("div");w.className="code-block-wrapper";var bar=document.createElement("div");bar.className="code-block-bar";bar.innerHTML=barHTML(lang||"text");bar.setAttribute("onclick","toggleCB(this)");bar.title="收起";var body=document.createElement("div");body.className="cb-body";pre.parentNode.insertBefore(w,pre);w.appendChild(bar);body.appendChild(pre);w.appendChild(body)}}' +
    'document.addEventListener("DOMContentLoaded",function(){document.getElementById("content").addEventListener("click",onCBBtn)});' +
    'function onCBBtn(e){var btn=e.target.closest(".code-block-btn");if(!btn)return;var a=btn.dataset.a,w=btn.closest(".code-block-wrapper"),pre=w.querySelector("pre");if(a==="copy")navigator.clipboard.writeText(pre.textContent);if(a==="fullscreen"){w.classList.toggle("fullscreen");if(w.classList.contains("fullscreen")){document.body.style.overflow="hidden";if(!pre.querySelector(".line-numbers")){var lines=pre.textContent.split("\\n"),nums="",lc=0;for(var li=0;li<lines.length;li++){if(lines[li].trim()||li<lines.length-1)nums+=(++lc)+"\\n"}var ln=document.createElement("div");ln.className="line-numbers";ln.textContent=nums;pre.insertBefore(ln,pre.firstChild);pre.style.display="flex"}}else{document.body.style.overflow=""}}}' +
    'var _posting=0;function postComment(pid){if(_posting)return;var c=document.getElementById("comment-input").value.trim(),n=document.getElementById("comment-name").value.trim()||"匿名";if(!c)return;_posting=1;var btn=document.querySelector(".btn-submit");if(btn)btn.disabled=true;fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,parent_id:pid||null,author_name:n,content:c})}).then(function(r){return r.json()}).then(function(){document.getElementById("comment-input").value="";replyTo=null;loadComments()}).finally(function(){_posting=0;if(btn)btn.disabled=false})}' +
    'function loadComments(){fetch("/api/comments?article_id="+aid).then(function(r){return r.json()}).then(function(cs){document.getElementById("cc").textContent=countAll(cs);document.getElementById("comments-area").innerHTML=rc(cs)})}' +
    'function countAll(list){var n=0;for(var i=0;i<list.length;i++){n++;if(list[i].replies)n+=countAll(list[i].replies)}return n}' +
    'function rc(list,d){d=d||0;var h="";for(var i=0;i<list.length;i++){var c=list[i];h+=' + JSON.stringify('<div class="comment-box" style="margin-left:IDXpx"><div style="display:flex;justify-content:space-between;margin-bottom:0.2rem"><strong style="font-size:0.85rem">NAME</strong><span style="font-size:0.72rem;color:var(--color-text-muted)">TIME</span></div><p style="font-size:0.9rem;color:var(--color-text-secondary);margin:0.2rem 0">BODY</p><a class="reply-link" onclick="replyTo=CID;document.getElementById(\'comment-input\').focus()">回复</a></div>') + '.replace("IDX",d*16).replace("NAME",escR(c.author_name)).replace("TIME",(c.created_at||"").slice(0,16).replace("T"," ")).replace("BODY",escR(c.content)).replace("CID",c.id);if(c.replies&&c.replies.length)h+=rc(c.replies,d+1)}return h}' +
    'function toggleLike(){fetch("/api/likes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,fingerprint:fp})}).then(function(r){return r.json()}).then(function(d){updateLikeState()})}' +
    'function updateLikeState(){var b=document.getElementById("like-btn");fetch("/api/likes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,fingerprint:fp})}).then(function(r){return r.json()}).then(function(d){b.innerHTML=d.liked?' + JSON.stringify('<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 已喜欢') + ':' + JSON.stringify('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 喜欢') + ';if(d.liked)b.classList.add("liked");else b.classList.remove("liked")})}' +
    'function escR(s){var d=document.createElement("div");d.textContent=s||"";return d.innerHTML}' +
    '<\/script></body></html>';
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function simpleMD(md) {
  var t = String(md || '');
  // Convert literal \n to actual newlines
  t = t.replace(/\\n/g, '\n');
  var cbs = [], i, j;
  // Manually extract code blocks
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
  // Restore code blocks
  for (var n = 0; n < cbs.length; n++) {
    var cb = cbs[n], l = esc(cb.l || 'text'), c = esc(cb.c);
    var html = '<div class="code-block-wrapper"><div class="code-block-bar" title="收起" onclick="toggleCB(this)">' +
'<span class="code-block-lang">' + l + ' <span class="lang-arrow">⌵</span></span>' +
      '<span style="flex:1"></span>' +
      '<button class="code-block-btn btn-copy" data-a="copy" title="复制" onclick="event.stopPropagation()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>' +
      '<button class="code-block-btn btn-fs" data-a="fullscreen" title="全屏" onclick="event.stopPropagation()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>' +
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
