import { json, error } from '../../lib/response.js';
import { requireAuth } from '../../lib/auth.js';

// GET/PUT/DELETE 单篇文章（GET 公开，PUT/DELETE 需认证）
// GET 支持 id 或 ?slug=xxx
export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const url = new URL(request.url);
  const id = params.id;
  const slug = url.searchParams.get('slug');

  if (method === 'GET') {
    const authErr = await requireAuth(request, env);
    const isAdmin = !authErr;
    return getArticle(env, id, slug, isAdmin);
  }

  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  try {
    if (method === 'PUT') {
      let data;
      try { data = await request.json(); } catch { return error('请求格式错误', 400); }
      return updateArticle(env, id, data);
    }
    if (method === 'DELETE') return deleteArticle(env, id);
    return error('Method not allowed', 405);
  } catch (e) {
    console.error(e);
    return error('Internal server error', 500);
  }
}

async function getArticle(env, id, slug, isAdmin) {
  let result;
  if (slug && slug !== 'undefined') {
    result = await env.DB.prepare("SELECT * FROM articles WHERE slug = ? AND is_published = 1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))").bind(slug).first();
  } else if (id && id !== 'new') {
    if (isAdmin) {
      result = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first();
    } else {
      result = await env.DB.prepare("SELECT * FROM articles WHERE id = ? AND is_published = 1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))").bind(id).first();
    }
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
  const author = (data.author || existing.author || 'Admin').trim();
  const tags = (data.tags || '').trim();
  const is_published = data.is_published !== undefined ? (data.is_published ? 1 : 0) : existing.is_published;
  const scheduled_at = data.scheduled_at !== undefined ? data.scheduled_at : existing.scheduled_at;

  const result = await env.DB.prepare(
    `UPDATE articles SET title=?, slug=?, content_md=?, summary=?, cover_image=?, author=?, tags=?, is_published=?, scheduled_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *`
  ).bind(title, slug, content_md, summary, cover_image, author, tags, is_published, scheduled_at, id).first();

  return json(result);
}

async function deleteArticle(env, id) {
  await env.DB.prepare('DELETE FROM comments WHERE article_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM likes WHERE article_id = ?').bind(id).run();
  const { meta } = await env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
  if (meta.changes === 0) return error('Not found', 404);
  return json({ success: true });
}
