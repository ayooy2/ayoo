import { navbar, mobileMenu, cmdOverlay } from '../lib/navbar.js';
import { esc } from '../lib/sanitize.js';
// 关于我 页面 Edge SSR
export async function onRequestGet(context) {
  try {
    const { env } = context;
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM settings WHERE key IN ('about_title','about_content','about_avatar','title','subtitle')"
    ).all();
    var settings = {};
    for (var i = 0; i < (results || []).length; i++) {
      settings[results[i].key] = results[i].value;
    }

    var html = render(settings);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { console.error('About page error:', e); return new Response('服务器错误，请稍后再试', { status: 500 }); }
}

function render(s) {
  var title = esc(s.about_title || '关于我');
  var content = s.about_content || '';
  var avatar = esc(s.about_avatar || '');
  var siteTitle = esc(s.title || 'Ayoo');

  // Simple markdown to HTML (client-side marked.js will enhance)
  // 先转义 HTML 再做 markdown 转换，防止 XSS（marked.js 会覆盖此内容）
  var contentHtml = esc(content)
    .replace(/\\n/g, '\n')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  contentHtml = '<p>' + contentHtml + '</p>';

  // 校验 avatar URL 协议白名单
  var avatarHtml = '';
  if (avatar && /^https?:\/\//i.test(avatar)) {
    avatarHtml = '<div class="about-avatar"><img src="' + avatar + '" alt="avatar"></div>';
  }

  var seo = '<meta name="description" content="关于 ' + siteTitle + ' — 个人简介">'
    + '\n<meta property="og:type" content="profile">'
    + '\n<meta property="og:title" content="' + title + '">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev/about">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev/about">';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>${seo}
<link rel="stylesheet" href="/style.css?v=6">
<link rel="stylesheet" href="/toolbar.css?v=6">
</head>
<body>
${navbar('关于', '/', '/about')}
${mobileMenu()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">${title}</h1>
  </div>
  <div class="content">
    <div class="about-container animate-in" style="animation-delay:100ms">
      ${avatarHtml}
      <div class="article-body about-body" id="about-content">
        ${contentHtml}
      </div>
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/" data-zh="← 返回首页" data-en="← Back to Home">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js" defer></script>
<script src="/sanitize.js"></script>
<script>
(function(){
  var raw = ${JSON.stringify(content).replace(/\//g, '\\/')};
  if(raw && window.marked){
    var el = document.getElementById('about-content');
    if(el) el.innerHTML = sanitizeMD(marked.parse(raw.replace(/\\\\n/g, '\\n')));
  }
  if(!window.marked){
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js';
    s.onload = function(){
      var raw2 = ${JSON.stringify(content).replace(/\//g, '\\/')};
      if(raw2){
        var el2 = document.getElementById('about-content');
        if(el2) el2.innerHTML = sanitizeMD(marked.parse(raw2.replace(/\\\\n/g, '\\n')));
      }
    };
    document.head.appendChild(s);
  }
})();
</script>
<script src="/toolbar.js" defer></script>
${cmdOverlay()}
</body>
</html>`;
}



