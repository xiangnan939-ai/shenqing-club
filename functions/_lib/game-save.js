export const GAME_SAVE_LIMITS = Object.freeze({
  maxBytes: 64000,
  maxRevision: 2147483647,
});

export function validateGameSave(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: '存档格式不正确。' };
  }
  let dataJson;
  try {
    dataJson = JSON.stringify(value);
  } catch {
    return { ok: false, error: '存档无法读取。' };
  }
  if (new TextEncoder().encode(dataJson).byteLength > GAME_SAVE_LIMITS.maxBytes) {
    return { ok: false, error: '存档内容过大。' };
  }
  return { ok: true, dataJson };
}

export function parseRevision(value) {
  const revision = Number(value);
  return Number.isSafeInteger(revision)
    && revision >= 0
    && revision <= GAME_SAVE_LIMITS.maxRevision
    ? revision
    : null;
}

export function parseStoredGameSave(row) {
  if (!row) return { revision: 0, data: null, updatedAt: null };
  try {
    const data = JSON.parse(row.data_json);
    return {
      revision: Number(row.revision) || 0,
      data: data && typeof data === 'object' && !Array.isArray(data) ? data : null,
      updatedAt: row.updated_at || null,
    };
  } catch {
    return { revision: Number(row.revision) || 0, data: null, updatedAt: row.updated_at || null };
  }
}
