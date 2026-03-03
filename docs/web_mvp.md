# Web MVP Runbook

## 1) 兩個終端機啟動方式

### Terminal A（Worker）

```bash
npm run jobs:worker
```

### Terminal B（Web）

```bash
cd apps/web
npm run dev
```

開啟：`http://localhost:3000`

## 2) 主要操作流程

1. 進入 `/projects/new` 建立專案。
2. 在 `/projects/[id]` 觸發：
   - `Run Rulebook`
   - `Run from PDF`（先上傳 PDF）
   - `Apply Patch`
   - `Run Sim`
3. 進入 `/runs/[runId]` 查看狀態、logs、artifact links。
4. 進入 `/replays/[replayId]` 查看 step 與 diff。

## 3) Artifacts 位置

### Jobs store

- `artifacts/jobs/projects.json`
- `artifacts/jobs/runs.json`
- `artifacts/jobs/queue.json`

### 一般 run 產物

- `artifacts/jobs/<runId>/manifest.json`
- `artifacts/jobs/<runId>/logs.txt`
- `artifacts/jobs/<runId>/*.json`

### PDF run 產物

- `artifacts/projects/<projectId>/uploads/<uploadId>.pdf`
- `artifacts/projects/<projectId>/uploads/<uploadId>.extracted.txt`
- `artifacts/projects/<projectId>/runs/<runId>/manifest.json`
- `artifacts/projects/<projectId>/runs/<runId>/*.json`

## 4) 常見問題排除

1. Run 一直停在 `queued`
   - 確認 worker 在跑：`npm run jobs:worker`
   - 檢查 `artifacts/jobs/queue.json`
2. Worker 啟動後馬上退出
   - 檢查是否誤加 `--once`
3. Lock 檔案卡住
   - 停 worker 後檢查 `artifacts/jobs/store.lock`
   - 再啟動 worker 讓 stale lock recovery 生效
4. Replay 連結不存在
   - 先完成 `Run Sim` 或含 replay 的 run
5. 快速健康檢查
   - `npm run jobs:smoke`
