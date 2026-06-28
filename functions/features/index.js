import { navbar, mobileMenu, cmdOverlay } from '../lib/navbar.js';
// 功能 页面 Edge SSR — Site Features
export async function onRequestGet(context) {
  try {
    const { env } = context;
    // Get article count, tag count, total views for stats
    const [statsRes, tagsRes] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count, COALESCE(SUM(views), 0) as total_views FROM articles WHERE is_published=1').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM tags').first()
    ]);

    var html = render(statsRes || { count: 0, total_views: 0 }, tagsRes || { count: 0 });
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { console.error('Features page error:', e); return new Response('服务器错误，请稍后再试', { status: 500 }); }
}

function render(stats, tags) {
  var features = [
    { icon: '📝', title: 'Markdown 博客', desc: '支持 Markdown 写作，代码高亮，目录导航，阅读时间估算' },
    { icon: '💬', title: '评论系统', desc: '支持嵌套回复，Gravatar 头像，管理员删除，防垃圾蜜罐' },
    { icon: '❤️', title: '点赞互动', desc: '基于浏览器指纹的点赞切换，防止重复点赞' },
    { icon: '🔍', title: '全文搜索', desc: '文章标题、摘要、内容、标签全文检索，关键词高亮' },
    { icon: '📋', title: '留言簿', desc: '访客留言板，支持昵称和网址，QQ 复古头像' },
    { icon: '📰', title: 'RSS 订阅', desc: 'RSS 2.0 订阅源，支持阅读器订阅最新文章' },
    { icon: '🗺️', title: '站点地图', desc: '自动生成 XML Sitemap，覆盖所有公开页面' },
    { icon: '⌨️', title: '命令面板', desc: 'Ctrl+K 快速导航，模糊搜索页面和文章' },
    { icon: '🌙', title: '暗色模式', desc: '一键切换明暗主题，偏好自动保存' },
    { icon: '📱', title: '移动适配', desc: '完全响应式设计，移动端友好' },
    { icon: '🖼️', title: '图片管理', desc: '后台图片上传，支持裁剪压缩，base64 存储' },
    { icon: '⏰', title: '定时发布', desc: '文章支持定时发布，到时间自动上线' },
    { icon: '🏷️', title: '标签分类', desc: '文章标签管理，按标签筛选文章' },
    { icon: '📊', title: '访问统计', desc: '每篇文章独立阅读计数，总览统计' },
    { icon: '🚀', title: 'CDN 加速', desc: 'Cloudflare Pages 全球 CDN，毫秒级响应' },
    { icon: '🔒', title: '安全防护', desc: 'XSS 转义，安全响应头，蜜罐防垃圾' }
  ];

  var cardsHtml = '';
  for (var i = 0; i < features.length; i++) {
    var f = features[i];
    cardsHtml += '<div class="feature-card animate-in" style="animation-delay:' + (i * 60) + 'ms">'
      + '<div class="feature-icon">' + f.icon + '</div>'
      + '<h3 class="feature-title">' + esc(f.title) + '</h3>'
      + '<p class="feature-desc">' + esc(f.desc) + '</p>'
      + '</div>';
  }

  var statsHtml = '<div class="feature-stats animate-in" style="animation-delay:0ms">'
    + '<div class="feature-stat"><span class="feature-stat-num">' + stats.count + '</span><span class="feature-stat-label">篇文章</span></div>'
    + '<div class="feature-stat"><span class="feature-stat-num">' + stats.total_views + '</span><span class="feature-stat-label">次阅读</span></div>'
    + '<div class="feature-stat"><span class="feature-stat-num">' + tags.count + '</span><span class="feature-stat-label">个标签</span></div>'
    + '</div>';

  var seo = '<meta name="description" content="网站功能一览 — 博客、评论、搜索、RSS、暗色模式等">'
    + '\n<meta property="og:type" content="website">'
    + '\n<meta property="og:title" content="功能">'
    + '\n<meta property="og:url" content="https://ayoow.pages.dev/features">'
    + '\n<link rel="canonical" href="https://ayoow.pages.dev/features">';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>功能</title>${seo}
<link rel="stylesheet" href="/style.css?v=4">
</head>
<body>
${navbar('功能', '/', '/features')}
${mobileMenu()}
<div class="page-wrapper">
  <div class="page-header animate-in">
    <h1 class="page-title">功能</h1>
    <p class="page-subtitle">这个网站能做什么</p>
  </div>
  <div class="content">
    ${statsHtml}
    <div class="feature-grid stagger">
      ${cardsHtml}
    </div>
  </div>
  <footer class="page-footer">
    <span class="footer-text"><a href="/">← 返回首页</a></span>
  </footer>
</div>
<script src="/app.js"></script>
${cmdOverlay()}
</body>
</html>`;
}


function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
