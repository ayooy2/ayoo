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
    // 从 base64 解码
    const binary = Uint8Array.from(atob(img.data), c => c.charCodeAt(0));
    return new Response(binary, {
      headers: {
        'Content-Type': img.mime_type || 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    });
  }

  // 上传（需认证）
  if (request.method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      return uploadImage(env, await request.json());
    } catch (e) {
      return error('请求格式错误', 400);
    }
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

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

async function uploadImage(env, data) {
  const filename = (data.filename || 'image').slice(0, 200);
  const mimeType = (data.mime_type || 'image/png').slice(0, 50);
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return error('不支持的图片格式', 400);
  const imageData = (data.data || '').trim();
  if (!imageData) return error('data required', 400);
  // D1 单列上限 256KB，base64 限制 250KB 留安全余量
  if (imageData.length > 250000) return error('Image too large (max ~180KB)', 400);
  const result = await env.DB.prepare(
    'INSERT INTO images (filename, data, mime_type) VALUES (?, ?, ?) RETURNING id, filename, mime_type, created_at'
  ).bind(filename, imageData, mimeType).first();
  return json({ id: result.id, url: '/api/images?id=' + result.id, filename: result.filename }, 201);
}

async function deleteImage(env, id) {
  const img = await env.DB.prepare('SELECT id FROM images WHERE id = ?').bind(id).first();
  if (!img) return error('Not found', 404);
  await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
  return json({ success: true });
}
