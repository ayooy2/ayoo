import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

// GET ?page=1&limit=50  获取错误日志（需认证）
// POST 上报客户端错误（公开）
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const offset = (page - 1) * limit;
    const level = url.searchParams.get('level') || '';

    let sql = 'SELECT id, level, message, path, created_at FROM error_logs';
    let countSql = 'SELECT COUNT(*) as total FROM error_logs';
    const params = [];

    if (level && ['error', 'warn', 'info'].includes(level)) {
      sql += ' WHERE level = ?';
      countSql += ' WHERE level = ?';
      params.push(level);
    }

    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';

    const countRow = await env.DB.prepare(countSql).bind(...params).first();
    const total = countRow ? countRow.total : 0;

    const { results } = await env.DB.prepare(sql).bind(...params, limit, offset).all();
    return json({ logs: results || [], total, page, limit, hasMore: offset + limit < total });
  }

  if (request.method === 'POST') {
    let data;
    try { data = await request.json(); } catch { return error('无效的请求数据', 400); }

    const level = ['error', 'warn', 'info'].includes(data.level) ? data.level : 'error';
    const message = String(data.message || '').slice(0, 500);
    const path = String(data.path || '').slice(0, 200);
    const stack = String(data.stack || '').slice(0, 2000);
    const userAgent = request.headers.get('User-Agent') || '';
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (!message) return error('message required', 400);

    try {
      await env.DB.prepare(
        'INSERT INTO error_logs (level, message, path, user_agent, ip, stack) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(level, message, path, userAgent.slice(0, 500), ip, stack).run();
    } catch (e) {
      console.error('Failed to log error:', e);
    }

    return json({ success: true }, 201);
  }

  // DELETE 清空日志（需认证）
  if (request.method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    await env.DB.prepare('DELETE FROM error_logs').run();
    return json({ success: true });
  }

  return error('Method not allowed', 405);
}
