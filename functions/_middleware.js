import { readSession } from './_lib/auth.js';

const PROTECTED_PATHS = [
  '/main',
  '/main.html',
  '/main.css',
  '/main.js',
  '/zhao-game.css',
  '/zhao-game.js',
  '/assets/zhao-yun-a-dou-icon-v2.png',
  '/assets/zhao-ink-landscape-v1.jpg',
  '/private/hero.png',
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const isProtected = PROTECTED_PATHS.includes(url.pathname) || url.pathname.startsWith('/game/');
  if (!isProtected) {
    return context.next();
  }

  const session = await readSession(context.request, context.env.SESSION_SECRET);
  if (session) return context.next();

  if (url.pathname === '/main' || url.pathname === '/main.html') {
    return Response.redirect(`${url.origin}/`, 302);
  }

  return new Response('Unauthorized', {
    status: 401,
    headers: { 'Cache-Control': 'no-store' },
  });
}
