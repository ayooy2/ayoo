import { json, error } from '../../lib/response.js';
import { clearAllSessions } from '../../lib/auth.js';

// POST - 重置密码（需要 Cloudflare Secret 作为 master key）
// 这是一个紧急恢复端点，删除数据库中的密码哈希，允许用 env.ADMIN_PASSWORD 重新登录
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return error('Method not allowed', 405);

  // 频率限制：5 分钟内最多 5 次
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl_reset_' + ip;
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

  // 验证 master key
  let body;
  try { body = await request.json(); } catch { return error('请求格式错误', 400); }
  const masterKey = (body.master_key || '').trim();

  if (!masterKey) return error('请输入 master key', 400);
  if (!env.ADMIN_PASSWORD || masterKey !== env.ADMIN_PASSWORD) {
    return error('Master key 错误', 403);
  }

  // 删除密码哈希和所有会话
  await env.DB.prepare("DELETE FROM settings WHERE key='admin_password_hash'").run();
  await clearAllSessions(env);

  return json({
    ok: true,
    message: '密码已重置。请使用 Cloudflare Secret 中的密码重新登录，然后修改密码。'
  });
}
