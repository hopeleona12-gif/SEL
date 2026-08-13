import { normalizeTaskResult } from './scoreNormalizer.js';
export const TASK_SEQUENCE = ['T02','T03','T04','T01-A','T06','T05','T07','T08','T01-B','T09','T10'];
const keyFor = id => id.replace('-', '_');
const now = () => new Date().toISOString();

export function createSession(participant) {
  const assessment_session_id = crypto.randomUUID();
  const tasks = Object.fromEntries(TASK_SEQUENCE.map(id => [keyFor(id), {}]));
  return { participant: { ...participant, child_id: participant.child_id || participant.id || '', group: participant.group || '' }, assessment_session_id, session: { session_id: assessment_session_id, assessment_session_id, start_time: now(), end_time: '' }, tasks };
}

export class TaskManager {
  constructor(session, hooks = {}) { this.session = session; this.currentTask = null; this.currentTaskIndex = -1; this.taskStatus = 'idle'; this.taskStartTime = ''; this.taskEndTime = ''; this.hooks = hooks; }
  startTask(taskId) { if (TASK_SEQUENCE.indexOf(taskId) < 0) throw new Error(`Unknown task: ${taskId}`); this.currentTask = taskId; this.currentTaskIndex = TASK_SEQUENCE.indexOf(taskId); this.taskStatus = 'running'; this.taskStartTime = now(); this.taskEndTime = ''; this.hooks.onStart?.(taskId, this); }
  finishTask(taskId, result = {}) { if (taskId !== this.currentTask) throw new Error(`Cannot finish ${taskId}; current task is ${this.currentTask}`); this.taskEndTime = now(); this.taskStatus = 'completed'; const slot = keyFor(taskId); const normalized = normalizeTaskResult(taskId, result, { assessment_session_id: this.session.assessment_session_id, participant_id: this.session.participant.child_id || this.session.participant.id || '' }); this.session.tasks[slot] = { ...this.session.tasks[slot], ...result, ...normalized, task_id: taskId, start_time: this.taskStartTime, end_time: this.taskEndTime }; this.hooks.onFinish?.(taskId, this.session.tasks[slot], this); }
  goToNextTask() { const next = TASK_SEQUENCE[this.currentTaskIndex + 1] ?? null; if (!next) { this.session.session.end_time = now(); this.taskStatus = 'session_completed'; this.hooks.onComplete?.(this.session); return null; } this.startTask(next); return next; }
}

export const eyeTrackingService = { enabled: false, currentTask: null, start(taskId) { this.currentTask = taskId; }, stop() { this.currentTask = null; } };
export const voiceService = { configured: false };
