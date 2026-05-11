import { json, error } from '../lib/response.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, title, url, icon, description, created_at FROM sites ORDER BY sort_order ASC, id ASC LIMIT 200'
    ).all();
    return json({ sites: results || [] });
  } catch (e) {
    console.error(e);
    return error('Internal server error', 500);
  }
}
