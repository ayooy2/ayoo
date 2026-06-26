import { requireAuth } from '../lib/auth.js';
import { error } from '../lib/response.js';

export async function onRequest(context) {
  const { request, env } = context;

  // 只允许 GET 请求
  if (request.method !== 'GET') {
    return error('Method not allowed', 405);
  }

  // 需要管理员认证
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  try {
    // 逐表查询，避免一次性占用过多内存
    const sites = (await env.DB.prepare('SELECT * FROM sites ORDER BY sort_order, id').all()).results || [];
    const settings = (await env.DB.prepare('SELECT * FROM settings').all()).results || [];
    const articles = (await env.DB.prepare('SELECT * FROM articles ORDER BY id').all()).results || [];
    const comments = (await env.DB.prepare('SELECT * FROM comments ORDER BY id').all()).results || [];
    const likes = (await env.DB.prepare('SELECT * FROM likes ORDER BY id').all()).results || [];
    const guestbook = (await env.DB.prepare('SELECT * FROM guestbook ORDER BY id').all()).results || [];
    const now_items = (await env.DB.prepare('SELECT * FROM now_items ORDER BY sort_order, id').all()).results || [];
    const tags = (await env.DB.prepare('SELECT * FROM tags ORDER BY id').all()).results || [];

    // images 表只导出元数据，不导出 base64 数据
    const images = (await env.DB.prepare('SELECT id, filename, mime_type, created_at FROM images ORDER BY id').all()).results || [];

    const exportData = {
      exported_at: new Date().toISOString(),
      version: '1.0',
      tables: {
        sites,
        settings,
        articles,
        comments,
        likes,
        guestbook,
        now_items,
        tags,
        images
      }
    };

    const now = new Date();
    const dateStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    const filename = 'ayoo-backup-' + dateStr + '.json';

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + filename + '"; filename*=UTF-8\'\'' + encodeURIComponent(filename)
      }
    });
  } catch (e) {
    console.error('Export error:', e);
    return error('Export failed: ' + e.message, 500);
  }
}
