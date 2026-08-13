const { Pool } = require('pg');
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } }) : null;
const fs = require('node:fs');
const path = require('node:path');
const nil = v => v === undefined || v === '' ? null : v;
const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] !== undefined) return o[k]; return null; };
function rows(payload) {
  const p = payload.participant || {}, s = payload.session || {}, tasks = payload.tasks || {};
  const taskRows = [], responseRows = [];
  for (const [key, raw] of Object.entries(tasks)) {
    const r = raw || {}, taskId = r.task_id || key.replace('_','-');
    const score = typeof r.score === 'number' ? r.score : null;
    taskRows.push({ session_id:s.session_id, task_id:taskId, start_time:nil(r.start_time), completed_at:nil(r.end_time || r.completed_at), task_duration_ms:nil(r.task_duration_ms), score, score_status:r.score_status || (score === null ? 'score_missing' : 'available'), validity:r.validity || null, subscores:r.subscores || null, a_score:pick(r,'A_score','T06A_score'), b_score:pick(r,'B_score','T06B_score') });
    const records = [].concat(r.records || r.responses || r.speech_records || []);
    records.forEach((x, i) => responseRows.push({ session_id:s.session_id, task_id:taskId, step_id:String(pick(x,'step_id','trial_id') || `record-${i+1}`), step_order:pick(x,'step_order') ?? i+1, context:nil(x.context), item_type:nil(x.item_type), stimulus_id:nil(x.stimulus_id), choice:x.choice ?? x.selected_option ?? null, transcript:nil(x.transcript || x.asr_text), response_mode:nil(x.response_mode), response_time_ms:pick(x,'response_time_ms','reaction_time'), attempt_count:pick(x,'attempt_count'), error_count:pick(x,'error_count'), prompt_level:nil(x.prompt_level), model_score:pick(x,'model_score','score'), confidence:pick(x,'confidence'), next_action:nil(x.next_action), semantic_class:nil(x.semantic_class), api_status:nil(x.api_status), audio_file:nil(x.audio_file), audio_url:nil(x.audio_url), eye_tracking_session_id:nil(x.eye_tracking_session_id), created_at:x.created_at || new Date().toISOString() }));
  }
  return {participant:{child_id:p.child_id || p.id, child_name:p.child_name || p.name, age_at_assessment:p.age_at_assessment ?? p.age, participant_group:p.participant_group || p.group}, session:{session_id:s.session_id, child_id:p.child_id || p.id, start_time:s.start_time, completed_at:s.completed_at || s.end_time || null, session_status:s.session_status || (s.end_time ? 'completed':'in_progress')}, taskRows, responseRows};
}
async function save(payload) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  const d=rows(payload), c=await pool.connect();
  try {
    await c.query('begin');
    await c.query('insert into participant(child_id,child_name,age_at_assessment,participant_group) values($1,$2,$3,$4) on conflict(child_id) do update set child_name=excluded.child_name,age_at_assessment=excluded.age_at_assessment,participant_group=excluded.participant_group', [d.participant.child_id,d.participant.child_name,d.participant.age_at_assessment,d.participant.participant_group]);
    await c.query('insert into session(session_id,child_id,start_time,completed_at,session_status) values($1,$2,$3,$4,$5) on conflict(session_id) do update set completed_at=excluded.completed_at,session_status=excluded.session_status', [d.session.session_id,d.session.child_id,d.session.start_time,d.session.completed_at,d.session.session_status]);
    for (const t of d.taskRows) await c.query('insert into task_result(session_id,task_id,start_time,completed_at,task_duration_ms,score,score_status,validity,subscores,a_score,b_score) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(session_id,task_id) do update set completed_at=excluded.completed_at,score=excluded.score,score_status=excluded.score_status,validity=excluded.validity,subscores=excluded.subscores,a_score=excluded.a_score,b_score=excluded.b_score', [t.session_id,t.task_id,t.start_time,t.completed_at,t.task_duration_ms,t.score,t.score_status,t.validity,t.subscores,t.a_score,t.b_score]);
    const placeholders = Array.from({length:23}, (_, i) => '$' + (i + 1)).join(',');
    for (const x of d.responseRows) await c.query(`insert into response(session_id,task_id,step_id,step_order,context,item_type,stimulus_id,choice,transcript,response_mode,response_time_ms,attempt_count,error_count,prompt_level,model_score,confidence,next_action,semantic_class,api_status,audio_file,audio_url,eye_tracking_session_id,created_at) values(${placeholders}) on conflict(session_id,task_id,step_id) do update set transcript=excluded.transcript,model_score=excluded.model_score,confidence=excluded.confidence,api_status=excluded.api_status`, [x.session_id,x.task_id,x.step_id,x.step_order,x.context,x.item_type,x.stimulus_id,x.choice,x.transcript,x.response_mode,x.response_time_ms,x.attempt_count,x.error_count,x.prompt_level,x.model_score,x.confidence,x.next_action,x.semantic_class,x.api_status,x.audio_file,x.audio_url,x.eye_tracking_session_id,x.created_at]);
    await c.query('commit');
    return {ok:true,task_count:d.taskRows.length,response_count:d.responseRows.length};
  } catch(e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
async function initSchema() {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return { ok: true };
}
async function testRead(sessionId) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  const result = await pool.query('select (select count(*) from participant where child_id=$1)::int as participants, (select count(*) from session where session_id=$2)::int as sessions, (select count(*) from task_result where session_id=$2)::int as task_results, (select count(*) from response where session_id=$2)::int as responses', ['TEST_DB_WRITE', sessionId]);
  return result.rows[0];
}
module.exports={save,initSchema,testRead,configured:()=>!!pool};
