import { json, error } from '../lib/response.js';

// GET ?article_id=&fingerprint=  check like state
// POST { article_id, fingerprint } toggle like
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const articleId = url.searchParams.get('article_id');
    const fp = (url.searchParams.get('fingerprint') || '').trim().slice(0, 100);
    if (!articleId || !fp) return error('article_id and fingerprint required', 400);
    if (isNaN(articleId)) return error('Invalid article_id', 400);
    const existing = await env.DB.prepare(
      'SELECT id FROM likes WHERE article_id = ? AND fingerprint = ?'
    ).bind(articleId, fp).first();
    const count = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id = ?').bind(articleId).first();
    return json({ liked: !!existing, likes: count.c });
  }

  if (request.method !== 'POST') return error('Method not allowed', 405);

  let data;
  try { data = await request.json(); } catch { return error('请求格式错误', 400); }
  const articleId = parseInt(data.article_id);
  const fp = (data.fingerprint || '').trim().slice(0, 100);
  if (!articleId || isNaN(articleId) || !fp) return error('article_id and fingerprint required', 400);

  // 验证文章存在
  const article = await env.DB.prepare('SELECT id FROM articles WHERE id = ?').bind(articleId).first();
  if (!article) return error('文章不存在', 404);

  const existing = await env.DB.prepare(
    'SELECT id FROM likes WHERE article_id = ? AND fingerprint = ?'
  ).bind(articleId, fp).first();

  if (existing) {
    await env.DB.prepare('DELETE FROM likes WHERE id = ?').bind(existing.id).run();
    const count = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id = ?').bind(articleId).first();
    return json({ liked: false, likes: count.c });
  } else {
    await env.DB.prepare(
      'INSERT INTO likes (article_id, fingerprint) VALUES (?, ?)'
    ).bind(articleId, fp).run();
    const count = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id = ?').bind(articleId).first();
    return json({ liked: true, likes: count.c });
  }
}
