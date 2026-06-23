import { json } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

export async function onRequestGet(context) {
  const authErr = await requireAuth(context.request, context.env);
  if (authErr) return authErr;
  return json({ ok: true });
}
