export function onRequest() {
  return new Response('Gone', {
    status: 410,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
