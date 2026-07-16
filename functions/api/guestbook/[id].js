import { json, error } from '../../lib/response.js';
import { requireAuth } from '../../lib/auth.js';

// DELETE: 删除留言（需认证）
export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;

    const id = parseInt(params.id, 10);
    if (isNaN(id) || id < 1) return error('无效的 ID', 400);

    try {
      const existing = await env.DB.prepare('SELECT id FROM guestbook WHERE id = ?').bind(id).first();
      if (!existing) return error('留言不存在', 404);
      await env.DB.prepare('DELETE FROM guestbook WHERE id = ?').bind(id).run();
      return json({ success: true });
    } catch (e) {
      console.error('Delete guestbook error:', e);
      return error('删除失败', 500);
    }
  }

  return error('Method not allowed', 405);
}
