/**
 * blog-detail.js — 博客详情页客户端逻辑
 * 功能：Markdown 渲染、代码块折叠/复制/全屏、评论系统、点赞、TOC、阅读进度
 * 依赖：sanitize.js（sanitizeMD）、marked.min.js（CDN）、highlight.min.js（CDN）
 * 数据来源：#content 元素的 data-aid 和 data-md 属性
 */

(function(){
var aid=0,md='',fp='',replyTo=null,_isAdmin=null,_likePending=false;

function escR(s){var d=document.createElement("div");d.textContent=s||"";return d.innerHTML}
function safeUrl(u){if(!u)return'';var t=u.replace(/^[\s\x00]+/,'');if(/^javascript:|^data:|^vbscript:/i.test(t))return'#';return u}

/* ── 初始化 ── */
function init(){
  var el=document.getElementById("content");
  if(el){aid=parseInt(el.dataset.aid)||0;md=el.dataset.md||''}
  fp=localStorage.getItem("fp_"+aid)||(function(){var f="fp"+Date.now()+Math.random();localStorage.setItem("fp_"+aid,f);return f;})();

  if(typeof marked=="undefined"){setTimeout(init,100);return;}
  try{
    var raw=md.replace(/\\n/g,"\n");
    document.getElementById("content").innerHTML=sanitizeMD(marked.parse(raw));
    document.querySelectorAll("#content img").forEach(function(img){
      img.addEventListener("error",function(){this.alt="图片加载失败";this.style.opacity="0.5";this.style.maxWidth="200px";this.onerror=null;},{once:true});
    });
    function tryHighlight(){
      if(typeof hljs!=="undefined"){
        document.querySelectorAll("#content pre code").forEach(function(block){hljs.highlightElement(block);});
      } else { setTimeout(tryHighlight, 100); }
    }
    tryHighlight();
    wrapCB();
    buildTOC();
  }catch(e){console.error("marked.parse failed:",e);}
}

/* ── TOC ── */
function buildTOC(){
  var c=document.getElementById("content"),hs=c.querySelectorAll("h2,h3");
  if(hs.length<2) return;
  var items=[];
  for(var i=0;i<hs.length;i++){var h=hs[i],id="h-"+i;h.id=id;items.push({level:h.tagName,id:id,text:h.textContent});}
  var tocList=document.getElementById("toc-list");
  if(tocList){var html='';for(var i=0;i<items.length;i++){var it=items[i];var cls=it.level==="H3"?"toc-item toc-h3":"toc-item";html+='<li class="'+cls+'"><a href="#'+it.id+'" data-target="'+it.id+'">'+escTOC(it.text)+'</a></li>';}tocList.innerHTML=html;}
  if(items.length>=2) initScrollSpy(items);
}
function escTOC(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}
function initScrollSpy(items){
  var tocLinks=document.querySelectorAll("#toc-list a"),headingEls=[];
  for(var i=0;i<items.length;i++){var el=document.getElementById(items[i].id);if(el)headingEls.push(el);}
  if(!headingEls.length) return;
  var activeIdx=-1;
  function updateActive(){var scrollY=window.scrollY+100,newIdx=0;for(var i=0;i<headingEls.length;i++){if(headingEls[i].offsetTop<=scrollY)newIdx=i;}if(newIdx!==activeIdx){activeIdx=newIdx;for(var i=0;i<tocLinks.length;i++){tocLinks[i].classList.toggle("active",i===activeIdx);}}}
  var ticking=false;window.addEventListener("scroll",function(){if(!ticking){requestAnimationFrame(function(){updateActive();ticking=false});ticking=true;}});updateActive();
}

/* ── 代码块 ── */
function toggleCB(bar){
  var wr=bar.parentElement;if(wr.classList.contains("fullscreen"))return;
  var body=bar.nextElementSibling,folded=wr.classList.toggle("folded");
  body.classList.toggle("hidden",folded);
  var arrow=bar.querySelector(".lang-arrow");
  if(arrow) arrow.textContent=folded?"›":"⌵";
  bar.title=folded?"展开":"收起";
}
function barHTML(l){
  return '<span class="code-block-lang">X <span class="lang-arrow">⌵</span></span><span style="flex:1"></span><button class="code-block-btn btn-copy" data-a="copy" title="复制" onclick="event.stopPropagation();onCBBtn(event)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button><button class="code-block-btn btn-fs" data-a="fullscreen" title="全屏" onclick="event.stopPropagation();onCBBtn(event)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>'.replace("X",l);
}
function wrapCB(){
  var pres=document.querySelectorAll("#content pre:not(.code-block-wrapper pre)");
  for(var i=0;i<pres.length;i++){
    var pre=pres[i],code=pre.querySelector("code"),lang="";
    if(code){var m=(code.className||"").match(/language-(\w+)/);if(m)lang=m[1];}
    var w=document.createElement("div");w.className="code-block-wrapper";
    var bar=document.createElement("div");bar.className="code-block-bar";
    bar.innerHTML=barHTML(lang||"text");bar.setAttribute("onclick","toggleCB(this)");bar.title="收起";
    var body=document.createElement("div");body.className="cb-body";
    pre.parentNode.insertBefore(w,pre);w.appendChild(bar);body.appendChild(pre);w.appendChild(body);
  }
  var vids=document.querySelectorAll("#content video:not(.video-wrapper video)");
  for(var i=0;i<vids.length;i++){var v=vids[i];if(!v.closest(".video-wrapper")){var w=document.createElement("div");w.className="video-wrapper";v.parentNode.insertBefore(w,v);w.appendChild(v);}}
  var auds=document.querySelectorAll("#content audio:not(.audio-wrapper audio)");
  for(var i=0;i<auds.length;i++){var a=auds[i];if(!a.closest(".audio-wrapper")){var w=document.createElement("div");w.className="audio-wrapper";a.parentNode.insertBefore(w,a);w.appendChild(a);}}
}
function onCBBtn(e){
  var btn=e.target.closest(".code-block-btn");if(!btn)return;
  var a=btn.dataset.a,w=btn.closest(".code-block-wrapper"),pre=w.querySelector("pre"),body=w.querySelector(".cb-body");
  if(a==="copy"){
    navigator.clipboard.writeText(pre.textContent);
    var orig=btn.innerHTML;
    btn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    btn.style.color="var(--success,#10b981)";
    setTimeout(function(){btn.innerHTML=orig;btn.style.color=""},2e3);
  }
  if(a==="fullscreen"){
    var bar=w.querySelector(".code-block-bar"),arrow=bar?bar.querySelector(".lang-arrow"):null;
    if(!w.classList.contains("fullscreen")){
      w._wasFolded=w.classList.contains("folded");w.classList.remove("folded");body.classList.remove("hidden");
      if(arrow)arrow.textContent="⌵";if(bar)bar.title="收起";
      w.classList.add("fullscreen");document.body.style.overflow="hidden";
      if(!pre.querySelector(".line-numbers")){
        var lines=pre.textContent.split("\n"),nums="",lc=0;
        for(var li=0;li<lines.length;li++){if(lines[li].trim()||li<lines.length-1)nums+=(++lc)+"\n"}
        var ln=document.createElement("div");ln.className="line-numbers";ln.textContent=nums;pre.insertBefore(ln,pre.firstChild);
      }
      if(bar&&!bar.querySelector(".cb-close-btn")){
        var closeBtn=document.createElement("button");closeBtn.className="cb-close-btn";closeBtn.title="退出全屏";
        closeBtn.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        closeBtn.onclick=function(e){e.stopPropagation();onCBBtn(e)};closeBtn.setAttribute("data-a","fullscreen");bar.appendChild(closeBtn);
      }
    }else{
      w.classList.remove("fullscreen");document.body.style.overflow="";pre.style.display="";
      if(w._wasFolded){w.classList.add("folded");body.classList.add("hidden");if(arrow)arrow.textContent="›";if(bar)bar.title="展开";}
      delete w._wasFolded;
      var closeBtn=bar?bar.querySelector(".cb-close-btn"):null;if(closeBtn)closeBtn.remove();
    }
  }
}

/* ── 评论系统 ── */
function submitComment(){
  var form=document.getElementById("comment-form");
  var hp=form.elements['website'];if(hp&&hp.value)return false;
  var n=(document.getElementById("comment-name").value||"").trim();
  var em=(document.getElementById("comment-email").value||"").trim().toLowerCase();
  var u=(document.getElementById("comment-url").value||"").trim();
  var c=(document.getElementById("comment-input").value||"").trim();
  var errEl=document.getElementById("comment-error"),btn=document.getElementById("comment-submit-btn");
  errEl.style.display="none";
  if(!n||!em||!c){showCommentError("请填写昵称、邮箱和评论内容");return false;}
  btn.disabled=true;btn.textContent="发布中...";
  fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,parent_id:replyTo,author_name:n,email:em,url:u,content:c})})
  .then(function(r){if(!r.ok)return r.json().then(function(d){throw new Error(d.error||"提交失败")});return r.json()})
  .then(function(){document.getElementById("comment-input").value="";cancelReply();try{localStorage.setItem("comment_email",em);localStorage.setItem("comment_name",n)}catch(e){}loadComments();showCommentSuccess()})
  .catch(function(err){showCommentError(err.message||"提交失败，请稍后再试")})
  .finally(function(){btn.disabled=false;btn.textContent="发表评论"});
  return false;
}
function showCommentError(msg){var el=document.getElementById("comment-error");el.textContent=msg;el.style.display="block";el.style.color="var(--danger)";}
function showCommentSuccess(){var el=document.getElementById("comment-error");el.textContent="评论发布成功！";el.style.display="block";el.style.color="var(--success)";setTimeout(function(){el.style.display="none"},3000);}
function cancelReply(){replyTo=null;var h=document.getElementById("reply-hint");if(h)h.style.display="none";}
function startReply(id,name){replyTo=id;var h=document.getElementById("reply-hint"),t=document.getElementById("reply-hint-text");if(h&&t){t.textContent="回复 "+name+":";h.style.display="flex";}document.getElementById("comment-input").focus();}
function loadComments(page){
  page=page||1;
  fetch("/api/comments?article_id="+aid+"&page="+page+"&limit=20").then(function(r){return r.json()}).then(function(d){
    document.getElementById("cc").textContent=d.total||0;
    var area=document.getElementById("comments-area");
    if(page===1)area.innerHTML="";
    if(!d.total&&page===1){area.innerHTML='<div class="comment-empty">还没有评论，来抢沙发吧</div>';return;}
    var html=rc(d.comments||[]);
    if(d.hasMore)html+='<div class="comment-load-more"><button class="btn-submit" onclick="loadComments('+(page+1)+')">加载更多评论</button></div>';
    area.insertAdjacentHTML('beforeend',html);checkAdmin();
  }).catch(function(){});
}
function retroAv(seed){var h=0,s=String(seed);for(var i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return"https://q1.qlogo.cn/g?b=qq&nk="+(Math.abs(h)%90000+10000)+"&s=100";}
function rc(list,d){
  d=d||0;var h="";var _cEmail='',_cName='';try{_cEmail=localStorage.getItem("comment_email")||"";_cName=localStorage.getItem("comment_name")||""}catch(e){}
  for(var i=0;i<list.length;i++){
    var c=list[i];var avatarHash=c.avatar_hash||"";if(!avatarHash&&_cEmail&&c.author_name===_cName){avatarHash=md5c(_cEmail.trim().toLowerCase());}
    var avatar=retroAv(avatarHash||c.author_name||"default");
    var nameHtml=c.url?'<a href="'+escR(safeUrl(c.url))+'" target="_blank" rel="noopener noreferrer" class="comment-author">'+escR(c.author_name)+'</a>':'<span class="comment-author">'+escR(c.author_name)+'</span>';
    var time=((c.created_at||"").slice(0,16).replace("T"," "));
    h+='<div class="comment-box'+(d?' comment-children':'')+'"><div class="comment-header"><img class="comment-avatar" src="'+avatar+'" alt="" loading="lazy"><div class="comment-header-info">'+nameHtml+'<span class="comment-time">'+time+'</span></div><button class="comment-delete-btn" data-id="'+c.id+'" onclick="deleteComment('+c.id+')" title="删除" style="display:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></div><div class="comment-text">'+escR(c.content).replace(/\\n/g,"<br>")+'</div><a class="reply-link" data-reply-id="'+c.id+'" data-reply-name="'+escR(c.author_name)+'">回复</a></div>';
    if(c.replies&&c.replies.length)h+=rc(c.replies,d+1);
  }
  return h;
}

/* ── 点赞 ── */
function toggleLike(){
  if(_likePending)return;_likePending=true;
  var b=document.getElementById("like-btn");if(b)b.disabled=true;
  fetch("/api/likes",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({article_id:aid,fingerprint:fp})})
  .then(function(r){return r.json()}).then(function(d){updateLikeState();var lc=document.getElementById("like-count");if(lc&&d.likes!==undefined)lc.textContent=d.likes;}).catch(function(){}).finally(function(){_likePending=false;if(b)b.disabled=false;});
}
function updateLikeState(){
  var b=document.getElementById("like-btn");
  fetch("/api/likes?article_id="+encodeURIComponent(aid)+"&fingerprint="+encodeURIComponent(fp),{credentials:"same-origin"})
  .then(function(r){return r.json()})
  .then(function(d){
    b.innerHTML=d.liked
      ?'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 已喜欢'
      :'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> 喜欢';
    if(d.liked)b.classList.add("liked");else b.classList.remove("liked");
  }).catch(function(){});
}

/* ── MD5（Gravatar） ── */
function md5c(s){function L(k,d){return(k<<d)|(k>>>(32-d))}function K(G,k){var I,d,F,H,x;F=(G&2147483648);H=(k&2147483648);I=(G&1073741824);d=(k&1073741824);x=(G&1073741823)+(k&1073741823);if(I&d)return(x^2147483648^F^H);if(I|d){if(x&1073741824)return(x^3221225472^F^H);else return(x^1073741824^F^H)}else return(x^F^H)}function r(d,F,k){return(d&F)|((~d)&k)}function q(d,F,k){return(d&k)|(F&(~k))}function p(d,F,k){return(d^F^k)}function n(d,F,k){return(F^(d|(~k)))}function u(G,F,aa,Z,k,H,I){G=K(G,K(K(r(F,aa,Z),k),I));return K(L(G,H),F)}function f(G,F,aa,Z,k,H,I){G=K(G,K(K(q(F,aa,Z),k),I));return K(L(G,H),F)}function D(G,F,aa,Z,k,H,I){G=K(G,K(K(p(F,aa,Z),k),I));return K(L(G,H),F)}function t(G,F,aa,Z,k,H,I){G=K(G,K(K(n(F,aa,Z),k),I));return K(L(G,H),F)}function e(G){var Z;var F=G.length;var x=F+8;var k=(x-(x%64))/64;var I=(k+1)*16;var aa=Array(I-1);var d=0;var H=0;while(H<F){Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=(aa[Z]|(G.charCodeAt(H)<<d));H++}Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=aa[Z]|(128<<d);aa[I-2]=F<<3;aa[I-1]=F>>>29;return aa}function B(x){var k="",F="",G,d;for(d=0;d<=3;d++){G=(x>>>(d*8))&255;F="0"+G.toString(16);k=k+F.substr(F.length-2,2)}return k}var C=[],P,h,E,v,g,Y,X,W,V,S=7,Q=12,N=17,M=22,A=5,z=9,y=14,w=20,i=4,o=11,m=16,j=23,U=6,T=10,R=15,O=21;s=e(s);Y=1732584193;X=4023233417;W=2562383102;V=271733878;for(P=0;P<s.length;P+=16){h=Y;E=X;v=W;g=V;Y=u(Y,X,W,V,s[P],S,3614090360);V=u(V,Y,X,W,s[P+1],Q,3905402710);W=u(W,V,Y,X,s[P+2],N,606105819);X=u(X,W,V,Y,s[P+3],M,3250441966);Y=u(Y,X,W,V,s[P+4],S,4118548399);V=u(V,Y,X,W,s[P+5],Q,1200080426);W=u(W,V,Y,X,s[P+6],N,2821735955);X=u(X,W,V,Y,s[P+7],M,4249261313);Y=u(Y,X,W,V,s[P+8],S,1770035416);V=u(V,Y,X,W,s[P+9],Q,2336552879);W=u(W,V,Y,X,s[P+10],N,4294925233);X=u(X,W,V,Y,s[P+11],M,2304563134);Y=u(Y,X,W,V,s[P+12],S,1804603682);V=u(V,Y,X,W,s[P+13],Q,4254626195);W=u(W,V,Y,X,s[P+14],N,2792965006);X=u(X,W,V,Y,s[P+15],M,1236535329);Y=f(Y,X,W,V,s[P+1],A,4129170786);V=f(V,Y,X,W,s[P+6],z,3225465664);W=f(W,V,Y,X,s[P+11],y,643717713);X=f(X,W,V,Y,s[P],w,3921069994);Y=f(Y,X,W,V,s[P+5],A,3593408605);V=f(V,Y,X,W,s[P+10],z,38016083);W=f(W,V,Y,X,s[P+15],y,3634488961);X=f(X,W,V,Y,s[P+4],w,3889429448);Y=f(Y,X,W,V,s[P+9],A,568446438);V=f(V,Y,X,W,s[P+14],z,3275163606);W=f(W,V,Y,X,s[P+3],y,4107603335);X=f(X,W,V,Y,s[P+8],w,1163531501);Y=f(Y,X,W,V,s[P+13],A,2850285829);V=f(V,Y,X,W,s[P+2],z,4243563512);W=f(W,V,Y,X,s[P+7],y,1735328473);X=f(X,W,V,Y,s[P+12],w,2368359562);Y=D(Y,X,W,V,s[P+5],i,4294588738);V=D(V,Y,X,W,s[P+8],o,2272392833);W=D(W,V,Y,X,s[P+11],m,1839030562);X=D(X,W,V,Y,s[P+14],j,4259657740);Y=D(Y,X,W,V,s[P+1],i,2763975236);V=D(V,Y,X,W,s[P+4],o,1272893353);W=D(W,V,Y,X,s[P+7],m,4139469664);X=D(X,W,V,Y,s[P+10],j,3200236656);Y=D(Y,X,W,V,s[P+13],i,681279174);V=D(V,Y,X,W,s[P],o,3936430074);W=D(W,V,Y,X,s[P+3],m,3572445317);X=D(X,W,V,Y,s[P+6],j,76029189);Y=D(Y,X,W,V,s[P+9],i,3654602809);V=D(V,Y,X,W,s[P+12],o,3873151461);W=D(W,V,Y,X,s[P+15],m,530742520);X=D(X,W,V,Y,s[P+2],j,3299628645);Y=t(Y,X,W,V,s[P],U,4096336452);V=t(V,Y,X,W,s[P+7],T,1126891415);W=t(W,V,Y,X,s[P+14],R,2878612391);X=t(X,W,V,Y,s[P+5],O,4237533241);Y=t(Y,X,W,V,s[P+12],U,1700485571);V=t(V,Y,X,W,s[P+3],T,2399980690);W=t(W,V,Y,X,s[P+10],R,4293915773);X=t(X,W,V,Y,s[P+1],O,2240044497);Y=t(Y,X,W,V,s[P+8],U,1873313359);V=t(V,Y,X,W,s[P+15],T,4264355552);W=t(W,V,Y,X,s[P+6],R,2734768916);X=t(X,W,V,Y,s[P+13],O,1309151649);Y=t(Y,X,W,V,s[P+4],U,4149444226);V=t(V,Y,X,W,s[P+11],T,3174756917);W=t(W,V,Y,X,s[P+2],R,718787259);X=t(X,W,V,Y,s[P+9],O,3951481745);Y=K(Y,h);X=K(X,E);W=K(W,v);V=K(V,g)}return(B(Y)+B(X)+B(W)+B(V)).toLowerCase()}

/* ── 管理员 ── */
function checkAdmin(){
  if(_isAdmin===false)return;
  if(_isAdmin===true){document.querySelectorAll(".comment-delete-btn").forEach(function(b){b.style.display="inline-flex"});return;}
  fetch("/api/auth",{credentials:"same-origin"}).then(function(r){return r.json()}).then(function(d){
    if(d.ok){_isAdmin=true;document.querySelectorAll(".comment-delete-btn").forEach(function(b){b.style.display="inline-flex"})}else{_isAdmin=false;}
  }).catch(function(){_isAdmin=false;});
}
function deleteComment(id){
  if(!confirm("确定删除这条评论及其所有回复？"))return;
  fetch("/api/comments/"+id,{method:"DELETE",credentials:"same-origin"})
  .then(function(r){if(!r.ok)throw new Error("fail");return r.json()})
  .then(function(){loadComments(1)})
  .catch(function(){alert("删除失败")});
}

/* ── 阅读进度条 ── */
function initProgressBar(){
  var bar=document.getElementById('reading-progress');if(!bar)return;
  var ticking=false;
  window.addEventListener('scroll',function(){
    if(!ticking){requestAnimationFrame(function(){var h=document.documentElement.scrollHeight-window.innerHeight;if(h>0)bar.style.width=Math.min(100,Math.round(window.scrollY/h*100))+'%';ticking=false});ticking=true}
  });
}

/* ── 启动 ── */
document.addEventListener("DOMContentLoaded",function(){
  init();
  loadComments();
  updateLikeState();
  initProgressBar();

  var _cForm=document.getElementById("comment-form");
  if(_cForm){
    _cForm.addEventListener("submit",function(e){e.preventDefault();submitComment()});
    try{var _cEmail=localStorage.getItem("comment_email")||"";var _cName=localStorage.getItem("comment_name")||"";if(_cName)document.getElementById("comment-name").value=_cName;if(_cEmail)document.getElementById("comment-email").value=_cEmail;}catch(e){}
    var _cInput=document.getElementById("comment-input"),_cCounter=document.getElementById("comment-counter");
    if(_cInput&&_cCounter){_cInput.addEventListener("input",function(){var len=_cInput.value.length;_cCounter.textContent=len+"/500";_cCounter.style.color=len>480?"var(--danger,#ef4444)":"var(--text-secondary)";});}
  }
  document.getElementById("content").addEventListener("click",onCBBtn);
  document.addEventListener("click",function(e){var link=e.target.closest(".reply-link");if(link)startReply(parseInt(link.dataset.replyId),link.dataset.replyName);});
  document.querySelectorAll('.animate-in').forEach(function(el){el.addEventListener('animationend',function(){el.classList.remove('animate-in');el.style.opacity='1'},{once:true})});
});

})();
