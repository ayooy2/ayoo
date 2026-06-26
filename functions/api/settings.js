import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

const ALLOWED_KEYS = ['title', 'subtitle', 'footer', 'bg_image', 'about_title', 'about_content', 'about_avatar'];

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
  }

  try {
    switch (request.method) {
      case 'GET':
        return getSettings(env);
      case 'PUT':
        return updateSettings(env, await request.json());
      default:
        return error('Method not allowed', 405);
    }
  } catch (e) {
    console.error(e);
    return error('Internal server error', 500);
  }
}

async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const config = {};
  for (const row of results || []) {
    if (ALLOWED_KEYS.includes(row.key)) {
      config[row.key] = row.value;
    }
  }
  return json(config);
}

async function updateSettings(env, data) {
  const stmts = [];
  for (const key of ALLOWED_KEYS) {
    const value = data[key];
    if (typeof value !== 'string') continue;
    stmts.push(
      env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind(key, value)
    );
  }
  if (stmts.length === 0) {
    return error('No valid settings', 400);
  }
  await env.DB.batch(stmts);

  // CDN purge via Cloudflare API
  const zoneId = env.CLOUDFLARE_ZONE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const pageUrl = env.CF_PAGES_URL;
  if (zoneId && apiToken && pageUrl) {
    try {
      await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [`https://${pageUrl}/`] })
      });
    } catch { /* non-critical */ }
  }

  return json({ success: true });
}
