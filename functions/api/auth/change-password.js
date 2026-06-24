import { json, error } from '../../lib/response.js';
import { requireAuth, clearSession } from '../../lib/auth.js';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST { current_password, new_password }
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return error('Method not allowed', 405);

  // Authenticate via Authorization header (doesn't read body)
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  // Parse body once
  const body = await request.json();
  const currentPassword = (body.current_password || '').trim();
  const newPassword = (body.new_password || '').trim();

  // Verify current password matches what's stored (defense in depth)
  const storedHash = await env.DB.prepare("SELECT value FROM settings WHERE key='admin_password_hash'").first();
  if (storedHash && storedHash.value) {
    // Has stored hash — verify current password against it
    const currentHash = await hashPassword(currentPassword);
    if (currentHash !== storedHash.value) {
      return error('当前密码错误', 403);
    }
  } else {
    // No stored hash yet — verify against env secret
    if (env.ADMIN_PASSWORD && currentPassword !== env.ADMIN_PASSWORD) {
      return error('当前密码错误', 403);
    }
  }

  if (!newPassword) return error('新密码不能为空', 400);
  if (newPassword.length > 100) return error('新密码不能超过100个字符', 400);

  // Hash and store new password
  const newHash = await hashPassword(newPassword);
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('admin_password_hash', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP"
  ).bind(newHash, newHash).run();

  // 清除当前会话，强制重新登录
  await clearSession(request, env);

  return json({ ok: true, message: '密码修改成功' }, {
    'Set-Cookie': 'admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
  });
}
