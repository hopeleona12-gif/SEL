create table if not exists participant (
  child_id text primary key,
  child_name text,
  age_at_assessment numeric,
  participant_group text,
  created_at timestamptz not null default now()
);
create table if not exists session (
  session_id uuid primary key,
  child_id text not null references participant(child_id),
  start_time timestamptz,
  completed_at timestamptz,
  session_status text not null default 'in_progress'
);
create table if not exists task_result (
  session_id uuid references session(session_id), task_id text,
  start_time timestamptz, completed_at timestamptz, task_duration_ms integer,
  score numeric, score_status text not null default 'score_missing', validity jsonb,
  subscores jsonb, a_score numeric, b_score numeric,
  primary key (session_id, task_id)
);
create table if not exists response (
  session_id uuid references session(session_id), task_id text, step_id text,
  step_order integer, context text, item_type text, stimulus_id text,
  choice jsonb, transcript text, response_mode text, response_time_ms integer,
  attempt_count integer, error_count integer, prompt_level text, model_score numeric,
  confidence numeric, next_action text, semantic_class text, api_status text,
  audio_file text, audio_url text, eye_tracking_session_id text, created_at timestamptz not null default now(),
  primary key (session_id, task_id, step_id)
);
