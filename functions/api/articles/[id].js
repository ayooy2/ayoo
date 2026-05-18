import { json, error } from '../../lib/response.js';

// GET/PUT/DELETE 单篇文章（GET 公开，PUT/DELETE 需认证）
// GET 支持 id 或 ?slug=xxx
export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const url = new URL(request.url);
  const id = params.id;
  const slug = url.searchParams.get('slug');

  if (method === 'GET') {
    return getArticle(env, id, slug);
  }

  const auth = request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.ADMIN_PASSWORD}`) {
    return error('Unauthorized', 401);
  }

  try {
    if (method === 'PUT') return updateArticle(env, id, await request.json());
    if (method === 'DELETE') return deleteArticle(env, id);
    return error('Method not allowed', 405);
  } catch (e) {
    console.error(e);
    return error('Internal server error', 500);
  }
}

async function getArticle(env, id, slug) {
  let result;
  if (slug && slug !== 'undefined') {
    result = await env.DB.prepare('SELECT * FROM articles WHERE slug = ? AND is_published = 1').bind(slug).first();
  } else if (id && id !== 'new') {
    result = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
  }
  if (!result) return error('Not found', 404);

  const likes = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id = ?').bind(result.id).first();
  result.likes = likes.c;

  return json(result);
}

async function updateArticle(env, id, data) {
  const existing = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
  if (!existing) return error('Not found', 404);

  const title = (data.title || '').trim() || existing.title;
  const slug = (data.slug || '').trim() || existing.slug;
  const content_md = data.content_md !== undefined ? data.content_md : existing.content_md;
  const summary = (data.summary || '').trim() || existing.summary;
  const cover_image = data.cover_image !== undefined ? (data.cover_image || '').trim() : existing.cover_image;
  const author = (data.author || 'Admin').trim();
  const tags = (data.tags || '').trim();
  const is_published = data.is_published !== undefined ? (data.is_published ? 1 : 0) : existing.is_published;

  const result = await env.DB.prepare(
    `UPDATE articles SET title=?, slug=?, content_md=?, summary=?, cover_image=?, author=?, tags=?, is_published=?, updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *`
  ).bind(title, slug, content_md, summary, cover_image, author, tags, is_published, id).first();

  return json(result);
}

async function deleteArticle(env, id) {
  await env.DB.prepare('DELETE FROM comments WHERE article_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM likes WHERE article_id = ?').bind(id).run();
  const { meta } = await env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
  if (meta.changes === 0) return error('Not found', 404);
  return json({ success: true });
}
