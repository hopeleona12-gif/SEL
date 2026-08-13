import assert from 'node:assert/strict';
import { normalizeTaskResult } from '../scoreNormalizer.js';

assert.equal(normalizeTaskResult('T02', { T02_total_score: 2 }).final_score, 2);
assert.equal(normalizeTaskResult('T02', { T02_total_score: 0 }).final_score, 0);
assert.equal(normalizeTaskResult('T02', { T02_total_score: null }).final_score, null);
assert.equal(normalizeTaskResult('T02', { score_status: 'score_missing' }).score_status, 'score_missing');
assert.equal(normalizeTaskResult('T09', { status: 'INV', total_score: null }).score_status, 'INV');
assert.equal(normalizeTaskResult('T03', { raw_score_percent: 81.2 }).final_score, 1.624);
const t05 = normalizeTaskResult('T05', { T05A_score: 2, T05B_score: 2 });
assert.equal(t05.final_score, 2);
assert.equal(t05.T05_score, 2);
assert.equal(t05.subscores.T05_dimension_input, 2);
const a = normalizeTaskResult('T01-A', { emotion: { score: 2 }, cause: { score: 1 } });
const b = normalizeTaskResult('T01-B', { emotion: { score: 1 }, cause: { score: 2 } });
assert.equal(a.task_id, 'T01-A');
assert.equal(b.task_id, 'T01-B');
console.log('scoreNormalizer tests passed');
