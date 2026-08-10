# T02 多模态语音评分 Demo 自检

版本：`T02-V3.6-2026.08.10`

## 实现范围

仅接入情境 B“缺少风车叶片”的开放语音节点。情境 A、既有视觉动画、拖拽、图片回答和原有任务分支未重构。

## 链路

1. 儿童点击“说一说”开始/停止录音。
2. 原始 WebM 先写入浏览器 IndexedDB。
3. 浏览器将原始录音转换为16kHz单声道WAV作为API分析副本。
4. 后端先把原始WebM写入 `data/audio/`。
5. 后端使用环境变量中的密钥调用 Qwen3.5-Omni。
6. 后端验证JSON、枚举、分数/分类一致性、下一动作和置信度。
7. 结果写入 `data/records/*.json`，前端进入原T02分支。
8. 研究人员面板可播放录音并另存人工评分，不覆盖AI字段。

## 分类与分支

- `missing_required_piece`：进入原“提供叶片”流程。
- `vague_difficulty`：播放固定中性追问；只允许一次，不由AI生成台词。
- `request_adult_complete`：按现有规则记0分并结束情境B。
- `irrelevant` / `dont_know`：进入现有再次判断流程。
- `uncertain_audio`、低置信度、API/JSON/录音异常：`manual_review`，允许重录或图片回答，不自动记0分。

## 保存字段

`participant_id`、`session_id`、`task_id`、`scene_id`、`question_id`、`audio_file_path`、`audio_start_time`、`audio_end_time`、`audio_duration`、`model_name`、`model_transcript`、`semantic_summary`、`ai_category`、`ai_score`、`ai_confidence`、`ai_reason`、`need_followup`、`next_action`、`prompt_level`、`api_success`、`api_error`、`human_score`、`human_category`、`human_note`、`human_modified`、`created_at`。

## 已完成检查

- `server.js` 与 `app.js` JavaScript语法检查通过。
- 项目密钥泄漏扫描通过，未写入用户提供的密钥。
- 空录音后端冒烟测试通过：`uncertain_audio → manual_review`，`api_success=false`，未自动记0分。
- 冒烟测试记录已清理。

## 尚需真实密钥验收

由于用户此前粘贴的密钥已暴露，未使用该密钥发起真实模型请求。撤销旧密钥并在本机配置新环境变量后，需依次实测8类回答和人工复核保存。
