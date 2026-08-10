(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.T08VoicePolicy=api})(typeof window!=='undefined'?window:globalThis,function(){
  "use strict";
  const CONFIDENCE_THRESHOLD=.65;
  const TURNS=Object.freeze({
    A1:{question:'你喜欢哪种小动物？',relevant_examples:['小狗','不知道','我不喜欢动物','恐龙']},
    A2:{question:'你喜欢在哪里看到小动物？',relevant_examples:['家里','公园','动物园','书里','电视里','不知道']},
    B1:{question:'你想做什么活动？',relevant_examples:['画画','搭积木','看书','玩球','不知道']},
    B2:{question:'你想自己做，还是和小伙伴一起做？',relevant_examples:['自己','和一个小伙伴','和大家','都可以','不想做','不知道']}
  });
  const CATEGORIES=new Set(['relevant_response','irrelevant_response','uncertain_audio']);
  function clamp(value){return Math.max(0,Math.min(1,Number(value)||0))}
  function normalizeModelResult(value){
    if(!value||typeof value!=='object')throw new Error('invalid_model_result');
    if(!CATEGORIES.has(value.category))throw new Error('invalid_category');
    const confidence=clamp(value.confidence);
    const uncertain=value.category==='uncertain_audio'||confidence<CONFIDENCE_THRESHOLD;
    const relevanceScore=Number(value.relevance_score);
    if(!uncertain&&![0,1].includes(relevanceScore))throw new Error('invalid_relevance_score');
    return{transcript:String(value.transcript||''),semantic_summary:String(value.semantic_summary||''),relevance_score:uncertain?null:relevanceScore,category:value.category,need_followup:Boolean(value.need_followup),confidence,reason:String(value.reason||''),review_status:uncertain?'manual_review':'ai_scored'};
  }
  function manualReview(reason,partial={}){return{transcript:String(partial.transcript||''),semantic_summary:String(partial.semantic_summary||''),relevance_score:null,category:'uncertain_audio',need_followup:false,confidence:clamp(partial.confidence),reason:String(reason||'manual_review_required'),review_status:'manual_review'}}
  function computeTurnScore(turnRecognitionScore,relevanceScore){return[0,1].includes(turnRecognitionScore)&&[0,1].includes(relevanceScore)?turnRecognitionScore+relevanceScore:null}
  function buildSystemPrompt(turnId){const turn=TURNS[turnId];if(!turn)throw new Error('unknown_turn');return `你是特殊儿童SEL数字化测评T08的语音相关性编码器。当前话轮${turnId}，问题是：“${turn.question}”。你只判断儿童回答是否与当前问题存在语义关联。相关示例包括：${turn.relevant_examples.join('、')}。单词、短语、完整句、拒绝、说不知道都可以是相关回应。不得评价语言丰富度、句子长度、语法、主谓宾、发音、口语流畅度，不得因儿童只说一个词而降分。只有明显答非所问才记0。若音频无法辨认、信息不足或无法可靠判断，category必须为uncertain_audio并进入人工复核，不能自动记0。仅返回JSON：{"transcript":"","semantic_summary":"","relevance_score":0,"category":"relevant_response|irrelevant_response|uncertain_audio","need_followup":false,"confidence":0.0,"reason":""}`}
  return Object.freeze({CONFIDENCE_THRESHOLD,TURNS,CATEGORIES,normalizeModelResult,manualReview,computeTurnScore,buildSystemPrompt});
});
