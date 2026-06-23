import { json } from '../lib/response.js';
import { requireAuth } from '../lib/auth.js';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const authErr = await requireAuth(context.request, context.env);
  if (authErr) return authErr;
  return json({ ok: true });
}
