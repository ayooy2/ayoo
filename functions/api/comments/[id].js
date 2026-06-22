import { json, error } from '../../lib/response.js';

// DELETE /api/comments/:id — 管理员删除评论（级联删除子回复）
export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = params.id;

  // 认证
  const auth = context.request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.ADMIN_PASSWORD}`) {
    return error('Unauthorized', 401);
  }

  if (!id || isNaN(id)) return error('Invalid comment id', 400);

  // 检查评论是否存在
  const comment = await env.DB.prepare('SELECT id FROM comments WHERE id = ?').bind(id).first();
  if (!comment) return error('Comment not found', 404);

  // 级联删除：先删子回复，再删自身
  await env.DB.prepare('DELETE FROM comments WHERE parent_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();

  return json({ ok: true });
}
