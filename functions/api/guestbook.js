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
    // IP 频率限制：同一 IP 30 秒内只能提交一次
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    try {
      const recent = await env.DB.prepare(
        "SELECT COUNT(*) as c FROM guestbook WHERE ip = ? AND created_at > datetime('now', '-30 seconds')"
      ).bind(ip).first();
      if (recent && recent.c > 0) return error('提交过于频繁，请稍后再试', 429);
    } catch (e) { /* ip column may not exist yet, skip rate limit */ }

    let data;
    try { data = await request.json(); } catch (e) { return error('请求格式错误', 400); }
    const name = stripHtml((data.name || '').trim()).slice(0, 50);
    const url = (data.url || '').trim().slice(0, 200);
    const message = stripHtml((data.message || '').trim()).slice(0, 1000);

    if (!name) return error('名字不能为空', 400);
    if (!message) return error('留言内容不能为空', 400);

    try {
      const result = await env.DB.prepare(
        'INSERT INTO guestbook (name, url, message, ip) VALUES (?, ?, ?, ?) RETURNING *'
      ).bind(name, url || null, message, ip).first();
      return json(result, 201);
    } catch (e) {
      // ip column may not exist yet, fallback without ip
      if (e.message && e.message.includes('no such column')) {
        const result = await env.DB.prepare(
          'INSERT INTO guestbook (name, url, message) VALUES (?, ?, ?) RETURNING *'
        ).bind(name, url || null, message).first();
        return json(result, 201);
      }
      throw e;
    }
  }

  return error('Method not allowed', 405);
}

function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, '');
}
