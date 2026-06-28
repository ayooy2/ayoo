import { requireAuth } from '../lib/auth.js';
import { json, error } from '../lib/response.js';

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

    // 按顺序导入各表（先清空再插入）
    const importOrder = ['sites', 'settings', 'articles', 'tags', 'comments', 'likes', 'guestbook', 'now_items'];

    for (const table of importOrder) {
      const rows = tables[table];
      if (!Array.isArray(rows) || !rows.length) {
        results[table] = { imported: 0, skipped: true };
        continue;
      }

      try {
        // 清空表
        await env.DB.prepare('DELETE FROM ' + table).run();

        // 获取表结构信息
        const columns = Object.keys(rows[0]);

        // 批量插入（每批 50 条）
        let imported = 0;
        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50);
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
        results[table] = { imported: 0, error: e.message };
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    console.error('Import error:', e);
    return error('导入失败，请稍后再试', 500);
  }
}
