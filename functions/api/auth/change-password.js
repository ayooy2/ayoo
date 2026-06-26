import { json, error } from '../../lib/response.js';
import { requireAuth, clearSession, validatePasswordComplexity } from '../../lib/auth.js';

// 旧 SHA-256 哈希（用于验证旧密码格式）
async function hashSHA256(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// PBKDF2 哈希，返回格式：salt_hex:hash_hex
async function hashPasswordPBKDF2(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const bytesToHex = bytes => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return bytesToHex(salt) + ':' + bytesToHex(new Uint8Array(hashBuffer));
}

// 验证密码（兼容旧 SHA-256 和新 PBKDF2）
async function verifyStoredPassword(password, stored) {
  if (stored && stored.includes(':')) {
    // 新格式 PBKDF2
    const [saltHex, hashHex] = stored.split(':');
    const hexToBytes = hex => {
      const arr = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      return arr;
    };
    const salt = hexToBytes(saltHex);
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    const computed = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computed === hashHex;
  }
  // 旧格式 SHA-256
  const oldHash = await hashSHA256(password);
  return oldHash === stored;
}

// POST { current_password, new_password }
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return error('Method not allowed', 405);

  // Authenticate via Cookie session or Authorization header
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  // Parse body once
  let body;
  try { body = await request.json(); } catch { return error('请求格式错误', 400); }
  const currentPassword = (body.current_password || '').trim();
  const newPassword = (body.new_password || '').trim();

  // 验证当前密码
  const storedHash = await env.DB.prepare("SELECT value FROM settings WHERE key='admin_password_hash'").first();
  if (storedHash && storedHash.value) {
    const valid = await verifyStoredPassword(currentPassword, storedHash.value);
    if (!valid) return error('当前密码错误', 403);
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
  const newHash = await hashPasswordPBKDF2(newPassword);
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('admin_password_hash', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP"
  ).bind(newHash, newHash).run();

  // 清除当前会话，强制重新登录
  await clearSession(request, env);

  return json({ ok: true, message: '密码修改成功' }, {
    'Set-Cookie': 'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  });
}
