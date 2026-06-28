// GET /api/search?q=xxx — 站内搜索
import { json, error } from '../lib/response.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return error('Method not allowed', 405);

  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (!q) return json({ results: [], total: 0 });
  if (q.length > 100) return error('Query too long', 400);

  const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
  const like = '%' + escaped + '%';
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, title, slug, summary, author, tags, created_at, views "
      + "FROM articles WHERE is_published=1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) "
      + "AND (title LIKE ? OR summary LIKE ? OR content_md LIKE ? OR tags LIKE ?) "
      + "ORDER BY created_at DESC LIMIT 20"
    ).bind(like, like, like, like).all();
    return json({ results: results || [], total: (results || []).length, query: q });
  } catch (e) {
    console.error('Search API error:', e);
    return error('搜索服务暂时不可用', 500);
  }
}
