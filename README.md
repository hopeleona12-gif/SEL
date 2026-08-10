# SEL_ASSESSMENT_MASTER

本目录是 T01–T10 的独立整理副本。历史项目均保留在原日期目录，MASTER 内未安装 `node_modules`，也未复制真实 `.env`、API Key 或历史运行数据。

## 启动

在本目录执行（系统需有 Node.js 18+ 和 Python 3.12+）：

```powershell
npm run start
```

打开 `http://127.0.0.1:4170/`。MASTER 会自动启动 T02（8081）、T03 FastAPI（8000）和 T08（8082）子服务；不要关闭 MASTER 进程。若 Python 不在 PATH，可先设置 `$env:SEL_PYTHON='你的python.exe完整路径'`。T02/T08 的 API Key 仍通过各自环境变量配置，不写入前端。

## 当前状态

- 已纳入 T01–T10 全部真实源码和素材。
- 已迁移上一轮总控骨架：`index.html`、`app.js`、`taskManager.js`、`taskAdapters.js`、`styles.css`。
- 固定流程骨架仍为：`T02 → T03 → T04 → T01-A → T06 → T05 → T07 → T08 → T01-B → T09 → T10`。
- 本轮没有修改任务内容、评分、T02/T08 语音实现或接入眼动。
- 已增加统一 iframe 加载、固定顺序调度、T02/T08 子服务自动启动和任务完成适配；详见 `SOURCE_INVENTORY.md`。

## 各任务独立启动

请先按 `SOURCE_INVENTORY.md` 中的入口启动对应任务。T02/T08 需要各自 Node 服务和环境变量；T03 需要前后端两个服务；T04/T07 可能需要其项目服务脚本。MASTER 当前是源码汇总目录，不声称已经完成跨端口自动调度。
