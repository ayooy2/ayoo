import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

// GET: 文章列表（公开，支持分页和排序）
// POST: 创建文章（需认证）
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === 'GET') {
    return listArticles(env, new URL(request.url).searchParams);
  }

  if (method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    return createArticle(env, await request.json());
  }

  return error('Method not allowed', 405);
}

async function listArticles(env, params) {
  const page = Math.max(1, parseInt(params.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(params.get('limit')) || 10));
  const offset = (page - 1) * limit;
  const publishedOnly = params.get('all') !== '1';

  let where = publishedOnly
    ? "WHERE is_published = 1 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))"
    : '';
  const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM articles ${where}`).first();
  const total = countResult.total;

  const { results } = await env.DB.prepare(
    `SELECT id, title, slug, summary, cover_image, author, tags, is_published, scheduled_at, created_at, updated_at, views FROM articles ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  for (const row of results || []) {
    const likeResult = await env.DB.prepare('SELECT COUNT(*) as c FROM likes WHERE article_id = ?').bind(row.id).first();
    row.likes = likeResult.c;
    const commentResult = await env.DB.prepare('SELECT COUNT(*) as c FROM comments WHERE article_id = ?').bind(row.id).first();
    row.comments = commentResult.c;
  }

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

  const result = await env.DB.prepare(
    'INSERT INTO articles (title, slug, content_md, summary, cover_image, author, tags, is_published, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(title, slug, content_md, summary, cover_image, author, tags, is_published, scheduled_at).first();

  return json(result, 201);
}
