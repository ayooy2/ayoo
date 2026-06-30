import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

// GET ?id=:id 读取单张图片 / GET ?list=1 列表 / POST 上传（需认证）/ DELETE 删除（需认证）
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 读取图片（公开）
  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    // 列表查询（需认证，支持分页）
    if (url.searchParams.get('list') === '1') {
      const authErr = await requireAuth(request, env);
      if (authErr) return authErr;
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
      const offset = (page - 1) * limit;
      const countRow = await env.DB.prepare('SELECT COUNT(*) as total FROM images').first();
      const total = countRow ? countRow.total : 0;
      const { results } = await env.DB.prepare('SELECT id, filename, mime_type, created_at FROM images ORDER BY id DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
      return json({ images: results || [], total, page, limit, hasMore: offset + limit < total });
    }
    if (!id) return error('id required', 400);
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId < 1) return error('无效的图片 ID', 400);
    const img = await env.DB.prepare('SELECT id, filename, mime_type, data FROM images WHERE id = ?').bind(numId).first();
    if (!img) return error('Not found', 404);
    if (!img.data) return error('Image data missing', 410);
    const binary = Uint8Array.from(atob(img.data), c => c.charCodeAt(0));
    return new Response(binary, {
      headers: {
        'Content-Type': img.mime_type || 'image/png',
        'Content-Length': String(binary.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    });
  }

  // 上传（需认证）
  if (request.method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    let data;
    try { data = await request.json(); } catch { return error('请求格式错误', 400); }
    return uploadImage(env, data);
  }

  // 删除（需认证）
  if (request.method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = url.searchParams.get('id');
    if (!id) return error('id required', 400);
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId < 1) return error('无效的图片 ID', 400);
    return deleteImage(env, numId);
  }

  return error('Method not allowed', 405);
}

// SVG 已移除：可内嵌 script 导致存储型 XSS
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];

async function uploadImage(env, data) {
  const filename = (data.filename || 'image').replace(/<[^>]*>/g, '').slice(0, 200);
  const mimeType = (data.mime_type || 'image/png').slice(0, 50);
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return error('不支持的图片格式', 400);
  const imageData = (data.data || '').trim();
  if (!imageData) return error('data required', 400);
  // 验证 base64 有效性
  try { atob(imageData); } catch { return error('无效的图片数据', 400); }
  // D1 单列上限 256KB，base64 限制 250KB 留安全余量
  if (imageData.length > 250000) return error('Image too large (max ~180KB)', 400);
  const result = await env.DB.prepare(
    'INSERT INTO images (filename, data, mime_type) VALUES (?, ?, ?) RETURNING id, filename, mime_type, created_at'
  ).bind(filename, imageData, mimeType).first();
  return json({ id: result.id, url: '/api/images?id=' + result.id, filename: result.filename }, 201);
}

async function deleteImage(env, id) {
  try {
    const img = await env.DB.prepare('SELECT id FROM images WHERE id = ?').bind(id).first();
    if (!img) return error('Not found', 404);
    await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
    return json({ success: true });
  } catch (e) {
    console.error('Delete image error:', e);
    return error('删除失败', 500);
  }
}
