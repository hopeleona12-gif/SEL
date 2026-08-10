(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.T02VoicePolicy=api})(typeof window!=='undefined'?window:globalThis,function(){
  "use strict";
  function routeVoice({category,nextAction,promptLevel=0,wrongAttempts=0,uncertainAttempts=0}){
    if(nextAction==='manual_review'||category==='uncertain_audio')return uncertainAttempts<1?{kind:'manual_retry'}:{kind:'manual_finish'};
    if(category==='missing_required_piece')return {kind:'provide_piece',score:2};
    if(category==='vague_difficulty')return promptLevel<1?{kind:'neutral_followup'}:{kind:'finish_vague',score:1};
    if(category==='request_adult_complete')return {kind:'finish_zero',reason:'request_adult_complete'};
    if(category==='irrelevant'||category==='dont_know')return wrongAttempts<1?{kind:'retry',reason:category}:{kind:'finish_zero',reason:category};
    return {kind:'manual_review',reason:'unexpected_category'};
  }
  function routePicture({kind,wrongAttempts=0}){
    if(kind==='missing')return {kind:'provide_piece',score:2};
    if(['direction','completed','unknown'].includes(kind))return wrongAttempts<1?{kind:'retry',reason:kind}:{kind:'finish_zero',reason:kind};
    return {kind:'manual_review',reason:'unexpected_picture_choice'};
  }
  return Object.freeze({routeVoice,routePicture});
});
