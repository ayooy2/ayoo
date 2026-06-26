import { error } from './response.js';

// --- 密码哈希（PBKDF2，向后兼容旧 SHA-256） ---

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return arr;
}

// 旧 SHA-256 哈希（用于向后兼容验证）
async function hashSHA256(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hash));
}

// 新 PBKDF2 哈希，返回格式：salt_hex:hash_hex
async function hashPassword(password) {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, HASH_BYTES * 8
  );
  return bytesToHex(salt) + ':' + bytesToHex(new Uint8Array(hashBuffer));
}

// SHA-256 哈希（用于会话 token，token 本身已是随机数据，无需 PBKDF2）
async function hashSessionToken(token) {
  return hashSHA256(token);
}

// 验证密码：自动识别新格式（含冒号）和旧格式（纯 64 字符 hex）
// 返回 { valid: boolean, needsRehash: boolean }
async function verifyPassword(password, stored) {
  if (stored && stored.includes(':')) {
    // 新格式：salt_hex:hash_hex
    const [saltHex, hashHex] = stored.split(':');
    const salt = hexToBytes(saltHex);
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial, HASH_BYTES * 8
    );
    const computed = bytesToHex(new Uint8Array(hashBuffer));
    return { valid: computed === hashHex, needsRehash: false };
  }
  // 旧格式：纯 SHA-256 hex（64 字符）
  const oldHash = await hashSHA256(password);
  return { valid: oldHash === stored, needsRehash: true };
}

// 密码复杂度校验：至少 8 字符
export function validatePasswordComplexity(password) {
  if (!password || password.length < 8) return '密码长度至少为 8 个字符';
  if (password.length > 100) return '密码不能超过 100 个字符';
  return null;
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
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
      const result = await verifyPassword(token, storedHash.value);
      if (!result.valid) return error('Unauthorized', 401);
      // 旧 SHA-256 格式验证成功，自动升级为 PBKDF2
      if (result.needsRehash) {
        const newHash = await hashPassword(token);
        await env.DB.prepare(
          "UPDATE settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='admin_password_hash'"
        ).bind(newHash).run();
      }
      return null;
    }
  } catch (e) {
    console.error('Auth DB error:', e);
    return error('Service temporarily unavailable', 503);
  }
  return error('Unauthorized', 401);
}

// 从 Cookie 中获取会话并验证
export async function getSessionFromCookie(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/admin_session=([a-f0-9]{64})/);
  if (!match) return null;
  const sessionToken = match[1];
  try {
    const sessionHash = await hashSessionToken(sessionToken);
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
  const hash = await hashSessionToken(token);
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
  const hash = await hashSessionToken(sessionToken);
  try {
    await env.DB.prepare("DELETE FROM settings WHERE key=?").bind('session_' + hash).run();
  } catch (e) {}
}
