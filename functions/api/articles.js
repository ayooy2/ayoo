import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';
import { purgeCDN } from '../lib/cache.js';

// GET: 文章列表（公开，支持分页和排序）
// POST: 创建文章（需认证）
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === 'GET') {
    const params = new URL(request.url).searchParams;
    if (params.get('all') === '1') {
      const authErr = await requireAuth(request, env);
      if (authErr) return authErr;
    }
    return listArticles(env, params);
  }

  if (method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    let data;
    try { data = await request.json(); } catch { return error('请求格式错误', 400); }
    return createArticle(env, data);
  }

  return error('Method not allowed', 405);
}

async function listArticles(env, params) {
  const page = Math.max(1, parseInt(params.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(params.get('limit')) || 10));
  const offset = (page - 1) * limit;
  const publishedOnly = params.get('all') !== '1';

  let where = publishedOnly
    ? "WHERE a.is_published = 1 AND (a.scheduled_at IS NULL OR a.scheduled_at <= datetime('now'))"
    : '';
  const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM articles a ${where}`).first();
  const total = countResult ? countResult.total : 0;

  const { results } = await env.DB.prepare(
    `SELECT a.id, a.title, a.slug, a.summary, a.cover_image, a.author, a.tags, a.is_published, a.scheduled_at, a.created_at, a.updated_at, a.views,
      (SELECT COUNT(*) FROM likes WHERE article_id=a.id) as likes,
      (SELECT COUNT(*) FROM comments WHERE article_id=a.id) as comments
    FROM articles a ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return json({ articles: results || [], total, page, limit });
}

async function createArticle(env, data) {
  const title = (data.title || '').trim();
  if (!title) return error('Title is required', 400);

  let slug = (data.slug || '').trim();
  if (!slug) {
    slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/-+/g, '-');
    if (!slug || slug.length < 2) slug = 'article-' + Date.now().toString(36);
  }
  const content_md = data.content_md || '';
  const summary = (data.summary || '').trim();
  const cover_image = (data.cover_image || '').trim();
  const author = (data.author || 'Admin').trim();
  const tags = (data.tags || '').trim();
  const is_published = data.is_published ? 1 : 0;
  const scheduled_at = data.scheduled_at || null;

  try {
    const result = await env.DB.prepare(
      'INSERT INTO articles (title, slug, content_md, summary, cover_image, author, tags, is_published, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
    ).bind(title, slug, content_md, summary, cover_image, author, tags, is_published, scheduled_at).first();
    // 发布文章时清除 CDN 缓存
    if (is_published) purgeCDN(env, slug);
    return json(result, 201);
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return error('Slug already exists', 409);
    throw e;
  }
}
