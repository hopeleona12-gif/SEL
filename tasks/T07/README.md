# T07《加入小伙伴：同伴进入与回应调整》Demo

## 启动

本工具与其他 SEL 任务采用相同的本地项目交付方式，不直接打开 HTML。

Windows 双击 `启动T07施测工具.bat`，程序会使用压缩包内置运行时并自动打开：

```text
http://127.0.0.1:4177
```

不需要另外安装 Node.js。开发人员也可以在项目目录运行 `npm start`。

## 已实现

- 两个完整情境：A 搭城堡、B 画森林海报。
- 每个情境固定流程：观察活动 → 加入选择 → 标准化重置 → 固定同伴回应 → 调整选择。
- 第一次作答不会改变同伴回应或后续剧情；A、B 各自只有一段固定回应。
- 四个选项直接出现在 16:9 场景内，没有底部 emoji 按钮或独立问答页。
- 每题四段等时长（2.4 秒循环）的动作动画；无对错提示、无正确项变色、无评价性反馈。
- P0/P1/P2 提示：每 8 秒无作答自动升级；P1 原题重复，P2 逐项中性朗读。
- 每次作答即时写入浏览器 `localStorage`；完成后可导出完整 JSON。
- 情境分按脚本计算，最终 `T07=mean(A,B)`。

## 运行

开发模式需要先安装依赖：

```bash
npm install
npm run dev
```

浏览器打开终端显示的地址。生产构建：

```bash
npm run build
npm run preview
```

## 数据字段

每次作答保存以下字段：

| 字段 | 类型 | 含义 |
|---|---|---|
| `task_id` | `"T07"` | 固定任务编号 |
| `condition` | `"A" \| "B"` | A 城堡；B 海报 |
| `phase` | `"entry" \| "adjustment"` | 加入或回应后调整 |
| `selected_option` | `1 \| 2 \| 3 \| 4` | 儿童选择的选项 |
| `correctness` | `boolean` | 选项是否适切（两个阶段均为选项 1） |
| `prompt_level` | `"P0" \| "P1" \| "P2"` | 作答发生时的提示等级 |
| `reaction_time` | `number` | 当前提示完整呈现后到作答的毫秒数 |
| `timeout` | `boolean` | 该题是否曾因超时升级提示 |
| `answered_at` | ISO 8601 字符串 | 作答时间 |

完成记录还包含：

- `condition_scores.A`、`condition_scores.B`：每个情境 0–2 分。
- `task_score`：A、B 均值，范围 0–2。
- `scoring_formula`：固定为 `T07=mean(A,B)`。

浏览器存储键：`SEL_T07_responses`（逐次作答）和 `SEL_T07_result`（最终结果）。完成结果同时写入项目内的 `data/sessions/`。

## 计分逻辑

每个情境的 entry 和 adjustment 均适切，且两次都在 P0/P1 完成，情境得 2 分；只有一步适切，或两步适切但至少一次在 P2 完成，情境得 1 分；两步均不适切得 0 分。Demo 不以同伴最终是否接受儿童计分。

## 素材与替换

当前交付为可运行的交互 Demo，场景与角色使用无外部依赖的内置矢量占位绘制，包含泡泡狗、小兔、小熊和左手星星手环儿童，不增加角色。正式美术素材到位后，可在不改变 `taskConfig.ts`、状态流程和计分模块的前提下替换 `SceneArt` 与 `Character` 的视觉层。

## 关键源码

- `src/App.tsx`：沿用 T03 的“阶段状态机 + 场景内交互 + 即时保存”思路，实现暂停节点与标准化流程。
- `src/taskConfig.ts`：两情境固定脚本、问题、选项和时长。
- `src/scoring.ts`：独立计分函数。
- `src/types.ts`：数据字段定义。
