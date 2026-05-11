// 首页 Edge SSR -- 从 D1 读取配置和网站数据，渲染完整 HTML，CDN 缓存
// 图标策略：SSR 一律渲染 emoji 兜底，客户端 JS 异步尝试获取真实 icon
export async function onRequestGet(context) {
  const { env } = context;

  const [settingsResult, sitesResult] = await Promise.all([
    env.DB.prepare('SELECT key, value FROM settings').all(),
    env.DB.prepare('SELECT id, title, url, icon, description FROM sites ORDER BY sort_order ASC, id ASC').all()
  ]);

  const settings = {};
  for (const row of settingsResult.results || []) {
    settings[row.key] = row.value;
  }

  const html = renderPage(settings, sitesResult.results || []);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=3600'
    }
  });
}

function renderPage(settings, sites) {
  var title = escapeHtml(settings.title || '我的导航主页');
  var subtitle = escapeHtml(settings.subtitle || '');
  var footer = escapeHtml(settings.footer || '© 2026');

  var cardsHtml = '';
  for (var i = 0; i < sites.length; i++) {
    cardsHtml += renderCard(sites[i]);
  }
  if (!cardsHtml) {
    cardsHtml = '<p class="empty">暂无网站。</p>';
  }

  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>' + title + '</title>\n    <link rel="stylesheet" href="/style.css">\n</head>\n<body>\n    <div class="page-wrapper">\n        <div class="clock" id="clock">--:--:--</div>\n        <header class="main-header">\n            <h1 class="main-title">' + title + '</h1>\n            <p class="subtitle">' + subtitle + '</p>\n        </header>\n\n        <main class="content">\n            <div id="sites-grid" class="sites-grid">\n                ' + cardsHtml + '\n            </div>\n        </main>\n\n        <footer class="main-footer">\n            <span class="footer-text">' + footer + '</span>\n        </footer>\n    </div>\n\n    <script>\n        (function() {\n            var TIMEOUT = 2000;\n\n            // 时钟\n            function updateClock() {\n                var now = new Date();\n                var h = String(now.getHours()).padStart(2, "0");\n                var m = String(now.getMinutes()).padStart(2, "0");\n                var s = String(now.getSeconds()).padStart(2, "0");\n                document.getElementById("clock").textContent = h + ":" + m + ":" + s;\n            }\n            updateClock();\n            setInterval(updateClock, 1000);\n\n            // 双击跳转\n            document.querySelectorAll(".site-card").forEach(function(card) {\n                card.addEventListener("dblclick", function() {\n                    var url = card.dataset.url;\n                    if (url) window.open(url, "_blank", "noopener,noreferrer");\n                });\n            });\n\n            // 异步加载图标：设置超时，失败不影响页面\n            document.querySelectorAll(".site-card").forEach(function(card) {\n                tryLoadIcon(card);\n            });\n\n            function tryLoadIcon(card) {\n                var container = card.querySelector(".card-icon");\n                var customIcon = card.dataset.icon;\n                var url = card.dataset.url;\n                var iconUrl = null;\n\n                if (customIcon) {\n                    iconUrl = customIcon;\n                } else if (url) {\n                    try {\n                        iconUrl = "https://" + new URL(url).hostname + "/favicon.ico";\n                    } catch(e) {}\n                }\n\n                if (!iconUrl) return;\n\n                var img = new Image();\n                var done = false;\n                var timer = setTimeout(function() {\n                    if (!done) { done = true; img.src = ""; }\n                }, TIMEOUT);\n\n                img.onload = function() {\n                    if (done) return;\n                    done = true;\n                    clearTimeout(timer);\n                    container.innerHTML = "";\n                    var el = document.createElement("img");\n                    el.src = iconUrl;\n                    el.alt = "";\n                    container.appendChild(el);\n                };\n\n                img.onerror = function() {\n                    if (done) return;\n                    done = true;\n                    clearTimeout(timer);\n                };\n\n                img.src = iconUrl;\n            }\n        })();\n    </script>\n</body>\n</html>';
}

function renderCard(site) {
  // 一律用 emoji 首屏渲染，icon URL 存在 data-icon 里供 JS 异步加载
  return '\n        <div class="site-card" data-url="' + escapeHtml(site.url) + '" data-icon="' + escapeHtml(site.icon || '') + '" title="双击打开：' + escapeHtml(site.title) + '">\n          <div class="card-icon">\n            <span class="card-emoji">🌐</span>\n          </div>\n          <div class="card-text">\n            <h3 class="card-title">' + escapeHtml(site.title) + '</h3>\n            <p class="card-desc">' + escapeHtml(site.description || '') + '</p>\n          </div>\n        </div>';
}

function escapeHtml(text) {
  var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text || '').replace(/[&<>"']/g, function(c) { return map[c]; });
}
