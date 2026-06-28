import { requireAuth } from '../lib/auth.js';
import { json, error } from '../lib/response.js';

// 列名白名单，防止 SQL 注入
const COLUMN_WHITELIST = {
  sites: ['id', 'title', 'url', 'icon', 'description', 'sort_order', 'created_at'],
  settings: ['key', 'value'],
  articles: ['id', 'title', 'slug', 'summary', 'content_md', 'cover_image', 'author', 'tags', 'is_published', 'views', 'created_at', 'updated_at', 'scheduled_at'],
  tags: ['id', 'name', 'slug', 'color', 'created_at'],
  comments: ['id', 'article_id', 'parent_id', 'author_name', 'url', 'content', 'created_at'],
  likes: ['id', 'article_id', 'fingerprint', 'created_at'],
  guestbook: ['id', 'name', 'url', 'message', 'created_at'],
  now_items: ['id', 'category', 'content', 'sort_order', 'created_at']
};

// 不允许导入的 settings key（安全过滤）
const BLOCKED_SETTINGS = ['admin_password_hash', 'admin_password_changed_at'];

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return error('Method not allowed', 405);
  }

  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  try {
    let data;
    try { data = await request.json(); } catch { return error('无效的 JSON 数据', 400); }

    if (!data.tables || typeof data.tables !== 'object') {
      return error('数据格式错误：缺少 tables 字段', 400);
    }

    const tables = data.tables;
    const results = {};

    // 按顺序导入各表
    const importOrder = ['sites', 'settings', 'articles', 'tags', 'comments', 'likes', 'guestbook', 'now_items'];

    for (const table of importOrder) {
      const rows = tables[table];
      if (!Array.isArray(rows) || !rows.length) {
        results[table] = { imported: 0, skipped: true };
        continue;
      }

      try {
        const allowedColumns = COLUMN_WHITELIST[table];
        if (!allowedColumns) {
          results[table] = { imported: 0, error: '未知表' };
          continue;
        }

        // 过滤列名，只保留白名单中的列
        const inputColumns = Object.keys(rows[0]);
        const columns = inputColumns.filter(c => allowedColumns.includes(c));
        if (!columns.length) {
          results[table] = { imported: 0, error: '无有效列' };
          continue;
        }

        // 安全过滤：settings 表不允许导入敏感 key
        let filteredRows = rows;
        if (table === 'settings') {
          filteredRows = rows.filter(row => !BLOCKED_SETTINGS.includes(row.key));
        }

        // 清空表
        await env.DB.prepare('DELETE FROM ' + table).run();

        // 批量插入（每批 50 条）
        let imported = 0;
        for (let i = 0; i < filteredRows.length; i += 50) {
          const batch = filteredRows.slice(i, i + 50);
          const stmts = batch.map(row => {
            const vals = columns.map(c => row[c] !== undefined ? row[c] : null);
            const placeholders = columns.map(() => '?').join(', ');
            return env.DB.prepare(
              'INSERT INTO ' + table + ' (' + columns.join(', ') + ') VALUES (' + placeholders + ')'
            ).bind(...vals);
          });
          await env.DB.batch(stmts);
          imported += batch.length;
        }

        results[table] = { imported };
      } catch (e) {
        results[table] = { imported: 0, error: '导入失败' };
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error('Import error:', e);
    return error('导入失败，请稍后再试', 500);
  }
}
