"use strict";
const assert=require('assert');
const policy=require('../shared/t02-voice-policy');
const route=(category,promptLevel=0,wrongAttempts=0,nextAction='continue')=>policy.routeVoice({category,promptLevel,wrongAttempts,nextAction});
assert.equal(route('missing_required_piece').kind,'provide_piece');
assert.equal(route('vague_difficulty',0,0,'neutral_followup').kind,'neutral_followup');
assert.equal(route('vague_difficulty',1,0,'neutral_followup').kind,'finish_vague');
assert.equal(route('irrelevant',0,0).kind,'retry');
assert.equal(route('irrelevant',0,1).kind,'finish_zero');
assert.equal(route('dont_know',0,0).kind,'retry');
assert.equal(route('dont_know',0,1).kind,'finish_zero');
assert.equal(route('request_adult_complete').kind,'finish_zero');
assert.equal(route('uncertain_audio',0,0,'manual_review').kind,'manual_retry');
assert.equal(policy.routeVoice({category:'uncertain_audio',nextAction:'manual_review',uncertainAttempts:1}).kind,'manual_finish');
assert.equal(route('missing_required_piece',0,0,'manual_review').kind,'manual_retry');
assert.equal(policy.routePicture({kind:'missing',wrongAttempts:0}).kind,'provide_piece');
for(const kind of ['direction','completed','unknown']){assert.equal(policy.routePicture({kind,wrongAttempts:0}).kind,'retry');assert.equal(policy.routePicture({kind,wrongAttempts:1}).kind,'finish_zero')}
console.log('T02 voice/picture policy: all branches passed');
