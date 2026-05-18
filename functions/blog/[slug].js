export async function onRequestGet(context) {
  try {
    const { env, params } = context;
    const url = new URL(context.request.url);
    const slug = params.slug || url.pathname.replace('/blog/', '').replace(/\/$/, '');

    const article = await env.DB.prepare(
      'SELECT * FROM articles WHERE slug = ? AND is_published = 1'
    ).bind(slug).first();
    if (!article) return new Response('Not found', { status: 404 });

    const lRes = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id=?').bind(article.id).first();
    const likes = lRes.c;

    const html = renderArticle(article, likes);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) {
    return new Response('Internal error: ' + e.message, { status: 500 });
  }
}

function renderArticle(a, likes) {
  var time = (a.created_at || '').replace('T', ' ').slice(0, 16);
  var tagsHtml = '';
  var tags = (a.tags || '').split(',').filter(Boolean);
  for (var ti = 0; ti < tags.length; ti++) {
    tagsHtml += '<span style="display:inline-block;background:var(--color-primary-light);color:var(--color-primary);padding:0.15rem 0.5rem;border-radius:10px;font-size:0.75rem;margin-right:0.4rem;">' + esc(tags[ti].trim()) + '</span>';
  }

  var mdEscaped = JSON.stringify(a.content_md || '');

  var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + esc(a.title) + '</title><link rel="stylesheet" href="/style.css">';
  html += '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>';
  html += '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css">';
  html += '<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/highlight.min.js"><\/script>';
  html += '<style>';
  html += '.article-wrapper{max-width:800px;margin:0 auto;padding:5rem 1.5rem 2rem;}';
  html += '.article-content{line-height:1.8;font-size:1rem;color:var(--color-text);}';
  html += '.article-content h1{font-size:1.8rem;margin:1.5rem 0 0.8rem;}';
  html += '.article-content h2{font-size:1.4rem;margin:1.3rem 0 0.6rem;padding-bottom:0.3rem;border-bottom:1px solid var(--color-border);}';
  html += '.article-content h3{font-size:1.15rem;margin:1rem 0 0.4rem;}';
  html += '.article-content p{margin:0.6rem 0;}';
  html += '.article-content pre{background:var(--color-bg);border-radius:12px;padding:1rem;overflow-x:auto;margin:0.8rem 0;border:1px solid var(--color-border);}';
  html += '.article-content code{font-family:var(--font-mono);font-size:0.85rem;}';
  html += '.article-content p code{background:var(--color-primary-light);padding:0.15rem 0.4rem;border-radius:4px;color:var(--color-primary);}';
  html += '.article-content pre code{background:none;padding:0;color:var(--color-text);}';
  html += '.article-content table{width:100%;border-collapse:collapse;margin:0.8rem 0;}';
  html += '.article-content th,.article-content td{border:1px solid var(--color-border);padding:0.5rem 0.8rem;text-align:left;}';
  html += '.article-content th{background:var(--color-bg-subtle);font-weight:600;}';
  html += '.article-content img{max-width:100%;border-radius:12px;margin:0.5rem 0;}';
  html += '.article-content blockquote{border-left:3px solid var(--color-primary);padding:0.5rem 1rem;margin:0.8rem 0;background:var(--color-primary-light);border-radius:0 8px 8px 0;color:var(--color-text-secondary);}';
  html += '.article-content ul,.article-content ol{padding-left:1.5rem;margin:0.5rem 0;}';
  html += '.article-content li{margin:0.2rem 0;}';
  html += '.article-content a{color:var(--color-primary);}';
  html += '.article-content hr{border:none;border-top:1px solid var(--color-border);margin:1.5rem 0;}';
  html += '.comment-box{background:var(--color-glass-bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:var(--radius-xl);padding:1.2rem;border:1px solid var(--color-glass-border);margin-top:0.8rem;}';
  html += '.comment-input{width:100%;padding:0.6rem 0.8rem;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-bg);color:var(--color-text);font-size:0.9rem;font-family:inherit;resize:vertical;min-height:60px;}';
  html += '.comment-input:focus{outline:none;border-color:var(--color-primary);}';
  html += '.btn-submit{padding:0.4rem 1rem;background:var(--color-primary);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:0.85rem;margin-top:0.5rem;}';
  html += '.btn-submit:hover{background:var(--color-primary-hover);}';
  html += '.btn-like{background:none;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:0.3rem 0.8rem;cursor:pointer;font-size:0.85rem;color:var(--color-text-secondary);transition:all 0.2s;}';
  html += '.btn-like:hover{border-color:var(--color-primary);color:var(--color-primary);}';
  html += '.btn-like.liked{background:var(--color-primary);color:#fff;border-color:var(--color-primary);}';
  html += '.reply-link{font-size:0.78rem;color:var(--color-primary);cursor:pointer;margin-left:0.5rem;text-decoration:none;}';
  html += '.reply-link:hover{text-decoration:underline;}';
  html += '.meta-line{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;font-size:0.85rem;color:var(--color-text-placeholder);margin:0.8rem 0 1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--color-border);}';
  html += '</style></head><body>';
  html += '<nav class="navbar"><div class="nav-inner"><a href="/" style="text-decoration:none;"><span class="nav-brand">' + esc(a.title) + '</span></a><div class="nav-spacer"></div><a href="/blog" style="color:var(--color-text-muted);text-decoration:none;font-size:0.9rem;">← 博客列表</a></div></nav>';
  html += '<div class="article-wrapper">';
  if (a.cover_image) html += '<img src="' + esc(a.cover_image) + '" style="width:100%;max-height:300px;object-fit:cover;border-radius:16px;margin-bottom:1rem;" alt="">';
  html += '<h1 style="font-size:2rem;margin-bottom:0.3rem;color:var(--color-text);">' + esc(a.title) + '</h1>';
  html += '<div class="meta-line"><span>👤 ' + esc(a.author) + '</span><span>📅 ' + time + '</span>' + tagsHtml + '<span>❤ <span id="like-count">' + likes + '</span></span></div>';
  html += '<div class="article-content" id="content"></div>';
  html += '<div style="margin:1.5rem 0;display:flex;align-items:center;gap:0.5rem;">';
  html += '<button class="btn-like" id="like-btn" onclick="toggleLike()">❤ 点赞</button>';
  html += '<span style="font-size:0.85rem;color:var(--color-text-muted);" id="like-text"></span>';
  html += '</div>';
  html += '<h3 style="margin:2rem 0 1rem;color:var(--color-text);">评论 (<span id="comment-count">0</span>)</h3>';
  html += '<div id="comments-area"></div>';
  html += '<div class="comment-box"><textarea class="comment-input" id="comment-input" placeholder="写下你的评论..."></textarea>';
  html += '<input class="comment-input" id="comment-name" placeholder="昵称（可选）" style="min-height:auto;height:auto;margin-top:0.4rem;">';
  html += '<button class="btn-submit" onclick="postComment()">发表评论</button></div>';
  html += '</div>';
  html += '<script>';
  html += 'var articleId = ' + a.id + ';';
  html += 'var fp = localStorage.getItem("fp") || (function(){var f="fp"+Date.now()+Math.random();localStorage.setItem("fp",f);return f;})();';
  html += 'var liked = false; var replyTo = null;';
  html += 'function initPage(){';
  html += 'if(typeof marked!=="undefined"&&typeof hljs!=="undefined"){marked.setOptions({highlight:function(code,lang){if(lang&&hljs.getLanguage(lang)){return hljs.highlight(code,{language:lang}).value;}return code;}});document.getElementById("content").innerHTML=marked.parse(' + mdEscaped + ');}else{setTimeout(initPage,100);}';
  html += '}';
  html += 'initPage();loadComments();updateLikeState();';
  html += 'function postComment(parentId){var content=document.getElementById("comment-input").value.trim();var name=document.getElementById("comment-name").value.trim()||"匿名";if(!content)return;var body=JSON.stringify({article_id:articleId,parent_id:parentId||null,author_name:name,content:content});fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:body}).then(function(r){return r.json();}).then(function(){document.getElementById("comment-input").value="";replyTo=null;updateReplyHint();loadComments();});}';
  html += 'function loadComments(){fetch("/api/comments?article_id="+articleId).then(function(r){return r.json();}).then(function(comments){document.getElementById("comment-count").textContent=countAll(comments);document.getElementById("comments-area").innerHTML=renderComments(comments);});}';
  html += 'function countAll(list){var n=0;for(var i=0;i<list.length;i++){n++;if(list[i].replies)n+=countAll(list[i].replies);}return n;}';
  html += 'function rc(list,depth){depth=depth||0;var h="";for(var i=0;i<list.length;i++){var c=list[i];h+=' + JSON.stringify('<div class="comment-box" style="margin-left:IDXpx;margin-bottom:0.5rem;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;"><strong style="font-size:0.9rem;color:var(--color-text);">NAME</strong><span style="font-size:0.75rem;color:var(--color-text-placeholder);">TIME</span></div><p style="font-size:0.9rem;color:var(--color-text-secondary);margin:0.3rem 0;">BODY</p><a class="reply-link" onclick="replyTo=CID;updateReplyHint();document.getElementById(\'comment-input\').focus();">回复</a></div>') + '.replace("IDX",depth*20).replace("NAME",esc(c.author_name)).replace("TIME",(c.created_at||"").slice(0,16).replace("T"," ")).replace("BODY",esc(c.content)).replace("CID",c.id);if(c.replies&&c.replies.length)h+=rc(c.replies,depth+1);}return h;}';
  html += 'function updateReplyHint(){document.getElementById("comment-input").placeholder=replyTo?"回复评论 #"+replyTo+"...":"写下你的评论...";}';
  html += 'function toggleLike(){fetch("/api/likes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:articleId,fingerprint:fp})}).then(function(r){return r.json();}).then(function(d){document.getElementById("like-count").textContent=d.likes;liked=d.liked;updateLikeState();});}';
  html += 'function updateLikeState(){var btn=document.getElementById("like-btn");fetch("/api/likes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:articleId,fingerprint:fp})}).then(function(r){return r.json();}).then(function(d){liked=d.liked;btn.textContent=liked?"❤ 已赞":"❤ 点赞";if(liked)btn.classList.add("liked");else btn.classList.remove("liked");});}';
  html += 'function esc(s){var d=document.createElement("div");d.textContent=s||"";return d.innerHTML;}';
  html += '<\/script></body></html>';

  return html;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
