import { clearSessionCookie, json } from '../_lib/auth.js';

export function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
