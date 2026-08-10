(() => {
  const score = async (part, questionType, item) => {
    const transcript = String(item?.asr_text || item?.transcript || '').trim();
    if (!transcript) return { score_status: 'score_missing', transcript };
    try {
      const response = await fetch('/api/t01/text-score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part, question_type: questionType, transcript, prompt_level: item.prompt_level || 'P0', context: `T01-${part}-${questionType}` })
      });
      if (!response.ok) throw new Error(`text_score_${response.status}`);
      const result = await response.json();
      if (result.api_success !== true || ![0, 1, 2].includes(Number(result.score))) throw new Error(result.api_error || 'score_missing');
      return { ...item, transcript, asr_text: transcript, score: Number(result.score), confidence: result.confidence ?? null, score_label: result.score_label || '', model_reason: result.reason || '', model_score: Number(result.score), score_status: 'scored_by_dashscope' };
    } catch (error) {
      return { ...item, transcript, asr_text: transcript, score: null, score_status: 'score_missing', api_error: String(error.message || error) };
    }
  };
  window.addEventListener('message', async (event) => {
    const data = event.data || {};
    if (data.type !== 'SEL_T01_COMPLETE' || !data.payload) return;
    event.stopImmediatePropagation();
    const payload = data.payload;
    const part = payload.part || (payload.source_task === 'T04' ? 'A' : 'B');
    const [emotion, cause] = await Promise.all([score(part, 'emotion', payload.emotion), score(part, 'cause', payload.cause)]);
    const enriched = { ...payload, emotion, cause, [`T01_${part}_emotion_score`]: emotion.score ?? null, [`T01_${part}_cause_score`]: cause.score ?? null, emotion_score: emotion.score ?? null, cause_score: cause.score ?? null };
    window.__activeTaskComplete?.(enriched);
  }, true);
})();
