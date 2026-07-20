import { json, error } from '../../lib/response.js';
import { requireAuth, clearAllSessions, validatePasswordComplexity, verifyPassword, hashPassword } from '../../lib/auth.js';

// POST { current_password, new_password }
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return error('Method not allowed', 405);

  // Authenticate via Cookie session or Authorization header
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  // 频率限制：5 分钟内最多 5 次密码修改尝试
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl_chpw_' + ip;
  try {
    const rl = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(rlKey).first();
    if (rl) {
      const { count, first } = JSON.parse(rl.value);
      const elapsed = Date.now() - first;
      if (elapsed < 300000 && count >= 5) {
        return error('尝试次数过多，请 5 分钟后再试', 429);
      }
      const next = elapsed >= 300000 ? { count: 1, first: Date.now() } : { count: count + 1, first };
      await env.DB.prepare("UPDATE settings SET value=? WHERE key=?")
        .bind(JSON.stringify(next), rlKey).run();
    } else {
      await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
        .bind(rlKey, JSON.stringify({ count: 1, first: Date.now() })).run();
    }
  } catch { /* rate limit non-critical */ }

  // Parse body once
  let body;
  try { body = await request.json(); } catch { return error('请求格式错误', 400); }
  const currentPassword = (body.current_password || '').trim();
  const newPassword = (body.new_password || '').trim();

  // 验证当前密码
  const storedHash = await env.DB.prepare("SELECT value FROM settings WHERE key='admin_password_hash'").first();
  if (storedHash && storedHash.value) {
    const result = await verifyPassword(currentPassword, storedHash.value);
    if (!result.valid) return error('当前密码错误', 403);
  } else {
    // 无存储哈希，对比 env secret
    if (env.ADMIN_PASSWORD && currentPassword !== env.ADMIN_PASSWORD) {
      return error('当前密码错误', 403);
    }
  }

  // 新密码复杂度校验
  const complexityErr = validatePasswordComplexity(newPassword);
  if (complexityErr) return error(complexityErr, 400);

  // 哈希并存储新密码（PBKDF2）
  const newHash = await hashPassword(newPassword);
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('admin_password_hash', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP"
  ).bind(newHash, newHash).run();

  // 清除所有会话，强制所有设备重新登录
  await clearAllSessions(env);

  return json({ ok: true, message: '密码修改成功' }, {
    'Set-Cookie': 'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  });
}
