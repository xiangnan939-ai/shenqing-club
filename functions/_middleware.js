import { readSession } from './_lib/auth.js';

const PROTECTED_PATHS = [
  '/main',
  '/main.html',
  '/main.css',
  '/main.js',
  '/assets/super-oreo-icon.webp',
  '/assets/dandan-racing-icon.webp',
  '/private/hero.png',
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const isGameEntry = url.pathname === '/games/dandan-racing'
    || url.pathname === '/games/dandan-racing/';
  const isProtected = PROTECTED_PATHS.includes(url.pathname)
    || isGameEntry
    || url.pathname.startsWith('/games/dandan-racing/');
  if (!isProtected) {
    return context.next();
  }

  const session = await readSession(context.request, context.env.SESSION_SECRET);
  if (session) return context.next();

  if (url.pathname === '/main' || url.pathname === '/main.html' || isGameEntry) {
    return Response.redirect(`${url.origin}/`, 302);
  }

  return new Response('Unauthorized', {
    status: 401,
    headers: { 'Cache-Control': 'no-store' },
  });
}
