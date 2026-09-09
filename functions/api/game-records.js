import {json} from '../_lib/auth.js';
import {requireUser} from '../_lib/user.js';

export async function onRequestGet(context) {
  const {user, response} = await requireUser(context);
  if (response) return response;
  const result = await context.env.DB.prepare(`
    WITH ranked AS (
      SELECT r.*, replace(r.record_key, '-online', '-race') AS category,
        ROW_NUMBER() OVER (
          PARTITION BY replace(r.record_key, '-online', '-race')
          ORDER BY CASE WHEN r.record_key LIKE '%-drift' THEN -r.value ELSE r.value END,
            r.user_id
          ) AS place
      FROM dandan_saved_records r
    )
    SELECT r.category, r.value, r.car, NULL AS updated_at, u.nickname, u.username
    FROM ranked r JOIN users u ON u.id = r.user_id WHERE r.place = 1
  `).all();
  const records = Object.fromEntries((result.results || []).map(row => [row.category, {
    value: Number(row.value), nickname: row.nickname || row.username,
    car: row.car, updatedAt: row.updated_at,
  }]));
  return json({ok: true, records, nickname: user.nickname || user.username});
}

export function onRequest() {
  return json({error: 'Method not allowed'}, 405, {Allow: 'GET'});
}
