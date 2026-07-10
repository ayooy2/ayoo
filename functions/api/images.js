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
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
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
    const contentType = request.headers.get('Content-Type') || '';
    // FormData 上传走 R2 存储
    if (contentType.includes('multipart/form-data')) {
      return uploadToR2(env, request);
    }
    // JSON 上传走旧的 base64/D1 存储（向后兼容）
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

// R2 上传路径（FormData 格式，向后兼容）
const MIME_TO_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/bmp': 'bmp',
};

async function uploadToR2(env, request) {
  if (!env.MEDIA) return error('R2 存储未配置', 500);
  let formData;
  try { formData = await request.formData(); } catch { return error('请求格式错误', 400); }
  const file = formData.get('file');
  if (!file || typeof file === 'string') return error('缺少文件字段 file', 400);
  const mimeType = file.type || '';
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return error('不支持的图片格式', 400);
  if (file.size > 10 * 1024 * 1024) return error('文件过大，限制 10MB', 400);
  const filename = (file.name || 'image').replace(/<[^>]*>/g, '').slice(0, 200);
  const ext = MIME_TO_EXT[mimeType] || 'bin';
  const timestamp = Date.now();
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const r2Key = `media/image/${timestamp}-${random}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  await env.MEDIA.put(r2Key, new Uint8Array(arrayBuffer), {
    httpMetadata: { contentType: mimeType, contentDisposition: `inline; filename="${encodeURIComponent(filename)}"` },
  });
  // 写入 media 表（如果有）和 images 表保持兼容
  try {
    const result = await env.DB.prepare(
      'INSERT INTO media (filename, mime_type, r2_key, file_size, type) VALUES (?, ?, ?, ?, ?) RETURNING id'
    ).bind(filename, mimeType, r2Key, file.size, 'image').first();
    return json({ id: result.id, url: '/api/media?id=' + result.id, filename, mime_type: mimeType, size: file.size, type: 'image' }, 201);
  } catch {
    // media 表可能不存在，回退到 images 表
    return json({ url: '/api/media/' + r2Key, filename, mime_type: mimeType, size: file.size }, 201);
  }
}
