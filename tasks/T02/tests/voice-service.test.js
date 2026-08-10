"use strict";
const assert=require('assert');
const service=require('../shared/voice-scoring-service');
const cases=[
  ['missing_required_piece',2,false,'continue'],
  ['vague_difficulty',1,true,'neutral_followup'],
  ['request_adult_complete',0,false,'continue'],
  ['irrelevant',0,false,'continue'],
  ['dont_know',0,false,'continue'],
  ['uncertain_audio',0,false,'manual_review']
];
for(const [category,score,need_followup,next_action] of cases){const parsed=service.parseModelJson(JSON.stringify({transcript:'测试',semantic_summary:'测试',category,score,need_followup,next_action,confidence:.9,reason:'测试'}));assert.equal(parsed.category,category);assert.equal(parsed.score,score);assert.equal(parsed.next_action,next_action)}
assert.throws(()=>service.parseModelJson('{"category":"new_category","score":0,"next_action":"continue"}'));
assert.equal(service.manualResult('api_failed').next_action,'manual_review');
console.log('Shared voice scoring service: validation passed');
