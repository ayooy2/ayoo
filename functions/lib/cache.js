// CDN 缓存清除工具
// 清除首页、博客列表和指定文章页面的 Cloudflare CDN 缓存
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
