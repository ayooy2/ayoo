import { json, error } from '../../lib/response.js';

// Simple hash for password storage (SHA-256 via Web Crypto)
async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST { current_password, new_password }
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return error('Method not allowed', 405);

  // Require authentication
  const auth = request.headers.get('Authorization');
  if (!auth) return error('Unauthorized', 401);

  // Verify current auth (check env secret or stored hash)
  const storedHash = await env.DB.prepare("SELECT value FROM settings WHERE key='admin_password_hash'").first();
  let authenticated = false;

  if (storedHash && storedHash.value) {
    // Verify against stored hash
    const data = await request.json();
    const currentHash = await hashPassword(data.current_password || '');
    if (currentHash === storedHash.value) authenticated = true;
  }

  // Fallback: verify against Cloudflare secret
  if (!authenticated && auth === 'Bearer ' + env.ADMIN_PASSWORD) {
    authenticated = true;
  }

  if (!authenticated) return error('当前密码错误', 403);

  const data = await request.json();
  const newPassword = (data.new_password || '').trim();

  if (!newPassword) return error('新密码不能为空', 400);
  if (newPassword.length < 1) return error('新密码至少1个字符', 400);
  if (newPassword.length > 100) return error('新密码不能超过100个字符', 400);

  // Hash and store new password
  const newHash = await hashPassword(newPassword);
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('admin_password_hash', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP"
  ).bind(newHash, newHash).run();

  return json({ ok: true, message: '密码修改成功' });
}
