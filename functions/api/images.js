import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

// GET ?id=:id 读取单张图片 / POST 上传（需认证）/ DELETE 删除（需认证）
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 读取图片（公开）
  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id) return error('id required', 400);
    const img = await env.DB.prepare('SELECT * FROM images WHERE id = ?').bind(id).first();
    if (!img) return error('Not found', 404);
    if (!img.r2_key) return error('Image data not available', 404);

    // 从 R2 读取图片二进制
    const obj = await env.IMAGES.get(img.r2_key);
    if (!obj) return error('Image data not found in storage', 404);

    return new Response(obj.body, {
      headers: {
        'Content-Type': img.mime_type || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    });
  }

  // 上传（需认证）
  if (request.method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    return uploadImage(env, await request.json());
  }

  // 删除（需认证）
  if (request.method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = url.searchParams.get('id');
    if (!id) return error('id required', 400);
    return deleteImage(env, id);
  }

  return error('Method not allowed', 405);
}

async function uploadImage(env, data) {
  const filename = (data.filename || 'image').slice(0, 200);
  const mimeType = (data.mime_type || 'image/png').slice(0, 50);
  const imageData = (data.data || '').trim();
  if (!imageData) return error('data required', 400);

  // base64 解码为 ArrayBuffer
  const binary = base64ToBytes(imageData);
  // 限制 5MB
  if (binary.length > 5 * 1024 * 1024) return error('Image too large (max 5MB)', 400);

  // 生成 R2 key：images/{timestamp}_{random}.{ext}
  const ext = mimeToExt(mimeType);
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const r2Key = `images/${Date.now()}_${rand}.${ext}`;

  // 写入 R2
  await env.IMAGES.put(r2Key, binary, {
    httpMetadata: { contentType: mimeType },
  });

  // D1 只存元数据
  const result = await env.DB.prepare(
    'INSERT INTO images (filename, mime_type, r2_key, file_size) VALUES (?, ?, ?, ?) RETURNING id, filename, mime_type, created_at'
  ).bind(filename, mimeType, r2Key, binary.length).first();

  return json({ id: result.id, url: '/api/images?id=' + result.id, filename: result.filename }, 201);
}

async function deleteImage(env, id) {
  const img = await env.DB.prepare('SELECT r2_key FROM images WHERE id = ?').bind(id).first();
  if (!img) return error('Not found', 404);

  // 删除 R2 对象
  if (img.r2_key) {
    await env.IMAGES.delete(img.r2_key);
  }

  // 删除 D1 记录
  await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();

  return json({ success: true });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function mimeToExt(mime) {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp',
  };
  return map[mime] || 'bin';
}
