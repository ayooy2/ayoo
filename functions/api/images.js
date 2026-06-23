import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

// GET ?id=:id 读取单张图片 / POST 上传（需认证）
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 读取图片（公开）
  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id) return error('id required', 400);
    const img = await env.DB.prepare('SELECT * FROM images WHERE id = ?').bind(id).first();
    if (!img) return error('Not found', 404);
    // 返回图片二进制，支持缓存
    const binary = base64ToBytes(img.data);
    return new Response(binary, {
      headers: {
        'Content-Type': img.mime_type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': binary.length.toString()
      }
    });
  }

  // 上传（需认证）
  if (request.method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    return uploadImage(env, await request.json());
  }

  return error('Method not allowed', 405);
}

async function uploadImage(env, data) {
  const filename = (data.filename || 'image').slice(0, 200);
  const mimeType = (data.mime_type || 'image/png').slice(0, 50);
  const imageData = (data.data || '').trim();
  if (!imageData) return error('data required', 400);
  if (imageData.length > 1024 * 1024) return error('Image too large (max 1MB base64)', 400);

  const result = await env.DB.prepare(
    'INSERT INTO images (filename, mime_type, data) VALUES (?, ?, ?) RETURNING id, filename, mime_type, created_at'
  ).bind(filename, mimeType, imageData).first();

  return json({ id: result.id, url: '/api/images?id=' + result.id, filename: result.filename }, 201);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
