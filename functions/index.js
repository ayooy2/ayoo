// 首页 Edge SSR -- 从 D1 读取配置和网站数据，渲染完整 HTML，CDN 缓存
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
  const title = escapeHtml(settings.title || '我的导航主页');
  const subtitle = escapeHtml(settings.subtitle || '');
  const footer = escapeHtml(settings.footer || '© 2026');

  let cardsHtml = '';
  for (const site of sites) {
    cardsHtml += renderCard(site);
  }

  if (!cardsHtml) {
    cardsHtml = '<p class="empty">暂无网站。</p>';
  }

  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>' + title + '</title>\n    <link rel="stylesheet" href="/style.css">\n</head>\n<body>\n    <div class="page-wrapper">\n        <div class="clock" id="clock">--:--:--</div>\n        <header class="main-header">\n            <h1 class="main-title">' + title + '</h1>\n            <p class="subtitle">' + subtitle + '</p>\n        </header>\n\n        <main class="content">\n            <div id="sites-grid" class="sites-grid">\n                ' + cardsHtml + '\n            </div>\n        </main>\n\n        <footer class="main-footer">\n            <span class="footer-text">' + footer + '</span>\n        </footer>\n    </div>\n\n    <script>\n        (function() {\n            function updateClock() {\n                var now = new Date();\n                var h = String(now.getHours()).padStart(2, "0");\n                var m = String(now.getMinutes()).padStart(2, "0");\n                var s = String(now.getSeconds()).padStart(2, "0");\n                document.getElementById("clock").textContent = h + ":" + m + ":" + s;\n            }\n            updateClock();\n            setInterval(updateClock, 1000);\n\n            document.querySelectorAll(".site-card").forEach(function(card) {\n                card.addEventListener("dblclick", function() {\n                    var url = card.dataset.url;\n                    if (url) window.open(url, "_blank");\n                });\n            });\n\n            // 延迟加载图标，避免阻塞页面渲染\n            document.querySelectorAll(".card-icon img[data-src]").forEach(function(img) {\n                img.src = img.dataset.src;\n            });\n        })();\n    </script>\n</body>\n</html>';
}

function renderCard(site) {
  var iconHtml;
  if (site.icon) {
    // 用户自定义图标：延迟加载，加载失败则显示 emoji
    iconHtml = '<img data-src="' + escapeHtml(site.icon) + '" alt="" onerror="this.style.display=\'none\'; this.parentElement.innerHTML=\'🌐\';">';
  } else {
    // 无自定义图标：直接显示 emoji，不发任何外部请求
    iconHtml = '<span class="card-emoji">🌐</span>';
  }

  return '\n        <div class="site-card" data-url="' + escapeHtml(site.url) + '" title="双击打开：' + escapeHtml(site.title) + '">\n          <div class="card-icon">\n            ' + iconHtml + '\n          </div>\n          <h3 class="card-title">' + escapeHtml(site.title) + '</h3>\n          <p class="card-desc">' + escapeHtml(site.description || '') + '</p>\n        </div>';
}

function escapeHtml(text) {
  var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text || '').replace(/[&<>"']/g, function(c) { return map[c]; });
}
