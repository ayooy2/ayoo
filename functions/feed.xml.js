// GET /feed.xml — RSS 2.0 订阅源
export async function onRequestGet(context) {
  const { env } = context;
  try {
  const base = 'https://ayoow.pages.dev';

  // 获取站点标题
  const titleRow = await env.DB.prepare("SELECT value FROM settings WHERE key='title'").first();
  const siteTitle = (titleRow && titleRow.value) || '我的自留地';

  // 获取最新 20 篇文章
  const { results } = await env.DB.prepare(
    "SELECT title, slug, summary, content_md, author, created_at FROM articles WHERE is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY created_at DESC LIMIT 20"
  ).all();

  var items = '';
  for (var i = 0; i < (results || []).length; i++) {
    var a = results[i];
    var link = base + '/blog/' + a.slug;
    var pubDate = new Date((a.created_at || '') + 'Z').toUTCString();
    var desc = escXml(a.summary || (a.content_md || '').slice(0, 300));

    items += '<item>'
      + '<title>' + escXml(a.title) + '</title>'
      + '<link>' + link + '</link>'
      + '<guid isPermaLink="true">' + link + '</guid>'
      + '<description>' + desc + '</description>'
      + '<author>' + escXml(a.author || 'Admin') + '</author>'
      + '<pubDate>' + pubDate + '</pubDate>'
      + '</item>';
  }

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
    + '<channel>\n'
    + '<title>' + escXml(siteTitle) + '</title>'
    + '<link>' + base + '</link>'
    + '<description>' + escXml(siteTitle) + ' — 笔记与分享</description>'
    + '<language>zh-CN</language>'
    + '<atom:link href="' + base + '/feed.xml" rel="self" type="application/rss+xml"/>'
    + items
    + '\n</channel>\n</rss>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
  } catch (e) {
    return new Response('服务器错误', { status: 500 });
  }
}

function escXml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
