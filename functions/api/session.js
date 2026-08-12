import { json, readSession } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const session = await readSession(context.request, context.env.SESSION_SECRET);
  if (!session) return json({ authenticated: false }, 401);

  const user = await context.env.DB.prepare(
    'SELECT username FROM users WHERE username = ? LIMIT 1',
  ).bind(session.username).first();
  if (!user) return json({ authenticated: false }, 401);

  return json({ authenticated: true, username: user.username });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
}
