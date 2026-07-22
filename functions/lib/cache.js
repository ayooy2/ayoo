/**
 * cache.js — CDN 缓存管理
 * 功能：清除 Cloudflare CDN 缓存（首页、博客列表、指定文章）
 * 导出：purgeCDN(env, slug)
 * 依赖：Cloudflare API（需要 CLOUDFLARE_ZONE_ID、CLOUDFLARE_API_TOKEN、CF_PAGES_URL）
 * 调用方：articles.js、articles/[id].js、settings.js
 */
export async function purgeCDN(env, slug) {
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const pageUrl = env.CF_PAGES_URL;
  if (!zoneId || !apiToken || !pageUrl) return;

  try {
    const base = `https://${pageUrl}`;
    const urls = [`${base}/`, `${base}/blog`];
    if (slug) urls.push(`${base}/blog/${slug}`);

    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: urls })
    });
  } catch { /* non-critical */ }
}
