import { json, error } from '../../lib/response.js';
import { requireAuth } from '../../lib/auth.js';

const TITLE_MAX = 200;
const URL_MAX = 2000;
const DESC_MAX = 500;

export async function onRequest(context) {
  const { request, env, params } = context;
  const id = params.id;

  if (request.method !== 'GET') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
  }

  try {
    switch (request.method) {
      case 'GET':
        return getSite(env.DB, id);
      case 'POST':
        return createSite(env.DB, await request.json());
      case 'PUT':
        return updateSite(env.DB, id, await request.json());
      case 'DELETE':
        return deleteSite(env.DB, id);
      case 'OPTIONS':
        return new Response(null, { status: 204, headers: { Allow: 'GET,POST,PUT,DELETE,OPTIONS' } });
      default:
        return error('Method not allowed', 405);
    }
  } catch (e) {
    console.error(e);
    return error('Internal server error', 500);
  }
}

function validateSite(data) {
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    return 'Title is required';
  }
  if (data.title.length > TITLE_MAX) {
    return 'Title too long (max ' + TITLE_MAX + ')';
  }
  if (!data.url || typeof data.url !== 'string' || !data.url.trim()) {
    return 'URL is required';
  }
  if (data.url.length > URL_MAX) {
    return 'URL too long';
  }
  try { new URL(data.url); } catch { return 'Invalid URL (must be absolute)'; }
  if (data.description && data.description.length > DESC_MAX) {
    return 'Description too long (max ' + DESC_MAX + ')';
  }
  return null;
}

async function getSite(db, id) {
  const result = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
  if (!result) return error('Not found', 404);
  return json(result);
}

async function createSite(db, data) {
  const err = validateSite(data);
  if (err) return error(err, 400);

  const sortOrder = Math.floor(Date.now() / 1000);
  const result = await db.prepare(
    'INSERT INTO sites (title, url, icon, description, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).bind(data.title.trim(), data.url.trim(), (data.icon || '').trim(), (data.description || '').trim(), sortOrder).first();
  return json(result, 201);
}

async function updateSite(db, id, data) {
  const err = validateSite(data);
  if (err) return error(err, 400);

  const result = await db.prepare(
    'UPDATE sites SET title = ?, url = ?, icon = ?, description = ? WHERE id = ? RETURNING *'
  ).bind(data.title.trim(), data.url.trim(), (data.icon || '').trim(), (data.description || '').trim(), id).first();
  if (!result) return error('Not found', 404);
  return json(result);
}

async function deleteSite(db, id) {
  const { meta } = await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
  if (meta.changes === 0) return error('Not found', 404);
  return json({ success: true });
}
