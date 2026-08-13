# 统一眼动模块

独立于 T01-T10 的 WebGazer.js 接入层。首次进入 MASTER 时打开 `calibration.html`，完成一次摄像头授权和 9 点校准。校准成功后，在 T02-B/T05B 的关键场景边界调用：

```js
EyeTracking.startWindow({ taskId: 'T02-B', sceneId: 'missing_material' });
// 场景结束、儿童开始回答前
await EyeTracking.stopWindow();
```

AOI 使用 DOM 属性标记：`data-gaze-aoi="missing_part"`。T02-B 约定 `missing_part/windmill/material_area`；T05B 约定 `original_location/new_location/protagonist/object`。数据写入 IndexedDB `sel-eye-tracking/gaze-sessions`，仅探索分析，不参与计分。`debug.html` 可预览并导出 JSON。
