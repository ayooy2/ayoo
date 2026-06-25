import { json, error } from '../lib/response.js';
import { requireAuth, createSession, getSessionFromCookie, clearSession } from '../lib/auth.js';

// GET - 检查会话状态（Cookie 方式）
export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await getSessionFromCookie(request, env);
  if (session) return json({ ok: true });
  // 也支持旧的 Bearer 方式（兼容）
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  return json({ ok: true });
}

// POST - 登录（密码验证 + 设置 Cookie 会话）
export async function onRequestPost(context) {
  const { request, env } = context;

  // 频率限制（D1 存储，跨 Worker 实例共享）
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const rateErr = await checkRateLimit(ip, env.DB);
  if (rateErr) return rateErr;

  let body;
  try { body = await request.json(); } catch(e) { return error('请求格式错误', 400); }
  const password = (body.password || '').trim();
  if (!password) return error('请输入密码', 400);

  // 验证密码
  const authErr = await requireAuth(request, env, password);
  if (authErr) {
    await recordFailure(ip, env.DB);
    return error('密码错误', 401);
  }

  // 创建会话并返回 Set-Cookie
  await clearRateLimit(ip, env.DB);
  const sessionToken = await createSession(env);
  return json({ ok: true }, {
    'Set-Cookie': `admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
  });
}

// --- 频率限制（D1 存储，跨 Worker 实例共享） ---
async function checkRateLimit(ip, db) {
  // 清理超过 1 小时的旧记录
  await db.prepare('DELETE FROM rate_limits WHERE attempted_at < datetime(\'now\', \'-1 hour\')').run();
  // 检查最近 5 分钟内的尝试次数
  const row = await db.prepare(
    'SELECT COUNT(*) as cnt FROM rate_limits WHERE ip = ? AND action = \'login\' AND attempted_at > datetime(\'now\', \'-5 minutes\')'
  ).bind(ip).first();
  if (row && row.cnt >= 5) return error('登录尝试过多，请 5 分钟后再试', 429);
  return null;
}

async function recordFailure(ip, db) {
  await db.prepare(
    'INSERT INTO rate_limits (ip, action) VALUES (?, \'login\')'
  ).bind(ip).run();
}

async function clearRateLimit(ip, db) {
  await db.prepare(
    'DELETE FROM rate_limits WHERE ip = ? AND action = \'login\''
  ).bind(ip).run();
}
