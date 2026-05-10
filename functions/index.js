// 首页 Edge SSR —— 从 D1 读取配置和网站数据，渲染完整 HTML，CDN 缓存
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
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=3600'
    }
  });
}

function renderPage(settings, sites) {
  const title = escapeHtml(settings.title || '我的导航主页');
  const subtitle = escapeHtml(settings.subtitle || '');
  const footer = escapeHtml(settings.footer || '© 2026');

  let cardsHtml = '';
  for (const site of sites) {
    const iconUrl = site.icon || getFavicon(site.url);
    cardsHtml += `
        <div class="site-card" data-url="${escapeHtml(site.url)}" title="双击打开：${escapeHtml(site.title)}">
          <div class="card-icon">
            <img src="${escapeHtml(iconUrl)}" alt="" onerror="this.style.display='none'; this.parentElement.innerHTML='🌐';">
          </div>
          <h3 class="card-title">${escapeHtml(site.title)}</h3>
          <p class="card-desc">${escapeHtml(site.description || '')}</p>
        </div>`;
  }

  if (!cardsHtml) {
    cardsHtml = '<p class="empty">暂无网站。</p>';
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div class="page-wrapper">
        <div class="clock" id="clock">--:--:--</div>
        <header class="main-header">
            <h1 class="main-title">${title}</h1>
            <p class="subtitle">${subtitle}</p>
        </header>

        <main class="content">
            <div id="sites-grid" class="sites-grid">
                ${cardsHtml}
            </div>
        </main>

        <footer class="main-footer">
            <span class="footer-text">${footer}</span>
        </footer>
    </div>

    <script>
        function updateClock() {
            var now = new Date();
            var h = String(now.getHours()).padStart(2, '0');
            var m = String(now.getMinutes()).padStart(2, '0');
            var s = String(now.getSeconds()).padStart(2, '0');
            document.getElementById('clock').textContent = h + ':' + m + ':' + s;
        }
        updateClock();
        setInterval(updateClock, 1000);

        document.querySelectorAll('.site-card').forEach(function(card) {
            card.addEventListener('dblclick', function() {
                var url = card.dataset.url;
                if (url) window.open(url, '_blank');
            });
        });
    </script>
</body>
</html>`;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text || '').replace(/[&<>"']/g, c => map[c]);
}

function getFavicon(url) {
  try {
    return 'https://www.google.com/s2/favicons?domain=' + new URL(url).hostname + '&sz=128';
  } catch {
    return '';
  }
}
