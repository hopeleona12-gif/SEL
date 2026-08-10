# T01 自身情绪与原因觉察探针

这是一个可嵌入现有 SEL 任务流程的前端模块原型。宿主系统在 T04/T08 完成并锁定得分后调用：

页面不包含任何自行增加的儿童可见素材。打开后仅显示用户提供的起始帧，点击画面开始播放。`index.html?part=A` 进入 T01-A，`index.html?part=B` 进入 T01-B。

```js
SELT01.start({
  afterTask: 'T04', // 仅允许 T04 或 T08
  scoreLocked: true,
  keyFrame: 'assets/T04关键静帧.png'
})
```

T04 完成后通过 `SEL_RETURN_TO_TASK` 返回主流程；T08 完成后通过 `SEL_ASSESSMENT_COMPLETE` 结束测评。每次完成同时发送 `SEL_T01_COMPLETE`，并写入 `localStorage['sel.t01.records']`。

数据包含 `task/part/emotion/cause/timestamp`，情绪与原因分开计分，P0/P1/P2 保留在各自字段中。语音录音在浏览器权限允许时记录 8 秒，宿主可在 `SEL_T01_COMPLETE` 后接入 ASR 回填 `asr_text` 与音频存储。
