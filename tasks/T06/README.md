# T06 小伙伴需要什么：需要识别与支持反应

请通过静态 HTTP 服务打开本目录，以确保视频和音频可以正常连续播放。

示例：`python -m http.server 8060 -d .`

## 数据接口

每次选择会立即写入浏览器 `localStorage` 的 `sel_assessment_T06_records`。宿主若设置 `window.T06_ENDPOINT`，同一条记录还会以 JSON POST 发送到该地址。

前端保存原始选项、反应时和 `full`（完整匹配）、`partial`（部分匹配）、`none`（无匹配）证据类别，不计算单题数值分、情境分或 `T06 = mean(A,B)`。最终情境分由评分系统结合需要识别与行动选择计算。

调试接口：`T06Assessment.getRecords()`、`T06Assessment.clearRecords()`、`T06Assessment.exportRecords()`。
