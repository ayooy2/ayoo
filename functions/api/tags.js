import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

// GET: list all tags
// POST: create tag (auth required)
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM tags ORDER BY name ASC'
    ).all();
    return json({ tags: results || [] });
  }

  if (request.method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;

    let data;
    try { data = await request.json(); } catch (e) { return error('请求格式错误', 400); }
    const name = (data.name || '').trim().slice(0, 50);
    if (!name) return error('标签名不能为空', 400);

    const slug = (data.slug || '').trim() || name.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '');
    const color = (data.color || '').trim().slice(0, 20);

    try {
      const result = await env.DB.prepare(
        'INSERT INTO tags (name, slug, color) VALUES (?, ?, ?) RETURNING *'
      ).bind(name, slug, color || null).first();
      return json(result, 201);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return error('标签名已存在', 409);
      throw e;
    }
  }

  return error('Method not allowed', 405);
}
