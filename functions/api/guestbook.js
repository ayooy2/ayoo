import { json, error } from '../lib/response.js';

// GET: 获取留言列表
// POST: 创建留言
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM guestbook ORDER BY created_at DESC LIMIT 50'
    ).all();
    return json(results || []);
  }

  if (request.method === 'POST') {
    const data = await request.json();
    const name = (data.name || '').trim().slice(0, 50);
    const url = (data.url || '').trim().slice(0, 200);
    const message = (data.message || '').trim().slice(0, 1000);

    if (!name) return error('名字不能为空', 400);
    if (!message) return error('留言内容不能为空', 400);

    const result = await env.DB.prepare(
      'INSERT INTO guestbook (name, url, message) VALUES (?, ?, ?) RETURNING *'
    ).bind(name, url || null, message).first();

    return json(result, 201);
  }

  return error('Method not allowed', 405);
}
