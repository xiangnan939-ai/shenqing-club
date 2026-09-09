import { json } from '../_lib/auth.js';
import { parseRevision, parseStoredGameSave, validateGameSave } from '../_lib/game-save.js';
import { requireUser } from '../_lib/user.js';

async function readSave(db, userId) {
  const row = await db.prepare(
    'SELECT revision, data_json, updated_at FROM dandan_saves WHERE user_id = ? LIMIT 1',
  ).bind(userId).first();
  return parseStoredGameSave(row);
}

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  return json({ ok: true, userId: Number(user.id), nickname: user.nickname || user.username, save: await readSave(context.env.DB, user.id) });
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
  const revision = parseRevision(input.revision);
  const validated = validateGameSave(input.data);
  if (revision === null) return json({ error: '存档版本不正确。' }, 400);
  if (!validated.ok) return json({ error: validated.error }, 400);

  if (revision === 0) {
    const inserted = await context.env.DB.prepare(
      `INSERT INTO dandan_saves (user_id, revision, data_json)
       VALUES (?, 1, ?) ON CONFLICT(user_id) DO NOTHING`,
    ).bind(user.id, validated.dataJson).run();
    if (Number(inserted.meta?.changes) > 0) {
      return json({ ok: true, save: await readSave(context.env.DB, user.id) }, 201);
    }
  } else {
    const updated = await context.env.DB.prepare(
      `UPDATE dandan_saves SET revision = revision + 1, data_json = ?,
       updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revision = ?`,
    ).bind(validated.dataJson, user.id, revision).run();
    if (Number(updated.meta?.changes) > 0) {
      return json({ ok: true, save: await readSave(context.env.DB, user.id) });
    }
  }

  return json({
    error: '存档已在另一处更新，请重新进入游戏。',
    conflict: true,
    save: await readSave(context.env.DB, user.id),
  }, 409);
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, PUT' });
}
