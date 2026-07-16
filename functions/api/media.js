import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

// 允许的 MIME 类型
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/x-m4a'],
};

// 文件大小限制（字节）
const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,  // 10MB
  video: 50 * 1024 * 1024,  // 50MB
  audio: 10 * 1024 * 1024,  // 10MB
};

// MIME 类型到扩展名映射
const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'oga',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/x-m4a': 'm4a',
};

// GET /api/media?id=:id 读取文件 / GET /api/media?list=1 列表 / POST 上传 / DELETE 删除
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 读取文件（公开）
  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    // 列表查询（需认证，支持分页）
    if (url.searchParams.get('list') === '1') {
      const authErr = await requireAuth(request, env);
      if (authErr) return authErr;
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
      const offset = (page - 1) * limit;
      const countRow = await env.DB.prepare('SELECT COUNT(*) as total FROM media').first();
      const total = countRow ? countRow.total : 0;
      const { results } = await env.DB.prepare(
        'SELECT id, filename, mime_type, r2_key, file_size, type, created_at FROM media ORDER BY id DESC LIMIT ? OFFSET ?'
      ).bind(limit, offset).all();
      return json({ media: results || [], total, page, limit, hasMore: offset + limit < total });
    }
    if (!id) return error('id required', 400);
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId < 1) return error('无效的文件 ID', 400);
    return getFile(env, numId);
  }

  // 上传（需认证）
  if (request.method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    return uploadFile(env, request);
  }

  // 删除（需认证）
  if (request.method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = url.searchParams.get('id');
    if (!id) return error('id required', 400);
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId < 1) return error('无效的文件 ID', 400);
    return deleteFile(env, numId);
  }

  return error('Method not allowed', 405);
}

// 从 R2 获取文件
async function getFile(env, id) {
  const record = await env.DB.prepare(
    'SELECT id, filename, mime_type, r2_key, file_size, type FROM media WHERE id = ?'
  ).bind(id).first();
  if (!record) return error('Not found', 404);

  const object = await env.media.get(record.r2_key);
  if (!object) return error('File not found in storage', 404);

  const headers = {
    'Content-Type': record.mime_type || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Disposition': `inline; filename="${encodeURIComponent(record.filename)}"`,
  };

  // SVG 文件设置 CSP 防止 XSS
  if (record.mime_type === 'image/svg+xml') {
    headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  if (record.file_size) {
    headers['Content-Length'] = String(record.file_size);
  }

  return new Response(object.body, { headers });
}

// 上传文件到 R2
async function uploadFile(env, request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return error('请求格式错误，需要 multipart/form-data', 400);
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return error('缺少文件字段 file', 400);
  }

  const type = (formData.get('type') || 'image').toLowerCase();
  if (!ALLOWED_TYPES[type]) {
    return error('不支持的文件类型，允许: image, video, audio', 400);
  }

  // 验证 MIME 类型
  const mimeType = file.type || '';
  if (!ALLOWED_TYPES[type].includes(mimeType)) {
    return error(`不支持的 ${type} 格式: ${mimeType}`, 400);
  }

  // 验证文件大小
  const sizeLimit = SIZE_LIMITS[type];
  if (file.size > sizeLimit) {
    const limitMB = sizeLimit / (1024 * 1024);
    return error(`文件过大，${type} 限制 ${limitMB}MB`, 400);
  }

  // 清洗文件名
  const rawFilename = file.name || 'file';
  const filename = rawFilename.replace(/<[^>]*>/g, '').slice(0, 200);

  // 生成唯一 R2 key
  const ext = MIME_TO_EXT[mimeType] || 'bin';
  const timestamp = Date.now();
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const r2Key = `media/${type}/${timestamp}-${random}.${ext}`;

  // 读取文件内容
  const arrayBuffer = await file.arrayBuffer();
  const body = new Uint8Array(arrayBuffer);

  // 上传到 R2
  await env.media.put(r2Key, body, {
    httpMetadata: {
      contentType: mimeType,
      contentDisposition: `inline; filename="${encodeURIComponent(filename)}"`,
    },
  });

  // 写入 D1 记录
  try {
    const result = await env.DB.prepare(
      'INSERT INTO media (filename, mime_type, r2_key, file_size, type) VALUES (?, ?, ?, ?, ?) RETURNING id, filename, mime_type, r2_key, file_size, type, created_at'
    ).bind(filename, mimeType, r2Key, file.size, type).first();

    return json({
      id: result.id,
      url: '/api/media?id=' + result.id,
      filename: result.filename,
      mime_type: result.mime_type,
      size: result.file_size,
      type: result.type,
    }, 201);
  } catch (e) {
    // D1 插入失败，清理已上传的 R2 对象
    try { await env.media.delete(r2Key); } catch {}
    throw e;
  }
}

// 删除文件（R2 + D1）
async function deleteFile(env, id) {
  try {
    const record = await env.DB.prepare('SELECT id, r2_key FROM media WHERE id = ?').bind(id).first();
    if (!record) return error('Not found', 404);

    // 删除 R2 对象
    if (record.r2_key) {
      await env.media.delete(record.r2_key);
    }

    // 删除 D1 记录
    await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
    return json({ success: true });
  } catch (e) {
    console.error('Delete media error:', e);
    return error('删除失败', 500);
  }
}
