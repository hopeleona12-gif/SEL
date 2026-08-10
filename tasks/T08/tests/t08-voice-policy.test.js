"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const policy=require('../shared/t08-voice-policy');
test('four formal turns are fixed',()=>assert.deepEqual(Object.keys(policy.TURNS),['A1','A2','B1','B2']));
test('single-word relevant response remains relevant',()=>{const r=policy.normalizeModelResult({transcript:'小狗',semantic_summary:'选择小狗',relevance_score:1,category:'relevant_response',need_followup:false,confidence:.9,reason:'回应动物偏好'});assert.equal(r.relevance_score,1);assert.equal(policy.computeTurnScore(1,r.relevance_score),2)});
test('low confidence routes to manual review without zero score',()=>{const r=policy.normalizeModelResult({transcript:'',semantic_summary:'不清楚',relevance_score:0,category:'irrelevant_response',need_followup:false,confidence:.2,reason:'音频不清'});assert.equal(r.review_status,'manual_review');assert.equal(r.relevance_score,null);assert.equal(policy.computeTurnScore(1,r.relevance_score),null)});
test('uncertain audio routes to manual review',()=>{const r=policy.normalizeModelResult({transcript:'',semantic_summary:'',relevance_score:0,category:'uncertain_audio',need_followup:false,confidence:0,reason:'无可辨语音'});assert.equal(r.review_status,'manual_review')});
