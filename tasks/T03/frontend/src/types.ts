export type Phase = 'practice' | 'test'
export type Stimulus = 'dong' | 'ding'
export interface Trial {
  trial_id:string
  condition:'quiet'|'distractor'
  stimulus:Stimulus
  distractor_video?:string
}
export interface TaskConfig {
  task_id:string; name:string; dimension:string; config_version:string
  assets: Record<string,string>
  timing:{
    pre_stimulus_ms:number
    response_window_ms:number
    inter_trial_interval_ms:number
    inter_trial_interval_max_ms?:number
    condition_transition_ms?:number
  }
  practice_trials:Trial[]; test_trials:Trial[]
}
export interface SelReport {
  child:{child_id:string;age:number}
  assessment:{session_id:string;task_id:string;task_name:string;completed_time:string}
  sel_dimensions:{self_awareness:number|null;self_management:number|null;social_awareness:number|null;relationship:number|null;responsible_decision:number|null}
  task_performance:{score:number;go_accuracy:number;no_go_accuracy:number;quiet_score:number|null;distractor_score:number|null;go_omissions:number|null;no_go_false_alarms:number|null;mean_go_reaction_time_ms:number|null;go_reaction_time_sd_ms:number|null}
  interpretation:string;support_suggestions:string[];disclaimer:string
}
