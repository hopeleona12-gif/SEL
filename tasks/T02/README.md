# T02《我能自己解决吗》Qwen3.5-Omni 语音评分 Demo

实现版本：`T02-V3.8-2026.08.10`

本版本只在情境 B“缺少风车叶片”的开放语音回答节点接入后端多模态评分。现有情境 A、视觉、动画、图片回答和原评分分支保持不变。

## 安全配置

不要把 API Key 写进任何前端或项目文件。请先撤销曾经在聊天、日志或代码中暴露的密钥，再生成新密钥。

在项目根目录 `.env` 中填写新生成的 Key：

```dotenv
DASHSCOPE_API_KEY=你的新Key
```

后端会自动加载项目根目录 `.env`。也可以使用系统环境变量，系统环境变量优先级更高。

启动示例：

```powershell
node server.js
```

随后打开：`http://127.0.0.1:8080/`

不能再用双击 `index.html` 的方式测试AI接口；麦克风和后端API需要通过上述本地服务运行。

## 数据位置

- 浏览器原始录音：`IndexedDB/T02_audio`
- 后端原始录音：`data/audio/`
- AI结果与人工复核：`data/records/*.json`
- 行为与任务数据：浏览器 `localStorage/T02_last_session`

`data/`、`.env` 和 `node_modules/` 已加入 `.gitignore`。

## 研究人员复核面板

完成页点击“研究人员复核”，或在测评页面按 `Ctrl+Shift+R`。面板可播放原始录音、查看模型转写/分类/分数/理由，并单独保存人工分数、分类和备注。人工修改不会覆盖AI原始结果。

## 异常策略

空录音、麦克风失败、API失败、模型JSON无效、`uncertain_audio` 或置信度低于阈值，均进入 `manual_review`，儿童端允许重新录音或改用图片回答，不自动记0分。
