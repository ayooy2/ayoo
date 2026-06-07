// GET /sitemap.xml — 动态生成站点地图
export async function onRequestGet(context) {
  const { env } = context;
  const base = 'https://ayoow.pages.dev';

  // 获取所有已发布的文章
  const { results } = await env.DB.prepare(
    "SELECT slug, updated_at FROM articles WHERE is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY created_at DESC"
  ).all();

  var urls = '';

  // 首页
  urls += '<url><loc>' + base + '</loc><changefreq>daily</changefreq><priority>1.0</priority></url>';

  // 博客列表
  urls += '<url><loc>' + base + '/blog</loc><changefreq>daily</changefreq><priority>0.8</priority></url>';

  // 文章详情
  for (var i = 0; i < (results || []).length; i++) {
    var a = results[i];
    var lastmod = (a.updated_at || '').replace(' ', 'T') + 'Z';
    urls += '<url><loc>' + base + '/blog/' + a.slug + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>';
  }

  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls + '\n'
    + '</urlset>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
}
