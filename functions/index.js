// 首页 Edge SSR -- 从 D1 读取配置和网站数据，渲染完整 HTML，CDN 缓存
export async function onRequestGet(context) {
  const { env } = context;

  const [settingsResult, sitesResult] = await Promise.all([
    env.DB.prepare('SELECT key, value FROM settings').all(),
    env.DB.prepare('SELECT id, title, url, icon, description FROM sites ORDER BY sort_order ASC, id ASC LIMIT 200').all()
  ]);

  var settings = {};
  for (var i = 0; i < (settingsResult.results || []).length; i++) {
    var row = settingsResult.results[i];
    settings[row.key] = row.value;
  }

  var html = renderPage(settings, sitesResult.results || []);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=3600'
    }
  });
}

function renderPage(settings, sites) {
  var t = escapeHtml(settings.title || '我的导航主页');
  var s = escapeHtml(settings.subtitle || '');
  var f = escapeHtml(settings.footer || '© 2026');

  var cards = '';
  for (var i = 0; i < sites.length; i++) {
    cards += renderCard(sites[i]);
  }
  if (!cards) {
    cards = '<p class="empty">暂无网站。</p>';
  }

  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '    <meta charset="UTF-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '    <title>' + t + '</title>',
    '    <link rel="stylesheet" href="/style.css">',
    '</head>',
    '<body>',
    '    <nav class="navbar">',
    '        <div class="nav-inner">',
    '            <span class="nav-brand">' + t + '</span>',
    '            <a href="/rain.html" class="nav-link" title="雨屏">💧</a>',
'            <div class="nav-spacer"></div>',
    '            <span class="nav-clock" id="clock">--:--:--</span>',
    '            <button class="theme-toggle" id="theme-toggle" aria-label="切换主题" title="切换日间/夜间模式">',
    '                <div class="track-scene track-day">',
    '                    <span class="day-beam day-beam-1"></span>',
    '                    <span class="day-beam day-beam-2"></span>',
    '                    <span class="cloud cloud-1"></span>',
    '                    <span class="cloud cloud-2"></span>',
    '                    <span class="cloud cloud-3"></span>',
    '                    <span class="day-particle"></span>',
    '                    <span class="day-particle"></span>',
    '                    <span class="day-particle"></span>',
    '                </div>',
    '                <div class="track-scene track-night">',
    '                    <span class="star-dot"></span>',
    '                    <span class="star-dot"></span>',
    '                    <span class="star-dot"></span>',
    '                    <span class="star-dot"></span>',
    '                    <span class="star-dot"></span>',
    '                    <span class="star-dot"></span>',
    '                    <span class="star-dot"></span>',
    '                </div>',
    '                <div class="theme-thumb"></div>',
    '            </button>',
    '        </div>',
    '    </nav>',
    '',
    '    <div class="page-wrapper">',
    '        <div class="page-header">',
    '            <p class="subtitle">' + s + '</p>',
    '        </div>',
    '',
    '        <main class="content">',
    '            <div id="sites-grid" class="sites-grid">',
    '                ' + cards,
    '            </div>',
    '        </main>',
    '',
    '        <footer class="page-footer">',
    '            <span class="footer-text">' + f + '</span>',
    '        </footer>',
    '    </div>',
    '',
    '    <script>',
    '        (function() {',
    '            var TIMEOUT = 2000;',
    '',
    '            function updateClock() {',
    '                var now = new Date();',
    '                var h = String(now.getHours()).padStart(2, "0");',
    '                var m = String(now.getMinutes()).padStart(2, "0");',
    '                var s = String(now.getSeconds()).padStart(2, "0");',
    '                document.getElementById("clock").textContent = h + ":" + m + ":" + s;',
    '            }',
    '            updateClock();',
    '            setInterval(updateClock, 1000);',
    '',
    '            var themeBtn = document.getElementById("theme-toggle");',
    '            var saved = localStorage.getItem("theme") || "light";',
    '            if (saved === "dark") document.documentElement.setAttribute("data-theme", "dark");',
    '            themeBtn.addEventListener("click", function() {',
    '                var isDark = document.documentElement.getAttribute("data-theme") === "dark";',
    '                if (isDark) {',
    '                    document.documentElement.removeAttribute("data-theme");',
    '                    localStorage.setItem("theme", "light");',
    '                } else {',
    '                    document.documentElement.setAttribute("data-theme", "dark");',
    '                    localStorage.setItem("theme", "dark");',
    '                }',
    '            });',
    '',
    '            document.querySelectorAll(".site-card").forEach(function(card) {',
    '                card.addEventListener("dblclick", function() {',
    '                    var url = card.dataset.url;',
    '                    if (url) window.open(url, "_blank", "noopener,noreferrer");',
    '                });',
    '            });',
    '',
    '            document.querySelectorAll(".site-card").forEach(function(card) {',
    '                tryLoadIcon(card);',
    '            });',
    '',
    '            function tryLoadIcon(card) {',
    '                var container = card.querySelector(".card-icon");',
    '                var customIcon = card.dataset.icon;',
    '                var url = card.dataset.url;',
    '                var iconUrl = null;',
    '                if (customIcon) {',
    '                    iconUrl = customIcon;',
    '                } else if (url) {',
    '                    try { iconUrl = "https://" + new URL(url).hostname + "/favicon.ico"; } catch(e) {}',
    '                }',
    '                if (!iconUrl) return;',
    '                var img = new Image();',
    '                var done = false;',
    '                var timer = setTimeout(function() {',
    '                    if (!done) { done = true; img.src = ""; }',
    '                }, TIMEOUT);',
    '                img.onload = function() {',
    '                    if (done) return;',
    '                    done = true; clearTimeout(timer);',
    '                    container.innerHTML = "";',
    '                    var el = document.createElement("img");',
    '                    el.src = iconUrl; el.alt = "";',
    '                    container.appendChild(el);',
    '                };',
    '                img.onerror = function() {',
    '                    if (done) return;',
    '                    done = true; clearTimeout(timer);',
    '                };',
    '                img.src = iconUrl;',
    '            }',
    '        })();',
    '    </script>',
    '</body>',
    '</html>'
  ].join('\n');
}

function renderCard(site) {
  return [
    '        <div class="site-card" data-url="' + escapeHtml(site.url) + '" data-icon="' + escapeHtml(site.icon || '') + '" title="双击打开：' + escapeHtml(site.title) + '">',
    '          <div class="card-icon">',
    '            <span class="card-emoji">🌐</span>',
    '          </div>',
    '          <div class="card-text">',
    '            <h3 class="card-title">' + escapeHtml(site.title) + '</h3>',
    '            <p class="card-desc">' + escapeHtml(site.description || '') + '</p>',
    '          </div>',
    '        </div>'
  ].join('\n');
}

function escapeHtml(text) {
  var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text || '').replace(/[&<>"']/g, function(c) { return map[c]; });
}
