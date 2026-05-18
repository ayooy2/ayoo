import { json, error } from '../lib/response.js';

// GET ?article_id=:id 获取评论列表
// POST 创建评论（公开）
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const articleId = url.searchParams.get('article_id');
    if (!articleId) return error('article_id required', 400);
    const { results } = await env.DB.prepare(
      'SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC'
    ).bind(articleId).all();
    return json(buildTree(results || []));
  }

  if (request.method === 'POST') {
    const data = await request.json();
    const articleId = data.article_id;
    const parentId = data.parent_id || null;
    const authorName = (data.author_name || '匿名').trim().slice(0, 50);
    const content = (data.content || '').trim().slice(0, 2000);
    if (!articleId || !content) return error('article_id and content required', 400);

    const result = await env.DB.prepare(
      'INSERT INTO comments (article_id, parent_id, author_name, content) VALUES (?, ?, ?, ?) RETURNING *'
    ).bind(articleId, parentId, authorName, content).first();

    return json(result, 201);
  }

  return error('Method not allowed', 405);
}

function buildTree(comments) {
  const map = {};
  const roots = [];
  for (const c of comments) { map[c.id] = c; c.replies = []; }
  for (const c of comments) {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].replies.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}
