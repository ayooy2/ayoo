import { json, error } from '../lib/response.js';

// GET ?article_id=:id&page=1&limit=20 获取评论列表（分页，最新置顶）
// POST 创建评论（公开，含校验+防重复+XSS过滤）
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const articleId = url.searchParams.get('article_id');
    if (!articleId) return error('article_id required', 400);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 获取总数
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM comments WHERE article_id = ?'
    ).bind(articleId).first();
    const total = countRow ? countRow.total : 0;

    // 获取当前页的顶级评论（最新置顶）
    const { results } = await env.DB.prepare(
      'SELECT id, article_id, parent_id, author_name, email, url, content, created_at FROM comments WHERE article_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(articleId, limit, offset).all();

    const comments = results || [];
    // 如果有顶级评论，获取它们的子回复（不分页，全部加载）
    if (comments.length) {
      const ids = comments.map(c => c.id);
      const placeholders = ids.map(() => '?').join(',');
      const { results: replies } = await env.DB.prepare(
        'SELECT id, article_id, parent_id, author_name, email, url, content, created_at FROM comments WHERE parent_id IN (' + placeholders + ') ORDER BY created_at ASC'
      ).bind(...ids).all();
      // 合并子回复到树结构
      const all = [...comments, ...(replies || [])];
      const tree = buildTree(all);
      return json({ comments: tree, total, page, limit, hasMore: offset + limit < total });
    }

    return json({ comments: [], total, page, limit, hasMore: false });
  }

  if (request.method === 'POST') {
    let data;
    try { data = await request.json(); }
    catch { return error('无效的请求数据', 400); }

    const articleId = data.article_id;
    const parentId = data.parent_id || null;
    const authorName = strip((data.author_name || '').trim());
    const email = (data.email || '').trim().toLowerCase();
    const urlStr = (data.url || '').trim();
    const content = strip((data.content || '').trim());

    // 校验
    if (!authorName) return error('昵称不能为空', 400);
    if (authorName.length > 20) return error('昵称不能超过 20 个字符', 400);
    if (authorName.replace(/\s/g, '').length === 0) return error('昵称不能全是空格', 400);

    if (!email) return error('邮箱不能为空', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('邮箱格式不正确', 400);

    if (!content) return error('评论内容不能为空', 400);
    if (content.length < 5) return error('评论内容至少 5 个字符', 400);
    if (content.length > 500) return error('评论内容不能超过 500 个字符', 400);

    // 网址校验（选填）
    let finalUrl = '';
    if (urlStr) {
      if (!/^https?:\/\/.+/i.test(urlStr)) return error('网址格式不正确，需以 http:// 或 https:// 开头', 400);
      finalUrl = urlStr.slice(0, 200);
    }

    if (!articleId) return error('article_id required', 400);

    // 防重复：30 秒内同一邮箱禁止连续发布
    const recent = await env.DB.prepare(
      "SELECT id FROM comments WHERE email = ? AND article_id = ? AND created_at > datetime('now', '-30 seconds') LIMIT 1"
    ).bind(email, articleId).first();
    if (recent) return error('请勿频繁提交，30 秒后再试', 429);

    // 基础敏感词过滤（广告导流）
    if (hasSpam(content) || hasSpam(authorName)) return error('评论内容包含不允许的词汇', 400);

    const result = await env.DB.prepare(
      'INSERT INTO comments (article_id, parent_id, author_name, email, url, content) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, article_id, parent_id, author_name, email, url, content, created_at'
    ).bind(articleId, parentId, authorName, email, finalUrl, content).first();

    return json(result, 201);
  }

  return error('Method not allowed', 405);
}

// 构建树形结构
function buildTree(comments) {
  const map = {};
  const roots = [];
  for (const c of comments) { map[c.id] = c; c.replies = []; }
  for (const c of comments) {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].replies.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

// 过滤 HTML 标签防 XSS
function strip(s) {
  return String(s || '').replace(/<[^>]*>/g, '');
}

// 基础敏感词检测
function hasSpam(s) {
  const lower = String(s || '').toLowerCase();
  const words = ['buy now', 'click here', 'free money', 'casino', 'viagra', '彩票', '赌博', '代开发票'];
  return words.some(w => lower.indexOf(w) >= 0);
}
