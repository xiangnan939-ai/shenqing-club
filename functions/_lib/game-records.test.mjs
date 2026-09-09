import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {serializeGameRoom} from './game-online.js';

test('AI slots reserve room for both joined and invited friends and allow zero bots',()=>{
 const members=[{user_id:1,status:'joined'},{user_id:2,status:'invited'}];
 assert.equal(serializeGameRoom({ai_count:5},members,1).aiCount,4);
 assert.equal(serializeGameRoom({ai_count:0},members,1).aiCount,0);
});

test('saved records view extracts valid results and ignores invalid scores',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id INTEGER PRIMARY KEY); CREATE TABLE game_rooms(id TEXT); CREATE TABLE dandan_saves(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data_json TEXT); INSERT INTO users VALUES(1),(2);');
  const save=db.prepare('INSERT INTO dandan_saves(user_id,data_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data_json=excluded.data_json');
  save.run(1,JSON.stringify({records:{'harbor-race':{time:300,car:'赤焰'},'harbor-drift':{longest:20},'harbor-online':{time:290},'bad-key':{time:1},'alpine-race':{time:-1},'canyon-race':{time:'1'}}}));
  db.exec(readFileSync(new URL('../../migrations/0011_game_ai_and_records.sql',import.meta.url),'utf8'));
  const records=()=>db.prepare('SELECT record_key,value FROM dandan_saved_records WHERE user_id=1 ORDER BY record_key').all().map(row=>({...row}));
  assert.deepEqual(records(),[{record_key:'harbor-drift',value:20},{record_key:'harbor-online',value:290},{record_key:'harbor-race',value:300}]);
  save.run(1,JSON.stringify({records:{'harbor-race':{time:310},'harbor-drift':{longest:10}}}));
  assert.equal(records().at(-1).value,310);assert.equal(records()[0].value,10);
  save.run(1,JSON.stringify({records:{'harbor-race':{time:250},'harbor-drift':{longest:35}}}));
  assert.equal(records().at(-1).value,250);assert.equal(records()[0].value,35);
  save.run(2,JSON.stringify({records:{'harbor-race':{time:230}}}));
  assert.equal(db.prepare('SELECT MIN(value) AS best FROM dandan_saved_records WHERE record_key=?').get('harbor-race').best,230);
  db.exec('DELETE FROM users WHERE id=2');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM dandan_saved_records WHERE user_id=2').get().count,0);
 }finally{db.close();}
});
