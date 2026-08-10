# T03 运行架构

## 职责边界

### 视频层

- 只呈现不可交互的视觉动画，例如角色进入、场景变化和干扰角色动作。
- 所有 trial 视频必须静音。
- 视频结束事件不决定儿童答案、正确性、反应时间或 trial 结束时间。
- 视频在当前 trial 组件卸载时自然停止；trial 生命周期由网页控制。

### 网页测评层

- 从任务配置读取 trial 顺序和时间参数。
- 使用纯背景图或静音短视频作为场景层。
- 独立呈现灰色/黄色星星刺激层和透明点击热区。
- 独立播放 dong/ding 音频。
- 仅在音频实际触发 `playing` 后开放点击窗口并开始反应计时。
- 记录第一次有效点击；窗口结束仍未点击则记录 `no_click`。
- 保存 stimulus onset、sound onset、response time 和 reaction time。
- 完成当前 trial 数据保存和间隔后，才开始下一 trial。

## Trial 状态机

```text
loading
  -> condition_transition（仅条件变化时）
  -> pre_stimulus
  -> response（音频 playing 后）
  -> saving
  -> inter_trial
  -> next trial / complete
```

发生音频或素材加载错误时进入 `error`，当前 trial 不会作为有效反应保存。

## 主要实现

- `frontend/src/engine/assetPreloader.ts`：测评素材预加载。
- `frontend/src/engine/useTrialRunner.ts`：trial 状态机、音频和计时。
- `frontend/src/components/TrialScene.tsx`：视频背景、网页星星及点击热区。
- `frontend/src/components/DoubleBufferedVideo.tsx`：固定双视频层；当前 trial 播放期间将下一条干扰视频装入备用层并解码首帧，切换时交叉淡入淡出。
- 条件过渡使用场景上方的覆盖层，`TrialScene` 以及 videoA/videoB 始终挂载，进入干扰 Block 时不会重建视频节点。
- T03 v1.2.0 时间线：灰色星星呈现后等待 500ms；声音实际开始时开启 2500ms 反应窗口；记录完成后隐藏星星并保持背景/干扰场景 800ms。
- T03 V3 时间线：灰星呈现 300ms 后播放听觉刺激；声音素材自然播放，不在运行时强制截断；音频实际 `playing` 时记录 `sound_onset` 并开放 1500ms 反应窗口；ITI 在 500–800ms 内随机。星星只在儿童点击后由灰色变为黄色。
- V3 的 `dong.mp3` 与 `ding.mp3` 已在素材层去除多余静音并裁至约 500ms；运行时仍让文件自然播放，避免再次出现定时暂停截断有效声音的问题。
- T03 v3.1.0 接入补充语音素材：练习引导、练习完成、正式测评开始和练习正确反馈均优先播放任务配置中的 MP3，媒体播放结束后才继续；加载失败时回退到浏览器中文语音。
- 补充素材原始4个文件的解码音频相同，均为9.43秒合并语音；已按内容切割。练习开始页播放练习引导，“答对啦”只在练习题答对时播放；正式开始页面仅播放正式开始提示，结束后才开放正式测评按钮。“你已经学会啦”不在任务中播放。
- V3 正式试次为 9 个 Go、3 个 No-Go（75%/25%）；练习保留 2 题并显示正确性反馈，正式阶段不显示正确、错误或得分。
- `frontend/src/assessment/TrialsPage.tsx`：练习/正式阶段页面组合。
- `tasks/T03.json`：trial、素材和时间配置。

## 干扰视频双缓冲

干扰阶段始终保留 `videoA` 和 `videoB` 两个静音层：

```text
当前层继续播放
  -> 非活动层加载下一trial视频
  -> loadeddata（首帧已解码）
  -> 非活动层开始播放
  -> 140ms透明度切换
  -> 暂停旧层
```

trial变化时不销毁video元素。视频切换只影响视觉层，不改变声音开始、点击窗口、RT或数据保存时间。
