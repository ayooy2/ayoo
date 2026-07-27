import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

// GET: list all tags
// POST: create tag (auth required)
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    if (params.get('articles') === '1') {
      // 返回标签 + 关联文章数量
      const { results } = await env.DB.prepare(
        `SELECT t.*,
          (SELECT COUNT(*) FROM articles a
            WHERE a.is_published = 1
            AND (
              INSTR(',' || a.tags || ',', ',' || t.name || ',') > 0
              OR (
                SUBSTR(a.tags, 1, LENGTH(t.name) + 1) = t.name || ','
                AND (LENGTH(t.name) + 2 > LENGTH(',' || a.tags || ',') OR SUBSTR(',' || a.tags || ',', LENGTH(t.name) + 2, 1) = ',')
              )
            )
          ) as article_count
        FROM tags t ORDER BY t.name ASC`
      ).all();
      return json({ tags: results || [] });
    }
    const { results } = await env.DB.prepare(
      'SELECT * FROM tags ORDER BY name ASC'
    ).all();
    return json({ tags: results || [] });
  }

  if (request.method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;

    let data;
    try { data = await request.json(); } catch (e) { return error('请求格式错误', 400); }

    // 标签转换：POST /api/tags/convert
    if (data.action === 'convert') {
      const fromTag = (data.fromTag || '').trim();
      const toTag = (data.toTag || '').trim();
      if (!fromTag || !toTag) return error('请输入原标签和新标签名', 400);
      if (fromTag === toTag) return error('原标签和新标签不能相同', 400);

      // 验证两个标签都存在
      const [fromExists, toExists] = await Promise.all([
        env.DB.prepare('SELECT id FROM tags WHERE name=?').bind(fromTag).first(),
        env.DB.prepare('SELECT id FROM tags WHERE name=?').bind(toTag).first()
      ]);
      if (!fromExists) return error('原标签不存在', 400);
      if (!toExists) return error('新标签不存在', 400);

      // 替换文章 tags 字段中的标签名
      // 处理 4 种位置情况：在中间、在开头、在末尾、单独存在
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE articles SET tags =
            REPLACE(
              REPLACE(
                REPLACE(
                  CASE
                    WHEN SUBSTR(',' || tags || ',', INSTR(',' || tags || ',', ',' || ? || ',') + LENGTH(',' || ? || ',') + 1, 1) = ','
                    THEN SUBSTR(tags, 1, INSTR(',' || tags || ',', ',' || ? || ',') - 1) || ',' || SUBSTR(tags, INSTR(',' || tags || ',', ',' || ? || ',') + LENGTH(',' || ? || ','))
                    WHEN SUBSTR(',' || tags || ',', 1, LENGTH(? || ',')) = ? || ','
                    THEN SUBSTR(tags, LENGTH(? || ',') + 1)
                    ELSE tags
                  END,
                ',' || ?, ''),
              ?, ''),
            ',', '')
          WHERE ',' || tags || ',' LIKE '%,' || ? || ',%'
          RETURNING id`
        ).bind(toTag, fromTag, fromTag, fromTag, fromTag, fromTag, fromTag, fromTag, toTag, toTag, fromTag)
      ]);

      // 刷新标签列表
      const { results } = await env.DB.prepare('SELECT * FROM tags ORDER BY name ASC').all();
      return json({ ok: true, tags: results || [] });
    }

    const name = (data.name || '').trim().slice(0, 50);
    if (!name) return error('标签名不能为空', 400);

    const slug = (data.slug || '').trim() || name.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '');
    const color = (data.color || '').trim().slice(0, 20);

    try {
      const result = await env.DB.prepare(
        'INSERT INTO tags (name, slug, color) VALUES (?, ?, ?) RETURNING *'
      ).bind(name, slug, color || null).first();
      return json(result, 201);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) return error('标签名已存在', 409);
      throw e;
    }
  }

  return error('Method not allowed', 405);
}
