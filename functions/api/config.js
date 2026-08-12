import { json } from '../_lib/auth.js';

export function onRequestGet(context) {
  return json({ turnstileSiteKey: context.env.TURNSTILE_SITE_KEY });
}
