import { json, error } from '../../lib/response.js';
import { requireAuth } from '../../lib/auth.js';

// DELETE /api/comments/:id — 管理员删除评论（级联删除子回复）
export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = params.id;

  const authErr = await requireAuth(context.request, env);
  if (authErr) return authErr;
  if (!id || isNaN(id)) return error('Invalid comment id', 400);

  // 原子批量删除：子回复 + 自身
  const results = await env.DB.batch([
    env.DB.prepare('DELETE FROM comments WHERE parent_id = ?').bind(id),
    env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id),
  ]);
  const changes = (results[0].meta?.changes || 0) + (results[1].meta?.changes || 0);
  if (!changes) return error('Comment not found', 404);

  return json({ ok: true });
}
