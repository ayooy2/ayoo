/**
 * 站点地图
 * 功能：生成 sitemap.xml（首页、博客列表、所有已发布文章）
 * 依赖：无（直接操作 D1）
 * 核心入口：onRequestGet()
 */
export async function onRequestGet(context) {
  const { env } = context;
  try {
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

  // 归档
  urls += '<url><loc>' + base + '/archive</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>';

  // 留言簿
  urls += '<url><loc>' + base + '/guestbook</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>';

  // Now
  urls += '<url><loc>' + base + '/now</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>';

  // 关于
  urls += '<url><loc>' + base + '/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>';

  // 功能
  urls += '<url><loc>' + base + '/features</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>';

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
  } catch (e) {
    return new Response('服务器错误', { status: 500 });
  }
}
