ALTER TABLE game_rooms ADD COLUMN ai_count INTEGER NOT NULL DEFAULT 5 CHECK (ai_count BETWEEN 0 AND 5);

CREATE VIEW dandan_saved_records AS
SELECT user_id, record_key, value, car FROM (
SELECT s.user_id, r.key AS record_key,
  CASE WHEN r.key LIKE '%-drift' THEN json_extract(r.value, '$.longest')
    ELSE json_extract(r.value, '$.time') END AS value,
  substr(COALESCE(json_extract(r.value, '$.car'), ''), 1, 40) AS car
FROM dandan_saves s, json_each(s.data_json, '$.records') r
WHERE r.type = 'object'
  AND r.key IN (
    'driftpark-race','driftpark-online','driftpark-drift',
    'harbor-race','harbor-online','harbor-drift',
    'canyon-race','canyon-online','canyon-drift',
    'alpine-race','alpine-online','alpine-drift',
    'volcano-race','volcano-online','volcano-drift'
  )
) WHERE typeof(value) IN ('integer','real') AND value > 0 AND value <= 86400;
