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

  // 频率限制
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const rateErr = checkRateLimit(ip);
  if (rateErr) return rateErr;

  let body;
  try { body = await request.json(); } catch(e) { return error('请求格式错误', 400); }
  const password = (body.password || '').trim();
  if (!password) return error('请输入密码', 400);

  // 验证密码
  const authErr = await requireAuth(request, env, password);
  if (authErr) {
    recordFailure(ip);
    return error('密码错误', 401);
  }

  // 创建会话并返回 Set-Cookie
  clearRateLimit(ip);
  const sessionToken = await createSession(env);
  return json({ ok: true }, {
    'Set-Cookie': `admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
  });
}

// --- 频率限制（内存级，Worker 重启后重置） ---
const rateMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const rec = rateMap.get(ip);
  if (!rec) return null;
  // 5 分钟窗口过期则清除
  if (now - rec.windowStart > 5 * 60 * 1000) { rateMap.delete(ip); return null; }
  if (rec.count >= 5) return error('登录尝试过多，请 5 分钟后再试', 429);
  return null;
}

function recordFailure(ip) {
  const now = Date.now();
  const rec = rateMap.get(ip);
  if (!rec || now - rec.windowStart > 5 * 60 * 1000) {
    rateMap.set(ip, { count: 1, windowStart: now });
  } else {
    rec.count++;
  }
}

function clearRateLimit(ip) {
  rateMap.delete(ip);
}
