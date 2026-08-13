import { json } from '../_lib/auth.js';
import {
  normalizeNickname,
  normalizeSignature,
  requireUser,
  serializeUser,
  validateAvatarImage,
} from '../_lib/user.js';

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  return json({ ok: true, profile: serializeUser(user) });
}

export async function onRequestPut(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;

  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }

  const nickname = normalizeNickname(input.nickname) || user.username;
  const signature = normalizeSignature(input.signature) || '这个人很深情，还没留下签名。';
  const avatarValidation = validateAvatarImage(input.avatarImage);
  if (!avatarValidation.ok) return json({ error: avatarValidation.error }, 400);
  const avatarImage = avatarValidation.value;

  await context.env.DB.prepare(
    `UPDATE users
     SET nickname = ?, signature = ?, avatar_image = ?
     WHERE username = ?`,
  ).bind(nickname, signature, avatarImage || null, user.username).run();

  return json({
    ok: true,
    profile: serializeUser({
      ...user,
      nickname,
      signature,
      avatar_image: avatarImage,
    }),
  });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, PUT' });
}
