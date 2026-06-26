import { json } from '../../lib/response.js';
import { clearSession } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  await clearSession(request, env);
  return json({ ok: true }, {
    'Set-Cookie': 'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
  });
}
