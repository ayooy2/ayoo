/**
 * 文章详情 SSR
 * 功能：渲染博客文章（Markdown→HTML、评论、点赞、TOC、面包屑导航）
 * 依赖：navbar.js、sanitize.js、response.js
 * 核心入口：onRequestGet()
 * 客户端：评论提交/加载、点赞、管理员功能、代码块折叠/复制/全屏
 */
import { navbar, mobileMenu, cmdOverlay } from '../lib/navbar.js';
import { esc, safeUrl } from '../lib/sanitize.js';
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
  } catch (e) { console.error('Blog detail error:', e); return new Response('服务器错误，请稍后再试', { status: 500 }); }
}

function render(a, likes, prev, next) {
  var time = (a.created_at || '').replace('T', ' ').slice(0, 16);
  var tags = '', ts = (a.tags || '').split(',').filter(Boolean);
  for (var i = 0; i < ts.length; i++) tags += '<span class="tag">#' + esc(ts[i].trim()) + '</span>';
  var md = JSON.stringify(a.content_md || '');
  var desc = esc(a.summary || (a.content_md || '').replace(/[#*`\[\]()!>|-]/g, '').replace(/\\n/g, ' ').trim().slice(0, 160));
  var kw = ts.map(function(t){ return esc(t.trim()); }).join(',');
  var url = 'https://ayoow.pages.dev/blog/' + esc(a.slug);
  var rawImg = a.cover_image || '';
  if (/^javascript:|^data:|^vbscript:/i.test(rawImg)) rawImg = '';
  var img = rawImg ? esc(rawImg) : '';

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
<link rel="stylesheet" href="/style.css?v=6">
<link rel="stylesheet" href="/toolbar.css?v=6">
</head>
<body>
<div class="reading-progress" id="reading-progress"></div>
${navbar('Blog', '/blog', '')}
${mobileMenu()}
<div class="page-wrapper">
  <div class="content">

    <!-- Breadcrumb -->
    <div class="article-top-bar animate-in">
      <a href="/blog"><svg viewBox="0 0 24 24"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> Blog</a>
      <span class="article-breadcrumb-sep">/</span>
      <span style="color:var(--text-primary)">${esc(a.title)}</span>
    </div>

    <!-- Article Layout: Content + Sidebar TOC -->
    <div class="article-layout">

      <!-- Main Content -->
      <article class="article-wrapper animate-in" style="animation-delay:100ms">
        <header class="article-header">
          ${rawImg ? '<img src="' + img + '" class="article-cover" alt="" onerror="this.remove()">' : ''}
          <h1 class="article-title">${esc(a.title)}</h1>
          <div class="article-meta">
            <span class="article-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${esc(a.author)}</span>
            <span class="article-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${time}</span>
            <span class="article-meta-item">${a.views || 0} 阅读</span>
            <span class="article-meta-item">${readTime} 分钟</span>
          </div>
          ${tags ? '<div class="article-tags">' + tags + '</div>' : ''}
        </header>

        <div class="article-body" id="content" data-aid="${a.id||0}" data-md=${JSON.stringify(a.content_md || '')}>${simpleMD(a.content_md || '')}</div>

        <div class="article-actions">
          <button class="btn-like" id="like-btn" onclick="toggleLike()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> <span data-zh="喜欢" data-en="Like">喜欢</span> <span id="like-count">${likes}</span>
          </button>
        </div>

        <section class="comment-section">
          <h3><span data-zh="评论" data-en="Comments">评论</span> (<span id="cc">0</span>)</h3>
          <div id="reply-hint" class="comment-reply-hint" style="display:none">
            <span id="reply-hint-text"></span>
            <button onclick="cancelReply()" class="reply-cancel-btn" data-zh="取消回复" data-en="Cancel reply">取消回复</button>
          </div>
          <form id="comment-form" class="comment-form">
            <div class="comment-form-row">
              <input type="text" id="comment-name" class="comment-input" placeholder="昵称 *" required maxlength="20" style="flex:1;min-height:auto;height:auto;">
              <input type="email" id="comment-email" class="comment-input" placeholder="邮箱 *" required maxlength="100" style="flex:1;min-height:auto;height:auto;">
            </div>
            <input type="url" id="comment-url" class="comment-input" placeholder="个人网址 (选填)" maxlength="200" style="min-height:auto;height:auto;">
            <textarea id="comment-input" class="comment-input" placeholder="写下想法... (5-500字)" required maxlength="500" rows="3"></textarea>
            <div id="comment-counter" style="text-align:right;font-size:.75rem;color:var(--text-secondary);margin-top:-0.5rem;">0/500</div>
            <input type="text" name="website" class="honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div id="comment-error" class="comment-form-error" style="display:none"></div>
            <button type="submit" class="btn-submit" id="comment-submit-btn">发表评论</button>
          </form>
          <div id="comments-area"></div>
        </section>
      </article>

      <!-- Mobile prev/next navigation -->
      <nav class="mobile-post-nav">
        ${prev ? '<a class="mobile-post-nav-item prev" href="/blog/' + esc(prev.slug) + '"><span class="mobile-post-nav-label" data-zh="← 上一篇" data-en="← Previous">← 上一篇</span><span class="mobile-post-nav-title">' + esc(prev.title) + '</span></a>' : '<div class="mobile-post-nav-item prev disabled"></div>'}
        ${next ? '<a class="mobile-post-nav-item next" href="/blog/' + esc(next.slug) + '"><span class="mobile-post-nav-label" data-zh="下一篇 →" data-en="Next →">下一篇 →</span><span class="mobile-post-nav-title">' + esc(next.title) + '</span></a>' : '<div class="mobile-post-nav-item next disabled"></div>'}
      </nav>

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
    <span class="footer-text"><a href="/blog" data-zh="← 返回笔记" data-en="← Back to Blog">← 返回笔记</a></span>
  </footer>
</div>

<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css" id="hljs-theme">
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js" async></script>
<script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js" async></script>
<script src="/sanitize.js" defer></script>
<script src="/blog-detail.js" defer></script>
<script src="/app.js" defer></script>
<script src="/toolbar.js" defer></script>
${cmdOverlay()}
</body>
</html>`;
}


function sanitizeIframe(html) {
  var m = html.match(/src="([^"]+)"/);
  if (!m) return '';
  var src = m[1];
  // 严格校验域名：只允许 google.com 及其子域名
  var isGoogleMaps = false;
  try {
    var u = new URL(src);
    var h = u.hostname;
    isGoogleMaps = (h === 'google.com' || h === 'www.google.com' || h.endsWith('.google.com') || h === 'maps.app.goo.gl');
  } catch(e) {}
  if (!isGoogleMaps) return '';
  var safeSrc = src.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return '<div class="iframe-wrapper"><iframe src="' + safeSrc +
    '" width="600" height="450" style="border:0" allowfullscreen loading="lazy" ' +
    'sandbox="allow-scripts allow-same-origin allow-popups" referrerpolicy="no-referrer"></iframe></div>';
}

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

  // 提取原始 HTML 标签（video/audio/iframe），防止被 esc() 转义
  var mFrames = [], match;
  var mediaRe = /<(video|audio|iframe)([\s\S]*?)<\/\1>/gi;
  while ((match = mediaRe.exec(t)) !== null) {
    var tag = match[1].toLowerCase();
    var raw = match[0];
    var safe = '';
    if (tag === 'video') {
      var src = (raw.match(/src="([^"]+)"/i) || [])[1] || '';
      if (src && !/^javascript:|^data:|^vbscript:/i.test(src)) {
        var poster = (raw.match(/poster="([^"]+)"/i) || [])[1] || '';
        safe = '<div class="video-wrapper"><video src="' + esc(src) + '" controls' +
          (poster ? ' poster="' + esc(poster) + '"' : '') + '></video></div>';
      }
    } else if (tag === 'audio') {
      var src = (raw.match(/src="([^"]+)"/i) || [])[1] || '';
      if (src && !/^javascript:|^data:|^vbscript:/i.test(src)) {
        safe = '<div class="audio-wrapper"><audio src="' + esc(src) + '" controls></audio></div>';
      }
    } else if (tag === 'iframe') {
      safe = sanitizeIframe(raw);
    }
    if (safe) {
      mFrames.push(safe);
      t = t.replace(raw, '__MF' + (mFrames.length - 1) + '__');
      mediaRe.lastIndex = 0; // 重置索引，因为文本已被修改
    }
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
    var cbPlaceholder = '__CB' + n + '__';
    var cbIdx = t.indexOf(cbPlaceholder);
    if (cbIdx !== -1) {
      t = t.substring(0, cbIdx) + html + t.substring(cbIdx + cbPlaceholder.length);
    }
  }

  // 还原媒体标签占位符（用 substring 避免 $ 模式问题）
  for (var mi = 0; mi < mFrames.length; mi++) {
    var mfPlaceholder = '__MF' + mi + '__';
    var mfIdx = t.indexOf(mfPlaceholder);
    if (mfIdx !== -1) {
      t = t.substring(0, mfIdx) + mFrames[mi] + t.substring(mfIdx + mfPlaceholder.length);
    }
  }

  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(?!\*)(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/!\[video\]\(([^)]+)\)/gi, function(m, src) {
    if (/^javascript:|^data:|^vbscript:/i.test(src)) return m;
    return '<div class="video-wrapper"><video src="' + esc(src) + '" controls></video></div>';
  });
  t = t.replace(/!\[audio\]\(([^)]+)\)/gi, function(m, src) {
    if (/^javascript:|^data:|^vbscript:/i.test(src)) return m;
    return '<div class="audio-wrapper"><audio src="' + esc(src) + '" controls></audio></div>';
  });
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(m, alt, src) {
    if (/^javascript:|^data:|^vbscript:/i.test(src)) return m;
    // src 已经被 esc(t) 转义过，不需要再次转义
    return '<img src="' + src + '" alt="' + esc(alt) + '">';
  });
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(m, text, href) {
    if (/^javascript:|^data:|^vbscript:/i.test(href)) return esc(m);
    // href 已经被 esc(t) 转义过，不需要再次转义
    return '<a href="' + href + '">' + esc(text) + '</a>';
  });
  t = t.replace(/(^|\n)### (.+)/g, '$1<h3>$2</h3>');
  t = t.replace(/(^|\n)## (.+)/g, '$1<h2>$2</h2>');
  t = t.replace(/(^|\n)# (.+)/g, '$1<h1>$2</h1>');
  t = t.replace(/\n&gt; (.+)/g, '\n<blockquote>$1</blockquote>');
  t = t.replace(/\n---/g, '\n<hr>');
  var parts = t.split('\n\n'), out = '';
  for (var k = 0; k < parts.length; k++) {
    var p = parts[k].trim(); if (!p) continue;
    if (/^<(h[123]|div|blockquote|hr|li|img|video|audio)/.test(p)) out += p;
    else out += '<p>' + p.replace(/\n/g, '<br>') + '</p>';
  }
  return out;
}
