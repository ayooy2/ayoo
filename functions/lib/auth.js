import { error } from './response.js';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify admin authentication (checks env secret + stored hash)
// Returns null if authenticated, or error Response if not
export async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth) return error('Unauthorized', 401);

  const token = auth.replace('Bearer ', '');

  // Check env secret first (backward compatibility)
  if (env.ADMIN_PASSWORD && token === env.ADMIN_PASSWORD) {
    return null; // authenticated
  }

  // Check stored hash in database
  try {
    const storedHash = await env.DB.prepare(
      "SELECT value FROM settings WHERE key='admin_password_hash'"
    ).first();
    if (storedHash && storedHash.value) {
      const inputHash = await hashPassword(token);
      if (inputHash === storedHash.value) {
        return null; // authenticated
      }
    }
  } catch (e) {
    // DB error, fall through
  }

  return error('Unauthorized', 401);
}
