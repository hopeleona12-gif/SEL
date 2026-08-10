# SEL 共用语音能力

本目录用于 T01、T02、T08 共用的语音评分链路。

- `voice-client.js`：浏览器录音、语音转写辅助、WAV转换、API请求和人工复核客户端。
- `voice-scoring-service.js`：后端JSON解析与校验、异常转人工复核、录音/评分记录保存、人工复核保存。
- `t02-voice-policy.js`：仅属于T02的业务分支，不放入通用评分服务。

接入新任务时应复用前两个文件，并单独提供该任务的评分Prompt和业务分支策略，避免把T02规则复制到T01或T08。

通用接口：

- `POST /api/voice/score-audio`
- `GET /api/voice/reviews?task_id=T02`
- `POST /api/voice/reviews/:id`

API Key只由后端环境变量 `DASHSCOPE_API_KEY` 读取。
