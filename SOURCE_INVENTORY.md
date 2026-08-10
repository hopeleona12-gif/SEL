# SEL T01–T10 源码盘点与迁移记录

盘点日期：2026-08-11。历史目录未修改；以下是本次选入 MASTER 的版本。

| 任务 | 选定历史目录 | MASTER 入口 | 技术结构/启动 | 版本判断 |
|---|---|---|---|---|
| T01 | `2026-08-08/codex-t01-sel-t01-t01-t01/outputs/t01-module` | `tasks/T01/index.html`（`?part=A/B`） | 静态 HTML；父页面通过 postMessage 接收 `SEL_T01_COMPLETE` | 2026-08-08 最新 T01 模块，已包含 A/B 探针、浏览器录音原型 |
| T02 | `2026-08-05/codex-1-t02-2-3-4/outputs/T02_final` | `tasks/T02/index.html`；`server.js` | Node 静态服务，默认 8080；DashScope/Qwen Omni 语音评分，Key 由环境变量读取 | 2026-08-10 修改的 V3.8/V4 版本；优先于 08-04 的未接真实 ASR 版本 |
| T03 | `2026-07-22/sel-demo-t03-sel-demo-react` | `tasks/T03/frontend/src/main.tsx`；开发入口为 Vite frontend | React/Vite + FastAPI；前端 5173，后端 8000 | 唯一明确的完整 T03 React 项目，含 T03 任务配置、评分和测试 |
| T04 | `2026-08-06/codex-t04-t04-t04-t04-a/outputs/T04_local` | `tasks/T04/index.html` | 静态 HTML/JS/CSS + assets | T04_local 含完整素材且入口独立可运行；未选父项目中的开发壳 |
| T05 | `2026-08-05/t05-codex-1-t05b-2-t05a/outputs/T05-demo` | `tasks/T05/index.html` | 静态 HTML + assets | 目录含完整 A/B 流程和素材，晚于同项目旧版 |
| T06 | `2026-08-05/t06-t06-1-2-t03-t06/outputs/T06` | `tasks/T06/index.html` | 静态 HTML/JS/CSS + assets | 2026-08-10 更新 app.js，入口与资源齐全 |
| T07 | `2026-08-05/t07-t07-1-t03-emoji-2/outputs/T07施测工具_V4_素材四宫格同步修正版` | `tasks/T07/index.html`；`server.js` | Vite/Node 静态服务，含 src/public/runtime | 选择 V4 素材四宫格同步修正版，晚于 V3/V5–V9 候选且有独立启动脚本 |
| T08 | `2026-08-08/files-mentioned-by-the-user-t08/outputs/T08` | `tasks/T08/index.html`；`server.js` | Node 服务，语音 API `/api/voice/score-audio`；`.env.example` | 2026-08-10 更新，明确保留语音服务；未复制真实 `.env` 和 data |
| T09 | `2026-08-06/t09-t09-a-4-b-task/outputs/T09` | `tasks/T09/index.html` | 静态 HTML/JS/CSS + assets；可用任意静态服务器 | 2026-08-10 更新 app.js/index.html，A/B 流程完整 |
| T10 | `2026-08-07/10-t10-t10-a-b-a/outputs/T10测评工具完整版` | `tasks/T10/index.html` | 单页 HTML/JS/CSS + assets | 2026-08-10 更新的完整版，包含 A/B 流程和完成数据 |

## 当前可访问性结论

10 个任务源码均已复制到 `tasks/T01`–`tasks/T10`，历史目录保持不变。MASTER 现在通过 iframe 加载任务，T02/T08 由 MASTER 自动托管子服务；T02/T08 使用 postMessage 完成通知，其他任务使用原有终态 DOM 适配探测。T03 的已构建 dist 也已纳入 MASTER。

## 已知结构性事项

- T02 和 T08 分别保留自己的 Node 服务、语音 API、数据字段和环境变量；没有复制真实 `.env` 或历史运行数据。
- T03 是 React + FastAPI 双服务，不能按静态 HTML 任务直接嵌入。
- T04/T07 也存在独立服务/构建结构；T04 本次选入的是可直接打开的 `T04_local` 静态副本。
- T03 的运行时 API 仍依赖其原 FastAPI 服务；本轮保留其已构建前端，若实际流程访问后端接口，需要额外启动原后端或下一轮增加 MASTER 代理。
- 浏览器级完整点击、摄像头/麦克风权限和控制台验证尚未在当前无浏览器自动化工具的环境中完成。
