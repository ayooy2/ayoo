import { json, error } from '../../lib/response.js';
import { requireAuth } from '../../lib/auth.js';

// GET: get single tag
// PUT: update tag (auth required)
// DELETE: delete tag (auth required)
export async function onRequest(context) {
  const { request, env, params } = context;
  const id = parseInt(params.id, 10);
  if (!id || isNaN(id)) return error('Invalid id', 400);

  if (request.method === 'GET') {
    const tag = await env.DB.prepare('SELECT * FROM tags WHERE id=?').bind(id).first();
    if (!tag) return error('Not found', 404);
    return json(tag);
  }

  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  if (request.method === 'PUT') {
    let data;
    try { data = await request.json(); } catch { return error('请求格式错误', 400); }
    const existing = await env.DB.prepare('SELECT * FROM tags WHERE id=?').bind(id).first();
    if (!existing) return error('Not found', 404);

    const name = data.name !== undefined ? (data.name || '').trim().slice(0, 50) : existing.name;
    const slug = data.slug !== undefined ? (data.slug || '').trim() : existing.slug;
    const color = data.color !== undefined ? (data.color || '').trim().slice(0, 20) : existing.color;

    if (!name) return error('标签名不能为空', 400);

    try {
      const result = await env.DB.prepare(
        'UPDATE tags SET name=?, slug=?, color=? WHERE id=? RETURNING *'
      ).bind(name, slug || name, color || null, id).first();
      return json(result);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return error('标签名已存在', 409);
      throw e;
    }
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM tags WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  return error('Method not allowed', 405);
}
