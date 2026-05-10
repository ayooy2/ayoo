export async function onRequest(context) {
  const { request, env, params } = context;
  const id = params.id;

  // 除 GET 外都需要认证
  if (request.method !== 'GET') {
    const auth = request.headers.get('Authorization');
    if (!auth || auth !== `Bearer ${env.ADMIN_PASSWORD}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  try {
    switch (request.method) {
      case 'GET':
        return await getSite(env.DB, id);
      case 'POST':
        return await createSite(env.DB, await request.json());
      case 'PUT':
        return await updateSite(env.DB, id, await request.json());
      case 'DELETE':
        return await deleteSite(env.DB, id);
      default:
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

async function getSite(db, id) {
  const result = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
  if (!result) return jsonResponse({ error: 'Not found' }, 404);
  return jsonResponse(result);
}

async function createSite(db, data) {
  const { title, url, icon, description } = data;
  const result = await db.prepare(
    'INSERT INTO sites (title, url, icon, description, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).bind(title, url, icon || '', description || '', Date.now()).first();
  return jsonResponse(result, 201);
}

async function updateSite(db, id, data) {
  const { title, url, icon, description } = data;
  const result = await db.prepare(
    'UPDATE sites SET title = ?, url = ?, icon = ?, description = ? WHERE id = ? RETURNING *'
  ).bind(title, url, icon || '', description || '', id).first();
  if (!result) return jsonResponse({ error: 'Not found' }, 404);
  return jsonResponse(result);
}

async function deleteSite(db, id) {
  await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
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
