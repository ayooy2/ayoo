import { json, error } from '../lib/response.js';

export async function onRequestGet(context) {
  const auth = context.request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${context.env.ADMIN_PASSWORD}`) {
    return error('Unauthorized', 401);
  }
  return json({ ok: true });
}
