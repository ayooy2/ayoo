import { json, error } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

// GET ?article_id=:id&page=1&limit=20 获取评论列表（分页，最新置顶）
// GET ?all=1 管理员获取所有评论（需认证）
// POST 创建评论（公开，含校验+防重复+XSS过滤）
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    // 管理员批量查询：返回所有评论 + 文章信息
    if (url.searchParams.get('all') === '1') {
      const authErr = await requireAuth(request, env);
      if (authErr) return authErr;
      const { results } = await env.DB.prepare(
        'SELECT c.id, c.article_id, c.parent_id, c.author_name, c.content, c.created_at, a.title as article_title, a.slug as article_slug FROM comments c LEFT JOIN articles a ON c.article_id = a.id ORDER BY c.created_at DESC'
      ).all();
      return json({ comments: results || [] });
    }

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

    // 获取当前页的顶级评论（最新置顶），不返回 email，返回 avatar_url
    const { results } = await env.DB.prepare(
      'SELECT id, article_id, parent_id, author_name, url, content, created_at FROM comments WHERE article_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(articleId, limit, offset).all();

    const comments = results || [];
    if (comments.length) {
      const ids = comments.map(c => c.id);
      const placeholders = ids.map(() => '?').join(',');
      const { results: replies } = await env.DB.prepare(
        'SELECT id, article_id, parent_id, author_name, url, content, created_at FROM comments WHERE parent_id IN (' + placeholders + ') ORDER BY created_at ASC'
      ).bind(...ids).all();
      const all = [...comments, ...(replies || [])];
      // 为每条评论添加 avatar_url（服务端计算 MD5）
      const emailMap = await getEmailMap(env.DB, articleId, all);
      for (const c of all) {
        const av = gravatarUrl(emailMap[c.id] || '');
        c.avatar_url = av.url;
        c.avatar_hash = av.hash;
      }
      const tree = buildTree(all);
      return json({ comments: tree, total, page, limit, hasMore: offset + limit < total });
    }

    return json({ comments: [], total, page, limit, hasMore: false });
  }

  if (request.method === 'POST') {
    let data;
    try { data = await request.json(); }
    catch { return error('无效的请求数据', 400); }

    const articleId = parseInt(data.article_id);
    const parentId = data.parent_id ? parseInt(data.parent_id) : null;
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

    let finalUrl = '';
    if (urlStr) {
      if (!/^https?:\/\/.+/i.test(urlStr)) return error('网址格式不正确，需以 http:// 或 https:// 开头', 400);
      finalUrl = urlStr.slice(0, 200);
    }

    if (!articleId || isNaN(articleId)) return error('article_id required', 400);

    // 验证 parent_id 存在且属于同一文章
    if (parentId) {
      const parent = await env.DB.prepare(
        'SELECT id, article_id FROM comments WHERE id = ?'
      ).bind(parentId).first();
      if (!parent) return error('父评论不存在', 400);
      if (parent.article_id !== articleId) return error('父评论不属于该文章', 400);
    }

    // 防重复：30 秒内同一邮箱或同一 IP 禁止连续发布
    const recent = await env.DB.prepare(
      "SELECT id FROM comments WHERE email = ? AND article_id = ? AND created_at > datetime('now', '-30 seconds') LIMIT 1"
    ).bind(email, articleId).first();
    if (recent) return error('请勿频繁提交，30 秒后再试', 429);

    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (ip) {
      try {
        const recentIp = await env.DB.prepare(
          "SELECT id FROM comments WHERE ip = ? AND article_id = ? AND created_at > datetime('now', '-30 seconds') LIMIT 1"
        ).bind(ip, articleId).first();
        if (recentIp) return error('请勿频繁提交，30 秒后再试', 429);
      } catch { /* ip column may not exist yet */ }
    }

    if (hasSpam(content) || hasSpam(authorName)) return error('评论内容包含不允许的词汇', 400);

    let result;
    if (ip) {
      try {
        result = await env.DB.prepare(
          'INSERT INTO comments (article_id, parent_id, author_name, email, url, content, ip) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, article_id, parent_id, author_name, url, content, created_at'
        ).bind(articleId, parentId, authorName, email, finalUrl, content, ip).first();
      } catch { /* ip column may not exist yet */ }
    }
    if (!result) {
      result = await env.DB.prepare(
        'INSERT INTO comments (article_id, parent_id, author_name, email, url, content) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, article_id, parent_id, author_name, url, content, created_at'
      ).bind(articleId, parentId, authorName, email, finalUrl, content).first();
    }

    // 返回时附带 avatar_url 和 avatar_hash
    const av = gravatarUrl(email);
    result.avatar_url = av.url;
    result.avatar_hash = av.hash;
    return json(result, 201);
  }

  return error('Method not allowed', 405);
}

// 批量获取评论邮箱用于计算 avatar（不暴露给前端）
async function getEmailMap(db, articleId, comments) {
  const ids = [...new Set(comments.map(c => c.id))];
  if (!ids.length) return {};
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db.prepare(
    'SELECT id, email FROM comments WHERE id IN (' + placeholders + ')'
  ).bind(...ids).all();
  const map = {};
  for (const r of (results || [])) map[r.id] = r.email;
  return map;
}

function gravatarUrl(email) {
  if (!email) return { url: '', hash: '' };
  const hash = md5(email.trim().toLowerCase());
  return { url: 'https://cravatar.cn/avatar/' + hash + '?d=mp&s=48', hash: hash };
}

// Minimal MD5 for Gravatar (works in Cloudflare Workers without node:crypto)
function md5(s) {
  function L(k,d){return(k<<d)|(k>>>(32-d))}
  function K(G,k){var I,d,F,H,x;F=(G&2147483648);H=(k&2147483648);I=(G&1073741824);d=(k&1073741824);x=(G&1073741823)+(k&1073741823);if(I&d)return(x^2147483648^F^H);if(I|d){if(x&1073741824)return(x^3221225472^F^H);else return(x^1073741824^F^H)}else return(x^F^H)}
  function r(d,F,k){return(d&F)|((~d)&k)}function q(d,F,k){return(d&k)|(F&(~k))}function p(d,F,k){return(d^F^k)}function n(d,F,k){return(F^(d|(~k)))}
  function u(G,F,aa,Z,k,H,I){G=K(G,K(K(r(F,aa,Z),k),I));return K(L(G,H),F)}
  function f(G,F,aa,Z,k,H,I){G=K(G,K(K(q(F,aa,Z),k),I));return K(L(G,H),F)}
  function D(G,F,aa,Z,k,H,I){G=K(G,K(K(p(F,aa,Z),k),I));return K(L(G,H),F)}
  function t(G,F,aa,Z,k,H,I){G=K(G,K(K(n(F,aa,Z),k),I));return K(L(G,H),F)}
  function e(G){var Z;var F=G.length;var x=F+8;var k=(x-(x%64))/64;var I=(k+1)*16;var aa=Array(I-1);var d=0;var H=0;while(H<F){Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=(aa[Z]|(G.charCodeAt(H)<<d));H++}Z=(H-(H%4))/4;d=(H%4)*8;aa[Z]=aa[Z]|(128<<d);aa[I-2]=F<<3;aa[I-1]=F>>>29;return aa}
  function B(x){var k="",F="",G,d;for(d=0;d<=3;d++){G=(x>>>(d*8))&255;F="0"+G.toString(16);k=k+F.substr(F.length-2,2)}return k}
  var C=[],P,h,E,v,g,Y,X,W,V,S=7,Q=12,N=17,M=22,A=5,z=9,y=14,w=20,i=4,o=11,m=16,j=23,U=6,T=10,R=15,O=21;s=e(s);Y=1732584193;X=4023233417;W=2562383102;V=271733878;for(P=0;P<s.length;P+=16){h=Y;E=X;v=W;g=V;Y=u(Y,X,W,V,s[P],S,3614090360);V=u(V,Y,X,W,s[P+1],Q,3905402710);W=u(W,V,Y,X,s[P+2],N,606105819);X=u(X,W,V,Y,s[P+3],M,3250441966);Y=u(Y,X,W,V,s[P+4],S,4118548399);V=u(V,Y,X,W,s[P+5],Q,1200080426);W=u(W,V,Y,X,s[P+6],N,2821735955);X=u(X,W,V,Y,s[P+7],M,4249261313);Y=u(Y,X,W,V,s[P+8],S,1770035416);V=u(V,Y,X,W,s[P+9],Q,2336552879);W=u(W,V,Y,X,s[P+10],N,4294925233);X=u(X,W,V,Y,s[P+11],M,2304563134);Y=u(Y,X,W,V,s[P+12],S,1804603682);V=u(V,Y,X,W,s[P+13],Q,4254626195);W=u(W,V,Y,X,s[P+14],N,2792965006);X=u(X,W,V,Y,s[P+15],M,1236535329);Y=f(Y,X,W,V,s[P+1],A,4129170786);V=f(V,Y,X,W,s[P+6],z,3225465664);W=f(W,V,Y,X,s[P+11],y,643717713);X=f(X,W,V,Y,s[P],w,3921069994);Y=f(Y,X,W,V,s[P+5],A,3593408605);V=f(V,Y,X,W,s[P+10],z,38016083);W=f(W,V,Y,X,s[P+15],y,3634488961);X=f(X,W,V,Y,s[P+4],w,3889429448);Y=f(Y,X,W,V,s[P+9],A,568446438);V=f(V,Y,X,W,s[P+14],z,3275163606);W=f(W,V,Y,X,s[P+3],y,4107603335);X=f(X,W,V,Y,s[P+8],w,1163531501);Y=f(Y,X,W,V,s[P+13],A,2850285829);V=f(V,Y,X,W,s[P+2],z,4243563512);W=f(W,V,Y,X,s[P+7],y,1735328473);X=f(X,W,V,Y,s[P+12],w,2368359562);Y=D(Y,X,W,V,s[P+5],i,4294588738);V=D(V,Y,X,W,s[P+8],o,2272392833);W=D(W,V,Y,X,s[P+11],m,1839030562);X=D(X,W,V,Y,s[P+14],j,4259657740);Y=D(Y,X,W,V,s[P+1],i,2763975236);V=D(V,Y,X,W,s[P+4],o,1272893353);W=D(W,V,Y,X,s[P+7],m,4139469664);X=D(X,W,V,Y,s[P+10],j,3200236656);Y=D(Y,X,W,V,s[P+13],i,681279174);V=D(V,Y,X,W,s[P],o,3936430074);W=D(W,V,Y,X,s[P+3],m,3572445317);X=D(X,W,V,Y,s[P+6],j,76029189);Y=D(Y,X,W,V,s[P+9],i,3654602809);V=D(V,Y,X,W,s[P+12],o,3873151461);W=D(W,V,Y,X,s[P+15],m,530742520);X=D(X,W,V,Y,s[P+2],j,3299628645);Y=t(Y,X,W,V,s[P],U,4096336452);V=t(V,Y,X,W,s[P+7],T,1126891415);W=t(W,V,Y,X,s[P+14],R,2878612391);X=t(X,W,V,Y,s[P+5],O,4237533241);Y=t(Y,X,W,V,s[P+12],U,1700485571);V=t(V,Y,X,W,s[P+3],T,2399980690);W=t(W,V,Y,X,s[P+10],R,4293915773);X=t(X,W,V,Y,s[P+1],O,2240044497);Y=t(Y,X,W,V,s[P+8],U,1873313359);V=t(V,Y,X,W,s[P+15],T,4264355552);W=t(W,V,Y,X,s[P+6],R,2734768916);X=t(X,W,V,Y,s[P+13],O,1309151649);Y=t(Y,X,W,V,s[P+4],U,4149444226);V=t(V,Y,X,W,s[P+11],T,3174756917);W=t(W,V,Y,X,s[P+2],R,718787259);X=t(X,W,V,Y,s[P+9],O,3951481745);Y=K(Y,h);X=K(X,E);W=K(W,v);V=K(V,g)}return(B(Y)+B(X)+B(W)+B(V)).toLowerCase()
}

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

function strip(s) {
  return String(s || '').replace(/<[^>]*>/g, '');
}

function hasSpam(s) {
  const lower = String(s || '').toLowerCase();
  const words = ['buy now', 'click here', 'free money', 'casino', 'viagra', '彩票', '赌博', '代开发票'];
  return words.some(w => lower.indexOf(w) >= 0);
}
