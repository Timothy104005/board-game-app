# 產品化規格（Productization）

本文件描述目前可運行拓撲與未來 SaaS 化方向。

## 1) 目前運行拓撲（Local Dev）

- Terminal A：`npm run jobs:worker`
- Terminal B：`cd apps/web && npm run dev`
- Web 透過 Route Handlers/Server Actions enqueue 任務。
- Worker 消化 queue，寫入 manifest/log/artifacts。

## 2) 未來 SaaS 拓撲（Planned）

- Web/API 層與 worker 層可分離部署。
- Queue 與 artifact storage 可替換成託管服務。
- 保留 deterministic run 契約與 manifest 結構。

## 3) 非功能需求（NFR）

- Determinism：固定 seed 下結果可重現。
- Auditability：每個 run 要有 `manifest.json` + `logs.txt`。
- Privacy：上傳規則內容僅限本系統使用，不對外再散布。
- Reliability：worker 重啟後可回收中斷任務並繼續處理。

## 4) 驗證命令

- `npm run jobs:smoke`
- `npm run verify:schoolday`
- `cd apps/web && npm test`
