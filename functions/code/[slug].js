/**
 * Code 文章详情 SSR
 * 功能：渲染 Code 文章（Markdown→HTML with figure.highlight 代码块、TOC、前后导航）
 * 特点：无评论、无点赞、无封面图、极简设计
 * 依赖：navbar.js、sanitize.js
 * 核心入口：onRequestGet()
 */
import { navbar, mobileMenu, cmdOverlay } from '../lib/navbar.js';
import { esc } from '../lib/sanitize.js';

export async function onRequestGet(context) {
  try {
    const { env, params } = context;
    const slug = params.slug || new URL(context.request.url).pathname.replace('/code/', '').replace(/\/$/, '');
    const a = await env.DB.prepare("SELECT * FROM articles WHERE slug=? AND article_type='code' AND is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))").bind(slug).first();
    if (!a) return new Response('Not found', { status: 404 });
    await env.DB.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').bind(a.id).run();
    a.views = (a.views || 0) + 1;

    // 前后文章导航（仅限 code 类型）
    const prev = await env.DB.prepare("SELECT title, slug FROM articles WHERE article_type='code' AND is_published=1 AND id < ? AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY id DESC LIMIT 1").bind(a.id).first();
    const next = await env.DB.prepare("SELECT title, slug FROM articles WHERE article_type='code' AND is_published=1 AND id > ? AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY id ASC LIMIT 1").bind(a.id).first();

    var h = render(a, prev, next);
    return new Response(h, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }
    });
  } catch (e) { console.error('Code detail error:', e); return new Response('服务器错误，请稍后再试', { status: 500 }); }
}

function slugify(text) {
  // 保留字母、数字、中文、连字符
  return text.replace(/[^\w一-鿿-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'heading';
}

function render(a, prev, next) {
  var time = (a.created_at || '').replace('T', ' ').slice(0, 16);
  var tags = '', ts = (a.tags || '').split(',').filter(Boolean);
  for (var i = 0; i < ts.length; i++) tags += '<span class="tag">#' + esc(ts[i].trim()) + '</span>';

  var result = codeMD(a.content_md || '');
  var body = result.body;
  var toc = result.toc;
  var tocHtml = buildTOC(toc);

  var desc = esc(a.summary || (a.content_md || '').replace(/[#*`\[\]()!>|-]/g, '').replace(/\\n/g, ' ').trim().slice(0, 160));
  var kw = ts.map(function(t){ return esc(t.trim()); }).join(',');
  var url = 'https://ayoow.pages.dev/code/' + esc(a.slug);
  var seo = '<meta name="description" content="' + desc + '">'
    + (kw ? '<meta name="keywords" content="' + kw + '">' : '')
    + '<meta property="og:type" content="article">'
    + '<meta property="og:title" content="' + esc(a.title) + '">'
    + '<meta property="og:description" content="' + desc + '">'
    + '<meta property="og:url" content="' + url + '">'
    + '<meta name="twitter:card" content="summary">'
    + '<meta name="twitter:title" content="' + esc(a.title) + '">'
    + '<meta name="twitter:description" content="' + desc + '">'
    + '<link rel="canonical" href="' + url + '">';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(a.title)} — Code</title>${seo}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/style.css?v=6">
<link rel="stylesheet" href="/toolbar.css?v=9">
<link rel="stylesheet" href="/code.css?v=1">
</head>
<body>
${navbar('Code', '/code', '')}
${mobileMenu()}
<div class="page-wrapper">
  <div class="content">

    <!-- Breadcrumb -->
    <div class="article-top-bar animate-in">
      <a href="/code"><svg viewBox="0 0 24 24"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> Code</a>
      <span class="article-breadcrumb-sep">/</span>
      <span style="color:var(--text-primary)">${esc(a.title)}</span>
    </div>

    <!-- Article Layout: Content + Sidebar TOC -->
    <div class="article-layout article-layout-code">

      <!-- Main Content -->
      <article class="article-wrapper code-article animate-in" style="animation-delay:100ms">
        <header class="article-header">
          <h1 class="article-title">${esc(a.title)}</h1>
          <div class="article-meta">
            <span class="article-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${esc(a.author)}</span>
            <span class="article-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${time}</span>
            <span class="article-meta-item">${a.views || 0} <span data-zh="阅读" data-en="views">阅读</span></span>
          </div>
          ${tags ? '<div class="article-tags">' + tags + '</div>' : ''}
        </header>

        <div class="article-body code-article-body" id="content">
          ${body}
        </div>
      </article>

      <!-- Mobile prev/next navigation -->
      <nav class="mobile-post-nav">
        ${prev ? '<a class="mobile-post-nav-item prev" href="/code/' + esc(prev.slug) + '"><span class="mobile-post-nav-label" data-zh="← 上一篇" data-en="← Previous">← 上一篇</span><span class="mobile-post-nav-title">' + esc(prev.title) + '</span></a>' : '<div class="mobile-post-nav-item prev disabled"></div>'}
        ${next ? '<a class="mobile-post-nav-item next" href="/code/' + esc(next.slug) + '"><span class="mobile-post-nav-label" data-zh="下一篇 →" data-en="Next →">下一篇 →</span><span class="mobile-post-nav-title">' + esc(next.title) + '</span></a>' : '<div class="mobile-post-nav-item next disabled"></div>'}
      </nav>

      <!-- Sidebar TOC (desktop) -->
      <aside class="article-toc" id="article-toc">
        <div class="toc-topbar">
          <svg class="toc-topbar-icon" onclick="var t=document.getElementById('toc-list');t.classList.toggle('collapsed');this.classList.toggle('collapsed')" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
          <span class="toc-topbar-info" id="toc-info">${toc.length ? toc.length + ' 个标题' : ''}</span>
          ${prev ? '<a class="toc-topbar-btn" href="/code/' + esc(prev.slug) + '" title="' + esc(prev.title) + '" data-label="Previous post"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></a>' : '<span class="toc-topbar-btn disabled" data-label="Previous post"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span>'}
          ${next ? '<a class="toc-topbar-btn" href="/code/' + esc(next.slug) + '" title="' + esc(next.title) + '" data-label="Next post"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></a>' : '<span class="toc-topbar-btn disabled" data-label="Next post"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg></span>'}
          <button class="toc-topbar-btn" data-label="Back to top" onclick="window.scrollTo({top:0,behavior:'smooth'})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
        </div>
        ${tocHtml ? '<ul class="toc-list" id="toc-list">' + tocHtml + '</ul>' : '<ul class="toc-list" id="toc-list"><li class="toc-empty">无标题</li></ul>'}
      </aside>

    </div>
  </div>

  <footer class="page-footer">
    <span class="footer-text"><a href="/code" data-zh="← 返回 Code" data-en="← Back to Code">← 返回 Code</a></span>
  </footer>
</div>

<script src="/app.js" defer></script>
<script src="/toolbar.js?v=11" defer></script>
<script>
(function(){
  var toc = document.getElementById('toc-list');
  var tocInfo = document.getElementById('toc-info');
  if (!toc) return;

  // Highlight active TOC item on scroll
  var headings = document.querySelectorAll('.article-body h2[id], .article-body h3[id]');
  if (!headings.length) return;

  var links = toc.querySelectorAll('a');
  var tocItems = toc.querySelectorAll('.toc-item');

  function onScroll() {
    var scrollY = window.scrollY;
    var current = '';
    for (var i = headings.length - 1; i >= 0; i--) {
      if (headings[i].offsetTop - 100 <= scrollY) {
        current = headings[i].getAttribute('id');
        break;
      }
    }
    for (var j = 0; j < tocItems.length; j++) {
      var a = tocItems[j].querySelector('a');
      if (a && a.getAttribute('href') === '#' + current) {
        tocItems[j].classList.add('active');
      } else {
        tocItems[j].classList.remove('active');
      }
    }
    if (tocInfo) {
      var activeEl = toc.querySelector('.toc-item.active a');
      if (activeEl) tocInfo.textContent = activeEl.textContent;
    }
  }

  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() { onScroll(); ticking = false; });
      ticking = true;
    }
  });
  onScroll();
})();
</script>
${cmdOverlay()}
</body>
</html>`;
}

function buildTOC(toc) {
  if (!toc.length) return '';
  var html = '';
  for (var i = 0; i < toc.length; i++) {
    var item = toc[i];
    var indent = item.level === 3 ? ' toc-h3' : '';
    html += '<li class="toc-item' + indent + '"><a href="#' + esc(item.id) + '">' + esc(item.text) + '</a></li>';
  }
  return html;
}

function codeMD(md) {
  var toc = [];
  var t = String(md || '');
  // D1 存储的换行是字面量 \n，需要先转换
  t = t.replace(/\\n/g, '\n');

  // 提取围栏代码块
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
      mediaRe.lastIndex = 0;
    }
  }

  // HTML 转义
  t = esc(t);

  // 还原代码块：使用 figure.highlight + table 格式（带行号）
  for (var n = 0; n < cbs.length; n++) {
    var cb = cbs[n];
    var lang = cb.l ? esc(cb.l) : 'text';
    var code = esc(cb.c);
    var lines = code.split('\n');
    var gutterHtml = '';
    var codeHtml = '';
    for (var li = 0; li < lines.length; li++) {
      gutterHtml += '<span class="line">' + (li + 1) + '</span>';
      codeHtml += '<span class="line">' + lines[li] + '</span>';
    }
    var figHtml = '<figure class="highlight ' + lang + '"><table><tr><td class="gutter"><pre>' + gutterHtml + '</pre></td><td class="code"><pre>' + codeHtml + '</pre></td></tr></table></figure>';
    var cbPlaceholder = '__CB' + n + '__';
    var cbIdx = t.indexOf(cbPlaceholder);
    if (cbIdx !== -1) {
      t = t.substring(0, cbIdx) + figHtml + t.substring(cbIdx + cbPlaceholder.length);
    }
  }

  // 还原媒体标签占位符
  for (var mi = 0; mi < mFrames.length; mi++) {
    var mfPlaceholder = '__MF' + mi + '__';
    var mfIdx = t.indexOf(mfPlaceholder);
    if (mfIdx !== -1) {
      t = t.substring(0, mfIdx) + mFrames[mi] + t.substring(mfIdx + mfPlaceholder.length);
    }
  }

  // Inline code
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold, italic
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(?!\*)(.+?)\*/g, '<em>$1</em>');

  // Images: ![alt](url)
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
    return '<img src="' + src + '" alt="' + esc(alt) + '">';
  });

  // Links: [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(m, text, href) {
    if (/^javascript:|^data:|^vbscript:/i.test(href)) return esc(m);
    return '<a href="' + href + '">' + esc(text) + '</a>';
  });

  // 标题（带 id，用于 TOC）
  t = t.replace(/(^|\n)### (.+)/g, function(m, nl, text) {
    var id = slugify(text);
    toc.push({ level: 3, text: text, id: id });
    return nl + '<h3 id="' + id + '">' + text + '</h3>';
  });
  t = t.replace(/(^|\n)## (.+)/g, function(m, nl, text) {
    var id = slugify(text);
    toc.push({ level: 2, text: text, id: id });
    return nl + '<h2 id="' + id + '">' + text + '</h2>';
  });
  // h1 不加入 TOC（页面标题已经是大标题）

  // Blockquote
  t = t.replace(/\n&gt; (.+)/g, '\n<blockquote>$1</blockquote>');

  // Horizontal rule
  t = t.replace(/\n---/g, '\n<hr>');

  // 段落处理：按双换行分割
  var parts = t.split('\n\n'), out = '';
  for (var k = 0; k < parts.length; k++) {
    var p = parts[k].trim(); if (!p) continue;
    if (/^<(h[123]|div|blockquote|hr|li|img|video|audio|figure)/.test(p)) out += p;
    else out += '<p>' + p.replace(/\n/g, '<br>') + '</p>';
  }

  return { body: out, toc: toc };
}

function sanitizeIframe(html) {
  var m = html.match(/src="([^"]+)"/);
  if (!m) return '';
  var src = m[1];
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
