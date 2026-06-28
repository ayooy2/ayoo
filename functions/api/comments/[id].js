import { json, error } from '../../lib/response.js';
import { requireAuth } from '../../lib/auth.js';

// DELETE /api/comments/:id — 管理员删除评论（递归删除所有子回复）
export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = params.id;

  const authErr = await requireAuth(context.request, env);
  if (authErr) return authErr;
  if (!id || isNaN(id)) return error('Invalid comment id', 400);

  // 递归获取所有后代评论 ID
  async function getDescendantIds(parentId) {
    const { results } = await env.DB.prepare('SELECT id FROM comments WHERE parent_id = ?').bind(parentId).all();
    const ids = (results || []).map(r => r.id);
    for (const childId of ids) {
      const childIds = await getDescendantIds(childId);
      ids.push(...childIds);
    }
    return ids;
  }

  const descendantIds = await getDescendantIds(id);
  const allIds = [parseInt(id), ...descendantIds];
  const placeholders = allIds.map(() => '?').join(',');

  const result = await env.DB.prepare('DELETE FROM comments WHERE id IN (' + placeholders + ')').bind(...allIds).run();
  const changes = result.meta?.changes || 0;
  if (!changes) return error('Comment not found', 404);

  return json({ ok: true, deleted: changes });
}
