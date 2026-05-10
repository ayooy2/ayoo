export async function onRequest(context) {
  const { request, env } = context;

  // 除 GET 外都需要认证
  if (request.method !== 'GET') {
    const auth = request.headers.get('Authorization');
    if (!auth || auth !== `Bearer ${env.ADMIN_PASSWORD}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  switch (request.method) {
    case 'GET':
      return getSettings(env);
    case 'PUT':
      return updateSettings(env, await request.json());
    default:
      return jsonResponse({ error: 'Method not allowed' }, 405);
  }
}

async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const config = {};
  for (const row of results || []) {
    config[row.key] = row.value;
  }
  return jsonResponse(config);
}

async function updateSettings(env, data) {
  const stmts = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') continue;
    stmts.push(
      env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
        .bind(key, value, value)
    );
  }
  if (stmts.length === 0) {
    return jsonResponse({ error: 'No valid settings' }, 400);
  }
  await env.DB.batch(stmts);

  // 清除首页缓存
  await purgeCache(env, '/');

  return jsonResponse({ success: true, updated: Object.keys(data) });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function purgeCache(env, path) {
  try {
    const url = `https://${env.CF_PAGES_URL}${path}`;
    // 尝试删除 Cloudflare edge cache
    if (typeof caches !== 'undefined' && caches.default) {
      await caches.default.delete(new Request(url));
    }
  } catch {
    // 缓存清除失败不阻塞主流程
  }
}
