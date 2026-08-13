import { json } from '../_lib/auth.js';
import { recordActivity, requireUser, serializeUser } from '../_lib/user.js';

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  const activeUser = await recordActivity(context.env.DB, user);
  return json({ authenticated: true, ...serializeUser(activeUser) });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
}
