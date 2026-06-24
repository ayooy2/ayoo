import { error } from './response.js';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 核心认证函数：先检查 Cookie 会话，再检查密码
// password 参数可选，不传时从 Cookie 或 Authorization header 读取
export async function requireAuth(request, env, password) {
  // 1. 先检查 Cookie 会话
  const session = await getSessionFromCookie(request, env);
  if (session) return null;
  // 2. 再检查密码（Bearer 或直接传入）
  let token = password;
  if (!token) {
    const auth = request.headers.get('Authorization');
    if (!auth) return error('Unauthorized', 401);
    token = auth.replace('Bearer ', '');
  }
  try {
    const storedHash = await env.DB.prepare("SELECT value FROM settings WHERE key='admin_password_hash'").first();
    if (storedHash && storedHash.value) {
      const inputHash = await hashPassword(token);
      if (inputHash === storedHash.value) return null;
      return error('Unauthorized', 401);
    }
  } catch (e) {}
  if (env.ADMIN_PASSWORD && token === env.ADMIN_PASSWORD) return null;
  return error('Unauthorized', 401);
}

// 从 Cookie 中获取会话并验证
export async function getSessionFromCookie(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/admin_session=([a-f0-9]{64})/);
  if (!match) return null;
  const sessionToken = match[1];
  try {
    const sessionHash = await hashPassword(sessionToken);
    const row = await env.DB.prepare(
      "SELECT value, updated_at FROM settings WHERE key=?"
    ).bind('session_' + sessionHash).first();
    if (!row) return null;
    // 检查是否过期（24 小时）
    const expiresAt = new Date(row.updated_at).getTime() + 24 * 60 * 60 * 1000;
    if (Date.now() > expiresAt) {
      await env.DB.prepare("DELETE FROM settings WHERE key=?").bind('session_' + sessionHash).run();
      return null;
    }
    // 刷新过期时间
    await env.DB.prepare(
      "UPDATE settings SET updated_at=CURRENT_TIMESTAMP WHERE key=?"
    ).bind('session_' + sessionHash).run();
    return sessionToken;
  } catch (e) {
    return null;
  }
}

// 创建新会话，返回 session token
export async function createSession(env) {
  const token = generateToken();
  const hash = await hashPassword(token);
  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, '', CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value='', updated_at=CURRENT_TIMESTAMP"
  ).bind('session_' + hash).run();
  return token;
}

// 清除会话（从 Cookie 中提取 token 并删除）
export async function clearSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/admin_session=([a-f0-9]{64})/);
  if (!match) return;
  const sessionToken = match[1];
  const hash = await hashPassword(sessionToken);
  try {
    await env.DB.prepare("DELETE FROM settings WHERE key=?").bind('session_' + hash).run();
  } catch (e) {}
}
